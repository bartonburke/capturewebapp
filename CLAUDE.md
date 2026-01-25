# ChoraGraph Capture

## What Is This?

A domain-agnostic field capture system that turns photos into navigable spatial knowledge graphs.

**The core insight:** Photos are **navigation primitives**, not attachments. Instead of documents containing photos as evidence (traditional), photos are entry points into rich, graph-connected data. The map surfaces photos; clicking a photo traverses into everything connected to that place. See [docs/photos-as-navigation-primitives.md](docs/photos-as-navigation-primitives.md) for the full argument.

**Current status:** Fully functional prototype (Phase 2 complete). Captures audio, GPS-tagged photos, AI transcription and vision analysis. Outputs graph-ready "Portable Evidence Packages" for Neo4j ingestion.

**Designed for:** Any workflow where evidence lives at locations — environmental consulting, construction inspections, asset management, personal documentation. Domain logic is defined by conversational schema creation, not hard-coded.

**Platform:** iOS Safari PWA (mobile-first), works offline, syncs on export.

---

## Core Architecture

This capture app is the front-end for a spatial knowledge graph (Neo4j). The following decisions shape everything:

### 1. Photos as Navigation Primitives

The traditional hierarchy (Project → Document → Photo as attachment) is inverted. Photos are the human-legible entry points into the graph. The map surfaces photos; clicking a photo traverses into the underlying data.

### 2. Graph-Shaped from the Start

The Portable Evidence Package outputs data ready for direct Neo4j ingestion, not document-shaped JSON requiring transformation. See [docs/photo-graph-schema.md](docs/photo-graph-schema.md) for the complete schema.

### 3. Locations are First-Class Nodes

Every photo connects to a Location node via `TAKEN_AT`. Locations have hierarchy (country → state → city → site → area → point) and can have hero images for navigation. Zoom level on a map = traversal depth in the graph.

### 4. Entities are Nodes, Tags are Properties

Structured findings (REC, Equipment, Defect) become Entity nodes linked via `SHOWS`. Flat tags (`catalogTags`) remain as searchable properties on Photo nodes.

### 5. Conversational Schema Creation

Entity schemas don't require upfront product definition. A 5-minute conversation with an agent generates the entity types, capture prompts, and vision analysis instructions. Schemas are saved as reusable templates. This enables the long tail of field workflows without product teams scoping each domain.

### 6. Defensibility via Decision Nodes

For regulated industries, every classification decision (human or AI) creates a Decision node with `BASED_ON` links to evidence, `madeBy` provenance, and `OVERRIDES` chains for revision history. Append-only; never mutate. This answers "why did you conclude this?"

### Key Architecture Documents

| Document | Purpose |
|----------|---------|
| [photos-as-navigation-primitives.md](docs/photos-as-navigation-primitives.md) | Core concept: photos are entry points, not attachments |
| [photo-graph-schema.md](docs/photo-graph-schema.md) | Neo4j schema: nodes, relationships, Portable Evidence Package format |
| [graph-database-briefing.md](docs/graph-database-briefing.md) | Neo4j fundamentals, trade-offs, geospatial capabilities |
| [SPATIAL-SEARCH-ARCHITECTURE.md](docs/SPATIAL-SEARCH-ARCHITECTURE.md) | 2-day MVP: Neo4j Aura Free, NL→Cypher search API |

### Integration Notes

- This capture app feeds into SimAnalytica's Compass Engine (existing Neo4j spatial graph)
- Integration pattern with Compass is TBD — likely via shared Location nodes or spatial join at query time
- The photo subgraph is designed to stand alone initially, then connect

---

## Why This Architecture?

### Problems It Solves

1. **Photos are forgotten.** Field teams capture detailed evidence but never consult it again. The capture intent was good ("I need to remember this"); the retrieval mechanism failed. Spatial retrieval (photos on a map) fixes this — you find photos where you took them.

2. **Schemas are rigid.** Domain software requires upfront product definition. Adding entity types = weeks of scoping. Conversational schema creation lets any user define their workflow in 5 minutes.

3. **Decisions are opaque.** Regulated industries need audit trails: who concluded what, based on what evidence. Traditional systems don't track this. Decision nodes make every classification traceable with full provenance.

### The Bet

Spatial memory (photos) + conversational extensibility (schemas) + graph defensibility (Decision nodes) = a new category. Not domain-specific software, but a configurable spatial memory system for any field evidence work.

---

## Tech Stack

- **Framework**: Next.js 16 (App Router) + React 19 + TypeScript
- **Styling**: Tailwind CSS 4
- **Storage**: IndexedDB (browser-based persistence)
- **Target Platform**: iOS Safari (PWA mode)
- **APIs Used**: MediaDevices (camera), Geolocation (GPS), IndexedDB (storage), MediaRecorder (audio), OpenAI Whisper (transcription), Anthropic Claude (analysis)

---

## Implementation Status

### Completed Features

- **Projects Management** - Home screen with projects list, create/resume projects
- **IndexedDB Persistence** - Projects, photos, and audio stored locally with full metadata
- **GPS Integration** - Real-time GPS tracking with accuracy display, coordinates saved per photo
- **Continuous Audio Recording** - MediaRecorder captures audio during sessions with pause/resume
- **Project Review Page** - Photo gallery with swipe navigation and audio playback
- **Delete Functionality** - Delete projects, photos, and audio with confirmation dialogs
- **Export Functionality** - Export projects as zip archives with separate media files and JSON metadata
- **Dynamic Routing** - `/` (projects list) → `/project/[id]` (review) → `/capture/[id]` (capture)
- **Capture UI** - Session state management (NOT_STARTED → RECORDING → PAUSED → ENDED)
- **Camera** - Rear camera access with live preview, photo capture with flash feedback
- **Session Controls** - Timer (HH:MM:SS), photo/audio counters, pause/resume with stream persistence
- **GPS Display** - Status indicator (acquiring/active/error), coordinates on thumbnails and fullscreen
- **iOS Safari Optimizations** - Safe area handling, no pull-to-refresh, proper scrolling
- **PWA** - Manifest for home screen installation
- **AI Transcription** - Whisper API integration with progress modal and transcript display
- **Multi-Project Support** - Project types: Phase I ESA, EIR/EIS, Borehole, Generic + Personal types (home-inventory, travel-log, personal-todos)
- **Launch API** - `/api/v1/capture/launch` for external session creation
- **Portable Evidence Package v2.0** - Export with vision analysis and entity extraction
- **Auto-Import** - Export automatically syncs to `evidence/sessions/`
- **SESSION_SUMMARY.md** - Human/Claude-readable context for each session
- **Vercel Blob Storage** - Large audio files (>4MB) upload to cloud before transcription
- **Audio-Only Recording** - MediaRecorder uses audio-only stream (10x smaller files)
- **Photo-Only Processing** - Analyze photos without transcript for legacy oversized audio
- **Enhanced Vision Analysis** - 11-instruction transcript-aware photo analysis prompts
- **Session Length Limit** - 4-hour max with 5-minute warning

### Next Up (Phase 3)

- Timestamp correlation (photos ↔ transcript segments)
- Entity extraction refinement

### Planned

- Share/download individual photos
- On-device computer vision demo

---

## Technical Reference

### Implementation Decisions

#### Session State Management
Simple useState with controlled state machine (NOT_STARTED → RECORDING → PAUSED → ENDED). Keeps UI logic simple, easy to reason about transitions.
Location: `app/components/CaptureInterface.tsx:8-9`

#### Camera Stream Lifecycle
Keep MediaStream alive during pause, only stop on END or unmount. Prevents black screen on resume; tracks stay active during pause.
Location: `app/components/CaptureInterface.tsx:19-40, 106-122`

#### iOS Safari Bottom Controls
Use `bottom-24` positioning instead of `bottom-0` with padding. Safari's UI bar blocks content at `bottom-0`.
Location: `app/components/CaptureInterface.tsx:194`

#### Photo Capture Flow
Canvas-based capture from video element. Works reliably across browsers, allows quality control (JPEG 0.9).
Location: `app/components/CaptureInterface.tsx:73-104`

#### AI Processing Architecture
Multi-phase processing pipeline with separate API routes:
- Phase 1: Whisper transcription via `/api/transcribe-audio`
- Phase 2: Claude Vision analysis via `/api/analyze-photo`
- Phase 3: Timestamp correlation (client-side)
- Phase 4: Entity extraction via `/api/extract-entities`

ProcessingResult objects stored in IndexedDB v4 with sessionId indexing.

### File Structure

```
app/
├── api/
│   ├── transcribe-audio/route.ts    # Whisper API endpoint
│   ├── analyze-photo/route.ts       # Claude Vision endpoint
│   ├── upload-audio/route.ts        # Vercel Blob upload
│   └── v1/capture/
│       ├── launch/route.ts          # External session creation
│       └── import/route.ts          # Receive exported packages
├── lib/
│   ├── types.ts                     # TypeScript interfaces
│   ├── db.ts                        # IndexedDB v4 utilities
│   ├── export.ts                    # Export utilities (zip, conversion)
│   └── defaultContexts.ts           # Entity schemas per project type
├── components/
│   ├── CaptureInterface.tsx         # Camera/audio capture UI (~700 lines)
│   ├── ProjectsList.tsx             # Projects home screen (~190 lines)
│   └── CreateProjectModal.tsx       # Create project form (~110 lines)
├── capture/[projectId]/page.tsx     # Capture interface route
├── project/[projectId]/page.tsx     # Project review page (~595 lines)
├── session/[sessionId]/page.tsx     # Handle launched sessions
├── globals.css                      # iOS-optimized mobile styles
├── layout.tsx                       # Root layout with PWA meta tags
└── page.tsx                         # Entry point (renders ProjectsList)

evidence/sessions/                   # Imported field capture sessions
public/
├── manifest.json                    # PWA configuration
└── icon.svg                         # App icon
```

### Data Model

```typescript
interface Project {
  id: string;              // UUID
  name: string;
  lead: string;
  notes?: string;
  createdAt: string;       // ISO8601
  modifiedAt: string;
  photoCount: number;
  audioCount: number;
}

interface PhotoMetadata {
  id: string;
  timestamp: string;
  projectId: string;
  gps: GpsCoordinates | null;
  imageData: string;       // Base64 JPEG
  sessionTimestamp: number;
}

interface AudioMetadata {
  id: string;
  projectId: string;
  sessionId: string;
  audioData: string;       // Base64 webm/mp4
  duration: number;
  mimeType: string;
  timestamp: string;
  fileSize: number;
}

interface ProcessingResult {
  id: string;
  projectId: string;
  sessionId: string;
  createdAt: string;
  status: 'processing' | 'completed' | 'failed';
  error?: string;
  transcript: Transcript;
  photoAnalyses: PhotoAnalysis[];
  entities: ExtractedEntity[];
}
```

**IndexedDB Schema** (`choragraph-capture`, version 4):
- **projects** - keyPath `id`, indexed by `modifiedAt`
- **photos** - keyPath `id`, indexed by `projectId`, `timestamp`
- **audio** - keyPath `id`, indexed by `projectId`, `sessionId`, `timestamp`
- **processing_results** - keyPath `id`, indexed by `projectId`, `sessionId`, `status`

### Key Code Patterns

#### Camera Stream Management
```typescript
// Always check stream exists and is active before operations
if (stream && videoRef.current) {
  videoRef.current.srcObject = stream;
  videoRef.current.play().catch(err => console.error(err));
}
```

#### iOS Safe Areas
```typescript
// Use bottom offset instead of padding for controls
className="absolute bottom-24 left-0 right-0"  // 96px from bottom
```

#### GPS Tracking
```typescript
const initializeGps = () => {
  watchIdRef.current = navigator.geolocation.watchPosition(
    (position) => setCurrentGps({ lat, lng, accuracy, timestamp }),
    (error) => handleGpsError(error),
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
};

const stopGps = () => {
  if (watchIdRef.current) {
    navigator.geolocation.clearWatch(watchIdRef.current);
  }
};
```

---

## Development

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

### Known Issues

1. **Camera & GPS Permissions**: Require HTTPS on iOS. Use ngrok for local dev.
2. **Node Version**: Requires Node 20.9.0+ (Next.js 16 requirement)
3. **Base64 Storage**: Photos and audio stored as base64 — may impact performance with large projects
4. **Private Browsing**: IndexedDB unavailable in Safari private mode

### Testing Checklist

**Critical paths to verify:**
- [ ] Camera preview loads (rear camera on iOS)
- [ ] GPS acquires and shows accuracy
- [ ] Photo capture saves with GPS coordinates
- [ ] Audio recording starts/pauses/resumes correctly
- [ ] Session end saves audio and shows summary
- [ ] Process button triggers transcription successfully
- [ ] Export creates downloadable zip
- [ ] PWA mode works from home screen

### Git Workflow

- Commit after each feature milestone
- Use descriptive commit messages
- Co-author: `Co-Authored-By: Claude <noreply@anthropic.com>`

---

## Appendix: Working with Field Session Data

Field capture sessions are automatically imported to `evidence/sessions/{sessionId}/` when exported from the mobile PWA.

### Directory Structure
```
evidence/sessions/{sessionId}/
├── index.json              # Complete metadata (Portable Evidence Package v2.0)
├── SESSION_SUMMARY.md      # Human/Claude readable summary - START HERE
├── session-audio.webm      # Audio recording
├── transcript.txt          # Plain text transcript (if processed)
└── photos/
    ├── 001-interior-wall.jpg
    └── ...
```

### Working with Sessions

**Find available sessions:**
```bash
ls -la evidence/sessions/
```

**Get context about a session:**
```bash
cat evidence/sessions/{sessionId}/SESSION_SUMMARY.md
```

**SESSION_SUMMARY.md contains:**
- Project name, type, and capture timestamp
- Photo count, audio duration, transcript availability
- GPS coordinates of capture location
- Extracted entities
- Transcript excerpt
- Photo observations

### Key Fields in index.json

- `session_id`: Unique identifier
- `project_type`: "phase1-esa", "eir-eis", "borehole", "asset-tagging", "generic", "home-inventory", "travel-log", "personal-todos"
- `photos[]`: Array with filename, GPS, timestamp, vision_analysis, tags
- `transcript`: Full text and segments with timestamps
- `session_summary.entities_extracted`: Count by entity type
- `processing_stage`: "captured", "transcribed", "analyzed", or "graph_ready"

### Common Tasks

**List all sessions with project types:**
```bash
for dir in evidence/sessions/*/; do
  if [ -f "$dir/index.json" ]; then
    echo "$dir: $(jq -r '.project_type + " - " + .project_name' "$dir/index.json")"
  fi
done
```

---

**Last Updated**: 2026-01-25
