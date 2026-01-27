/**
 * Search Index Builder
 *
 * Pure function that builds a SearchIndexEntry[] from photo analyses,
 * entity clusters, location hierarchy, and an optional SearchSchema.
 *
 * Extracted to its own file for testability — no external dependencies
 * (neo4j, OpenAI, etc.).
 */

import type {
  PhotoAnalysis,
  EntityCluster,
  LocationNode,
  SearchIndexEntry,
} from '@/app/lib/types';
import type { SearchSchema, IndexableFieldConfig } from './configs';

/**
 * Build search index from synthesis results.
 *
 * Always indexes: entity clusters, location hierarchy, catalog tags (the base layer).
 * When a SearchSchema is provided, additionally indexes project-type-specific fields
 * declared in searchSchema.indexableFields (e.g., room, items[].attributes for home-inventory).
 */
export function buildSearchIndex(
  photoAnalyses: PhotoAnalysis[],
  entityClusters: EntityCluster[],
  locationHierarchy: LocationNode[],
  searchSchema?: SearchSchema
): SearchIndexEntry[] {
  const termMap = new Map<string, SearchIndexEntry>();

  // Helper: add or merge a term into the index
  function addTerm(
    term: string,
    type: SearchIndexEntry['type'],
    photoId: string,
    relevance: number,
    context?: string,
    clusterId?: string
  ) {
    if (!term) return;
    const key = term.toLowerCase();
    if (!termMap.has(key)) {
      termMap.set(key, { term: key, type, matches: [] });
    }
    termMap.get(key)!.matches.push({
      photoId,
      relevance,
      ...(context ? { context } : {}),
      ...(clusterId ? { clusterId } : {}),
    });
  }

  // ── Base layer: always runs ──

  // Index items from entity clusters
  for (const cluster of entityClusters) {
    const type: SearchIndexEntry['type'] =
      cluster.entityType === 'location' ? 'location' :
      cluster.entityType === 'container' ? 'container' : 'item';
    for (const photoId of cluster.photoIds) {
      addTerm(cluster.canonicalName, type, photoId, cluster.confidence, cluster.mergedDescription, cluster.clusterId);
    }
  }

  // Index locations
  for (const loc of locationHierarchy) {
    for (const photoId of loc.photoIds) {
      addTerm(loc.name, 'location', photoId, 1.0, `${loc.level}: ${loc.name}`);
    }
  }

  // ── Schema-driven layer: runs BEFORE catalog tags so specific types (room, container)
  //    take precedence over the generic 'tag' type ──

  if (searchSchema?.indexableFields) {
    for (const analysis of photoAnalyses) {
      for (const fieldConfig of searchSchema.indexableFields) {
        indexFieldFromAnalysis(analysis, fieldConfig, addTerm);
      }
    }
  }

  // Index catalog tags from photos (last, so specific types win)
  for (const analysis of photoAnalyses) {
    for (const tag of analysis.catalogTags) {
      addTerm(tag, 'tag', analysis.photoId, 0.8);
    }
  }

  return Array.from(termMap.values());
}

/**
 * Index a single field from a PhotoAnalysis based on an IndexableFieldConfig.
 * Handles scalars, arrays-of-strings, and arrays-of-objects with termField/attributeKeys.
 */
function indexFieldFromAnalysis(
  analysis: PhotoAnalysis,
  fieldConfig: IndexableFieldConfig,
  addTerm: (term: string, type: SearchIndexEntry['type'], photoId: string, relevance: number, context?: string) => void
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const value = (analysis as any)[fieldConfig.fieldPath];
  if (value == null) return;

  const { indexType, relevanceWeight } = fieldConfig;
  const photoId = analysis.photoId;

  // Array of objects (e.g., items[])
  if (Array.isArray(value) && fieldConfig.termField) {
    for (const item of value) {
      if (typeof item === 'object' && item !== null) {
        // Index the main term (e.g., item.name)
        const term = item[fieldConfig.termField];
        if (typeof term === 'string' && term) {
          addTerm(term, indexType, photoId, relevanceWeight, analysis.vlmDescription);
        }

        // Index attribute values (e.g., item.attributes.brand, item.attributes.color)
        if (fieldConfig.attributeKeys && item.attributes) {
          for (const attrKey of fieldConfig.attributeKeys) {
            const attrValue = item.attributes[attrKey];
            if (typeof attrValue === 'string' && attrValue) {
              addTerm(attrValue, 'attribute', photoId, relevanceWeight * 0.8, `${attrKey}: ${attrValue}`);
            }
          }
        }
      }
    }
    return;
  }

  // Array of strings (e.g., notes[])
  if (Array.isArray(value)) {
    for (const v of value) {
      if (typeof v === 'string' && v) {
        addTerm(v, indexType, photoId, relevanceWeight);
      }
    }
    return;
  }

  // Scalar string (e.g., room, area, container, vlmDescription)
  if (typeof value === 'string') {
    addTerm(value, indexType, photoId, relevanceWeight);
  }
}
