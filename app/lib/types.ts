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
  thumbnail?: string;      // Base64 thumbnail from first photo (small, ~200x200)
  thumbnailPhotoId?: string; // ID of selected cover photo

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

export interface CompassData {
  heading: number;         // 0-360 degrees (0 = North, 90 = East, etc.)
  accuracy?: number;       // degrees of accuracy (iOS provides this)
  timestamp: number;       // Unix timestamp when reading was taken
}

export interface PhotoMetadata {
  id: string;              // UUID
  timestamp: string;       // ISO8601
  projectId: string;       // Link to parent project
  gps: GpsCoordinates | null;
  compass: CompassData | null;  // Device compass heading when photo was taken
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
export type CompassStatus = 'NOT_REQUESTED' | 'REQUESTING' | 'ACTIVE' | 'ERROR' | 'DENIED' | 'UNSUPPORTED';
export type SessionState = 'NOT_STARTED' | 'RECORDING' | 'PAUSED' | 'ENDED';

// Multi-project platform support types
export type ProjectType =
  | 'phase1-esa' | 'eir-eis' | 'borehole' | 'asset-tagging' | 'generic'  // work
  | 'home-inventory' | 'travel-log' | 'personal-todos';                   // personal

export type ProjectCategory = 'work' | 'personal';
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
  transcriptSegment: TranscriptSegment | string | null;  // Matched transcript segment or context window string
  timestamp: string;          // When photo was taken (ISO8601)
  gps: GpsCoordinates | null; // GPS at photo time

  // Home inventory specific fields (graph-ready format)
  room?: string;              // Which room (lowercase)
  area?: string | null;       // Where in the room
  container?: string | null;  // What holds the items
  items?: Array<{             // List of items visible
    name: string;
    attributes?: Record<string, string>;
  }>;
}

// Photo-specific entity (simpler than ExtractedEntity for Phase 4)
// Entity types are dynamic based on project type - these are the common ones
export interface PhotoEntity {
  type: string;  // Dynamic based on project entitySchema + transcript-derived types
  // Common types: 'REC' | 'AOC' | 'Feature' | 'Equipment' | 'Condition'
  // Home inventory: 'item' | 'location' | 'container' | 'note'
  // Transcript-derived: 'ActionItem' | 'Question' | 'Observation'
  description: string;
  severity: 'high' | 'medium' | 'low' | 'info';
  recommendation?: string;
  // Transcript-aware analysis fields
  consultantContext?: string;  // What the consultant said that prompted this
  aiResponse?: string;         // AI's answer to a question, if applicable
  // Enhanced transcript-derived fields
  extractedData?: string;      // Specific data extracted (serial numbers, measurements)
  suggestedFollowUp?: string;  // Suggested additional photo if current doesn't capture request
  priorityReason?: string;     // Why this was flagged high priority (from verbal cues)
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
  synthesis?: SessionSynthesis;  // Phase 5: cross-photo synthesis
}

// ============================================================================
// Session Synthesis Types (Phase 5)
// ============================================================================

// Session synthesis result - produced after all photos analyzed
export interface SessionSynthesis {
  id: string;
  sessionId: string;
  createdAt: string;
  projectType: ProjectType;

  // Cross-photo intelligence
  entityClusters: EntityCluster[];      // Deduplicated entities across photos
  locationHierarchy: LocationNode[];    // Room → area → container → spot tree
  searchIndex: SearchIndexEntry[];      // Fast lookup terms
  coverageAnalysis: CoverageAnalysis;   // Missing areas detection

  // Project-type-specific deliverables
  deliverables: SynthesisDeliverable[];

  // Metadata
  llmModel?: string;
  graphQueriesExecuted?: string[];
  synthesisMethod: 'graph' | 'indexeddb';  // Which data source was used
}

// Entity clusters - same item appearing across multiple photos
export interface EntityCluster {
  clusterId: string;
  canonicalName: string;        // Unified name for the entity
  entityType: string;           // item, location, container, etc.
  photoIds: string[];           // All photos showing this entity
  descriptions: string[];       // All descriptions from each photo
  mergedDescription: string;    // LLM-synthesized unified description
  locations: string[];          // All locations where this entity appears
  confidence: number;           // 0-1 clustering confidence
}

// Location hierarchy node
export interface LocationNode {
  id: string;
  name: string;
  level: 'room' | 'area' | 'container' | 'shelf' | 'spot' | 'other';
  parentId?: string;            // For tree structure
  children?: LocationNode[];    // Child nodes (built at runtime)
  photoIds: string[];           // Photos taken at this location
  itemCount: number;            // Number of items at this location
}

// Search index entry for fast lookup
export interface SearchIndexEntry {
  term: string;                 // Search term (item name, category, etc.)
  type: 'item' | 'location' | 'category' | 'tag' | 'container';
  matches: SearchMatch[];
}

export interface SearchMatch {
  photoId: string;
  entityId?: string;
  clusterId?: string;
  relevance: number;            // 0-1 relevance score
  context?: string;             // Snippet showing match context
}

// Coverage analysis - what's missing
export interface CoverageAnalysis {
  mentionedLocations: string[];     // Locations mentioned in transcript
  photographedLocations: string[];  // Locations with photos
  missingLocations: string[];       // Mentioned but not photographed
  suggestedFollowups: string[];     // What to capture next
  completenessScore: number;        // 0-1 overall coverage
}

// Generic deliverable wrapper
export interface SynthesisDeliverable {
  id: string;
  type: SynthesisDeliverableType;
  title: string;
  format: 'markdown' | 'json' | 'html';
  content: string;              // The actual deliverable content
  generatedAt: string;          // ISO8601
  metadata?: Record<string, unknown>;
}

// Deliverable types per project type
export type SynthesisDeliverableType =
  // Home inventory deliverables
  | 'room-inventory'            // Items organized by room
  | 'item-index'                // Alphabetical item list with locations
  | 'storage-map'               // What's in each container
  | 'cross-references'          // Items in multiple places
  | 'coverage-report'           // Missing areas
  // Future: other project types
  | 'findings-summary'          // For ESA/EIR
  | 'site-observations'
  | 'recommendations';

// Progress tracking for UI
export type ProcessingStep =
  | 'uploading'
  | 'transcribing'
  | 'analyzing_photos'
  | 'correlating'
  | 'extracting_entities'
  | 'saving'
  | 'syncing'              // Syncing to Neo4j graph
  | 'synthesizing';        // Phase 5: cross-photo synthesis

export interface ProcessingProgress {
  step: ProcessingStep;
  progress: number;           // 0-100
  message: string;            // e.g., "Analyzing photo 3 of 12"
  currentItem?: number;       // For array processing
  totalItems?: number;
}
