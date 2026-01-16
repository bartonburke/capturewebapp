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

  // Multi-project platform support fields
  projectType: ProjectType;           // Default: 'phase1-esa' for migration
  externalProjectId?: string;         // ID from launching system (Claude Code)
  launchSessionId?: string;           // Session ID if launched via API
  context?: ProjectContext;           // Dynamic context from launch
  processingStage?: ProcessingStage;  // Current state in processing pipeline
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

// Multi-project platform support types
export type ProjectType = 'phase1-esa' | 'eir-eis' | 'borehole' | 'generic';
export type ProcessingStage = 'captured' | 'transcribed' | 'analyzed' | 'graph_ready';

// Entity schema for dynamic configuration per project type
export interface EntitySchemaItem {
  name: string;                    // e.g., "REC", "UST"
  displayName: string;             // e.g., "Recognized Environmental Condition"
  description?: string;            // For UI tooltips
  extractionKeywords?: string[];   // Keywords for Claude Vision prompts
  confidenceThreshold?: number;    // 0.0-1.0
}

// Project context passed at launch or configured locally
export interface ProjectContext {
  projectType: ProjectType;
  entitySchema: EntitySchemaItem[];
  capturePrompts: string[];        // Rotating tips during capture
  visionAnalysisPrompt?: string;   // Custom Claude Vision prompt
}

// Launch API request/response types
export interface LaunchSessionRequest {
  projectId?: string;              // External project ID (from Claude Code)
  projectType: ProjectType;
  projectName: string;
  lead?: string;
  notes?: string;
  context?: Partial<ProjectContext>;
  expiresAt?: string;              // ISO8601 - defaults to 24 hours
}

export interface LaunchSessionResponse {
  sessionId: string;               // UUID for capture session
  captureUrl: string;              // Full URL to open on mobile
  expiresAt: string;               // ISO8601
}

// Launch session record (stored in IndexedDB)
export interface LaunchSessionRecord {
  sessionId: string;               // Primary key
  externalProjectId?: string;      // From launching system
  projectType: ProjectType;
  projectName: string;
  lead?: string;
  notes?: string;
  context: ProjectContext;
  createdAt: string;               // ISO8601
  expiresAt: string;               // ISO8601
  status: 'pending' | 'active' | 'completed' | 'expired';
  localProjectId?: string;         // Links to local Project after activation
}

// AI Processing types

// Transcript types
export interface TranscriptSegment {
  start: number;              // Seconds from session start
  end: number;                // Seconds from session start
  text: string;               // Transcript text for this segment
}

export interface Transcript {
  fullText: string;           // Full transcript of entire audio
  segments: TranscriptSegment[];
  language?: string;          // Detected language from Whisper
  duration: number;           // Total audio duration in seconds
}

// Photo analysis types
export interface PhotoAnalysis {
  photoId: string;            // Links to PhotoMetadata.id
  vlmDescription: string;     // Claude Vision description
  catalogTags: string[];      // Searchable keywords for filtering/search
  entities: PhotoEntity[];    // Photo-specific findings
  transcriptSegment: TranscriptSegment | null;  // Matched transcript segment
  timestamp: string;          // When photo was taken (ISO8601)
  gps: GpsCoordinates | null; // GPS at photo time
}

// Photo-specific entity (simpler than ExtractedEntity for Phase 4)
export interface PhotoEntity {
  type: 'REC' | 'AOC' | 'Feature' | 'Equipment' | 'Condition';
  description: string;
  severity: 'high' | 'medium' | 'low' | 'info';
  recommendation?: string;
}

// ESA entity types
export type EntityType =
  | 'REC'                     // Recognized Environmental Condition
  | 'SiteFeature'             // AST, UST, drain, staining, etc.
  | 'Structure'               // Building, loading dock, etc.
  | 'Interview'               // Person statement
  | 'Historical'              // Evidence of past use
  | 'Regulatory';             // Permits, signage, placards

export interface ExtractedEntity {
  type: EntityType;
  label: string;              // e.g., "Potential REC - surface staining"
  confidence: number;         // 0.0 to 1.0
  description?: string;       // Additional context
  sourcePhotoIds: string[];   // Which photos show this entity
  transcriptRefs: Array<{     // Where in transcript this is mentioned
    start: number;
    end: number;
    text: string;
  }>;
}

// Processing result (stored in IndexedDB)
export interface ProcessingResult {
  id: string;                 // UUID
  projectId: string;          // Links to parent project
  sessionId: string;          // Links to AudioMetadata.sessionId
  createdAt: string;          // ISO8601
  status: 'processing' | 'completed' | 'failed';
  error?: string;             // Error message if failed

  transcript: Transcript;
  photoAnalyses: PhotoAnalysis[];
  entities: ExtractedEntity[];
}

// Progress tracking for UI
export type ProcessingStep =
  | 'transcribing'
  | 'analyzing_photos'
  | 'correlating'
  | 'extracting_entities'
  | 'saving';

export interface ProcessingProgress {
  step: ProcessingStep;
  progress: number;           // 0-100
  message: string;            // e.g., "Analyzing photo 3 of 12"
  currentItem?: number;       // For array processing
  totalItems?: number;
}
