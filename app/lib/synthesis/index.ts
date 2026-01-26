/**
 * Session Synthesis Module
 *
 * Orchestrates cross-photo intelligence gathering after individual photo analysis.
 * Combines LLM reasoning with optional Neo4j graph queries to produce
 * project-type-specific deliverables.
 */

import {
  ProjectType,
  SessionSynthesis,
  PhotoAnalysis,
  Transcript,
  EntityCluster,
  LocationNode,
  SearchIndexEntry,
  CoverageAnalysis,
  SynthesisDeliverable,
} from '@/app/lib/types';
import { queryGraphForSynthesis, GraphSynthesisData } from './graph-queries';
import { runLLMSynthesis, LLMSynthesisResult } from './llm-synthesis';
import { generateDeliverables } from './deliverables';
import { SYNTHESIS_CONFIGS } from './configs';

export interface SynthesisInput {
  sessionId: string;
  projectId: string;
  projectType: ProjectType;
  photoAnalyses: PhotoAnalysis[];
  transcript: Transcript;
}

/**
 * Main synthesis orchestrator
 *
 * Flow:
 * 1. Try to query Neo4j graph for enriched data
 * 2. Fall back to IndexedDB-only if graph unavailable
 * 3. Run LLM synthesis stages (deduplication, location extraction)
 * 4. Generate project-type-specific deliverables
 */
export async function synthesizeSession(input: SynthesisInput): Promise<SessionSynthesis> {
  const { sessionId, projectId, projectType, photoAnalyses, transcript } = input;
  const startTime = Date.now();

  console.log(`[Synthesis] Starting for session ${sessionId}, type: ${projectType}`);

  // Get synthesis config for this project type
  const config = SYNTHESIS_CONFIGS[projectType];
  if (!config) {
    console.warn(`[Synthesis] No config for project type ${projectType}, using generic`);
  }

  // Step 1: Try to get graph data (graceful fallback if unavailable)
  let graphData: GraphSynthesisData | null = null;
  let synthesisMethod: 'graph' | 'indexeddb' = 'indexeddb';

  try {
    graphData = await queryGraphForSynthesis(sessionId);
    if (graphData) {
      synthesisMethod = 'graph';
      console.log(`[Synthesis] Graph data loaded: ${graphData.photos.length} photos, ${graphData.entities.length} entities`);
    }
  } catch (error) {
    console.warn('[Synthesis] Graph query failed, falling back to IndexedDB-only:', error);
  }

  // Step 2: Run LLM synthesis (entity clustering, location extraction)
  const llmResult = await runLLMSynthesis({
    projectType,
    photoAnalyses,
    transcript,
    graphData,
    config,
  });

  // Step 3: Generate deliverables
  const deliverables = await generateDeliverables({
    projectType,
    photoAnalyses,
    transcript,
    entityClusters: llmResult.entityClusters,
    locationHierarchy: llmResult.locationHierarchy,
    coverageAnalysis: llmResult.coverageAnalysis,
    config,
  });

  // Build search index from all extracted data
  const searchIndex = buildSearchIndex(
    photoAnalyses,
    llmResult.entityClusters,
    llmResult.locationHierarchy
  );

  const synthesis: SessionSynthesis = {
    id: crypto.randomUUID(),
    sessionId,
    createdAt: new Date().toISOString(),
    projectType,
    entityClusters: llmResult.entityClusters,
    locationHierarchy: llmResult.locationHierarchy,
    searchIndex,
    coverageAnalysis: llmResult.coverageAnalysis,
    deliverables,
    synthesisMethod,
    llmModel: llmResult.model,
  };

  const elapsed = Date.now() - startTime;
  console.log(`[Synthesis] Complete in ${elapsed}ms: ${deliverables.length} deliverables, ${llmResult.entityClusters.length} clusters`);

  return synthesis;
}

/**
 * Build search index from synthesis results
 */
function buildSearchIndex(
  photoAnalyses: PhotoAnalysis[],
  entityClusters: EntityCluster[],
  locationHierarchy: LocationNode[]
): SearchIndexEntry[] {
  const index: SearchIndexEntry[] = [];
  const termMap = new Map<string, SearchIndexEntry>();

  // Index items from entity clusters
  for (const cluster of entityClusters) {
    const term = cluster.canonicalName.toLowerCase();
    if (!termMap.has(term)) {
      termMap.set(term, {
        term,
        type: cluster.entityType === 'location' ? 'location' :
              cluster.entityType === 'container' ? 'container' : 'item',
        matches: [],
      });
    }
    const entry = termMap.get(term)!;
    for (const photoId of cluster.photoIds) {
      entry.matches.push({
        photoId,
        clusterId: cluster.clusterId,
        relevance: cluster.confidence,
        context: cluster.mergedDescription,
      });
    }
  }

  // Index locations
  for (const loc of locationHierarchy) {
    const term = loc.name.toLowerCase();
    if (!termMap.has(term)) {
      termMap.set(term, {
        term,
        type: 'location',
        matches: [],
      });
    }
    const entry = termMap.get(term)!;
    for (const photoId of loc.photoIds) {
      entry.matches.push({
        photoId,
        relevance: 1.0,
        context: `${loc.level}: ${loc.name}`,
      });
    }
  }

  // Index catalog tags from photos
  for (const analysis of photoAnalyses) {
    for (const tag of analysis.catalogTags) {
      const term = tag.toLowerCase();
      if (!termMap.has(term)) {
        termMap.set(term, {
          term,
          type: 'tag',
          matches: [],
        });
      }
      const entry = termMap.get(term)!;
      entry.matches.push({
        photoId: analysis.photoId,
        relevance: 0.8,
      });
    }
  }

  return Array.from(termMap.values());
}

// Re-export for external use
export { queryGraphForSynthesis } from './graph-queries';
export { runLLMSynthesis } from './llm-synthesis';
export { generateDeliverables } from './deliverables';
export { SYNTHESIS_CONFIGS } from './configs';
