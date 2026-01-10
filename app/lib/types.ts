// Shared TypeScript interfaces for ChoraGraph Capture PWA

export interface Project {
  id: string;              // UUID
  name: string;            // e.g., "123 Main St ESA"
  lead: string;            // Project lead name
  notes?: string;          // Optional notes
  createdAt: string;       // ISO8601
  modifiedAt: string;      // ISO8601
  photoCount: number;      // Total photos
  audioCount: number;      // Total audio recordings
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

export interface AudioMetadata {
  id: string;              // UUID
  projectId: string;       // Links to parent project
  sessionId: string;       // Unique session identifier (UUID)
  audioData: string;       // Base64 encoded audio blob
  duration: number;        // Total session duration in seconds
  mimeType: string;        // e.g., 'audio/webm;codecs=opus'
  timestamp: string;       // ISO8601 when recording started
  fileSize: number;        // Bytes (for performance tracking)
}

export type GpsStatus = 'NOT_REQUESTED' | 'REQUESTING' | 'ACTIVE' | 'ERROR' | 'DENIED';
export type SessionState = 'NOT_STARTED' | 'RECORDING' | 'PAUSED' | 'ENDED';
