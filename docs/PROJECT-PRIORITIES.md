# Project Priorities: Getting to a Demonstrable State

**Date:** 2026-02-06
**Assessed against:** Current `main` codebase

---

## Where We Are

ChoraGraph Capture is functionally complete through Phase 3. The core capture loop works end-to-end: create a project, take GPS-tagged photos, record audio, run AI analysis (vision + transcription), and export a Portable Evidence Package. The code is clean — no TODO/FIXME comments, no broken components, no placeholder UI (aside from the intentional map-view placeholder). Error handling is thorough across all API routes.

**What works well:**
- Project creation and management across 8 project types (work + personal)
- Camera capture with GPS, compass heading, and flash feedback
- Audio recording with pause/resume and stream persistence
- AI processing pipeline: Whisper transcription → vision analysis → entity extraction → synthesis
- Export as versioned Portable Evidence Packages (v2.1 raw, v3.0 processed)
- Import via drag-and-drop with SESSION_SUMMARY.md generation
- IndexedDB persistence with schema migrations (v4)
- Dark theme UI, polished and iOS-optimized
- PWA configuration for home screen installation

**What doesn't work yet:**
- Map view (placeholder only)
- Neo4j graph features require a running database instance
- No service worker (no offline caching beyond IndexedDB)
- No `.env.example` — setup requires reading CLAUDE.md

---

## Top 5 Priorities

### 1. Remove ESA-specific branding — make the app domain-neutral

**Why this matters:** The app's thesis is that it's domain-agnostic ("any workflow where evidence lives at locations"). But the first things a viewer sees — the browser tab title, the PWA install name, the home screen subtitle, and the example search queries — all say "ESA Site Assessment" or "Environmental Field Evidence." This undermines the pitch before the demo even starts.

**What to change:**
- `app/layout.tsx:17-18` — Title and description reference "ESA Site Assessment"
- `app/layout.tsx:30` — Apple Web App title is "ESA Capture"
- `public/manifest.json:2-4` — Name, short_name, and description all reference ESA
- `app/components/ProjectsList.tsx:175` — Subtitle reads "Environmental Field Evidence"
- `app/search/page.tsx` and `app/graph/page.tsx` — Example queries reference ESA-specific terms (AOCs, RECs, staining)

**Target state:** Title becomes "ChoraGraph Capture", subtitle becomes "Spatial Field Capture", example queries cover multiple project types (home inventory, construction, environmental) to demonstrate breadth.

---

### 2. Add a `.env.example` and replace the default README

**Why this matters:** Anyone who clones the repo — a potential collaborator, investor doing diligence, or yourself on a new machine — hits a wall immediately. The README is still the default `create-next-app` boilerplate. There's no `.env.example`, so discovering which API keys are needed requires reading CLAUDE.md or grepping the source. This is the difference between "clone and run in 2 minutes" and "give up after 5."

**What to create:**
- `.env.example` with all environment variables, marked required/optional:
  ```
  # Required for photo analysis (default provider)
  GEMINI_API_KEY=

  # Required for audio transcription
  OPENAI_API_KEY=

  # Optional: alternative vision provider
  CLAUDE_API_KEY=

  # Optional: large audio file uploads (>4MB)
  BLOB_READ_WRITE_TOKEN=

  # Optional: graph features
  NEO4J_URI=
  NEO4J_USER=
  NEO4J_PASSWORD=
  ```
- Replace README.md with a concise version: what the app does, how to run it, link to CLAUDE.md for architecture details.

---

### 3. Clean up console logging for a professional demo experience

**Why this matters:** The codebase has 100+ `console.log` statements across the three main components (`CaptureInterface.tsx`, `ProjectsList.tsx`, `project/[projectId]/page.tsx`). During a live demo, opening DevTools — or accidentally having them open — floods the console with debug output like `[ProjectsList] Loading projects...`, `Camera effect triggered`, and dozens of processing-pipeline logs. This reads as "development prototype" rather than "working product."

**Approach:**
- Don't delete the logging infrastructure — it's useful for debugging.
- Introduce a simple debug flag (e.g., `const DEBUG = process.env.NODE_ENV === 'development'`) and gate verbose logs behind it, or reduce to `console.debug` which can be filtered in DevTools.
- Keep `console.error` and `console.warn` for actual problems.
- Critical files: `CaptureInterface.tsx` (~50 logs), `project/[projectId]/page.tsx` (~50 logs), `ProjectsList.tsx` (~9 logs).

---

### 4. Validate API keys upfront with clear error messages

**Why this matters:** Several API routes instantiate SDK clients without checking if the key exists, then fail with cryptic errors deep in the call stack. During a demo, hitting "Process" with a missing `GEMINI_API_KEY` produces a generic 500 error — not "Gemini API key not configured." The `/api/search` route uses `new Anthropic()` without validating `CLAUDE_API_KEY`. The graph routes don't validate Neo4j credentials until the first query fails.

**What to fix:**
- `/api/analyze-photo` — Validate the active provider's key before calling the API. Return a 503 with `"${provider} API key not configured. Set ${envVar} in environment."`.
- `/api/search` — Check for `ANTHROPIC_API_KEY` or `CLAUDE_API_KEY` before instantiation.
- `/api/graph/search` and `/api/graph/ingest` — Check Neo4j env vars at the top of the handler, return a clear "Neo4j not configured" message.
- `/api/transcribe-audio` — Already validates well; no change needed.

**Bonus:** Add a `/api/health` endpoint that reports which services are configured, so you can verify setup before demoing.

---

### 5. Build a 2-minute demo script with sample data

**Why this matters:** The app's value is best shown through the full loop: capture → process → review → export. But in a live demo, you need a phone with camera permissions over HTTPS (ngrok), a quiet room for audio, GPS signal, and working API keys — any of which can fail. A pre-loaded demo project with 3-5 photos, a short audio clip, and completed processing results lets you show the review/export experience reliably, and fall back to it if live capture fails.

**What to create:**
- A seed script or fixture that populates IndexedDB with a sample project (e.g., a home inventory session with processed results).
- Alternatively, a pre-built Portable Evidence Package in `evidence/sessions/demo/` that can be imported to demonstrate the import → review flow.
- A short `docs/DEMO-SCRIPT.md` outlining the recommended demo sequence:
  1. Show home screen with project types (breadth of domains)
  2. Create a project, capture 2-3 photos with GPS
  3. Show the pre-loaded project with completed analysis
  4. Walk through photo gallery, entity extraction results
  5. Export and show the Portable Evidence Package structure
  6. (If Neo4j available) Show graph search

---

## What's Deliberately Not on This List

- **Map view**: Important for the full vision, but a demo can show the photo-as-navigation concept through the gallery + GPS coordinates. Adding a map is a multi-day feature, not a polish item.
- **Service worker / offline caching**: IndexedDB already provides offline data persistence. A service worker would cache the app shell for true offline-first, but this is invisible in a demo.
- **Neo4j integration**: The graph endpoints exist and work. Setting up a Neo4j Aura Free instance is an infrastructure task, not a code task. If you want to demo graph features, spin up the instance and set the env vars — the code is ready.
- **Cross-session entity deduplication (Phase 4)**: Important for production, but a single-session demo doesn't need it.
