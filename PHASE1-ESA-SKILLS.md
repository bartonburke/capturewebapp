# Phase I ESA Claude Code Skills

This document defines the custom skills for the Phase I ESA Claude Code template. These skills enable field capture integration with the ChoraGraph Capture PWA.

---

## Skill 1: `/launch-capture`

**Purpose:** Launch a new field capture session on the mobile PWA with Phase I ESA-specific context.

### Usage

```
/launch-capture [site-name]
```

**Examples:**
```
/launch-capture 123 Main Street Industrial
/launch-capture Former Gas Station - Elm Ave
/launch-capture
```

### Skill Prompt

```markdown
# /launch-capture Skill

You are launching a field capture session for Phase I ESA site inspection.

## What This Skill Does

1. Generates a unique session ID
2. Creates a launch URL for the ChoraGraph Capture PWA
3. Provides the URL for the user to open on their mobile device
4. Records the pending session for later import

## Instructions

When the user invokes `/launch-capture`:

1. **Get the site name** - If not provided as an argument, ask the user for the site/project name.

2. **Generate the launch URL** by making a POST request:

```bash
curl -X POST http://localhost:3000/api/v1/capture/launch \
  -H "Content-Type: application/json" \
  -d '{
    "projectType": "phase1-esa",
    "projectName": "[SITE_NAME]",
    "lead": "Field Inspector",
    "notes": "Launched from Claude Code Phase I ESA session"
  }'
```

3. **Display the result** to the user:

```
## Field Capture Session Ready

**Site:** [site name]
**Session ID:** [session_id]
**Expires:** [expiration time]

### Open on your mobile device:
[capture_url]

Or scan this URL with your phone camera.

### What to capture:
- Site perimeter and boundaries
- All structures and buildings
- Staining, discoloration, or stressed vegetation
- Storage tanks (ASTs, USTs, fill ports)
- Drums, containers, chemical storage
- Floor drains, sumps, trenches
- HVAC equipment and transformers
- Adjacent properties
- Any areas of concern (AOCs)

### When done:
1. Process the session (transcription + photo analysis)
2. Click "Export & Delete"
3. AirDrop the zip file to this Mac
4. Run `/import-captures` to import the session
```

4. **Track the pending session** by noting:
   - Session ID
   - Site name
   - Launch timestamp
   - Status: "pending capture"

## Phase I ESA Context

The capture session is pre-configured with:
- **Entity types:** REC, HREC, CREC, AOC, UST, AST, Feature, Condition, Equipment
- **Vision analysis:** ESA-specific photo descriptions
- **Capture prompts:** ASTM E1527-21 aligned observations

## Error Handling

If the launch API fails:
- Check if the dev server is running (`npm run dev`)
- Verify the API endpoint is accessible
- Provide manual instructions for creating a session in the PWA
```

### Implementation Notes

The skill should:
1. Accept an optional site name argument
2. Call the launch API at `http://localhost:3000/api/v1/capture/launch`
3. Display a formatted response with the capture URL
4. Store the session info for tracking

---

## Skill 2: `/import-captures`

**Purpose:** Import field capture evidence packages from a designated folder into the project's evidence directory.

### Usage

```
/import-captures [folder-path]
```

**Default folder:** `~/Downloads` (scans for `site-visit-*.zip` files)

**Examples:**
```
/import-captures
/import-captures ~/Desktop/field-data
/import-captures /path/to/specific/file.zip
```

### Skill Prompt

```markdown
# /import-captures Skill

You are importing field capture evidence packages into the Claude Code working directory.

## What This Skill Does

1. Scans a folder for Portable Evidence Package zip files
2. Extracts each package to `evidence/sessions/{sessionId}/`
3. Generates SESSION_SUMMARY.md for each imported session
4. Provides a summary of imported sessions
5. Optionally moves processed zips to an archive folder

## Instructions

When the user invokes `/import-captures`:

1. **Determine the source folder:**
   - If a path argument is provided, use that
   - Default: `~/Downloads`
   - If a specific .zip file is provided, import just that file

2. **Find evidence packages:**

```bash
# List all portable evidence packages
ls -la ~/Downloads/site-visit-*.zip 2>/dev/null || echo "No packages found"
```

3. **For each zip file found, import it:**

```bash
# Import using the capture API
curl -X POST http://localhost:3000/api/v1/capture/import \
  -F "file=@[ZIP_FILE_PATH]" \
  -F "sessionId=[extracted-session-id]"
```

The session ID should be extracted from the filename:
- `site-visit-2026-01-15-main-street-abc123.zip` → session ID: `main-street-abc123`

4. **After successful import:**
   - Move the zip to `~/Downloads/imported/` (create if needed)
   - Or delete if the user confirms

5. **Display import summary:**

```
## Field Sessions Imported

### Session 1: Main Street Industrial
- **Photos:** 12
- **Audio:** Yes (45.2 seconds)
- **Transcript:** Yes
- **REC Potential:** 2 high, 3 medium
- **Location:** evidence/sessions/main-street-abc123/

### Session 2: Former Gas Station
- **Photos:** 8
- **Audio:** Yes (32.1 seconds)
- **Transcript:** Yes
- **REC Potential:** 4 high, 1 medium
- **Location:** evidence/sessions/gas-station-def456/

---

**Total:** 2 sessions imported, 20 photos, 77.3 seconds audio

To review a session:
- Read `evidence/sessions/[sessionId]/SESSION_SUMMARY.md`
- View photos in `evidence/sessions/[sessionId]/photos/`
```

6. **If no packages found:**

```
No field capture packages found in ~/Downloads.

Looking for files matching: site-visit-*.zip

To import:
1. Export a session from ChoraGraph Capture on your phone
2. AirDrop the zip file to this Mac (saves to ~/Downloads)
3. Run /import-captures again

Or specify a different folder:
/import-captures ~/Desktop/field-data
```

## Import Process Details

For each zip file:

1. **Extract session ID from filename** or from index.json inside the zip
2. **Call the import API** which:
   - Extracts to `evidence/sessions/{sessionId}/`
   - Parses `index.json` for metadata
   - Generates `SESSION_SUMMARY.md`
3. **Verify the import** by checking the output directory exists

## Error Handling

- If dev server not running: Provide instructions to start it
- If zip is invalid: Skip and report error
- If session already exists: Ask user whether to overwrite
- If import API fails: Try direct extraction as fallback

## Direct Extraction Fallback

If the API is unavailable, extract manually:

```bash
# Create session directory
mkdir -p evidence/sessions/[sessionId]

# Extract zip
unzip -o "[ZIP_FILE]" -d evidence/sessions/[sessionId]/

# The SESSION_SUMMARY.md should already be in the zip
# If not, read index.json and generate it
```
```

### Implementation Notes

The skill should:
1. Default to scanning `~/Downloads` for `site-visit-*.zip`
2. Support specifying a custom folder or specific file
3. Call the import API for each package
4. Track which sessions were imported
5. Move/archive processed zips to avoid re-importing

---

## Skill 3: `/field-sessions`

**Purpose:** List and summarize available field capture sessions in the evidence directory.

### Usage

```
/field-sessions [sessionId]
```

**Examples:**
```
/field-sessions                    # List all sessions
/field-sessions main-street-abc123 # Show details for specific session
```

### Skill Prompt

```markdown
# /field-sessions Skill

You are listing and summarizing field capture sessions available in the evidence directory.

## What This Skill Does

1. Lists all imported field sessions
2. Shows summary information for each
3. Highlights sessions with high REC potential
4. Provides quick access to session details

## Instructions

When the user invokes `/field-sessions`:

### If no session ID provided (list all):

1. **Scan the evidence directory:**

```bash
ls -d evidence/sessions/*/ 2>/dev/null | head -20
```

2. **For each session, read the summary:**

```bash
# Get basic info from each session
for dir in evidence/sessions/*/; do
  if [ -f "$dir/index.json" ]; then
    echo "=== $(basename $dir) ==="
    cat "$dir/SESSION_SUMMARY.md" | head -20
    echo ""
  fi
done
```

3. **Display formatted list:**

```
## Available Field Sessions

| Session | Site | Photos | Audio | RECs | Date |
|---------|------|--------|-------|------|------|
| main-street-abc123 | Main Street Industrial | 12 | 45s | 2 high | Jan 15 |
| gas-station-def456 | Former Gas Station | 8 | 32s | 4 high | Jan 15 |

**Total:** 2 sessions, 20 photos

To view details: `/field-sessions [sessionId]`
To import more: `/import-captures`
```

### If session ID provided (show details):

1. **Read the SESSION_SUMMARY.md:**

```bash
cat evidence/sessions/[sessionId]/SESSION_SUMMARY.md
```

2. **List the photos:**

```bash
ls -la evidence/sessions/[sessionId]/photos/
```

3. **Show high-REC observations:**

```bash
# Extract high REC items from index.json
cat evidence/sessions/[sessionId]/index.json | jq '.photos[] | select(.vision_analysis.rec_potential == "high")'
```

4. **Display formatted details:**

```
## Field Session: Main Street Industrial

**Session ID:** main-street-abc123
**Captured:** January 15, 2026 at 2:30 PM
**Location:** 33.7249°N, 118.3053°W

### Summary
- 12 photos captured
- 45.2 seconds audio recorded
- Transcript available
- 8 entities extracted (2 AOC, 3 Feature, 3 Condition)

### High REC Potential Observations

#### Photo 003: UST fill port
Circular metal fill port embedded in concrete with dark staining...
**Why high REC:** Potential UST with visible staining indicates possible release

#### Photo 007: Hydraulic lift area
Floor staining pattern consistent with hydraulic fluid...
**Why high REC:** Subsurface contamination from hydraulic equipment

### Files
- `evidence/sessions/main-street-abc123/SESSION_SUMMARY.md`
- `evidence/sessions/main-street-abc123/index.json`
- `evidence/sessions/main-street-abc123/transcript.txt`
- `evidence/sessions/main-street-abc123/photos/` (12 files)

### Quick Actions
- View all photos: Read files in photos/ directory
- Listen to audio: `evidence/sessions/main-street-abc123/session-audio.webm`
- Full transcript: `evidence/sessions/main-street-abc123/transcript.txt`
```

## No Sessions Found

If no sessions exist:

```
## No Field Sessions Found

The evidence directory is empty or doesn't exist.

To capture field data:
1. Run `/launch-capture [site-name]` to start a capture session
2. Open the URL on your mobile device
3. Capture photos and audio during site inspection
4. Export and import using `/import-captures`
```
```

---

## Adding These Skills to Claude Code

### Option 1: CLAUDE.md Instructions

Add to the project's CLAUDE.md file:

```markdown
## Custom Skills

This project has custom skills for Phase I ESA field capture integration.

### /launch-capture [site-name]
Launches a new field capture session. Generates a URL for the ChoraGraph Capture PWA.

### /import-captures [folder]
Imports field capture evidence packages from ~/Downloads (or specified folder).

### /field-sessions [sessionId]
Lists available field sessions or shows details for a specific session.
```

### Option 2: Claude Code Hooks (if supported)

Create `.claude/hooks/` directory with skill handlers.

### Option 3: MCP Tool Server

Implement as MCP tools that Claude Code can call directly.

---

## Workflow Example

**Complete Phase I ESA field capture workflow:**

```
User: /launch-capture 456 Industrial Blvd

Claude: ## Field Capture Session Ready
        **Site:** 456 Industrial Blvd
        **Session ID:** abc-123-def
        Open on mobile: https://...

[User goes to field, captures photos/audio, processes, exports]

User: /import-captures

Claude: ## Field Sessions Imported
        ### Session: 456 Industrial Blvd
        - Photos: 15
        - Audio: 2 min 34 sec
        - High REC: 3 observations

User: /field-sessions abc-123-def

Claude: [Shows detailed session summary with all observations]

User: What environmental concerns were identified at 456 Industrial?

Claude: Based on the field capture session, I identified 3 high-REC
        potential observations:
        1. UST fill port with staining (Photo 003)
        2. Hydraulic lift area contamination (Photo 007)
        3. Chemical storage drums without secondary containment (Photo 012)

        [References photos and transcript excerpts]
```

---

## Prerequisites

For these skills to work, the user needs:

1. **ChoraGraph Capture PWA** running locally (`npm run dev`) or deployed
2. **ngrok** for mobile access during development (or deployed URL)
3. **Evidence directory** structure in place (`evidence/sessions/`)
4. **API keys** configured in `.env.local` (OpenAI, Anthropic)

---

## File Locations

| Component | Location |
|-----------|----------|
| Launch API | `app/api/v1/capture/launch/route.ts` |
| Import API | `app/api/v1/capture/import/route.ts` |
| Evidence storage | `evidence/sessions/{sessionId}/` |
| Session summaries | `evidence/sessions/{sessionId}/SESSION_SUMMARY.md` |
| Session metadata | `evidence/sessions/{sessionId}/index.json` |
| Photos | `evidence/sessions/{sessionId}/photos/` |
