# Claude Context: ChoraGraph Capture PWA

## Project Overview
Mobile-first PWA for capturing Phase 1 Environmental Site Assessment (ESA) data on iOS Safari. Combines continuous audio recording, photo capture with GPS, and timestamp correlation for AI-assisted report generation.

**Status**: Prototype with Projects management + GPS-tagged photo capture + IndexedDB persistence

## Tech Stack
- **Framework**: Next.js 16 (App Router) + React 19 + TypeScript
- **Styling**: Tailwind CSS 4
- **Storage**: IndexedDB (browser-based persistence)
- **Target Platform**: iOS Safari (PWA mode)
- **APIs Used**: MediaDevices (camera), Geolocation (GPS), IndexedDB (storage), MediaRecorder (audio - not yet implemented)

## Current Implementation Status

### ✅ Completed Features
- [x] **Projects Management** - Home screen with projects list, create/resume projects
- [x] **IndexedDB Persistence** - Projects and photos stored locally with full metadata
- [x] **GPS Integration** - Real-time GPS tracking with accuracy display, coordinates saved per photo
- [x] **Dynamic Routing** - Navigate between projects list and capture interface (`/capture/[projectId]`)
- [x] Capture UI with session state management (NOT_STARTED → RECORDING → PAUSED → ENDED)
- [x] Rear camera access with live preview
- [x] Photo capture with flash feedback + base64 storage
- [x] Session timer (HH:MM:SS format) and photo counter
- [x] Pause/Resume with camera stream persistence (no black screen)
- [x] GPS status indicator (acquiring/active/error with accuracy)
- [x] Back navigation to projects list
- [x] iOS Safari optimizations (safe area handling, no pull-to-refresh)
- [x] PWA manifest for home screen installation

### 🚧 Next Up
- [ ] Continuous audio recording during session
- [ ] Project details/review page (view captured photos)

### 📋 Planned Features
- [ ] Post-session processing (Whisper transcription + Claude Vision analysis)
- [ ] Review/gallery interface
- [ ] Export structured JSON
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

## File Structure
```
app/
├── lib/
│   ├── types.ts                 # Shared TypeScript interfaces (Project, PhotoMetadata, GPS)
│   └── db.ts                    # IndexedDB utilities (CRUD for projects/photos)
├── components/
│   ├── CaptureInterface.tsx     # Photo capture UI with GPS (~420 lines)
│   ├── ProjectsList.tsx         # Projects home screen (~110 lines)
│   └── CreateProjectModal.tsx   # Create project form (~110 lines)
├── capture/[projectId]/
│   └── page.tsx                 # Dynamic route for project capture
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
```

### IndexedDB Schema (`choragraph-capture` database)
- **projects** store - Projects with keyPath `id`, indexed by `modifiedAt`
- **photos** store - Photos with keyPath `id`, indexed by `projectId` and `timestamp`

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
3. **Base64 Storage**: Photos stored as base64 strings - may impact performance with many photos
4. **No Audio Recording**: MediaRecorder not yet implemented
5. **No Photo Review**: Can't view captured photos yet (only counter updates)
6. **Private Browsing**: IndexedDB unavailable in Safari private mode

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
- [ ] Camera preview loads (rear camera)
- [ ] GPS indicator appears (yellow → green with accuracy)
- [ ] Photo capture works (flash + count increment + IndexedDB save)
- [ ] Photos save with GPS coordinates (check console log)
- [ ] GPS denied/unavailable → photos still work (gps: null)
- [ ] Pause stops timer, disables capture button
- [ ] Resume keeps camera live, re-enables capture
- [ ] End session stops camera & GPS, shows summary
- [ ] All buttons tappable above Safari bar

### iOS Safari Specific
- [ ] HTTPS via ngrok for camera + GPS permissions
- [ ] GPS permission prompt appears on session start
- [ ] Location Services settings respected
- [ ] PWA mode (add to home screen) works
- [ ] No pull-to-refresh interference

## Next Session Goals
1. **Audio Recording**: MediaRecorder integration for continuous recording during session
2. **Photo Review Interface**: View captured photos from project details page
3. **Export Functionality**: Export project data (photos + GPS + metadata) to JSON

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

**Last Updated**: 2026-01-09
**Current Commit**: 9cea238 - "Implement ChoraGraph Capture PWA with iOS-optimized session UI"
