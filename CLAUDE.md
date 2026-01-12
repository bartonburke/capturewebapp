# Claude Context: ChoraGraph Capture PWA

## Project Overview
Mobile-first PWA for capturing Phase 1 Environmental Site Assessment (ESA) data on iOS Safari. Combines continuous audio recording, photo capture with GPS, and timestamp correlation for AI-assisted report generation.

**Status**: Fully functional prototype with audio recording, GPS-tagged photos, project review, and AI transcription (Phase 1)

## Tech Stack
- **Framework**: Next.js 16 (App Router) + React 19 + TypeScript
- **Styling**: Tailwind CSS 4
- **Storage**: IndexedDB (browser-based persistence)
- **Target Platform**: iOS Safari (PWA mode)
- **APIs Used**: MediaDevices (camera), Geolocation (GPS), IndexedDB (storage), MediaRecorder (audio), OpenAI Whisper (transcription), Anthropic Claude (analysis)

## Current Implementation Status

### ✅ Completed Features
- [x] **Projects Management** - Home screen with projects list, create/resume projects
- [x] **IndexedDB Persistence** - Projects, photos, and audio stored locally with full metadata
- [x] **GPS Integration** - Real-time GPS tracking with accuracy display, coordinates saved per photo
- [x] **Continuous Audio Recording** - MediaRecorder captures audio during sessions with pause/resume
- [x] **Project Review Page** - Photo gallery with swipe navigation and audio playback
- [x] **Delete Functionality** - Delete projects, photos, and audio with confirmation dialogs
- [x] **Export Functionality** - Export projects as zip archives with separate media files and JSON metadata
- [x] **Dynamic Routing** - `/` (projects list) → `/project/[id]` (review) → `/capture/[id]` (capture)
- [x] Capture UI with session state management (NOT_STARTED → RECORDING → PAUSED → ENDED)
- [x] Rear camera access with live preview
- [x] Photo capture with flash feedback + base64 storage
- [x] Session timer (HH:MM:SS format) and photo/audio counters
- [x] Pause/Resume with camera/audio stream persistence (no black screen)
- [x] GPS status indicator (acquiring/active/error with accuracy)
- [x] GPS coordinates visible on photo thumbnails and fullscreen view
- [x] Swipe gestures for photo navigation in fullscreen
- [x] Back navigation throughout app
- [x] iOS Safari optimizations (safe area handling, no pull-to-refresh, scrolling)
- [x] PWA manifest for home screen installation
- [x] **AI Transcription (Phase 1)** - Whisper API integration with OpenAI
- [x] Process button for audio sessions with progress modal
- [x] Transcript display with segments, language detection, and duration
- [x] Processing results stored in IndexedDB with persistence
- [x] Green "Processed" badge for completed transcriptions

### 🚧 Next Up (Phase 2)
- Photo analysis with Claude Vision API
- ESA-specific photo descriptions
- Parallel photo processing with progress tracking

### 📋 Planned Features
- [ ] Phase 2: Claude Vision photo analysis
- [ ] Phase 3: Timestamp correlation (photos ↔ transcript segments)
- [ ] Phase 4: Entity extraction (RECs, site features, observations)
- [ ] Share/download individual photos
- [ ] On-device computer vision demo

## Architecture Decisions

### Session State Management
**Decision**: Simple useState with controlled state machine (NOT_STARTED → RECORDING → PAUSED → ENDED)
**Rationale**: Keeps UI logic simple, easy to reason about transitions
**Location**: `app/components/CaptureInterface.tsx:8-9`

### Camera Stream Lifecycle
**Decision**: Keep MediaStream alive during pause, only stop on END or unmount
**Rationale**: Prevents black screen on resume; tracks stay active during pause
**Implementation**:
- `useEffect` with `[sessionState, stream]` dependencies (line 19-30)
- Separate effect to attach stream to video element (line 32-40)
- Explicit play/pause video element on pause/resume (line 106-122)

### iOS Safari Bottom Controls
**Decision**: Use `bottom-24` positioning instead of `bottom-0` with padding
**Rationale**: Safari's UI bar blocks content at `bottom-0`; moving entire container up ensures full visibility
**Location**: `app/components/CaptureInterface.tsx:194`

### Photo Capture Flow
**Decision**: Canvas-based capture from video element
**Rationale**: Works reliably across browsers, allows quality control (JPEG 0.9)
**Current**: Blob created but not persisted (TODO: IndexedDB)
**Location**: `app/components/CaptureInterface.tsx:73-104`

### AI Processing Architecture
**Decision**: Multi-phase processing pipeline with separate API routes
**Rationale**: Modular design allows independent testing and future optimization
**Implementation**:
- Phase 1: Whisper transcription via `/api/transcribe-audio`
- Phase 2: Claude Vision analysis via `/api/analyze-photo` (pending)
- Phase 3: Timestamp correlation in client-side utility
- Phase 4: Entity extraction via `/api/extract-entities` (pending)
**Storage**: ProcessingResult objects in IndexedDB v3 with sessionId indexing
**Location**: `app/project/[projectId]/page.tsx:186-268`

## File Structure
```
app/
├── api/
│   └── transcribe-audio/
│       └── route.ts             # Whisper API endpoint for audio transcription
├── lib/
│   ├── types.ts                 # TypeScript interfaces (Project, Photos, Audio, Processing types)
│   ├── db.ts                    # IndexedDB v3 utilities (CRUD for projects/photos/audio/processing)
│   └── export.ts                # Export utilities (zip generation, file conversion)
├── components/
│   ├── CaptureInterface.tsx     # Camera/audio capture UI (~700 lines)
│   ├── ProjectsList.tsx         # Projects home screen with delete (~190 lines)
│   └── CreateProjectModal.tsx   # Create project form (~110 lines)
├── capture/[projectId]/
│   └── page.tsx                 # Dynamic route for capture interface
├── project/[projectId]/
│   └── page.tsx                 # Project review page with AI processing (~595 lines)
├── globals.css                  # iOS-optimized mobile styles
├── layout.tsx                   # Root layout with PWA meta tags
└── page.tsx                     # Entry point (renders ProjectsList)

public/
├── manifest.json                # PWA configuration
└── icon.svg                     # App icon (camera design)

PRD.md                           # Full product requirements
TESTING.md                       # iOS testing guide
CLAUDE.md                        # This file - context for AI assistants
```

## Data Model

### TypeScript Interfaces (`app/lib/types.ts`)
```typescript
interface Project {
  id: string;              // UUID
  name: string;            // e.g., "123 Main St ESA"
  lead: string;            // Project lead name
  notes?: string;          // Optional notes
  createdAt: string;       // ISO8601
  modifiedAt: string;      // ISO8601
  photoCount: number;      // Total photos
  audioCount: number;      // Total audio recordings
}

interface GpsCoordinates {
  latitude: number;
  longitude: number;
  accuracy: number;        // meters
  timestamp: number;       // Unix timestamp
}

interface PhotoMetadata {
  id: string;              // UUID
  timestamp: string;       // ISO8601
  projectId: string;       // Links to parent project
  gps: GpsCoordinates | null;
  imageData: string;       // Base64 encoded JPEG
  sessionTimestamp: number;  // Session duration when captured
}

interface AudioMetadata {
  id: string;              // UUID
  projectId: string;       // Links to parent project
  sessionId: string;       // Groups recordings from same session
  audioData: string;       // Base64 encoded audio (webm/mp4)
  duration: number;        // Recording duration in seconds
  mimeType: string;        // audio/webm or audio/mp4
  timestamp: string;       // ISO8601
  fileSize: number;        // Bytes
}

// AI Processing Types (added in Phase 1)
interface Transcript {
  fullText: string;
  segments: TranscriptSegment[];
  language?: string;
  duration: number;
}

interface ProcessingResult {
  id: string;
  projectId: string;
  sessionId: string;
  createdAt: string;
  status: 'processing' | 'completed' | 'failed';
  error?: string;
  transcript: Transcript;
  photoAnalyses: PhotoAnalysis[];  // Phase 2
  entities: ExtractedEntity[];     // Phase 4
}
```

### IndexedDB Schema (`choragraph-capture` database, version 3)
- **projects** store - Projects with keyPath `id`, indexed by `modifiedAt`
- **photos** store - Photos with keyPath `id`, indexed by `projectId` and `timestamp`
- **audio** store - Audio recordings with keyPath `id`, indexed by `projectId`, `sessionId`, and `timestamp`
- **processing_results** store - AI processing results with keyPath `id`, indexed by `projectId`, `sessionId`, and `status`

## Development Workflow

### Local Development
```bash
npm run dev  # Starts on localhost:3000 (requires Node 20.9.0+)
```

### iOS Testing
```bash
# Terminal 1: Dev server
npm run dev

# Terminal 2: HTTPS tunnel (required for camera access on iOS)
ngrok http 3000
```

Use ngrok HTTPS URL on iPhone Safari, then add to home screen for PWA mode.

## Known Issues / Limitations

1. **Camera & GPS Permissions**: Require HTTPS on iOS. Use ngrok for local dev.
2. **Node Version**: Requires Node 20.9.0+ (Next.js 16 requirement)
3. **Base64 Storage**: Photos and audio stored as base64 - may impact performance with large projects
4. **Private Browsing**: IndexedDB unavailable in Safari private mode

## Key Code Patterns

### Adding New State
```typescript
// Add to component state
const [newState, setNewState] = useState<Type>(initialValue);

// Update in handlers
const handleSomething = () => {
  setNewState(newValue);
};
```

### Camera Stream Management
```typescript
// Always check stream exists and is active before operations
if (stream && videoRef.current) {
  videoRef.current.srcObject = stream;
  videoRef.current.play().catch(err => console.error(err));
}
```

### iOS Safe Areas
```typescript
// Use bottom offset instead of padding for controls
className="absolute bottom-24 left-0 right-0"  // 96px from bottom
```

### GPS Tracking Pattern
```typescript
// Initialize GPS on session start
const initializeGps = () => {
  watchIdRef.current = navigator.geolocation.watchPosition(
    (position) => setCurrentGps({ lat, lng, accuracy, timestamp }),
    (error) => handleGpsError(error),
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
};

// Stop GPS on session end or unmount
const stopGps = () => {
  if (watchIdRef.current) {
    navigator.geolocation.clearWatch(watchIdRef.current);
  }
};
```

### IndexedDB Photo Storage
```typescript
// Convert blob to base64, save with GPS metadata
canvas.toBlob(async (blob) => {
  const reader = new FileReader();
  reader.onloadend = async () => {
    const photoMetadata: PhotoMetadata = {
      id: crypto.randomUUID(),
      projectId: project.id,
      gps: currentGps ? { ...currentGps } : null,
      imageData: reader.result as string,
      timestamp: new Date().toISOString(),
      sessionTimestamp: duration
    };
    await savePhoto(photoMetadata);
    await updateProject({ ...project, photoCount: project.photoCount + 1 });
  };
  reader.readAsDataURL(blob);
}, 'image/jpeg', 0.9);
```

### Delete Operations Pattern
```typescript
// Cascading delete - remove project and all associated data
export async function deleteProject(projectId: string): Promise<void> {
  const db = await initDB();

  // Delete all photos
  const photos = await getProjectPhotos(projectId);
  for (const photo of photos) {
    await deletePhoto(photo.id);
  }

  // Delete all audio
  const audio = await getProjectAudio(projectId);
  for (const audioRecord of audio) {
    await deleteAudio(audioRecord.id);
  }

  // Delete project itself
  const tx = db.transaction('projects', 'readwrite');
  await tx.objectStore('projects').delete(projectId);
}
```

### Export Pattern
```typescript
// Export project as zip with separate files
const zipBlob = await exportProject(project, photos, audio);
const filename = generateExportFilename(project.name);
downloadBlob(zipBlob, filename);

// Zip structure:
// project-name-2026-01-09.zip
// ├── project.json (metadata without base64)
// ├── photos/
// │   ├── photo-001-timestamp.jpg
// │   └── ...
// └── audio/
//     ├── audio-001-session-id.webm
//     └── ...
```

## Testing Checklist

### Projects Workflow
- [ ] Projects list loads on home screen
- [ ] Create new project modal (name, lead, notes)
- [ ] New project navigates to capture interface
- [ ] Select existing project resumes capture
- [ ] Project photo count updates after capture
- [ ] Back button returns to projects list
- [ ] Data persists after page refresh

### Capture Interface
- [x] Camera preview loads (rear camera)
- [x] GPS indicator appears (yellow → green with accuracy)
- [x] Photo capture works (flash + count increment + IndexedDB save)
- [x] Photos save with GPS coordinates (check console log)
- [x] GPS denied/unavailable → photos still work (gps: null)
- [x] Audio recording starts/pauses/resumes with session
- [x] Audio chunks collected and saved on session end
- [x] Pause stops timer, disables capture button, pauses audio
- [x] Resume keeps camera/audio live, re-enables capture
- [x] End session stops camera/audio/GPS, shows summary, saves audio
- [x] All buttons tappable above Safari bar

### Project Review Page
- [x] Project details page loads with correct stats
- [x] Photo gallery displays all photos in 2-column grid
- [x] GPS coordinates visible on photo thumbnails
- [x] Click photo to view fullscreen
- [x] Swipe left/right to navigate between photos
- [x] Arrow buttons work for photo navigation
- [x] GPS metadata shown in fullscreen footer
- [x] Audio recordings section displays all sessions
- [x] Audio playback works on iOS Safari
- [x] Page scrolls properly to see all content
- [x] Resume button navigates to capture interface
- [x] Back button returns to projects list

### AI Processing (Phase 1)
- [x] Purple "Process" button appears on unprocessed audio
- [x] Processing modal shows with animated progress bar
- [x] Whisper API transcribes audio successfully
- [x] Transcript displays with full text, segments, and language
- [x] Green "Processed" badge appears after completion
- [x] Results persist in IndexedDB and survive page refresh
- [x] Error handling for rate limits and API failures

### iOS Safari Specific
- [ ] HTTPS via ngrok for camera + GPS permissions
- [ ] GPS permission prompt appears on session start
- [ ] Location Services settings respected
- [ ] PWA mode (add to home screen) works
- [ ] No pull-to-refresh interference

## Next Session Goals
1. **Phase 2 - Photo Analysis**: Implement Claude Vision API for ESA-specific photo descriptions
2. **Phase 3 - Timestamp Correlation**: Match photos to transcript segments by timestamp
3. **Phase 4 - Entity Extraction**: Extract RECs, site features, and observations with Claude

## Useful Context for AI Assistants

- **Always test on iOS**: Desktop behavior differs significantly (front camera, no safe area issues)
- **Camera permissions strict**: getUserMedia requires HTTPS or localhost
- **State machine is critical**: Don't break NOT_STARTED → RECORDING → PAUSED → ENDED flow
- **Stream lifecycle matters**: Stopping tracks during pause causes black screen on resume
- **Bottom controls positioning**: Safari UI bar covers `bottom-0`; use `bottom-24` or higher

## Git Workflow
- Commit after each feature milestone
- Use descriptive commit messages with feature lists
- Include testing notes in commits
- Co-author with Claude: `Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>`

## References
- PRD: Full product vision and architecture
- TESTING.md: iOS testing setup and checklist
- Data Model (PRD line 156-191): JSON structure for session data

---

**Last Updated**: 2026-01-11
**Current Status**: Phase 1 (AI Transcription) complete and tested

## Session Summary (2026-01-11) - Phase 1: AI Transcription

### Completed Today
1. ✅ **Dependencies** - Installed `openai` and `@anthropic-ai/sdk` packages
2. ✅ **Environment Setup** - Created `.env.local` with API keys for OpenAI and Anthropic
3. ✅ **Type System** - Extended `app/lib/types.ts` with AI processing interfaces (Transcript, ProcessingResult, ProcessingProgress)
4. ✅ **Database Upgrade** - IndexedDB v2 → v3 with `processing_results` store
5. ✅ **Transcription API** - Created `/app/api/transcribe-audio/route.ts` with Whisper integration
6. ✅ **Process UI** - Added purple "Process" button and animated progress modal
7. ✅ **Transcript Display** - Shows full text, segments, language, and duration
8. ✅ **State Management** - Processing results stored in IndexedDB with sessionId indexing
9. ✅ **Testing** - Successfully transcribed real audio from captured sessions

### Key Files Modified
- `app/lib/types.ts` - Added AI processing types (lines 44-119)
- `app/lib/db.ts` - Upgraded to v3, added processing_results CRUD operations
- `app/api/transcribe-audio/route.ts` - New Whisper API endpoint (146 lines)
- `app/project/[projectId]/page.tsx` - Added processing UI and handlers (~595 lines)
- `.env.local` - Created with OpenAI and Anthropic API keys

### Testing Status
Phase 1 fully tested and working:
- ✅ Process button triggers transcription
- ✅ Progress modal with animated indicators
- ✅ Whisper API transcribes audio successfully
- ✅ Transcript displays with full metadata
- ✅ Results persist in IndexedDB
- ✅ Green "Processed" badge after completion
- ✅ Rate limit errors handled gracefully

### Architecture Notes
- **Modular API Routes**: Each processing phase has its own API endpoint
- **Client-Side Orchestration**: Main processing logic in page component
- **IndexedDB v3**: Separate store for processing results with proper indexing
- **Progress Tracking**: Real-time UI updates during multi-step processing

## Previous Session Summary (2026-01-09)

### Completed
1. ✅ **Audio Recording** - Full MediaRecorder integration with pause/resume lifecycle
2. ✅ **Project Review Page** - Photo gallery with GPS display and audio playback
3. ✅ **Swipe Navigation** - Touch gestures for navigating between photos
4. ✅ **Bug Fixes** - Fixed stale project prop causing incorrect photo/audio counts
5. ✅ **UI Improvements** - GPS coordinates on thumbnails, scrolling fixes, navigation arrows

### Key Commits
- `67ef5ac` - Fix stale project prop causing incorrect photo/audio counts
- `22fdfd9` - Add project details/review page with photo gallery and audio playback
- `3a131e3` - Fix scrolling, add swipe navigation, and show GPS on photo thumbnails
