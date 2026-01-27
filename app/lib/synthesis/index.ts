/**
 * Session Synthesis Module
 *
 * Orchestrates cross-photo intelligence gathering after individual photo analysis.
 * Combines LLM reasoning with optional Neo4j graph queries to produce
 * project-type-specific deliverables.
 */

import type {
  ProjectType,
  SessionSynthesis,
  PhotoAnalysis,
  Transcript,
} from '@/app/lib/types';
import { queryGraphForSynthesis, GraphSynthesisData } from './graph-queries';
import { runLLMSynthesis, LLMSynthesisResult } from './llm-synthesis';
import { generateDeliverables } from './deliverables';
import { SYNTHESIS_CONFIGS } from './configs';
import { buildSearchIndex } from './search-index';

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
    llmResult.locationHierarchy,
    config?.searchSchema
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

// Re-export for external use
export { buildSearchIndex } from './search-index';
export { queryGraphForSynthesis } from './graph-queries';
export { runLLMSynthesis } from './llm-synthesis';
export { generateDeliverables } from './deliverables';
export { SYNTHESIS_CONFIGS } from './configs';
