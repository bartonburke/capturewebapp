# ChoraGraph Capture

A mobile-first PWA that turns photos into navigable spatial knowledge graphs. Capture GPS-tagged photos with audio narration, run AI analysis (vision + transcription), and export graph-ready "Portable Evidence Packages."

**Designed for:** Any workflow where evidence lives at locations -- environmental consulting, construction inspections, asset management, home inventory, personal documentation. Domain logic is defined by conversational schema creation, not hard-coded.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables
cp .env.example .env.local
# Edit .env.local with your API keys (at minimum, set GEMINI_API_KEY)

# 3. Run the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### iOS Testing

Camera and GPS require HTTPS. Use [ngrok](https://ngrok.com/) to create a tunnel:

```bash
# Terminal 1
npm run dev

# Terminal 2
ngrok http 3000
```

Open the ngrok HTTPS URL on iPhone Safari, then "Add to Home Screen" for PWA mode.

## Environment Variables

| Variable | Required? | Purpose |
|----------|-----------|---------|
| `GEMINI_API_KEY` | Yes | Photo analysis (default vision provider) |
| `OPENAI_API_KEY` | For transcription | Audio transcription via Whisper |
| `CLAUDE_API_KEY` | Optional | Alternative vision provider, project search |
| `BLOB_READ_WRITE_TOKEN` | Optional | Large audio uploads (>4MB) to Vercel Blob |
| `NEO4J_URI` | Optional | Graph database for search features |
| `NEO4J_USER` | Optional | Neo4j authentication |
| `NEO4J_PASSWORD` | Optional | Neo4j authentication |

## Architecture

See [CLAUDE.md](CLAUDE.md) for the full architecture guide, including:
- Photo-as-navigation-primitive concept
- Neo4j graph schema
- IndexedDB data model
- API route documentation
- File structure

## Tech Stack

- **Framework**: Next.js 16 (App Router) + React 19 + TypeScript
- **Styling**: Tailwind CSS 4
- **Storage**: IndexedDB (browser-based persistence)
- **Platform**: iOS Safari PWA (mobile-first)
- **AI**: OpenAI Whisper (transcription), Google Gemini / Anthropic Claude (vision)
