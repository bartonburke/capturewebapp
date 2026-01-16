# Phase I ESA Claude Code Template - Field Capture Integration

Copy this section into your Phase I ESA project's CLAUDE.md file to enable field capture skills.

---

## Field Capture Integration

This project integrates with ChoraGraph Capture for mobile field data collection during Phase I ESA site inspections.

### Prerequisites

- ChoraGraph Capture running at `http://localhost:3000` (or deployed URL)
- For mobile access during dev: `ngrok http 3000`
- Evidence directory: `evidence/sessions/`

### Custom Skills

#### `/launch-capture [site-name]`

Launches a new field capture session for Phase I ESA inspection.

**When invoked:**
1. If no site name provided, ask for it
2. Call the launch API:
```bash
curl -X POST http://localhost:3000/api/v1/capture/launch \
  -H "Content-Type: application/json" \
  -d '{"projectType": "phase1-esa", "projectName": "[SITE_NAME]", "lead": "Field Inspector"}'
```
3. Display the returned `captureUrl` for the user to open on mobile
4. List what to capture: perimeter, structures, staining, tanks, drums, drains, transformers, AOCs

#### `/import-captures [folder]`

Imports field capture packages into the evidence directory.

**When invoked:**
1. Default folder: `~/Downloads`, look for `site-visit-*.zip` files
2. For each zip found, call:
```bash
curl -X POST http://localhost:3000/api/v1/capture/import \
  -F "file=@[ZIP_PATH]" \
  -F "sessionId=[from-filename]"
```
3. Report: sessions imported, photo counts, REC observations
4. Move processed zips to `~/Downloads/imported/`

If no dev server running, extract manually:
```bash
unzip -o "file.zip" -d evidence/sessions/[sessionId]/
```

#### `/field-sessions [sessionId]`

Lists or shows details of imported field sessions.

**When invoked without sessionId:**
- List all sessions in `evidence/sessions/*/`
- Show: site name, photo count, audio duration, high-REC count

**When invoked with sessionId:**
- Read `evidence/sessions/[sessionId]/SESSION_SUMMARY.md`
- List photos and highlight high-REC observations
- Show file paths for photos, audio, transcript

### Evidence Directory Structure

```
evidence/sessions/{sessionId}/
├── index.json              # Full metadata (Portable Evidence Package v2.0)
├── SESSION_SUMMARY.md      # Human-readable summary - START HERE
├── session-audio.webm      # Audio recording
├── transcript.txt          # Whisper transcription
└── photos/
    ├── 001-exterior-perimeter.jpg
    ├── 002-ust-fillport.jpg
    └── ...
```

### Key Fields in index.json

- `session_id`: Unique identifier
- `project_type`: "phase1-esa"
- `photos[]`: Array with filename, GPS, timestamp, vision_analysis, tags
- `photos[].vision_analysis.rec_potential`: "high" | "medium" | "low" | "none"
- `transcript.full_text`: Complete audio transcription
- `session_summary.entities_extracted`: Count by type (REC, AOC, Feature, etc.)

### Working with Field Data

**Find high-REC observations:**
```bash
grep -l '"rec_potential": "high"' evidence/sessions/*/index.json
```

**Read a session summary:**
```bash
cat evidence/sessions/[sessionId]/SESSION_SUMMARY.md
```

**View photos for a session:**
Read files in `evidence/sessions/[sessionId]/photos/`

### Workflow

1. **Before site visit:** `/launch-capture 123 Main Street`
2. **On site:** Open capture URL on phone, take photos, record observations
3. **After capture:** Process session (Whisper + Claude Vision), Export & Delete
4. **Back at desk:** AirDrop zip to Mac, `/import-captures`
5. **Review:** `/field-sessions` to list, then reference in report writing

### Entity Types (Phase I ESA)

The capture system extracts these entity types:
- **REC** - Recognized Environmental Condition
- **HREC** - Historical REC
- **CREC** - Controlled REC
- **AOC** - Area of Concern
- **UST** - Underground Storage Tank
- **AST** - Aboveground Storage Tank
- **Feature** - Site feature (building, equipment, etc.)
- **Condition** - Observable condition (staining, damage, etc.)
- **Equipment** - Industrial/commercial equipment

### Photo Analysis

Each photo has Claude Vision analysis with:
- `description`: ESA-specific observation
- `concerns`: List of environmental concerns noted
- `rec_potential`: Risk rating (high/medium/low/none)
- `confidence`: Analysis confidence score

---

## API Endpoints (for reference)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/capture/launch` | POST | Create new capture session |
| `/api/v1/capture/import` | POST | Import evidence package |

### Launch Request
```json
{
  "projectType": "phase1-esa",
  "projectName": "Site Name",
  "lead": "Inspector Name",
  "notes": "Optional notes"
}
```

### Launch Response
```json
{
  "sessionId": "uuid",
  "captureUrl": "http://localhost:3000/session/uuid?data=...",
  "expiresAt": "ISO8601"
}
```

### Import Request
- `multipart/form-data`
- `file`: The zip blob
- `sessionId`: Session identifier for directory naming

### Import Response
```json
{
  "success": true,
  "sessionId": "...",
  "outputPath": "evidence/sessions/...",
  "summary": {
    "projectName": "...",
    "photoCount": 12,
    "hasTranscript": true,
    "hasAudio": true
  }
}
```
