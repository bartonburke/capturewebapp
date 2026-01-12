# ChoraGraph — Vision Document

**Version:** 1.0  
**Date:** January 9, 2026  
**Author:** Bart Burke + Claude  

---

## The Core Insight

Many everyday apps and workflows — especially jobs done in the real world — benefit from spatial organization. **Place can be the connective tissue.**

You're already using multiple apps to get a job done: camera, notes, maps, email, specialized tools. Each lives in its own silo. **Place** can be the deep link between them — tap a location, get to the right screen, the right app, the right data.

If we make **capture easier** — photos, video, audio with context baked in — we get richer spatial anchors. Those anchors connect fragmented workflows into a coherent whole.

---

## What ChoraGraph Is

**ChoraGraph is a geobrowser.**

A geobrowser is to places what a web browser is to pages. Instead of navigating URLs, you navigate locations. Instead of bookmarks, you have spatial anchors. Instead of links between pages, you have connections between places and the evidence, data, and workflows tied to them.

It's a spatial interface layer for work done in the real world — not replacing your apps, but creating the **spatial context layer** that ties them together.

---

## Two Modes

| Mode | Primary Interface | Purpose |
|------|-------------------|---------|
| **Capture** | Camera | Collect evidence in the field — photos, audio, observations anchored to location |
| **View** | Map | See, navigate, and act on spatial data — browse what's captured, access linked apps/data |

### Capture Mode

The field interface. Optimized for speed and minimal friction.

- Continuous audio recording with tap-to-photo
- Automatic context: GPS, timestamp, transcript
- AI processing extracts structure from raw capture
- Output: graph-ready, linkable, anchored to place

### View Mode

The desk interface. Map-based navigation of spatial knowledge.

- Browse captured data by location
- Visualize layers: your data, reference data (parcels, environmental records, etc.)
- Deep link to other apps and workflows
- Chat-to-Map: natural language queries grounded in spatial entities

---

## The Glue: Share Extensions

ChoraGraph isn't a walled garden. It uses **iOS Share Extensions** to connect with everything else:

**Ingest:**
- Share a photo, document, or link *into* ChoraGraph
- It gets placed in space (GPS from metadata, or manual placement)
- Existing content becomes spatially organized

**Export:**
- From ChoraGraph, deep link *out* to other apps and webpages
- The map becomes a spatial launcher
- Tap a place → jump to the relevant tool, screen, or data

---

## Design Principles

### 1. Place-First, Not Page-First

The primary object is a site, parcel, building, room, or asset — not a URL. Location is the organizing principle.

### 2. Orient → Capture → Act

The workflow for real-world jobs:

1. **Orient:** Arrive in a spatial context. See what's known, what's needed.
2. **Capture:** Collect evidence in seconds. Photos, audio, observations — all anchored.
3. **Act:** Execute the job tied to that place. Generate reports, make decisions, trigger workflows.

### 3. Evidence Becomes Structure

Photos, video, notes, and documents aren't attachments — they become **anchored evidence** that supports specific claims and decisions. Raw capture is transformed into structured knowledge.

### 4. Living Model Over Static Report

Outputs aren't frozen documents. They're a continuously updateable "understanding model" where every conclusion is traceable back to evidence. Update the evidence, update the conclusions.

### 5. Trust by Design

The system privileges:
- **Provenance:** Where did this data come from?
- **Traceability:** What evidence supports this claim?
- **Reviewable assertions:** AI conclusions are checkable, not black boxes

"Trust by design" over "AI says so."

### 6. Multiple Views of the Same Truth

Map, 3D, camera, and narrative/report are different lenses on the same underlying graph. Switch views without losing context. The truth is in the graph; the views are just ways to see it.

---

## Technical Foundations

### Spatial Knowledge Graph

The core data structure. Everything anchors to location:

```
Place (lat/lng, boundary)
  └── Project (e.g., Site Assessment)
        └── Session (field visit)
              └── Evidence Node (photo, audio clip, observation)
                    └── Extracted Entities (RECs, features, claims)
                          └── Linked Resources (deep links, documents, app screens)
```

### Workflow-Specific Schemas

The graph schema adapts to the job:

- **Phase 1 ESA:** RECs, ASTs, USTs, interviews, historical indicators
- **Construction Inspection:** Punch list items, code violations, progress photos
- **Real Estate Due Diligence:** Condition issues, measurements, comparable references

Same capture flow, different structure.

### Integration Points

- **Compass Engine (SimAnalytica):** Neo4j-based geospatial knowledge graph. View mode connects here.
- **ChoraGraph Agents:** AI agents scoped to workflows. They live in the graph, assist with specific jobs.
- **External Apps:** Via share extensions and deep links. ChoraGraph is a hub, not a silo.

---

## The Long View

### Spatial Agents

Agents don't float — they live in places. An agent anchored to a site remembers past visits, knows the project context, and assists with location-specific tasks. Return to a place, the agent is there with history.

**Key implication: Agents operate in the physical world, and property governs access.**

- Agents live and work in physical space, not just digital space
- **Property owners/operators control which agents can operate on their property**
- This creates a natural governance model: your land, your rules for AI
- Visiting professionals (like ESA consultants) bring their agents, but operate within the property's permissions
- Opens possibilities: property owners could deploy their own agents, grant/revoke access, set boundaries

This mirrors how the physical world already works — you control who enters your property and what they can do there. Spatial agents inherit that model.

### AR Cloud / Digital Twin Integration

AR is not a separate mode — it's a **layer on top of Capture mode**. 

When VPS is available, you can view existing spatial data overlaid on the real world *while* capturing new evidence. See what's been documented before, right where it happened. Add to it in context.

As AR matures, ChoraGraph's spatial graph becomes the anchor layer. Visual positioning (VPS), persistent AR content, and digital twin data all connect to the same place-based structure. The graph is the source of truth; AR is just another view.

### The Spatial Web

ChoraGraph is one piece of a larger shift: from searching pages to navigating places. The spatial web isn't a replacement for the document web — it's a layer for the real-world jobs that never fit neatly into pages and links.

---

## Product Roadmap (High Level)

| Phase | Focus | Outcome |
|-------|-------|---------|
| **1. Capture MVP** | Camera-based field capture | Photos + audio + GPS → structured graph-ready data |
| **2. View MVP** | Map-based navigation | Browse captured data, basic layers, deep links |
| **3. Share Extensions** | Ingest/export | Connect to iOS ecosystem, import existing photos |
| **4. Agent Integration** | ChoraGraph Agents | AI assistance scoped to projects and places |
| **5. Compass Integration** | SimAnalytica backend | Full knowledge graph, Chat-to-Map, report generation |
| **6. AR / Spatial** | VPS, persistent anchors | Real-world AR tied to graph |

---

## Current Focus: ChoraGraph Capture

The prototype demonstrates Phase 1 — the Capture leg.

**What we're building:**
- Mobile-first PWA (iOS Safari)
- Continuous audio + tap-to-photo + GPS
- Post-session processing: transcription, AI analysis, entity extraction
- Structured output ready for the graph

**What we're proving:**
- Evidence capture can be fast and frictionless
- Raw capture can be transformed into structured spatial knowledge
- The foundation for View, Agents, and the full platform

---

*This document describes the vision. See PRD.md for prototype specifications.*
