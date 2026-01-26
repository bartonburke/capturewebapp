/**
 * GET /api/graph/photo/[photoId]
 *
 * Fetch a single photo with all its entities from Neo4j
 */

import { NextRequest, NextResponse } from 'next/server';
import { runQuery } from '@/app/lib/neo4j';

interface PhotoEntity {
  entityType: string;
  description: string;
  severity: string;
}

interface PhotoDetail {
  id: string;
  imageUrl: string;
  timestamp: string;
  sessionId: string;
  location: { latitude: number; longitude: number } | null;
  vlmDescription: string;
  recPotential: string;
  confidence: number;
  catalogTags: string[];
  entities: PhotoEntity[];
}

interface PhotoResponse {
  success: boolean;
  photo: PhotoDetail | null;
  error?: string;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ photoId: string }> }
): Promise<NextResponse<PhotoResponse>> {
  try {
    const { photoId } = await params;

    if (!photoId) {
      return NextResponse.json(
        { success: false, photo: null, error: 'Photo ID is required' },
        { status: 400 }
      );
    }

    console.log(`[GraphPhoto] Fetching photo: ${photoId}`);

    // Fetch photo and all related entities
    const cypher = `
      MATCH (p:Photo {id: $photoId})
      OPTIONAL MATCH (p)-[:SHOWS]->(e:Entity)
      RETURN p, collect(e) as entities
    `;

    const result = await runQuery(cypher, { photoId });

    if (result.records.length === 0) {
      return NextResponse.json(
        { success: false, photo: null, error: 'Photo not found' },
        { status: 404 }
      );
    }

    const record = result.records[0];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const photoNode = record.get('p') as { properties: Record<string, any> };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entityNodes = record.get('entities') as Array<{ properties: Record<string, any> } | null>;

    const photoProps = photoNode.properties;

    // Extract location from Neo4j point type
    let location: { latitude: number; longitude: number } | null = null;
    if (photoProps.location) {
      location = {
        latitude: photoProps.location.y,
        longitude: photoProps.location.x,
      };
    }

    // Extract entities
    const entities: PhotoEntity[] = entityNodes
      .filter((e): e is { properties: Record<string, unknown> } => e !== null)
      .map((e) => ({
        entityType: String(e.properties.entityType || ''),
        description: String(e.properties.description || ''),
        severity: String(e.properties.severity || 'info'),
      }));

    const photo: PhotoDetail = {
      id: photoProps.id,
      imageUrl: photoProps.imageUrl,
      timestamp: photoProps.timestamp,
      sessionId: photoProps.sessionId,
      location,
      vlmDescription: photoProps.vlmDescription,
      recPotential: photoProps.recPotential || 'none',
      confidence: typeof photoProps.confidence === 'number' ? photoProps.confidence : 0,
      catalogTags: Array.isArray(photoProps.catalogTags) ? photoProps.catalogTags : [],
      entities,
    };

    console.log(`[GraphPhoto] Found photo with ${entities.length} entities`);

    return NextResponse.json({ success: true, photo });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[GraphPhoto] Error:', errorMessage);

    return NextResponse.json(
      { success: false, photo: null, error: errorMessage },
      { status: 500 }
    );
  }
}
