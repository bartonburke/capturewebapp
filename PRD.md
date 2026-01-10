# ChoraGraph ESA Capture App — Product Requirements Document

**Version:** 0.1 (Prototype)  
**Date:** January 9, 2026  
**Author:** Bart Burke + Claude  

---

## 1. Problem Statement

Phase 1 Environmental Site Assessments (ESAs) require site reconnaissance where environmental professionals walk properties capturing photos, observations, and notes. Current workflows are fragmented: photos in the camera roll, voice memos in a separate app, handwritten notes, GPS logged elsewhere. This data must later be manually assembled, correlated, and structured for the ESA report.

There is no tool that captures all site data in a unified, structured, spatially-aware format that feeds directly into AI-assisted report generation.

---

## 2. Solution Overview

A mobile-first web app (PWA) optimized for Safari/iOS that enables field professionals to capture site assessment data—photos, continuous audio/dictation, and GPS—in a single session. Post-session processing transcribes audio, correlates transcript segments to photos via timestamps, analyzes images with vision AI, and extracts ESA-relevant concepts (RECs, site features, observations). The output is a structured, graph-ready dataset.

This prototype demonstrates the core concept of **building a spatial knowledge graph from mobile capture**, laying groundwork for integration with SimAnalytica's Compass: Engine and the ChoraGraph AI agent initiative.

---

## 3. Target User

**Primary:** Environmental consultants conducting Phase 1 ESA site visits  
**Context:** Walking a property, phone in hand, capturing evidence and observations on the go  
**Device:** iPhone with Safari  

---

## 4. Core Concepts

### 4.1 Photo as the Atomic Unit

Each photo becomes a **node in the knowledge graph**. Attached to each photo node:

- GPS coordinates + timestamp
- Surrounding transcript context (what was said before/during/after the shot)
- VLM analysis (AI description of image contents)
- Extracted ESA concepts (potential RECs, site features, observations)
- Manual or auto-generated tags
- (Future) Agent attachment point

### 4.2 Continuous Audio → Structured Transcript

Audio recording runs continuously throughout the site visit. Post-session:

1. Full audio is transcribed (Whisper API)
2. AI processes transcript to extract ESA-relevant entities: RECs, ASTs, USTs, staining, interviews, historical indicators, regulatory observations
3. Transcript segments are correlated to photos via timestamps

### 4.3 Workflow-Specific Schema

The data schema is shaped by the job to be done. For Phase 1 ESA, relevant entity types include:

- **RECs** (Recognized Environmental Conditions)
- **Site Features:** ASTs, USTs, storm drains, floor drains, sumps, staining, drums/containers
- **Structures:** Buildings, loading docks, maintenance areas
- **Interviews:** Facility manager statements, tenant observations
- **Historical Indicators:** Evidence of past use, fill material, former structures
- **Regulatory:** Permits observed, signage, placards

The architecture supports swapping schemas for different workflows (e.g., construction inspection) without changing the capture flow.

### 4.4 Spatial Agents (Conceptual)

Agents live in places. In the knowledge graph:

```
Project (Site Assessment)
  └── Site Agent (scoped to this project/location)
        └── Photo Node
              └── Contextual data, extracted entities, agent can assist here
```

For the prototype, the "agent" is Claude with ESA context + access to the photo and transcript segment. The graph structure demonstrates how agents could persist spatially in future versions (AR cloud, digital twin integration).

---

## 5. MVP Feature Set (Prototype Scope)

### 5.1 Capture Mode

| Feature | Description |
|---------|-------------|
| **Continuous audio recording** | Single record button, runs throughout site visit |
| **Photo capture** | Tap to capture, auto-attaches GPS + timestamp |
| **GPS per photo** | Standard device GPS (high-precision SLAM deferred) |
| **Visual feedback** | Live camera preview, recording indicator, photo count |
| **Session management** | Start session, end session, basic metadata (site name) |

### 5.2 Post-Session Processing

| Feature | Description |
|---------|-------------|
| **Audio transcription** | Full session audio → text via Whisper API |
| **Transcript analysis** | Claude extracts ESA entities from transcript |
| **Photo analysis** | Claude Vision describes each image, identifies ESA-relevant features |
| **Timestamp correlation** | Link transcript segments to photos based on capture time |
| **Structured output** | Graph-ready JSON with all nodes and relationships |

### 5.3 Review Interface

| Feature | Description |
|---------|-------------|
| **Photo gallery** | Scroll through captured photos |
| **Per-photo detail** | View: image, GPS, timestamp, transcript context, VLM description, extracted tags |
| **Session summary** | List of extracted RECs, site features, observations |
| **Export** | Download structured JSON |

### 5.4 On-Device Computer Vision (Demo Feature)

Simple, clever CV demo during capture. Options (TBD):

- Object detection: storm drains, tanks, drums, signage
- OCR: read placards, labels, permit numbers
- Scene classification: industrial, commercial, residential

Implementation: Core ML model or lightweight JS-based detection.

---

## 6. Out of Scope (Future)

- Integration with Compass: Engine / Neo4j
- VPS / Visual SLAM for precise positioning
- Real-time transcription during capture
- Multi-user / team features
- Persistent spatial agents (AR cloud style)
- Android support
- Offline-first with sync
- Report generation (ChoraGraph agents)

---

## 7. Technical Approach

### 7.1 Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | HTML/CSS/JS, mobile-optimized PWA |
| **Platform** | Safari on iOS only |
| **Camera/Audio** | MediaDevices API (getUserMedia) |
| **GPS** | Geolocation API |
| **Local Storage** | IndexedDB for session data |
| **Transcription** | Whisper API (OpenAI) |
| **AI Processing** | Claude API (transcript analysis, vision) |
| **On-device CV** | Core ML via Safari / TensorFlow.js (TBD) |
| **Output** | JSON (graph-ready structure) |

### 7.2 Data Model (Simplified)

```json
{
  "session": {
    "id": "uuid",
    "siteName": "Example Property",
    "startTime": "ISO8601",
    "endTime": "ISO8601",
    "gpsStart": { "lat": 0.0, "lng": 0.0 }
  },
  "audio": {
    "fileUri": "path/to/audio.mp3",
    "transcript": "Full transcript text...",
    "segments": [
      { "start": 0, "end": 15, "text": "Starting at the main entrance..." }
    ]
  },
  "photos": [
    {
      "id": "uuid",
      "timestamp": "ISO8601",
      "gps": { "lat": 0.0, "lng": 0.0 },
      "imageUri": "path/to/photo.jpg",
      "transcriptSegment": { "start": 45, "end": 60 },
      "vlmDescription": "Image shows a concrete pad with visible staining...",
      "extractedEntities": [
        { "type": "REC", "label": "Potential REC - surface staining", "confidence": 0.85 },
        { "type": "SiteFeature", "label": "Concrete pad", "confidence": 0.95 }
      ],
      "tags": ["staining", "concrete", "north-side"]
    }
  ],
  "extractedEntities": [
    { "type": "REC", "label": "...", "sourcePhotoId": "uuid", "transcriptRef": { "start": 45, "end": 60 } }
  ]
}
```

### 7.3 Processing Flow

```
[Capture Session]
       │
       ▼
┌─────────────────┐
│ Audio + Photos  │
│ GPS + Timestamps│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Upload Audio   │──────► Whisper API ──────► Transcript
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ For each photo: │
│  - Send to VLM  │──────► Claude Vision ──────► Description
│  - Match transcript segment by timestamp       
└────────┬────────┘
         │
         ▼
┌─────────────────────────┐
│ Claude: Extract ESA     │
│ entities from transcript│──────► Structured entities
│ + VLM descriptions      │
└────────┬────────────────┘
         │
         ▼
┌─────────────────┐
│ Graph-ready JSON│
└─────────────────┘
```

---

## 8. Success Criteria (Prototype)

1. **Capture works smoothly:** User can record audio, take photos, and see GPS attached—no crashes, no lost data
2. **Post-processing produces structured output:** Transcript, VLM descriptions, extracted entities all present in JSON
3. **Photo-transcript correlation is accurate:** Transcript segments match what was being said when each photo was taken
4. **ESA entities are extracted:** RECs, site features, observations appear in output with reasonable accuracy
5. **Demo is compelling:** Non-technical stakeholder can see the value of "mobile capture → spatial knowledge graph"

---

## 9. Open Questions

- [ ] Which object should on-device CV detect for the demo?
- [ ] Whisper API vs. alternative transcription service?
- [ ] How to handle long sessions (>30 min audio)?
- [ ] Should review interface allow editing extracted entities?
- [ ] Branding: is this "ChoraGraph Capture" or something else?

---

## 10. Next Steps

1. **Finalize PRD** — review and adjust with Bart
2. **Set up Claude Code project** — clone repo, configure environment
3. **Build capture UI** — camera, audio, photo button, GPS
4. **Implement local storage** — IndexedDB for session persistence
5. **Build post-processing pipeline** — Whisper + Claude integrations
6. **Build review interface** — gallery, detail view, export
7. **Add on-device CV demo** — TBD object detection
8. **Test on iPhone Safari** — validate full flow

---

*This document is a working draft for prototype development. It will evolve as we build.*
