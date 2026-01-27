# Security Review — ChoraGraph Capture

**Date:** 2026-01-27
**Scope:** Full repository review for blatant security risks
**Status:** Prototype — findings documented for tracking

---

## No Hardcoded Secrets (PASS)

All credentials (`OPENAI_API_KEY`, `CLAUDE_API_KEY`, `GEMINI_API_KEY`, `NEO4J_PASSWORD`, `BLOB_READ_WRITE_TOKEN`) are read from `process.env` in server-side routes only. `.gitignore` correctly excludes `.env*` files. No secrets found in git history. The only `NEXT_PUBLIC_` variable is `NEXT_PUBLIC_APP_URL` (a base URL, not a secret).

---

## Findings

### CRITICAL

#### 1. Path Traversal in Zip Import
- **File:** `app/api/v1/capture/import/route.ts:218,265`
- **Issue:** `sessionId` from uploaded zip or form field is used directly in `path.join(evidenceBase, sessionId)`. Zip entry names at line 265 are also unsanitized. A crafted zip can write files anywhere on the filesystem. Line 226 calls `fs.rmSync` on the resolved path.
- **Fix:** Validate `sessionId` matches UUID format. Validate all resolved paths are within `evidenceBase` using `path.resolve()` comparison.

#### 2. SSRF in Audio Transcription
- **File:** `app/api/transcribe-audio/route.ts:61`
- **Issue:** `audioUrl` from request body is fetched with `fetch(audioUrl)` — no validation, no allowlist, no timeout, no size limit. Can target cloud metadata endpoints, internal services, or `file://` URLs.
- **Fix:** Validate `audioUrl` against an allowlist (e.g., must match your Vercel Blob storage domain).

#### 3. Cypher Injection via LLM
- **File:** `app/api/graph/search/route.ts:168-173`
- **Issue:** User's natural language query is translated to Cypher by an LLM, then executed directly. Prompt injection can produce destructive queries (`DETACH DELETE`, `DROP INDEX`).
- **Fix:** Execute queries in a read-only transaction. Validate generated Cypher against a whitelist of allowed operations. Add query timeout.

#### 4. Path Traversal in Graph Ingest
- **File:** `app/api/graph/ingest/route.ts:371-374`
- **Issue:** `body.sessionId` is interpolated into a filesystem path with no validation. `../` sequences allow reading arbitrary files.
- **Fix:** Validate `sessionId` matches expected format (UUID). Verify resolved path is within expected directory.

### HIGH

#### 5. No Authentication on Any Endpoint
- **Files:** All 11 routes under `app/api/`
- **Issue:** No auth middleware, no API key checks, no session tokens. Anyone who discovers the URL can call all endpoints, including AI APIs (cost exposure), file operations, and database writes.
- **Fix:** Add shared API key validation middleware or bearer token check.

#### 6. 100MB Unauthenticated Upload
- **File:** `app/api/upload-audio/route.ts:26`
- **Issue:** Vercel Blob upload allows 100MB files with no auth, no per-user quota. Includes video MIME types.
- **Fix:** Reduce size limit. Add authentication. Restrict to audio MIME types only.

### MEDIUM

#### 7. No Rate Limiting
- **Files:** All AI-calling routes (`transcribe-audio`, `analyze-photo`, `graph/search`, `synthesize-session`)
- **Issue:** Unlimited calls = unlimited API costs.
- **Fix:** Add rate limiting middleware (e.g., per-IP or per-token limits).

#### 8. No CORS Configuration
- **File:** `next.config.ts`
- **Issue:** No CORS headers configured. Any website can make cross-origin requests.
- **Fix:** Configure `Access-Control-Allow-Origin` to restrict to known origins.

#### 9. Unguarded JSON.parse on Untrusted Input
- **File:** `app/api/v1/capture/import/route.ts:201`
- **Issue:** `JSON.parse()` on zip content has no try-catch. Malformed JSON crashes the handler.
- **Fix:** Wrap in try-catch. Add schema validation.

#### 10. API Self-Documentation Endpoint
- **File:** `app/api/v1/capture/launch/route.ts:112-127`
- **Issue:** GET endpoint returns complete API docs including all fields, types, and example requests. Aids reconnaissance.
- **Fix:** Remove or gate behind authentication.

### LOW

#### 11. Verbose Logging of User Data
- **Files:** Multiple API routes
- **Issue:** Transcript text, GPS coordinates, Cypher queries, file paths logged to console. May constitute PII exposure in production log systems.
- **Fix:** Reduce log verbosity in production. Avoid logging user content.

#### 12. Leaky Error Messages
- **Files:** Multiple API routes
- **Issue:** Error responses reveal which AI provider is configured, internal file paths, and session ID formats.
- **Fix:** Return generic error messages in production. Log details server-side only.

---

## Priority Fix Order (for public deployment)

1. Path traversal guards (#1, #4) — arbitrary file read/write
2. SSRF allowlist (#2) — internal network access
3. API authentication (#5) — blocks all casual abuse
4. Read-only Cypher execution (#3) — prevents data destruction
5. Rate limiting (#7) — prevents cost abuse
6. Everything else

---

## Summary

| # | Issue | Severity | Location |
|---|-------|----------|----------|
| 1 | Path traversal (zip import) | CRITICAL | `import/route.ts:218,265` |
| 2 | SSRF (audio fetch) | CRITICAL | `transcribe-audio/route.ts:61` |
| 3 | Cypher injection via LLM | CRITICAL | `graph/search/route.ts:168` |
| 4 | Path traversal (graph ingest) | CRITICAL | `graph/ingest/route.ts:371` |
| 5 | No authentication | HIGH | All `app/api/` routes |
| 6 | 100MB unauth upload | HIGH | `upload-audio/route.ts:26` |
| 7 | No rate limiting | MEDIUM | All AI-calling routes |
| 8 | No CORS config | MEDIUM | `next.config.ts` |
| 9 | Unguarded JSON.parse | MEDIUM | `import/route.ts:201` |
| 10 | API self-documentation | MEDIUM | `launch/route.ts:112` |
| 11 | Verbose PII logging | LOW | Multiple routes |
| 12 | Leaky error messages | LOW | Multiple routes |
