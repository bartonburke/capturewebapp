/**
 * POST /api/graph/ingest
 *
 * Ingests a Portable Evidence Package into Neo4j
 * Creates Photo nodes, Entity nodes, and SHOWS relationships
 */

import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { runWriteTransaction } from '@/app/lib/neo4j';
import { ManagedTransaction } from 'neo4j-driver';
import {
  PhotoNode,
  EntityNode,
  ShowsRelationship,
  IngestResponse,
  PortableEvidenceIndex,
  PortablePhotoEntry,
} from '@/app/lib/neo4j-types';

// Cypher query templates
const MERGE_PHOTO_CYPHER = `
  MERGE (p:Photo {id: $id})
  SET p.timestamp = datetime($timestamp),
      p.location = CASE
        WHEN $latitude IS NOT NULL AND $longitude IS NOT NULL
        THEN point({latitude: $latitude, longitude: $longitude})
        ELSE null
      END,
      p.vlmDescription = $vlmDescription,
      p.catalogTags = $catalogTags,
      p.imageUrl = $imageUrl,
      p.sessionId = $sessionId,
      p.recPotential = $recPotential,
      p.confidence = $confidence
  RETURN p
`;

const MERGE_ENTITY_CYPHER = `
  MERGE (e:Entity {id: $id})
  SET e.entityType = $entityType,
      e.description = $description,
      e.severity = $severity,
      e.sessionId = $sessionId
  RETURN e
`;

const MERGE_SHOWS_CYPHER = `
  MATCH (p:Photo {id: $photoId})
  MATCH (e:Entity {id: $entityId})
  MERGE (p)-[r:SHOWS]->(e)
  SET r.confidence = $confidence
  RETURN r
`;

// Home inventory specific Cypher queries
const MERGE_LOCATION_CYPHER = `
  MERGE (l:Location {id: $id})
  SET l.name = $name,
      l.level = $level,
      l.sessionId = $sessionId
  RETURN l
`;

const MERGE_INSIDE_CYPHER = `
  MATCH (child:Location {id: $childId})
  MATCH (parent:Location {id: $parentId})
  MERGE (child)-[r:INSIDE]->(parent)
  RETURN r
`;

const MERGE_STORED_IN_CYPHER = `
  MATCH (e:Entity {id: $entityId})
  MATCH (l:Location {id: $locationId})
  MERGE (e)-[r:STORED_IN]->(l)
  RETURN r
`;

const MERGE_TAKEN_AT_CYPHER = `
  MATCH (p:Photo {id: $photoId})
  MATCH (l:Location {id: $locationId})
  MERGE (p)-[r:TAKEN_AT]->(l)
  RETURN r
`;

/**
 * Derive severity from REC potential and entity type
 */
function deriveSeverity(
  recPotential: string | undefined,
  entityType: string
): 'high' | 'medium' | 'low' | 'info' {
  // AOC = Area of Concern = medium+
  if (entityType === 'AOC') return 'medium';
  if (entityType === 'REC') return 'high';

  // Use rec_potential from vision analysis
  if (recPotential === 'high') return 'high';
  if (recPotential === 'medium') return 'medium';
  if (recPotential === 'low') return 'low';

  // Default for Condition/Feature
  return 'info';
}

/**
 * Extract entities from a photo entry
 * Maps concerns (descriptions) to entity types
 */
function extractEntities(
  photo: PortablePhotoEntry,
  sessionId: string,
  photoIndex: number
): EntityNode[] {
  const entities: EntityNode[] = [];

  // Get entity types from photo.entities array
  const types = photo.entities || [];

  // Get descriptions from vision_analysis.concerns
  const concerns = photo.vision_analysis?.concerns || [];

  // Map concerns to entity types (1:1 correspondence)
  for (let i = 0; i < concerns.length; i++) {
    const type = types[i] || 'Observation';
    const description = concerns[i];

    entities.push({
      id: `${sessionId}-photo-${String(photoIndex).padStart(3, '0')}-entity-${String(i).padStart(2, '0')}`,
      entityType: type,
      description: description,
      severity: deriveSeverity(photo.vision_analysis?.rec_potential, type),
      sessionId: sessionId,
    });
  }

  return entities;
}

// Types for home inventory ingestion
interface LocationNode {
  id: string;
  name: string;
  level: 'room' | 'container';
  sessionId: string;
}

interface InsideRelationship {
  childId: string;
  parentId: string;
}

interface StoredInRelationship {
  entityId: string;
  locationId: string;
}

interface TakenAtRelationship {
  photoId: string;
  locationId: string;
}

// Home inventory photo entry (from test fixture or vision output)
interface HomeInventoryPhoto {
  photoId: string;
  timestamp: string;
  gps?: { latitude: number; longitude: number; accuracy: number };
  vlmDescription: string;
  room: string;
  area?: string | null;
  container?: string | null;
  items: Array<{ name: string; attributes?: Record<string, string> }>;
  catalogTags: string[];
  notes?: string[];
}

/**
 * Process home inventory session into graph-ready structures
 */
function processHomeInventory(
  photos: HomeInventoryPhoto[],
  sessionId: string
): {
  photoNodes: PhotoNode[];
  entityNodes: EntityNode[];
  locationNodes: LocationNode[];
  showsRelationships: ShowsRelationship[];
  insideRelationships: InsideRelationship[];
  storedInRelationships: StoredInRelationship[];
  takenAtRelationships: TakenAtRelationship[];
} {
  const photoNodes: PhotoNode[] = [];
  const entityNodes: EntityNode[] = [];
  const locationNodes: LocationNode[] = [];
  const showsRelationships: ShowsRelationship[] = [];
  const insideRelationships: InsideRelationship[] = [];
  const storedInRelationships: StoredInRelationship[] = [];
  const takenAtRelationships: TakenAtRelationship[] = [];

  // Track unique locations to avoid duplicates
  const roomIds = new Map<string, string>(); // room name → id
  const containerIds = new Map<string, string>(); // container key → id

  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];
    const photoId = photo.photoId || `${sessionId}-photo-${String(i).padStart(3, '0')}`;

    // Create Photo node
    photoNodes.push({
      id: photoId,
      timestamp: photo.timestamp,
      latitude: photo.gps?.latitude ?? null,
      longitude: photo.gps?.longitude ?? null,
      vlmDescription: photo.vlmDescription,
      catalogTags: photo.catalogTags || [],
      imageUrl: `evidence/sessions/${sessionId}/photos/${String(i + 1).padStart(3, '0')}.jpg`,
      sessionId: sessionId,
      recPotential: 'none',
      confidence: 0.9,
    });

    // Create or get Room location
    const roomName = photo.room.toLowerCase();
    let roomId = roomIds.get(roomName);
    if (!roomId) {
      roomId = `${sessionId}-loc-${roomName.replace(/\s+/g, '-')}`;
      roomIds.set(roomName, roomId);
      locationNodes.push({
        id: roomId,
        name: roomName,
        level: 'room',
        sessionId: sessionId,
      });
    }

    // Determine where items are stored (container or room)
    let storageLocationId = roomId;

    // Create Container location if present
    if (photo.container) {
      const containerName = photo.container.toLowerCase();
      const containerKey = `${roomName}::${containerName}`;
      let containerId = containerIds.get(containerKey);
      if (!containerId) {
        containerId = `${sessionId}-loc-${roomName.replace(/\s+/g, '-')}-${containerName.replace(/\s+/g, '-')}`;
        containerIds.set(containerKey, containerId);
        locationNodes.push({
          id: containerId,
          name: containerName,
          level: 'container',
          sessionId: sessionId,
        });
        // Link container to room
        insideRelationships.push({
          childId: containerId,
          parentId: roomId,
        });
      }
      storageLocationId = containerId;
    }

    // Link photo to its location
    takenAtRelationships.push({
      photoId: photoId,
      locationId: storageLocationId,
    });

    // Create Item entities
    for (let j = 0; j < photo.items.length; j++) {
      const item = photo.items[j];
      const entityId = `${sessionId}-photo-${String(i).padStart(3, '0')}-item-${String(j).padStart(2, '0')}`;

      // Build attributes string
      const attrStr = item.attributes
        ? Object.entries(item.attributes).map(([k, v]) => `${k}: ${v}`).join(', ')
        : '';

      entityNodes.push({
        id: entityId,
        entityType: 'item',
        description: item.name,
        severity: 'info',
        sessionId: sessionId,
        // Store attributes in a way we can retrieve
        ...(attrStr && { attributes: attrStr }),
      });

      // Link photo to item
      showsRelationships.push({
        photoId: photoId,
        entityId: entityId,
        confidence: 0.9,
      });

      // Link item to storage location
      storedInRelationships.push({
        entityId: entityId,
        locationId: storageLocationId,
      });
    }

    // Create Note entities
    if (photo.notes && photo.notes.length > 0) {
      for (let k = 0; k < photo.notes.length; k++) {
        const noteId = `${sessionId}-photo-${String(i).padStart(3, '0')}-note-${String(k).padStart(2, '0')}`;
        entityNodes.push({
          id: noteId,
          entityType: 'note',
          description: photo.notes[k],
          severity: 'info',
          sessionId: sessionId,
        });
        showsRelationships.push({
          photoId: photoId,
          entityId: noteId,
          confidence: 0.9,
        });
      }
    }
  }

  return {
    photoNodes,
    entityNodes,
    locationNodes,
    showsRelationships,
    insideRelationships,
    storedInRelationships,
    takenAtRelationships,
  };
}

/**
 * Build PhotoNode from Portable Evidence Package photo entry
 */
function buildPhotoNode(
  photo: PortablePhotoEntry,
  sessionId: string,
  photoIndex: number
): PhotoNode {
  const photoId = `${sessionId}-${photo.filename}`;

  return {
    id: photoId,
    timestamp: photo.timestamp,
    latitude: photo.gps?.latitude ?? null,
    longitude: photo.gps?.longitude ?? null,
    vlmDescription: photo.vision_analysis?.description || '',
    catalogTags: photo.tags || [],
    imageUrl: `evidence/sessions/${sessionId}/photos/${photo.filename}`,
    sessionId: sessionId,
    recPotential: photo.vision_analysis?.rec_potential || 'none',
    confidence: photo.vision_analysis?.confidence || 0,
  };
}

export async function POST(req: NextRequest): Promise<NextResponse<IngestResponse>> {
  try {
    console.log('[GraphIngest] Request received');

    const body = await req.json();
    let indexJson: PortableEvidenceIndex;

    // Load index.json from request or file system
    if (body.indexJson) {
      console.log('[GraphIngest] Using index.json from request body');
      indexJson = body.indexJson;
    } else if (body.sessionId) {
      console.log(`[GraphIngest] Loading session from file: ${body.sessionId}`);
      const sessionPath = path.resolve(
        process.cwd(),
        `evidence/sessions/${body.sessionId}/index.json`
      );
      try {
        const data = await fs.readFile(sessionPath, 'utf-8');
        indexJson = JSON.parse(data);
      } catch (fileError) {
        console.error('[GraphIngest] Failed to load session file:', fileError);
        return NextResponse.json(
          {
            success: false,
            sessionId: body.sessionId,
            nodesCreated: { photos: 0, entities: 0 },
            relationshipsCreated: 0,
            errors: [`Session not found: ${body.sessionId}`],
          },
          { status: 404 }
        );
      }
    } else {
      return NextResponse.json(
        {
          success: false,
          sessionId: '',
          nodesCreated: { photos: 0, entities: 0 },
          relationshipsCreated: 0,
          errors: ['Provide indexJson or sessionId in request body'],
        },
        { status: 400 }
      );
    }

    const sessionId = indexJson.session_id;
    const projectType = indexJson.project_type || body.projectType || 'generic';
    console.log(`[GraphIngest] Processing session: ${sessionId}`);
    console.log(`[GraphIngest] Project type: ${projectType}`);
    console.log(`[GraphIngest] Photos to process: ${indexJson.photos.length}`);

    // Branch based on project type
    if (projectType === 'home-inventory') {
      // Use home inventory specific processing
      const homePhotos = (body.photos || indexJson.photos) as unknown as HomeInventoryPhoto[];
      const processed = processHomeInventory(homePhotos, sessionId);

      console.log(`[GraphIngest] Home inventory prepared: ${processed.photoNodes.length} photos, ${processed.entityNodes.length} entities, ${processed.locationNodes.length} locations`);

      // Execute home inventory transaction
      const result = await runWriteTransaction(async (tx: ManagedTransaction) => {
        let photosCreated = 0;
        let entitiesCreated = 0;
        let locationsCreated = 0;
        let relsCreated = 0;

        // Create Location nodes first
        for (const loc of processed.locationNodes) {
          await tx.run(MERGE_LOCATION_CYPHER, {
            id: loc.id,
            name: loc.name,
            level: loc.level,
            sessionId: loc.sessionId,
          });
          locationsCreated++;
        }

        // Create INSIDE relationships (container → room)
        for (const rel of processed.insideRelationships) {
          await tx.run(MERGE_INSIDE_CYPHER, {
            childId: rel.childId,
            parentId: rel.parentId,
          });
          relsCreated++;
        }

        // Create Photo nodes
        for (const photo of processed.photoNodes) {
          await tx.run(MERGE_PHOTO_CYPHER, {
            id: photo.id,
            timestamp: photo.timestamp,
            latitude: photo.latitude,
            longitude: photo.longitude,
            vlmDescription: photo.vlmDescription,
            catalogTags: photo.catalogTags,
            imageUrl: photo.imageUrl,
            sessionId: photo.sessionId,
            recPotential: photo.recPotential,
            confidence: photo.confidence,
          });
          photosCreated++;
        }

        // Create Entity nodes (items, notes)
        for (const entity of processed.entityNodes) {
          await tx.run(MERGE_ENTITY_CYPHER, {
            id: entity.id,
            entityType: entity.entityType,
            description: entity.description,
            severity: entity.severity,
            sessionId: entity.sessionId,
          });
          entitiesCreated++;
        }

        // Create SHOWS relationships (photo → entity)
        for (const rel of processed.showsRelationships) {
          await tx.run(MERGE_SHOWS_CYPHER, {
            photoId: rel.photoId,
            entityId: rel.entityId,
            confidence: rel.confidence,
          });
          relsCreated++;
        }

        // Create STORED_IN relationships (item → location)
        for (const rel of processed.storedInRelationships) {
          await tx.run(MERGE_STORED_IN_CYPHER, {
            entityId: rel.entityId,
            locationId: rel.locationId,
          });
          relsCreated++;
        }

        // Create TAKEN_AT relationships (photo → location)
        for (const rel of processed.takenAtRelationships) {
          await tx.run(MERGE_TAKEN_AT_CYPHER, {
            photoId: rel.photoId,
            locationId: rel.locationId,
          });
          relsCreated++;
        }

        return { photosCreated, entitiesCreated, locationsCreated, relsCreated };
      });

      console.log(`[GraphIngest] Home inventory success: ${result.photosCreated} photos, ${result.entitiesCreated} entities, ${result.locationsCreated} locations, ${result.relsCreated} relationships`);

      return NextResponse.json({
        success: true,
        sessionId,
        nodesCreated: {
          photos: result.photosCreated,
          entities: result.entitiesCreated,
          locations: result.locationsCreated,
        },
        relationshipsCreated: result.relsCreated,
      });
    }

    // Standard processing for other project types
    const photoNodes: PhotoNode[] = [];
    const entityNodes: EntityNode[] = [];
    const showsRelationships: ShowsRelationship[] = [];

    // Process each photo
    for (let i = 0; i < indexJson.photos.length; i++) {
      const photo = indexJson.photos[i];
      const photoNode = buildPhotoNode(photo, sessionId, i);
      photoNodes.push(photoNode);

      // Extract entities from this photo
      const entities = extractEntities(photo, sessionId, i);

      for (const entity of entities) {
        entityNodes.push(entity);
        showsRelationships.push({
          photoId: photoNode.id,
          entityId: entity.id,
          confidence: photo.vision_analysis?.confidence || 0.8,
        });
      }
    }

    console.log(`[GraphIngest] Prepared: ${photoNodes.length} photos, ${entityNodes.length} entities, ${showsRelationships.length} relationships`);

    // Execute in transaction
    const result = await runWriteTransaction(async (tx: ManagedTransaction) => {
      let photosCreated = 0;
      let entitiesCreated = 0;
      let relsCreated = 0;

      // Create photos
      for (const photo of photoNodes) {
        await tx.run(MERGE_PHOTO_CYPHER, {
          id: photo.id,
          timestamp: photo.timestamp,
          latitude: photo.latitude,
          longitude: photo.longitude,
          vlmDescription: photo.vlmDescription,
          catalogTags: photo.catalogTags,
          imageUrl: photo.imageUrl,
          sessionId: photo.sessionId,
          recPotential: photo.recPotential,
          confidence: photo.confidence,
        });
        photosCreated++;
      }

      // Create entities
      for (const entity of entityNodes) {
        await tx.run(MERGE_ENTITY_CYPHER, {
          id: entity.id,
          entityType: entity.entityType,
          description: entity.description,
          severity: entity.severity,
          sessionId: entity.sessionId,
        });
        entitiesCreated++;
      }

      // Create relationships
      for (const rel of showsRelationships) {
        await tx.run(MERGE_SHOWS_CYPHER, {
          photoId: rel.photoId,
          entityId: rel.entityId,
          confidence: rel.confidence,
        });
        relsCreated++;
      }

      return { photosCreated, entitiesCreated, relsCreated };
    });

    console.log(`[GraphIngest] Success: ${result.photosCreated} photos, ${result.entitiesCreated} entities, ${result.relsCreated} relationships`);

    return NextResponse.json({
      success: true,
      sessionId,
      nodesCreated: {
        photos: result.photosCreated,
        entities: result.entitiesCreated,
      },
      relationshipsCreated: result.relsCreated,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[GraphIngest] Error:', errorMessage);

    return NextResponse.json(
      {
        success: false,
        sessionId: '',
        nodesCreated: { photos: 0, entities: 0 },
        relationshipsCreated: 0,
        errors: [errorMessage],
      },
      { status: 500 }
    );
  }
}
