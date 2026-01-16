# ChoraGraph Capture - Integration Handoff Document

**Date:** January 15, 2026 **From:** Environmental AI Platform Team
(Bart + Claude) **To:** ChoraGraph Capture Development Team **Re:** New
integration context and required changes for multi-project platform

---

## Executive Summary

The existing ChoraGraph Capture prototype was designed as a standalone
Phase I ESA field capture tool. We now need to **generalize it for
multi-project-type use** while integrating it into a larger platform
architecture that includes Claude Code desktop workflows and CMAP
spatial intelligence.

**Key Change:** From "Phase I ESA-specific tool" → "Platform-agnostic
field capture tool with dynamic project context"

---

## Current State (from PRD v1.0)

Your existing prototype has:

✅ **Core Capture Functionality:** - Mobile PWA with continuous audio +
tap-to-photo + GPS - Session-based workflow (start → record/pause → end
→ name project) - IndexedDB local storage - Post-processing pipeline
(Whisper transcription + Claude Vision analysis) - ESA-specific entity
extraction (RECs, ASTs, USTs, staining, etc.) - Review interface with
photo gallery - On-device CV demo (drainage grate detection)

✅ **Data Model:** - Session → Photos → Transcript segments -
ESA-specific entity schema - JSON output structure

✅ **Technical Stack:** - Next.js + Tailwind CSS - Vercel serverless -
iPhone Safari optimized - MediaDevices API (camera/audio) - Geolocation
API

---

## New Context: Multi-Project Platform Integration

### The Bigger Picture

ChoraGraph Capture is now one layer in a three-layer architecture:

``` ┌─────────────────────────────────────────────────────────────┐ │ 
Layer 1: ChoraGraph Capture (Mobile PWA)                   │ │  - Field
data collection (photos + audio + GPS)             │ │  - Session
management                                        │ │  - Lightweight
processing                                    │
└─────────────────────────────────────────────────────────────┘ ↓
Portable Evidence Package
┌─────────────────────────────────────────────────────────────┐ │  Layer
2: Claude Code Desktop Workflows                     │ │  - Project
management                                        │ │  - Post-processing
with Claude Vision                        │ │  - Report generation      
                                  │ │  - Workflow automation            
                          │
└─────────────────────────────────────────────────────────────┘ ↓
Spatial data + queries
┌─────────────────────────────────────────────────────────────┐ │  Layer
3: CMAP (ChoraGraph Map) Spatial Intelligence (SimAnalytica Backend)  │ │  - Knowledge
graph ingestion                                 │ │  - Spatial analysis 
                                        │ │  - Interactive visualization
                                │ │  - Conversational geospatial queries
                        │
└─────────────────────────────────────────────────────────────┘ ```

### New Use Cases Beyond Phase I ESA

ChoraGraph Capture now needs to support **multiple project types** (initial examples, many
more planned):

**1. Phase I Environmental Site Assessments** (existing) - Entities:
RECs, ASTs, USTs, staining, drums, historical indicators - Context:
"Document USTs, ASTs, staining, drums, adjoining properties"

**2. Environmental Impact Reports (EIR/EIS)** (NEW) - Entities: Visual
impacts, environmental constraints, sensitive receptors, public concerns
- Context: "Capture site visit inspections, locations, visual impact concerns,
wildlife observations"

**3. Borehole Analysis & Geotechnical Data** (NEW) - Entities: Equipment
verification, stratum changes, sample locations, safety compliance -
Context: "Document stratum changes, sample locations, equipment setup,
site conditions"

**Future:** Construction inspection, real estate due diligence,
compliance audits, etc.

---

## Required Changes (High Level)

### 1. Dynamic Project Context (CRITICAL)

**Current:** Hardcoded Phase I ESA entity extraction and prompts

**New:** Accept project-specific context at session launch

**Implementation:** - Add `project_context` parameter to session
initialization - Project context includes: - `project_type` (e.g.,
"phase1-esa", "eir-eis", "borehole") - `entity_schema` (list of entities
to extract for this project type) - `capture_prompts` (guidance messages
for field user) - `vision_analysis_prompt` (Claude Vision instructions
per project type)

**Example Launch API:** ```json POST /api/v1/capture/launch {
"project_id": "phase1-esa-123", "project_type": "phase1-esa",
"project_name": "Industrial Property - 123 Main St", "context": {
"entity_schema": ["REC", "AST", "UST", "staining", "drums",
"historical_use"], "capture_prompts": [ "Document underground storage
tanks (USTs)", "Note any staining or stressed vegetation", "Photograph
adjoining properties" ], "vision_analysis_prompt": "Analyze for
environmental concerns per ASTM E1527-21..." } }

Response: { "session_id": "uuid-abc123", "capture_url":
"https://capture.choragraph.com/session/uuid-abc123" } ```

**UI Changes:** - Session header shows project type and name (not
hardcoded "ESA Capture Agent") - Capture prompts display contextually
during recording - Entity extraction uses project-specific schema

---

### 2. Portable Evidence Package Output (CRITICAL)

**Current:** JSON output designed for direct graph ingestion

**New:** Self-contained directory structure that can be stored anywhere
(filesystem, Google Drive, SharePoint, Dropbox)

**Structure:** ``` site-visit-2026-01-15-uuid/ ├── index.json           
        # Metadata + structured data ├── session-audio.m4a             #
Full audio file ├── transcript.txt                # Full transcript └──
photos/ ├── 001-ust-removal-site.jpg ├── 002-staining-northeast.jpg └──
003-adjoining-drums.jpg ```

**index.json Schema:** ```json { "session_id": "uuid", "project_id":
"phase1-esa-123", "project_type": "phase1-esa", "project_name":
"Industrial Property - 123 Main St", "timestamp_start":
"2026-01-15T14:30:00Z", "timestamp_end": "2026-01-15T14:42:00Z",
"location_start": {"lat": 37.7749, "lng": -122.4194}, "photos": [ {
"filename": "001-ust-removal-site.jpg", "gps": {"lat": 37.7750, "lng":
-122.4195, "accuracy": 10}, "timestamp": "2026-01-15T14:32:15Z",
"audio_segment": {"start": "00:02:15", "end": "00:03:45"}, "transcript":
"Former UST removed here, staining visible in soil...", "entities":
["UST", "staining", "remediation"], "vision_analysis": { "description":
"Excavated area with exposed soil, visible staining...", "concerns":
["soil staining", "incomplete backfill"], "rec_potential": "high",
"confidence": 0.85 }, "tags": ["REC-candidate", "UST-related"] } ],
"session_summary": { "total_photos": 12, "total_duration_seconds": 720,
"entities_extracted": {"REC": 3, "UST": 2, "staining": 4},
"key_observations": ["Former UST removal site", "Adjoining property
drums"] }, "graph_ready": true, "version": "2.0" } ```

**Key Changes:** - Photos stored in subdirectory with contextual
filenames (not generic IMG_1234.jpg) - index.json is complete standalone
metadata (no separate database required) - Can be zipped and emailed,
uploaded to cloud storage, or processed locally

---

### 3. Launch Integration (IMPORTANT)

**Current:** User manually starts session in PWA

**New:** Session can be launched FROM Claude Code or CMAP web with
pre-loaded context

**Flow:** ``` User in Claude Code (desktop): "Start site visit for 123
Main St Phase I ESA" ↓ Claude Code calls Launch API with project context
↓ Returns session URL: https://capture.choragraph.com/session/abc123 ↓
User opens URL on mobile device ↓ Capture session pre-loaded with
project info, entity schema, prompts ↓ User begins recording immediately
(no manual setup) ```

**Implementation:** - Accept pre-loaded session context via URL
parameter or API - Display project name and context in session header -
Validate session is still active (not expired)

---

### 4. Post-Processing Handoff (IMPORTANT)

**Current:** Post-processing happens within Capture app via Vercel
functions

**New:** Post-processing can happen in Claude Code (desktop) with more
powerful Claude Vision analysis

**Two-Stage Processing:**

**Stage 1 (In Capture PWA - Lightweight):** - Save photos + audio + GPS
to portable evidence package - Basic transcript generation (Whisper API
- optional, can defer to desktop) - Return package to user

**Stage 2 (In Claude Code - Heavyweight):** - User: "Process my site
visit photos for Phase I ESA" - Claude Code reads portable evidence
package - Runs Claude Vision analysis with project-specific prompts -
Extracts entities with higher accuracy (full context model, not
lightweight) - Updates index.json with vision analysis results -
Prepares for CMAP spatial ingestion

**Benefit:** Keeps mobile app lightweight, allows more sophisticated AI
processing on desktop with full context

**Implementation:** - Make Whisper transcription optional in Capture
(can upload raw audio for desktop processing) - Ensure index.json schema
supports "partial" state (photos captured but not yet analyzed) - Add
status field: `processing_stage: "captured" | "transcribed" | "analyzed"
| "graph_ready"`

---

### 5. Storage Location Flexibility (LOW)

**Current:** IndexedDB local storage in browser

**New:** Support multiple storage backends (user choice)

**Options:** 1. **Local filesystem** (download zip to device, manual
upload to desktop) 2. **Google Drive** (OAuth integration, auto-sync to
user's Drive) 3. **Microsoft 365/SharePoint** (enterprise users) 4.
**Dropbox** (common for small firms)

**MVP Approach:** Keep local storage as default, add "Export to..."
options at session end

**Future:** Direct cloud sync during capture (requires OAuth flows)

---

### 6. Session Management UI Updates (MEDIUM)

**Current:** Single "ESA Capture Agent" label

**New:** Dynamic UI based on project context

**Changes:** - Session header shows project type badge ("Phase I ESA" |
"EIR/EIS" | "Borehole") - Project name displays prominently - Capture
prompts rotate through project-specific guidance - Entity extraction
summary shows project-relevant entities only

**Example:** ``` ┌─────────────────────────────────────────┐ │  🟢
Recording  [Phase I ESA]            │ │  Industrial Property - 123 Main
St      │ │  12:34 elapsed | 8 photos               │
├─────────────────────────────────────────┤ │  💡 Tip: Document USTs and
staining     │ └─────────────────────────────────────────┘ ```

---

### 7. Entity Schema as Configuration (MEDIUM)

**Current:** Hardcoded Phase I ESA entities in code

**New:** Entity schema as JSON configuration passed at launch

**Schema Format:** ```json { "entities": [ { "name": "REC",
"display_name": "Recognized Environmental Condition", "description":
"Evidence of release or likely release of hazardous substances",
"extraction_keywords": ["contamination", "release", "spill", "leak",
"UST failure"], "confidence_threshold": 0.7 }, { "name": "UST",
"display_name": "Underground Storage Tank", "extraction_keywords":
["underground tank", "UST", "fuel tank", "storage tank"],
"confidence_threshold": 0.8 } ] } ```

**Implementation:** - Accept entity schema as part of project context -
Use schema to guide Claude Vision prompts - Display extracted entities
in review interface based on schema - Allow future project types to
define their own entities without code changes

---

### 8. On-Device CV Generalization (LOW PRIORITY)

**Current:** Drainage grate detection demo

**New:** Project-type-specific object detection

**Examples:** - **Phase I ESA:** USTs, ASTs, drums, staining, signage -
**EIR/EIS:** Wildlife, vegetation types, infrastructure - **Borehole:**
Equipment, core samples, safety gear

**Implementation:** Not critical for MVP, can defer to 
post-processing (either Claude Vision, otehr MCP, or preferably on-device). 

---

## What DOESN'T Change

These elements of the existing prototype remain the same:

✅ Core capture UX (continuous audio + tap-to-photo) ✅ Session workflow
(start → record/pause → end) ✅ GPS metadata capture ✅ iPhone Safari PWA
optimization ✅ MediaDevices API usage ✅ Photo gallery review interface ✅
Technical stack (Next.js, Tailwind, Vercel)

---

## Integration Points with Other Systems

### With Claude Code (Desktop)

**Launch:** Claude Code calls `/api/v1/capture/launch` with project
context, gets session URL **Handoff:** User opens session URL on mobile,
captures data **Return:** Portable evidence package stored in project
directory (e.g., `2-field-notes/site-visits/`) **Post-Processing:**
Claude Code runs vision analysis, updates index.json

### With CMAP (Spatial Intelligence)

**Ingestion:** CMAP reads index.json + photos from portable evidence
package **Spatial Nodes:** Each photo becomes a node in knowledge graph
at GPS coordinates **Visualization:** Interactive map shows photos
positioned spatially alongside EDR data, terrain layers **Queries:**
User asks conversational questions grounded in spatial context

---

## Demo Requirements

For the initial demo to environmental consultants, we need:

**1. Pre-recorded Demo Session (Phase I ESA)** - 12 sample photos with
GPS coordinates - 8 minutes audio transcript - Realistic environmental
observations (USTs, staining, adjoining properties) - Complete portable
evidence package ready for desktop processing

**2. Multi-Project Type Support** - Launch with Phase I ESA context
(working) - Launch with EIR/EIS context (shows flexibility) - Launch
with Borehole context (shows breadth)

**3. Desktop Integration** - Session launched from Claude Code command -
Portable evidence package returned to project directory -
Post-processing workflow demonstrated


**Demo Timeline:** End of January 2026

---

## Migration Path

### Phase 1: Minimal Changes (1-2 weeks)
1. Add dynamic project context parameter to launch API 2. Update session
header UI to display project info 3. Implement portable evidence package
output format 4. Test with Phase I ESA context (existing functionality)

### Phase 2: Multi-Project Support (1-2 weeks)
5. Add EIR/EIS entity schema and prompts 6. Add Borehole entity schema
and prompts 7. Update entity extraction to use dynamic schema 8. Test
launch from Claude Code integration

### Phase 3: Polish & Demo Prep (1 week)
9. Create pre-recorded demo session data 10. Build demo walkthrough
materials 11. Test full field → desktop → CMAP workflow 12. Prepare for
environmental consultant presentation

---

## Open Questions for Discussion

1. **Whisper transcription:** Keep in Capture PWA or defer to Claude Code desktop processing?
   - **Recommendation:** Defer to desktop for MVP. Keeps mobile app lightweight, allows more sophisticated processing with full context.

2. **Storage priority:** Which cloud provider to integrate first (Google Drive, Microsoft 365, Dropbox)?
   - **Recommendation:** Start with local filesystem download (simplest), add Google Drive second (common for small firms).

3. **Session expiry:** How long should launch URLs remain valid before requiring re-authentication?
   - **Recommendation:** 24 hours. Covers same-day field work, prevents stale sessions from accumulating.

4. **Offline mode:** Critical for MVP or defer to Phase 2?
   - **Recommendation:** Defer to Phase 2. Most sites have cell coverage; focus on core workflow first.

5. **Photo naming:** Auto-generate from transcript entities or manual user input?
   - **Recommendation:** Auto-generate with sequential numbering + extracted entities (e.g., "001-ust-removal.jpg"). User can rename if needed.

6. **Index format:** JSON only or also markdown for human readability?
   - **Recommendation:** JSON as primary, optionally generate markdown summary for human review.

7. **Server architecture:** Do we need an always-on server with a fixed, dedicated endpoint?
   - **Answer:** **No always-on server required for MVP.** Two lightweight approaches:

   **Option A: Serverless (Vercel) - Recommended for MVP**
   - Use existing Vercel serverless functions
   - `/api/v1/capture/launch` endpoint creates session in database/storage
   - Session data stored in Vercel KV or similar lightweight DB
   - No persistent server needed, scales automatically
   - Cost: ~$0 for demo/low volume

   **Option B: Static + Local Processing**
   - PWA with static hosting (no backend at all for capture)
   - Session context passed via URL hash parameters (client-side only)
   - Portable evidence package generated entirely in browser
   - Downloaded to device, manually transferred to desktop
   - Cost: $0 (pure static hosting)

   **For Demo:** Option A (serverless) provides better UX while keeping infrastructure minimal. No dedicated server, no fixed endpoint maintenance, just API routes on Vercel.


---

## Success Metrics for Integration

✅ Launch session from Claude Code with project context ✅ Capture 12
photos with continuous audio + GPS on iPhone Safari ✅ Generate portable
evidence package with correct structure ✅ Return package to Claude Code
project directory ✅ Post-process with Claude Vision (desktop) ✅
Visualize photos on CMAP map alongside EDR data ✅ Ask conversational
spatial questions grounded in field evidence ✅ Generate Phase I report
section with photo citations and spatial analysis

---

## Next Steps

**Immediate Actions:** 1. Review this handoff document - does it align
with existing prototype architecture? 2. Identify technical blockers or
concerns with proposed changes 3. Estimate effort for Phase 1 minimal
changes 4. Schedule sync to discuss integration timeline

**Key Contacts:** - **Bart Denny** (US Lead, SimAnalytica): Product
strategy, demo requirements - **Claude** (AI Advisor): Technical
architecture, integration design - **UK Team** (Rob et al): CMAP backend
integration, borehole use case validation

---

## Appendix: Example Project Contexts (these may require tuning to make the outputs less verbose, more focused and relevant)

### Phase I ESA Context
```json { "project_type": "phase1-esa", "entity_schema": ["REC", "AST",
"UST", "staining", "drums", "historical_use", "interview"],
"capture_prompts": [ "Document underground storage tanks (USTs) and fill
pipes", "Photograph any staining, stressed vegetation, or odors",
"Capture adjoining property conditions", "Note historical industrial
equipment or structures" ], "vision_analysis_prompt": "Analyze this
photo for environmental concerns per ASTM E1527-21. Identify potential
Recognized Environmental Conditions (RECs), underground storage tanks,
aboveground storage tanks, staining, drums, or other indicators of
contamination. Assess REC potential (low/medium/high) and provide ASTM
section references." } ```

### EIR/EIS Context
```json { "project_type": "eir-eis", "entity_schema": ["visual_impact",
"environmental_constraint", "sensitive_receptor", "wildlife",
"vegetation", "public_concern"], "capture_prompts": [ "Document visual
impacts and viewshed concerns", "Photograph sensitive environmental
receptors", "Capture wildlife observations and habitat conditions",
"Note public hearing locations and community concerns" ],
"vision_analysis_prompt": "Analyze this photo for environmental impact
assessment. Identify visual impacts, sensitive receptors, environmental
constraints, wildlife, vegetation types, and community concerns. Assess
significance level and NEPA/CEQA relevance." } ```

### Borehole Analysis Context
```json { "project_type": "borehole", "entity_schema": ["equipment",
"stratum_change", "sample_location", "safety_compliance", "soil_type",
"contamination_indicator"], "capture_prompts": [ "Document drilling
equipment and setup", "Photograph stratum changes and soil samples",
"Capture sample locations with GPS precision", "Note safety compliance
and site conditions" ], "vision_analysis_prompt": "Analyze this photo
for geotechnical and environmental data. Identify drilling equipment,
soil types, stratum changes, sample locations, contamination indicators,
and safety compliance. Note any visual soil characteristics relevant to
Phase II investigation or remediation planning." } ```

---

**Document Version:** 1.0 **Date:** January 15, 2026 **Status:** Ready
for Development Team Review
