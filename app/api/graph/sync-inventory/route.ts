/**
 * POST /api/graph/sync-inventory
 *
 * Syncs inventory synthesis results to Neo4j
 * Creates Item nodes (from EntityClusters) and Location nodes (from LocationHierarchy)
 * Links photos to items via SHOWS relationship
 * Links items to locations via STORED_IN relationship
 */

import { NextRequest, NextResponse } from 'next/server';
import { runWriteTransaction } from '@/app/lib/neo4j';
import { ManagedTransaction } from 'neo4j-driver';
import { EntityCluster, LocationNode, SessionSynthesis } from '@/app/lib/types';

// Cypher queries for inventory sync
const MERGE_ITEM_CYPHER = `
  MERGE (i:Item {id: $id})
  SET i.name = $name,
      i.description = $description,
      i.entityType = $entityType,
      i.confidence = $confidence,
      i.sessionId = $sessionId,
      i.photoCount = $photoCount
  RETURN i
`;

const MERGE_LOCATION_CYPHER = `
  MERGE (l:Location {id: $id})
  SET l.name = $name,
      l.level = $level,
      l.sessionId = $sessionId,
      l.itemCount = $itemCount
  RETURN l
`;

const LINK_ITEM_TO_PHOTO_CYPHER = `
  MATCH (p:Photo {id: $photoId})
  MATCH (i:Item {id: $itemId})
  MERGE (p)-[r:SHOWS_ITEM]->(i)
  SET r.confidence = $confidence
  RETURN r
`;

const LINK_ITEM_TO_LOCATION_CYPHER = `
  MATCH (i:Item {id: $itemId})
  MATCH (l:Location {id: $locationId})
  MERGE (i)-[r:STORED_IN]->(l)
  RETURN r
`;

const LINK_LOCATION_PARENT_CYPHER = `
  MATCH (child:Location {id: $childId})
  MATCH (parent:Location {id: $parentId})
  MERGE (child)-[r:INSIDE]->(parent)
  RETURN r
`;

interface SyncInventoryRequest {
  sessionId: string;
  synthesis: SessionSynthesis;
}

interface SyncInventoryResponse {
  success: boolean;
  sessionId: string;
  nodesCreated: {
    items: number;
    locations: number;
  };
  relationshipsCreated: {
    photoToItem: number;
    itemToLocation: number;
    locationHierarchy: number;
  };
  errors?: string[];
}

export async function POST(req: NextRequest): Promise<NextResponse<SyncInventoryResponse>> {
  try {
    const body: SyncInventoryRequest = await req.json();
    const { sessionId, synthesis } = body;

    if (!sessionId || !synthesis) {
      return NextResponse.json({
        success: false,
        sessionId: sessionId || '',
        nodesCreated: { items: 0, locations: 0 },
        relationshipsCreated: { photoToItem: 0, itemToLocation: 0, locationHierarchy: 0 },
        errors: ['Missing sessionId or synthesis in request'],
      }, { status: 400 });
    }

    console.log(`[SyncInventory] Starting for session ${sessionId}`);
    console.log(`[SyncInventory] Clusters: ${synthesis.entityClusters.length}, Locations: ${synthesis.locationHierarchy.length}`);

    // Filter to items only (not locations/containers which are handled separately)
    const itemClusters = synthesis.entityClusters.filter(c => c.entityType === 'item');
    const locationNodes = synthesis.locationHierarchy;

    console.log(`[SyncInventory] Processing ${itemClusters.length} items, ${locationNodes.length} locations`);

    const result = await runWriteTransaction(async (tx: ManagedTransaction) => {
      let itemsCreated = 0;
      let locationsCreated = 0;
      let photoToItemRels = 0;
      let itemToLocationRels = 0;
      let locationHierarchyRels = 0;

      // Create Location nodes first (need them for item relationships)
      for (const loc of locationNodes) {
        await tx.run(MERGE_LOCATION_CYPHER, {
          id: `${sessionId}-loc-${loc.id}`,
          name: loc.name,
          level: loc.level,
          sessionId: sessionId,
          itemCount: loc.itemCount,
        });
        locationsCreated++;
      }

      // Create location hierarchy relationships
      for (const loc of locationNodes) {
        if (loc.parentId) {
          await tx.run(LINK_LOCATION_PARENT_CYPHER, {
            childId: `${sessionId}-loc-${loc.id}`,
            parentId: `${sessionId}-loc-${loc.parentId}`,
          });
          locationHierarchyRels++;
        }
      }

      // Create Item nodes
      for (const cluster of itemClusters) {
        const itemId = `${sessionId}-item-${cluster.clusterId}`;

        await tx.run(MERGE_ITEM_CYPHER, {
          id: itemId,
          name: cluster.canonicalName,
          description: cluster.mergedDescription,
          entityType: cluster.entityType,
          confidence: cluster.confidence,
          sessionId: sessionId,
          photoCount: cluster.photoIds.length,
        });
        itemsCreated++;

        // Link item to photos
        for (const photoId of cluster.photoIds) {
          // Photo IDs may be just the ID or may need session prefix
          const fullPhotoId = photoId.includes(sessionId) ? photoId : `${sessionId}-photo-${photoId}`;
          try {
            await tx.run(LINK_ITEM_TO_PHOTO_CYPHER, {
              photoId: fullPhotoId,
              itemId: itemId,
              confidence: cluster.confidence,
            });
            photoToItemRels++;
          } catch (linkError) {
            // Photo may not exist in graph yet - continue
            console.warn(`[SyncInventory] Could not link photo ${fullPhotoId} to item ${itemId}`);
          }
        }

        // Link item to locations
        for (const locName of cluster.locations) {
          // Find matching location node
          const matchingLoc = locationNodes.find(l =>
            l.name.toLowerCase() === locName.toLowerCase()
          );
          if (matchingLoc) {
            await tx.run(LINK_ITEM_TO_LOCATION_CYPHER, {
              itemId: itemId,
              locationId: `${sessionId}-loc-${matchingLoc.id}`,
            });
            itemToLocationRels++;
          }
        }
      }

      return {
        itemsCreated,
        locationsCreated,
        photoToItemRels,
        itemToLocationRels,
        locationHierarchyRels,
      };
    });

    console.log(`[SyncInventory] Success: ${result.itemsCreated} items, ${result.locationsCreated} locations`);
    console.log(`[SyncInventory] Relationships: ${result.photoToItemRels} photo->item, ${result.itemToLocationRels} item->location, ${result.locationHierarchyRels} location hierarchy`);

    return NextResponse.json({
      success: true,
      sessionId,
      nodesCreated: {
        items: result.itemsCreated,
        locations: result.locationsCreated,
      },
      relationshipsCreated: {
        photoToItem: result.photoToItemRels,
        itemToLocation: result.itemToLocationRels,
        locationHierarchy: result.locationHierarchyRels,
      },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[SyncInventory] Error:', errorMessage);

    return NextResponse.json({
      success: false,
      sessionId: '',
      nodesCreated: { items: 0, locations: 0 },
      relationshipsCreated: { photoToItem: 0, itemToLocation: 0, locationHierarchy: 0 },
      errors: [errorMessage],
    }, { status: 500 });
  }
}
