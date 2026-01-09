# Claude Context: ChoraGraph Capture PWA

## Project Overview
Mobile-first PWA for capturing Phase 1 Environmental Site Assessment (ESA) data on iOS Safari. Combines continuous audio recording, photo capture with GPS, and timestamp correlation for AI-assisted report generation.

**Status**: Early prototype - capture UI functional, storage/processing not yet implemented

## Tech Stack
- **Framework**: Next.js 16 (App Router) + React 19 + TypeScript
- **Styling**: Tailwind CSS 4
- **Target Platform**: iOS Safari (PWA mode)
- **APIs Used**: MediaDevices (camera), Geolocation (GPS - not yet implemented), MediaRecorder (audio - not yet implemented)

## Current Implementation Status

### ✅ Completed Features
- [x] Capture UI shell with session state management (NOT_STARTED → RECORDING → PAUSED → ENDED)
- [x] Rear camera access with live preview
- [x] Photo capture with flash feedback
- [x] Session timer (HH:MM:SS format)
- [x] Photo counter
- [x] Pause/Resume with camera stream persistence (no black screen)
- [x] iOS Safari optimizations (safe area handling, no pull-to-refresh)
- [x] PWA manifest for home screen installation
- [x] Touch-optimized controls positioned above Safari UI bar

### 🚧 In Progress
- [ ] GPS tagging for photos (next up)
- [ ] Continuous audio recording during session
- [ ] IndexedDB storage for photos + metadata
- [ ] Session metadata (site name, timestamps)

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
├── components/
│   └── CaptureInterface.tsx    # Main capture UI (301 lines)
├── globals.css                  # iOS-optimized mobile styles
├── layout.tsx                   # Root layout with PWA meta tags
└── page.tsx                     # Entry point (renders CaptureInterface)

public/
├── manifest.json                # PWA configuration
└── icon.svg                     # App icon (camera design)

PRD.md                           # Full product requirements
TESTING.md                       # iOS testing guide (ngrok setup, checklist)
```

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

1. **Camera Permission**: Requires HTTPS on iOS. Use ngrok for local dev.
2. **Node Version**: Requires Node 20.9.0+ (Next.js 16 requirement)
3. **Photos Not Persisted**: Currently increment counter but don't save to IndexedDB
4. **No GPS Yet**: Location API not integrated
5. **No Audio Recording**: MediaRecorder not implemented

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

## Testing Checklist (from TESTING.md)
- [ ] Camera preview loads (rear camera)
- [ ] Photo capture works (flash + count increment)
- [ ] Pause stops timer, disables capture button
- [ ] Resume keeps camera live, re-enables capture
- [ ] End session stops camera, shows summary
- [ ] All buttons tappable above Safari bar

## Next Session Goals
1. **GPS Integration**: Capture location on photo capture, display in UI
2. **Storage Layer**: IndexedDB schema + persistence for photos
3. **Audio Recording**: MediaRecorder integration for continuous recording

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
