/**
 * Neo4j Graph Queries for Session Synthesis
 *
 * Queries the graph database for enriched session data.
 * Falls back gracefully if Neo4j is unavailable.
 */

import { runQuery, verifyConnection } from '@/app/lib/neo4j';

export interface GraphPhoto {
  id: string;
  vlmDescription: string;
  catalogTags: string[];
  sessionId: string;
  timestamp?: string;
  latitude?: number;
  longitude?: number;
}

export interface GraphEntity {
  id: string;
  entityType: string;
  description: string;
  severity: string;
  sessionId: string;
}

export interface GraphRelationship {
  photoId: string;
  entityId: string;
  confidence: number;
}

export interface GraphSynthesisData {
  photos: GraphPhoto[];
  entities: GraphEntity[];
  relationships: GraphRelationship[];
  spatialClusters: SpatialCluster[];
}

export interface SpatialCluster {
  photoIds: string[];
  centroidLat: number;
  centroidLng: number;
  radiusMeters: number;
}

/**
 * Query Neo4j for all session data needed for synthesis
 * Returns null if graph is unavailable (graceful fallback)
 */
export async function queryGraphForSynthesis(sessionId: string): Promise<GraphSynthesisData | null> {
  try {
    // Verify connection first
    const connected = await verifyConnection();
    if (!connected) {
      console.warn('[GraphQueries] Neo4j not available, will use IndexedDB fallback');
      return null;
    }

    console.log(`[GraphQueries] Querying session ${sessionId}...`);

    // Get all photos and entities for this session
    const photosAndEntities = await queryPhotosAndEntities(sessionId);

    // Get spatial clusters (photos near each other)
    const spatialClusters = await querySpatialClusters(sessionId);

    return {
      photos: photosAndEntities.photos,
      entities: photosAndEntities.entities,
      relationships: photosAndEntities.relationships,
      spatialClusters,
    };

  } catch (error) {
    console.error('[GraphQueries] Query failed:', error);
    return null;
  }
}

/**
 * Get all photos and their related entities for a session
 */
async function queryPhotosAndEntities(sessionId: string): Promise<{
  photos: GraphPhoto[];
  entities: GraphEntity[];
  relationships: GraphRelationship[];
}> {
  const cypher = `
    MATCH (p:Photo)
    WHERE p.sessionId = $sessionId
    OPTIONAL MATCH (p)-[r:SHOWS]->(e:Entity)
    RETURN p, collect({entity: e, confidence: r.confidence}) as entityData
  `;

  const result = await runQuery(cypher, { sessionId });

  const photos: GraphPhoto[] = [];
  const entities: GraphEntity[] = [];
  const relationships: GraphRelationship[] = [];
  const seenEntityIds = new Set<string>();

  for (const record of result.records) {
    const photoNode = record.get('p') as { properties: Record<string, any> } | null;
    const entityData = record.get('entityData') as Array<{
      entity: { properties: Record<string, any> } | null;
      confidence: number;
    }> | null;

    if (photoNode) {
      const props = photoNode.properties;
      photos.push({
        id: props.id,
        vlmDescription: props.vlmDescription || '',
        catalogTags: props.catalogTags || [],
        sessionId: props.sessionId,
        timestamp: props.timestamp,
        latitude: props.location?.latitude,
        longitude: props.location?.longitude,
      });

      // Process entities linked to this photo
      for (const ed of entityData || []) {
        if (ed.entity && !seenEntityIds.has(ed.entity.properties.id)) {
          const entityProps = ed.entity.properties;
          seenEntityIds.add(entityProps.id);
          entities.push({
            id: entityProps.id,
            entityType: entityProps.entityType,
            description: entityProps.description || '',
            severity: entityProps.severity || 'info',
            sessionId: entityProps.sessionId,
          });
        }

        if (ed.entity) {
          relationships.push({
            photoId: props.id,
            entityId: ed.entity.properties.id,
            confidence: ed.confidence || 0.8,
          });
        }
      }
    }
  }

  console.log(`[GraphQueries] Found ${photos.length} photos, ${entities.length} entities, ${relationships.length} relationships`);

  return { photos, entities, relationships };
}

/**
 * Find photos that are spatially clustered (within 10m of each other)
 * Useful for identifying photos of the same room/area
 */
async function querySpatialClusters(sessionId: string): Promise<SpatialCluster[]> {
  const cypher = `
    MATCH (p1:Photo), (p2:Photo)
    WHERE p1.sessionId = $sessionId
      AND p2.sessionId = $sessionId
      AND p1.id < p2.id
      AND p1.location IS NOT NULL
      AND p2.location IS NOT NULL
      AND point.distance(p1.location, p2.location) < 10
    RETURN p1.id as photo1, p2.id as photo2,
           point.distance(p1.location, p2.location) as distance,
           p1.location.latitude as lat1, p1.location.longitude as lng1,
           p2.location.latitude as lat2, p2.location.longitude as lng2
  `;

  try {
    const result = await runQuery(cypher, { sessionId });

    // Group nearby photos into clusters using union-find
    const photoToCluster = new Map<string, Set<string>>();

    for (const record of result.records) {
      const photo1 = record.get('photo1') as string;
      const photo2 = record.get('photo2') as string;

      // Get or create clusters for both photos
      let cluster1 = photoToCluster.get(photo1);
      let cluster2 = photoToCluster.get(photo2);

      if (cluster1 && cluster2) {
        // Merge clusters
        if (cluster1 !== cluster2) {
          for (const p of cluster2) {
            cluster1.add(p);
            photoToCluster.set(p, cluster1);
          }
        }
      } else if (cluster1) {
        cluster1.add(photo2);
        photoToCluster.set(photo2, cluster1);
      } else if (cluster2) {
        cluster2.add(photo1);
        photoToCluster.set(photo1, cluster2);
      } else {
        const newCluster = new Set([photo1, photo2]);
        photoToCluster.set(photo1, newCluster);
        photoToCluster.set(photo2, newCluster);
      }
    }

    // Convert to unique clusters
    const uniqueClusters = new Set<Set<string>>();
    for (const cluster of photoToCluster.values()) {
      uniqueClusters.add(cluster);
    }

    // Build SpatialCluster objects (simplified - centroid calculation would need actual coords)
    const spatialClusters: SpatialCluster[] = [];
    for (const cluster of uniqueClusters) {
      if (cluster.size >= 2) {
        spatialClusters.push({
          photoIds: Array.from(cluster),
          centroidLat: 0, // Would need actual coordinates
          centroidLng: 0,
          radiusMeters: 10,
        });
      }
    }

    console.log(`[GraphQueries] Found ${spatialClusters.length} spatial clusters`);
    return spatialClusters;

  } catch (error) {
    console.warn('[GraphQueries] Spatial cluster query failed:', error);
    return [];
  }
}

/**
 * Query for location tags to help with room extraction
 */
export async function queryLocationTags(sessionId: string): Promise<Map<string, string[]>> {
  const locationKeywords = [
    'kitchen', 'bedroom', 'bathroom', 'garage', 'basement', 'attic',
    'living_room', 'dining_room', 'office', 'closet', 'pantry', 'laundry',
    'drawer', 'shelf', 'cabinet', 'bin', 'box', 'container'
  ];

  const cypher = `
    MATCH (p:Photo)
    WHERE p.sessionId = $sessionId
    RETURN p.id as photoId,
           [tag IN p.catalogTags WHERE tag IN $locationKeywords] as locationTags
  `;

  try {
    const result = await runQuery(cypher, { sessionId, locationKeywords });

    const photoLocationTags = new Map<string, string[]>();
    for (const record of result.records) {
      const photoId = record.get('photoId') as string;
      const tags = (record.get('locationTags') || []) as string[];
      if (tags.length > 0) {
        photoLocationTags.set(photoId, tags);
      }
    }

    return photoLocationTags;

  } catch (error) {
    console.warn('[GraphQueries] Location tags query failed:', error);
    return new Map();
  }
}
