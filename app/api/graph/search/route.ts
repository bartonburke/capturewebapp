/**
 * POST /api/graph/search
 *
 * Natural language search over the photo graph.
 * Translates NL queries to Cypher via LLM, executes against Neo4j.
 *
 * Now schema-driven: accepts optional `projectType` to generate a
 * project-type-aware system prompt from the SearchSchema config.
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { runQuery } from '@/app/lib/neo4j';
import { ProjectType } from '@/app/lib/types';
import {
  getSearchSchema,
  buildSystemPrompt,
  SearchSchema,
} from '@/app/lib/synthesis/configs';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
  locations?: Array<{
    name: string;
    level: string;
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
async function generateCypherWithOpenAI(query: string, sessionId?: string, searchSchema?: SearchSchema): Promise<string> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 500,
    messages: [
      {
        role: 'system',
        content: buildSystemPrompt(sessionId, searchSchema),
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
    const { query, sessionId, projectType } = body;

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

    console.log(`[GraphSearch] Query: "${query}"${sessionId ? ` (sessionId: ${sessionId})` : ''}${projectType ? ` (type: ${projectType})` : ''}`);

    // Look up search schema for this project type
    const searchSchema = projectType
      ? getSearchSchema(projectType as ProjectType)
      : undefined;

    // Step 1: Translate NL to Cypher using OpenAI (with type-aware schema)
    const cypherQuery = await generateCypherWithOpenAI(query, sessionId, searchSchema);

    console.log(`[GraphSearch] Generated Cypher: ${cypherQuery}`);

    // Step 2: Execute Cypher against Neo4j
    const result = await runQuery(cypherQuery);

    // Step 3: Transform results
    const results: SearchResult[] = [];
    const seenPhotoIds = new Set<string>();

    for (const record of result.records) {
      // Extract photo node (could be 'p' or other variable name)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let photoNode: { properties: Record<string, any> } | null = null;
      try {
        photoNode = record.get('p') as typeof photoNode;
      } catch {
        // No photo node in this record
        continue;
      }

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
        // No entity in this record — expected for inventory queries
      }

      // Collect items (aliased as 'i' in inventory queries)
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const itemNode = record.get('i') as { properties: Record<string, any> } | null;
        if (itemNode) {
          entities.push({
            entityType: itemNode.properties.entityType || 'item',
            description: itemNode.properties.name || itemNode.properties.description,
            severity: 'info',
          });
        }
      } catch {
        // No item node — expected for non-inventory queries
      }

      // Collect locations (aliased as 'l' or 'c' in inventory queries)
      const locations: SearchResult['locations'] = [];
      for (const varName of ['l', 'c']) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const locNode = record.get(varName) as { properties: Record<string, any> } | null;
          if (locNode) {
            locations.push({
              name: locNode.properties.name,
              level: locNode.properties.level,
            });
          }
        } catch {
          // Variable not in this record
        }
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
        ...(locations.length > 0 ? { locations } : {}),
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
