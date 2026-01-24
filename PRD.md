# ChoraGraph Capture — Product Requirements Document

**Version:** 1.0 (Working Prototype)
**Date:** January 16, 2026
**Author:** Bart Burke + Claude

> **See also:** [VISION.md](./VISION.md) for the broader ChoraGraph platform vision
> **See also:** [CLAUDE.md](./CLAUDE.md) for development context and implementation details

---

## 1. Context

ChoraGraph is a spatial interface layer for work done in the real world. It has two modes:

| Mode | Interface | Purpose |
|------|-----------|---------|
| **Capture** | Camera | Collect evidence in the field — photos, audio, observations anchored to location |
| **View** | Map | See, navigate, and act on spatial data — browse captured content, deep link to other apps |

**This prototype implements Capture mode** with AI-powered processing.

---

## 2. Problem Statement

Phase 1 Environmental Site Assessments (ESAs) require site reconnaissance where environmental professionals walk properties capturing photos, observations, and notes. Current workflows are fragmented: photos in the camera roll, voice memos in a separate app, handwritten notes, GPS logged elsewhere. This data must later be manually assembled, correlated, and structured for the ESA report.

There is no tool that captures all site data in a unified, structured, spatially-aware format that feeds directly into AI-assisted report generation.

**The ChoraGraph vision:** Field capture is just the beginning. Back at their desk, this semi-structured visual data awaits them in the SimAnalytica engine. The Project Map has a GIS Assistant to help visualize all key project data—EDR reports, surrounding parcels, potential RECs—and populate the map with relevant layers. A whole range of AI tools for the job at hand are available within this environment, turning raw field capture into actionable intelligence and draft reports.

---

## 3. Solution Overview

A mobile-first web app (PWA) optimized for Safari/iOS that enables field professionals to capture site assessment data—photos, continuous audio/dictation, and GPS—in a single session. Post-session processing transcribes audio, correlates transcript segments to photos via timestamps, analyzes images with vision AI, and extracts ESA-relevant concepts (RECs, site features, observations). The output is a structured, graph-ready dataset.

This prototype demonstrates the core concept of **building a spatial knowledge graph from mobile capture**, laying groundwork for integration with SimAnalytica's Compass: Engine and the ChoraGraph AI agent initiative.

---

## 4. Target User

**Primary:** Environmental consultants conducting Phase 1 ESA site visits
**Secondary:** EIR/EIS specialists, borehole logging technicians, general site inspectors
**Context:** Walking a property, phone in hand, capturing evidence and observations on the go
**Device:** iPhone with Safari

---

## 5. Core Concepts

### 5.1 Photo as the Atomic Unit

Each photo becomes a **node in the knowledge graph**. Attached to each photo node:

- GPS coordinates + timestamp
- Surrounding transcript context (what was said before/during/after the shot)
- VLM analysis (AI description of image contents)
- Extracted ESA concepts (potential RECs, site features, observations)
- Manual or auto-generated tags
- (Future) Agent attachment point

### 5.2 Continuous Audio → Structured Transcript

Audio recording runs continuously throughout the site visit. Post-session:

1. Full audio is transcribed (Whisper API)
2. AI processes transcript to extract ESA-relevant entities: RECs, ASTs, USTs, staining, interviews, historical indicators, regulatory observations
3. Transcript segments are correlated to photos via timestamps

### 5.3 Workflow-Specific Schema

The data schema is shaped by the job to be done. The app supports multiple project types:

| Project Type | Use Case | Entity Focus |
|--------------|----------|--------------|
| **Phase I ESA** | Environmental site assessments | RECs, USTs, ASTs, staining, regulatory |
| **EIR/EIS** | Environmental impact reports | Habitat, species, land use, mitigation |
| **Borehole** | Subsurface investigation logging | Soil types, water levels, stratigraphy |
| **Generic** | General site documentation | Flexible entity schema |

The architecture supports swapping schemas for different workflows without changing the capture flow.

### 5.4 Spatial Agents (Conceptual)

Agents live in places. In the knowledge graph:

```
Project (Site Assessment)
  └── Site Agent (scoped to this project/location)
        └── Photo Node
              └── Contextual data, extracted entities, agent can assist here
```

For the prototype, the "agent" is Claude with ESA context + access to the photo and transcript segment. The graph structure demonstrates how agents could persist spatially in future versions (AR cloud, digital twin integration).

---

## 6. Current Feature Set (Implemented)

### 6.1 Projects Management

| Feature | Description | Status |
|---------|-------------|--------|
| **Projects list** | Home screen showing all projects with metadata | ✅ Implemented |
| **Create project** | Modal with name, lead, notes, project type selection | ✅ Implemented |
| **Project types** | Phase I ESA, EIR/EIS, Borehole, Generic with badges | ✅ Implemented |
| **Delete project** | Cascading delete of project + photos + audio | ✅ Implemented |
| **Resume capture** | Continue capturing on existing project | ✅ Implemented |

### 6.2 Capture Mode

#### Session Header (Always Visible During Capture)
| Element | Description |
|---------|-------------|
| **Back button** | Return to projects list |
| **Project name** | Current project title |
| **Session status** | Recording / Paused indicator with colored dot |
| **Duration** | Elapsed time (HH:MM:SS format) |
| **Photo count** | Number of photos captured this session |
| **GPS status** | Acquiring/Active/Error with accuracy (±Xm) |
| **Audio indicator** | Red pulsing dot when recording audio |
| **Capture prompts** | Rotating contextual tips (10-second intervals) |

#### Live View
- Rear camera preview (full screen behind controls)
- Recording indicator (red dot/pulse when audio is live)
- Flash overlay feedback on photo capture

#### Controls & States

**NOT_STARTED STATE:**
| Control | Action |
|---------|--------|
| **Start Session** | Begin recording → initialize camera, audio, GPS |

**RECORDING STATE:**
| Control | Action |
|---------|--------|
| **📷 Capture** | Take photo (GPS + timestamp attached, saved to IndexedDB) |
| **Pause** | Pause audio recording, stay in session |
| **End Session** | End session → save audio → show summary |

**PAUSED STATE:**
| Control | Action |
|---------|--------|
| **📷 Capture** | **DISABLED** (grayed out, cannot take photos while paused) |
| **Resume** | Resume audio recording, re-enable capture |
| **End Session** | End session → save audio → show summary |

**ENDED STATE:**
| Control | Action |
|---------|--------|
| **Back to Projects** | Return to projects list |
| **New Session** | Start another capture session |

#### Session Flow
```
[Start Session] → RECORDING → [Pause] → PAUSED → [Resume] → RECORDING
                      │                     │
                      └──── [End Session] ──┘
                                  │
                                  ▼
                      ┌─────────────────────┐
                      │ Session Complete    │
                      │ Summary displayed   │
                      └─────────────────────┘
```

### 6.3 Project Review Interface

| Feature | Description | Status |
|---------|-------------|--------|
| **Photo gallery** | 2-column grid of captured photos | ✅ Implemented |
| **GPS on thumbnails** | Coordinates visible on each photo | ✅ Implemented |
| **Fullscreen view** | Tap to expand photo | ✅ Implemented |
| **Swipe navigation** | Touch gestures between photos | ✅ Implemented |
| **Arrow navigation** | Button navigation in fullscreen | ✅ Implemented |
| **Audio playback** | Native audio player for recordings | ✅ Implemented |
| **Delete photos** | Remove individual photos | ✅ Implemented |
| **Delete audio** | Remove audio recordings | ✅ Implemented |

### 6.4 AI Processing Pipeline

| Phase | Feature | Technology | Status |
|-------|---------|------------|--------|
| **Phase 1** | Audio transcription | OpenAI Whisper API | ✅ Implemented |
| **Phase 2** | Photo analysis | Claude Vision API | 🚧 In Progress |
| **Phase 3** | Timestamp correlation | Client-side matching | 📋 Planned |
| **Phase 4** | Entity extraction | Claude API | 📋 Planned |

#### Phase 1: Transcription (Implemented)
- Purple "Process" button on unprocessed audio
- Animated progress modal during processing
- Transcript display with full text, segments, language detection
- Green "Processed" badge after completion
- Results persisted in IndexedDB

### 6.5 Export & Integration

| Feature | Description | Status |
|---------|-------------|--------|
| **Portable Evidence Package v2.0** | Structured zip export | ✅ Implemented |
| **SESSION_SUMMARY.md** | Human/Claude-readable summary | ✅ Implemented |
| **Auto-import** | Sync to `evidence/sessions/` directory | ✅ Implemented |
| **Launch API** | `/api/v1/capture/launch` for external session creation | ✅ Implemented |
| **Import API** | `/api/v1/capture/import` for receiving packages | ✅ Implemented |

#### Export Structure (Portable Evidence Package v2.0)
```
site-visit-YYYY-MM-DD-{name}-{uuid}/
├── index.json              # Complete metadata
├── SESSION_SUMMARY.md      # Human/Claude readable summary
├── session-audio.webm      # Audio recording
├── transcript.txt          # Plain text transcript
└── photos/
    ├── 001-contextual-name.jpg
    ├── 002-another-photo.jpg
    └── ...
```

### 6.6 Launch API

External systems (like Claude Code) can create capture sessions:

```typescript
// POST /api/v1/capture/launch
{
  projectId?: string,           // External project ID
  projectType: 'phase1-esa' | 'eir-eis' | 'borehole' | 'generic',
  projectName: string,
  lead?: string,
  notes?: string,
  context?: Partial<ProjectContext>,
  expiresAt?: string            // ISO8601, defaults to 24 hours
}

// Response
{
  sessionId: string,            // UUID for capture session
  captureUrl: string,           // Full URL to open on mobile
  expiresAt: string             // ISO8601
}
```

---

## 7. Technical Stack

### 7.1 Core Technologies

| Layer | Technology |
|-------|------------|
| **Framework** | Next.js 16 (App Router) + React 19 |
| **Language** | TypeScript |
| **Styling** | Tailwind CSS 4 |
| **Hosting** | Vercel (serverless functions for API routes) |
| **Platform** | Safari on iOS (mobile-optimized PWA) |
| **Camera/Audio** | MediaDevices API (getUserMedia) |
| **GPS** | Geolocation API |
| **Local Storage** | IndexedDB (browser-based persistence) |
| **Transcription** | OpenAI Whisper API |
| **AI Processing** | Anthropic Claude API (Vision + Analysis) |
| **Export** | JSZip for package generation |

### 7.2 Data Model

#### Core Types
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
  projectType: ProjectType;           // phase1-esa, eir-eis, borehole, generic
  externalProjectId?: string;         // ID from launching system
  launchSessionId?: string;           // Session ID if launched via API
  context?: ProjectContext;           // Dynamic context from launch
  processingStage?: ProcessingStage;  // captured, transcribed, analyzed, graph_ready
}

interface PhotoMetadata {
  id: string;
  timestamp: string;
  projectId: string;
  gps: GpsCoordinates | null;
  imageData: string;       // Base64 encoded JPEG
  sessionTimestamp: number;
}

interface AudioMetadata {
  id: string;
  projectId: string;
  sessionId: string;
  audioData: string;       // Base64 encoded audio
  duration: number;
  mimeType: string;
  timestamp: string;
  fileSize: number;
}
```

#### Processing Types
```typescript
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

interface Transcript {
  fullText: string;
  segments: TranscriptSegment[];
  language?: string;
  duration: number;
}

interface PhotoAnalysis {
  photoId: string;
  vlmDescription: string;
  catalogTags: string[];
  entities: PhotoEntity[];
  transcriptSegment: TranscriptSegment | null;
}
```

### 7.3 IndexedDB Schema

Database: `choragraph-capture` (version 4)

| Store | KeyPath | Indexes |
|-------|---------|---------|
| **projects** | `id` | `modifiedAt` |
| **photos** | `id` | `projectId`, `timestamp` |
| **audio** | `id` | `projectId`, `sessionId`, `timestamp` |
| **processing_results** | `id` | `projectId`, `sessionId`, `status` |

### 7.4 File Structure
```
app/
├── api/
│   ├── transcribe-audio/
│   │   └── route.ts             # Whisper API endpoint
│   ├── analyze-photo/
│   │   └── route.ts             # Claude Vision endpoint
│   └── v1/capture/
│       ├── launch/
│       │   └── route.ts         # External session creation
│       └── import/
│           └── route.ts         # Package import
├── lib/
│   ├── types.ts                 # TypeScript interfaces
│   ├── db.ts                    # IndexedDB utilities
│   ├── export.ts                # Export utilities
│   └── defaultContexts.ts       # Default entity schemas
├── components/
│   ├── CaptureInterface.tsx     # Camera/audio capture UI
│   ├── ProjectsList.tsx         # Projects home screen
│   ├── CreateProjectModal.tsx   # Create project form
│   └── MobileConsole.tsx        # Debug console
├── capture/[projectId]/
│   └── page.tsx                 # Capture interface route
├── project/[projectId]/
│   └── page.tsx                 # Project review route
├── session/[sessionId]/
│   └── page.tsx                 # External launch handler
├── import/
│   └── page.tsx                 # Import handling
├── globals.css                  # iOS-optimized styles
├── layout.tsx                   # Root layout with PWA meta
└── page.tsx                     # Home (ProjectsList)

evidence/
└── sessions/                    # Imported field sessions
    └── {sessionId}/
        ├── index.json
        ├── SESSION_SUMMARY.md
        ├── session-audio.webm
        ├── transcript.txt
        └── photos/

public/
├── manifest.json                # PWA configuration
└── icon.svg                     # App icon
```

---

## 8. Planned Features (Future)

| Feature | Priority | Notes |
|---------|----------|-------|
| **Phase 2: Photo analysis** | High | Claude Vision for ESA-specific descriptions |
| **Phase 3: Timestamp correlation** | High | Match photos to transcript segments |
| **Phase 4: Entity extraction** | High | Extract RECs, site features, observations |
| **On-device CV demo** | Medium | Real-time object detection (drainage grates) |
| **Share/download individual photos** | Medium | Quick sharing from review |
| **Offline-first with sync** | Low | Full offline support |
| **Real-time transcription** | Low | Live transcription during capture |
| **Android support** | Low | Cross-platform PWA |
| **Report generation** | Future | ChoraGraph agents for draft reports |

---

## 9. Success Criteria

1. **Capture works smoothly:** User can record audio, take photos, and see GPS attached—no crashes, no lost data
2. **Post-processing produces structured output:** Transcript, VLM descriptions, extracted entities all present in JSON
3. **Photo-transcript correlation is accurate:** Transcript segments match what was being said when each photo was taken
4. **ESA entities are extracted:** RECs, site features, observations appear in output with reasonable accuracy
5. **Demo is compelling:** Non-technical stakeholder can see the value of "mobile capture → spatial knowledge graph"
6. **Integration works:** External systems can launch sessions and receive processed packages

---

## 10. Known Issues & Limitations

1. **Camera & GPS Permissions**: Require HTTPS on iOS. Use ngrok for local dev.
2. **Node Version**: Requires Node 20.9.0+ (Next.js 16 requirement)
3. **Base64 Storage**: Photos and audio stored as base64 - may impact performance with large projects
4. **Private Browsing**: IndexedDB unavailable in Safari private mode
5. **Long Sessions**: Sessions >30 minutes not optimized (audio chunking TBD)

---

## 11. Development History

| Date | Milestone |
|------|-----------|
| Jan 9, 2026 | Initial prototype with camera, GPS, photo capture |
| Jan 9, 2026 | Audio recording with pause/resume lifecycle |
| Jan 9, 2026 | Project review page with photo gallery |
| Jan 10, 2026 | Swipe navigation, GPS on thumbnails |
| Jan 11, 2026 | Phase 1 AI Transcription (Whisper API) |
| Jan 15, 2026 | Multi-project types, Launch API, Portable Evidence Package v2.0 |

---

*This document reflects the current state of the working prototype. See CLAUDE.md for detailed implementation notes and development context.*
