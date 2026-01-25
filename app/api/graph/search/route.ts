/**
 * POST /api/graph/search
 *
 * Natural language search over the photo graph
 * Translates NL queries to Cypher via LLM, executes against Neo4j
 *
 * Supports both OpenAI and Claude providers (defaults to OpenAI)
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { runQuery } from '@/app/lib/neo4j';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// System prompt for NL→Cypher translation
// Build system prompt with optional session filter context
function buildSystemPrompt(sessionId?: string): string {
  const sessionFilter = sessionId
    ? `\n\nIMPORTANT: All queries MUST filter by sessionId = '${sessionId}'. Add this WHERE clause to every query.`
    : '';

  const sessionExamples = sessionId
    ? `

Q: "all photos" (with sessionId filter)
A: MATCH (p:Photo) WHERE p.sessionId = '${sessionId}' RETURN p LIMIT 50

Q: "photos with AOCs" (with sessionId filter)
A: MATCH (p:Photo)-[:SHOWS]->(e:Entity) WHERE p.sessionId = '${sessionId}' AND e.entityType = 'AOC' RETURN p, e`
    : '';

  return `You are a Cypher query generator for a photo graph database.

Schema:
- (:Photo {id, timestamp, location: point, vlmDescription, catalogTags: [string], imageUrl, sessionId, recPotential, confidence})
- (:Entity {id, entityType, description, severity, sessionId})
- (Photo)-[:SHOWS {confidence}]->(Entity)

Entity types: REC, AOC, Feature, Condition, Observation
Severity levels: high, medium, low, info
recPotential levels: high, medium, low, none

Spatial functions:
- point.distance(p.location, point({latitude: $lat, longitude: $lng})) returns distance in meters
- point({latitude: $lat, longitude: $lng}) creates a point

Text search:
- Use CONTAINS for partial text matching (case-sensitive)
- Use toLower() for case-insensitive: toLower(p.vlmDescription) CONTAINS toLower('search term')
${sessionFilter}

Given a natural language query, generate ONLY the Cypher query. No explanation, no markdown, no backticks.

Examples:

Q: "all photos"
A: MATCH (p:Photo) RETURN p LIMIT 50

Q: "photos near 37.7749, -122.4194"
A: MATCH (p:Photo) WHERE point.distance(p.location, point({latitude: 37.7749, longitude: -122.4194})) < 500 RETURN p

Q: "photos showing staining"
A: MATCH (p:Photo) WHERE toLower(p.vlmDescription) CONTAINS 'staining' RETURN p

Q: "photos with AOCs"
A: MATCH (p:Photo)-[:SHOWS]->(e:Entity) WHERE e.entityType = 'AOC' RETURN p, e

Q: "high severity findings"
A: MATCH (p:Photo)-[:SHOWS]->(e:Entity) WHERE e.severity = 'high' RETURN p, e

Q: "photos within 100m of 33.725, -118.305"
A: MATCH (p:Photo) WHERE point.distance(p.location, point({latitude: 33.725, longitude: -118.305})) < 100 RETURN p

Q: "environmental concerns"
A: MATCH (p:Photo)-[:SHOWS]->(e:Entity) WHERE e.entityType IN ['REC', 'AOC'] OR e.severity IN ['high', 'medium'] RETURN p, e

Q: "photos showing drains or pipes"
A: MATCH (p:Photo) WHERE toLower(p.vlmDescription) CONTAINS 'drain' OR toLower(p.vlmDescription) CONTAINS 'pipe' RETURN p
${sessionExamples}

Always include LIMIT 50 if no limit is specified to prevent large result sets.`;
}

interface SearchResult {
  photo: {
    id: string;
    imageUrl: string;
    timestamp: string;
    location: { latitude: number; longitude: number } | null;
    vlmDescription: string;
    recPotential: string;
  };
  entities: Array<{
    entityType: string;
    description: string;
    severity: string;
  }>;
}

interface SearchResponse {
  success: boolean;
  results: SearchResult[];
  cypherQuery: string;
  executionTimeMs: number;
  error?: string;
}

/**
 * Generate Cypher query from natural language using OpenAI
 */
async function generateCypherWithOpenAI(query: string, sessionId?: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 500,
    messages: [
      {
        role: 'system',
        content: buildSystemPrompt(sessionId),
      },
      {
        role: 'user',
        content: query,
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from OpenAI');
  }

  // Clean up any markdown formatting
  return content
    .trim()
    .replace(/^```cypher\n?/i, '')
    .replace(/^```\n?/i, '')
    .replace(/\n?```$/i, '')
    .trim();
}

export async function POST(req: NextRequest): Promise<NextResponse<SearchResponse>> {
  const startTime = Date.now();

  try {
    const body = await req.json();
    const { query, sessionId } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        {
          success: false,
          results: [],
          cypherQuery: '',
          executionTimeMs: 0,
          error: 'Query string is required',
        },
        { status: 400 }
      );
    }

    console.log(`[GraphSearch] Query: "${query}"${sessionId ? ` (sessionId: ${sessionId})` : ''}`);

    // Step 1: Translate NL to Cypher using OpenAI (with optional session filter)
    const cypherQuery = await generateCypherWithOpenAI(query, sessionId);

    console.log(`[GraphSearch] Generated Cypher: ${cypherQuery}`);

    // Step 2: Execute Cypher against Neo4j
    const result = await runQuery(cypherQuery);

    // Step 3: Transform results
    const results: SearchResult[] = [];
    const seenPhotoIds = new Set<string>();

    for (const record of result.records) {
      // Extract photo node (could be 'p' or other variable name)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const photoNode = record.get('p') as { properties: Record<string, any> } | null;

      if (!photoNode || seenPhotoIds.has(photoNode.properties.id)) {
        continue;
      }

      seenPhotoIds.add(photoNode.properties.id);

      const photoProps = photoNode.properties;

      // Extract location from Neo4j point type
      let location: { latitude: number; longitude: number } | null = null;
      if (photoProps.location) {
        location = {
          latitude: photoProps.location.y, // Neo4j point: y = latitude
          longitude: photoProps.location.x, // Neo4j point: x = longitude
        };
      }

      // Collect entities for this photo
      const entities: SearchResult['entities'] = [];

      // Try to get entity from record if it exists
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const entityNode = record.get('e') as { properties: Record<string, any> } | null;
        if (entityNode) {
          entities.push({
            entityType: entityNode.properties.entityType,
            description: entityNode.properties.description,
            severity: entityNode.properties.severity,
          });
        }
      } catch {
        // No entity in this record, that's fine
      }

      results.push({
        photo: {
          id: photoProps.id,
          imageUrl: photoProps.imageUrl,
          timestamp: photoProps.timestamp,
          location,
          vlmDescription: photoProps.vlmDescription,
          recPotential: photoProps.recPotential,
        },
        entities,
      });
    }

    const executionTimeMs = Date.now() - startTime;

    console.log(`[GraphSearch] Found ${results.length} photos in ${executionTimeMs}ms`);

    return NextResponse.json({
      success: true,
      results,
      cypherQuery,
      executionTimeMs,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[GraphSearch] Error:', errorMessage);

    return NextResponse.json(
      {
        success: false,
        results: [],
        cypherQuery: '',
        executionTimeMs: Date.now() - startTime,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
