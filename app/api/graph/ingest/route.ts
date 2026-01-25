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
    console.log(`[GraphIngest] Processing session: ${sessionId}`);
    console.log(`[GraphIngest] Photos to process: ${indexJson.photos.length}`);

    // Collect all nodes and relationships
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
