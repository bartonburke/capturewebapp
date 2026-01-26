/**
 * LLM Synthesis Module
 *
 * Uses OpenAI/Claude to perform cross-photo intelligence:
 * - Entity deduplication (same item in multiple photos)
 * - Location hierarchy extraction
 * - Coverage analysis
 */

import OpenAI from 'openai';
import {
  ProjectType,
  PhotoAnalysis,
  Transcript,
  EntityCluster,
  LocationNode,
  CoverageAnalysis,
} from '@/app/lib/types';
import { GraphSynthesisData } from './graph-queries';
import { SynthesisConfig } from './configs';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface LLMSynthesisInput {
  projectType: ProjectType;
  photoAnalyses: PhotoAnalysis[];
  transcript: Transcript;
  graphData: GraphSynthesisData | null;
  config?: SynthesisConfig;
}

export interface LLMSynthesisResult {
  entityClusters: EntityCluster[];
  locationHierarchy: LocationNode[];
  coverageAnalysis: CoverageAnalysis;
  model: string;
}

/**
 * Run multi-stage LLM synthesis
 */
export async function runLLMSynthesis(input: LLMSynthesisInput): Promise<LLMSynthesisResult> {
  const { projectType, photoAnalyses, transcript, graphData, config } = input;
  const model = 'gpt-4o-mini';

  console.log(`[LLMSynthesis] Starting synthesis for ${photoAnalyses.length} photos`);

  // Stage 1: Entity deduplication
  const entityClusters = await deduplicateEntities(photoAnalyses, transcript, model);

  // Stage 2: Location hierarchy extraction
  const locationHierarchy = await extractLocationHierarchy(photoAnalyses, transcript, model);

  // Stage 3: Coverage analysis
  const coverageAnalysis = await analyzeCoverage(photoAnalyses, transcript, locationHierarchy, model);

  return {
    entityClusters,
    locationHierarchy,
    coverageAnalysis,
    model,
  };
}

/**
 * Stage 1: Identify when the same item appears across multiple photos
 */
async function deduplicateEntities(
  photoAnalyses: PhotoAnalysis[],
  transcript: Transcript,
  model: string
): Promise<EntityCluster[]> {
  // Build a compact representation of all entities
  const entitySummaries: string[] = [];
  for (const analysis of photoAnalyses) {
    const photoSummary = {
      photoId: analysis.photoId,
      description: analysis.vlmDescription,
      items: analysis.entities.filter(e => e.type === 'item').map(e => e.description),
      locations: analysis.entities.filter(e => e.type === 'location').map(e => e.description),
      tags: analysis.catalogTags,
    };
    entitySummaries.push(JSON.stringify(photoSummary));
  }

  const prompt = `You are analyzing a home inventory photo session to find duplicate items across photos.

Given these photo analyses:
${entitySummaries.join('\n')}

Identify clusters of photos that show THE SAME ITEM. Items might be:
- The same physical object photographed multiple times
- Items mentioned in multiple photos (e.g., "extension cords" in garage AND basement)
- Items that appear in the same container/location

Return a JSON array of clusters:
[
  {
    "canonicalName": "Extension cords",
    "entityType": "item",
    "photoIds": ["photo-id-1", "photo-id-2"],
    "descriptions": ["Orange extension cord on shelf", "White extension cord in bin"],
    "mergedDescription": "Extension cords stored in garage (shelf) and basement (bin)",
    "confidence": 0.9
  }
]

Rules:
- Only cluster items that are truly the same or closely related
- Don't cluster generic items like "stuff" or "misc"
- Include single-photo items as clusters of 1 if notable
- confidence: 0.9+ for certain matches, 0.7-0.9 for likely, 0.5-0.7 for possible

Return ONLY valid JSON array, no explanation.`;

  try {
    const response = await openai.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content || '{"clusters":[]}';
    const parsed = JSON.parse(content);
    const clusters = parsed.clusters || parsed || [];

    // Add cluster IDs
    return clusters.map((c: any, i: number) => ({
      clusterId: `cluster-${i + 1}`,
      canonicalName: c.canonicalName || 'Unknown',
      entityType: c.entityType || 'item',
      photoIds: c.photoIds || [],
      descriptions: c.descriptions || [],
      mergedDescription: c.mergedDescription || c.canonicalName,
      locations: c.locations || [],
      confidence: c.confidence || 0.7,
    }));

  } catch (error) {
    console.error('[LLMSynthesis] Entity deduplication failed:', error);
    return [];
  }
}

/**
 * Stage 2: Extract location hierarchy from photos
 */
async function extractLocationHierarchy(
  photoAnalyses: PhotoAnalysis[],
  transcript: Transcript,
  model: string
): Promise<LocationNode[]> {
  // Collect all location-related data
  const locationData: string[] = [];
  for (const analysis of photoAnalyses) {
    const locations = analysis.entities.filter(e =>
      e.type === 'location' || e.type === 'container'
    );
    const roomTags = analysis.catalogTags.filter(t =>
      ['kitchen', 'bedroom', 'bathroom', 'garage', 'basement', 'attic',
       'living_room', 'dining_room', 'office', 'closet', 'pantry', 'laundry'].includes(t)
    );
    const containerTags = analysis.catalogTags.filter(t =>
      ['drawer', 'shelf', 'cabinet', 'bin', 'box', 'container'].includes(t)
    );

    locationData.push(JSON.stringify({
      photoId: analysis.photoId,
      description: analysis.vlmDescription,
      locationEntities: locations.map(l => l.description),
      roomTags,
      containerTags,
    }));
  }

  const prompt = `You are building a location hierarchy from home inventory photos.

Photo location data:
${locationData.join('\n')}

Build a hierarchical tree of locations mentioned in these photos.
Structure: room → area → container → spot

Return a JSON array of location nodes:
[
  {
    "name": "Kitchen",
    "level": "room",
    "parentId": null,
    "photoIds": ["photo-1", "photo-2"],
    "itemCount": 5
  },
  {
    "name": "Counter by stove",
    "level": "area",
    "parentId": "kitchen",
    "photoIds": ["photo-1"],
    "itemCount": 2
  },
  {
    "name": "Junk drawer",
    "level": "container",
    "parentId": "kitchen",
    "photoIds": ["photo-2"],
    "itemCount": 3
  }
]

Rules:
- Use lowercase IDs (e.g., "kitchen", "garage")
- Link children to parents via parentId
- Count items visible in photos at each location
- level: room > area > container > shelf > spot

Return ONLY valid JSON array, no explanation.`;

  try {
    const response = await openai.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content || '{"locations":[]}';
    const parsed = JSON.parse(content);
    const locations = parsed.locations || parsed || [];

    // Add IDs and normalize
    return locations.map((loc: any, i: number) => ({
      id: loc.id || loc.name?.toLowerCase().replace(/\s+/g, '_') || `loc-${i + 1}`,
      name: loc.name || 'Unknown',
      level: loc.level || 'other',
      parentId: loc.parentId || undefined,
      photoIds: loc.photoIds || [],
      itemCount: loc.itemCount || 0,
    }));

  } catch (error) {
    console.error('[LLMSynthesis] Location extraction failed:', error);
    return [];
  }
}

/**
 * Stage 3: Analyze coverage - what's missing?
 */
async function analyzeCoverage(
  photoAnalyses: PhotoAnalysis[],
  transcript: Transcript,
  locationHierarchy: LocationNode[],
  model: string
): Promise<CoverageAnalysis> {
  const photographedLocations = locationHierarchy
    .filter(l => l.level === 'room')
    .map(l => l.name);

  const prompt = `You are analyzing coverage of a home inventory session.

Transcript of what was said during capture:
"${transcript.fullText.substring(0, 2000)}"

Rooms/locations that have photos:
${photographedLocations.join(', ')}

Number of photos taken: ${photoAnalyses.length}

Analyze:
1. What locations were MENTIONED in the transcript but NOT photographed?
2. What locations have photos?
3. What should be captured next?
4. Overall completeness score (0-1)

Return JSON:
{
  "mentionedLocations": ["kitchen", "garage", "attic"],
  "photographedLocations": ["kitchen", "garage"],
  "missingLocations": ["attic"],
  "suggestedFollowups": ["Document attic storage", "Complete bathroom cabinets"],
  "completenessScore": 0.75
}

Return ONLY valid JSON, no explanation.`;

  try {
    const response = await openai.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);

    return {
      mentionedLocations: parsed.mentionedLocations || [],
      photographedLocations: parsed.photographedLocations || photographedLocations,
      missingLocations: parsed.missingLocations || [],
      suggestedFollowups: parsed.suggestedFollowups || [],
      completenessScore: parsed.completenessScore || 0.5,
    };

  } catch (error) {
    console.error('[LLMSynthesis] Coverage analysis failed:', error);
    return {
      mentionedLocations: [],
      photographedLocations,
      missingLocations: [],
      suggestedFollowups: [],
      completenessScore: 0.5,
    };
  }
}
