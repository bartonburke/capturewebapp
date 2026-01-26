/**
 * TypeScript interfaces for Neo4j graph nodes and relationships
 * Used by the ingest endpoint to create/update graph entities
 */

/**
 * Photo node in Neo4j
 * Represents a captured photo with GPS coordinates and AI analysis
 */
export interface PhotoNode {
  id: string;                    // {sessionId}-{filename}
  timestamp: string;             // ISO8601 datetime
  latitude: number | null;       // GPS latitude
  longitude: number | null;      // GPS longitude
  vlmDescription: string;        // Vision language model description
  catalogTags: string[];         // Searchable tags
  imageUrl: string;              // Path/URL to image file
  sessionId: string;             // Parent session ID
  recPotential: string;          // REC potential: high | medium | low | none
  confidence: number;            // AI confidence score 0-1
}

/**
 * Entity node in Neo4j
 * Represents an extracted entity (REC, AOC, Feature, Condition, etc.)
 */
export interface EntityNode {
  id: string;                    // {sessionId}-photo-{i}-entity-{j}
  entityType: string;            // REC | AOC | Feature | Condition | Observation | item | note
  description: string;           // Full description from vision analysis
  severity: 'high' | 'medium' | 'low' | 'info';
  sessionId: string;             // Parent session ID
  attributes?: string;           // Optional attributes for home inventory items (e.g., "color: red, quantity: 3")
}

/**
 * SHOWS relationship between Photo and Entity
 */
export interface ShowsRelationship {
  photoId: string;               // Source Photo.id
  entityId: string;              // Target Entity.id
  confidence: number;            // Confidence score 0-1
}

/**
 * Response from ingest endpoint
 */
export interface IngestResponse {
  success: boolean;
  sessionId: string;
  nodesCreated: {
    photos: number;
    entities: number;
    locations?: number;  // Home inventory adds Location nodes
  };
  relationshipsCreated: number;
  errors?: string[];
}

/**
 * Portable Evidence Package photo entry (for parsing)
 * Matches the structure from evidence/sessions/{id}/index.json
 */
export interface PortablePhotoEntry {
  filename: string;
  timestamp: string;
  gps?: {
    latitude: number;
    longitude: number;
    accuracy: number;
    timestamp: number;
  };
  entities?: string[];           // Entity type names
  vision_analysis?: {
    description: string;
    concerns: string[];
    rec_potential: 'high' | 'medium' | 'low' | 'none';
    confidence: number;
  };
  tags: string[];
}

/**
 * Portable Evidence Package index (subset of fields needed for ingest)
 */
export interface PortableEvidenceIndex {
  session_id: string;
  project_type: string;
  project_name: string;
  timestamp_start: string;
  timestamp_end: string;
  photos: PortablePhotoEntry[];
  session_summary: {
    total_photos: number;
    entities_extracted: Record<string, number>;
  };
  processing_stage: string;
  version: string;
}
