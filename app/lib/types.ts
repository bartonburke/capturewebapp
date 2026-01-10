// Shared TypeScript interfaces for ChoraGraph Capture PWA

export interface Project {
  id: string;              // UUID
  name: string;            // e.g., "123 Main St ESA"
  lead: string;            // Project lead name
  notes?: string;          // Optional notes
  createdAt: string;       // ISO8601
  modifiedAt: string;      // ISO8601
  photoCount: number;      // Total photos
}

export interface GpsCoordinates {
  latitude: number;
  longitude: number;
  accuracy: number;        // meters
  timestamp: number;       // Unix timestamp
}

export interface PhotoMetadata {
  id: string;              // UUID
  timestamp: string;       // ISO8601
  projectId: string;       // Link to parent project
  gps: GpsCoordinates | null;
  imageData: string;       // Base64 encoded JPEG
  sessionTimestamp: number;  // Session duration when captured
}

export type GpsStatus = 'NOT_REQUESTED' | 'REQUESTING' | 'ACTIVE' | 'ERROR' | 'DENIED';
export type SessionState = 'NOT_STARTED' | 'RECORDING' | 'PAUSED' | 'ENDED';
