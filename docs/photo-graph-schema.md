# Photo Subgraph Schema for Neo4j

*Draft v0.1 — January 2026*

---

## Design Principles

1. **Graph-shaped from the start** — The Portable Evidence Package outputs data ready for direct Neo4j ingestion, not document-shaped JSON that requires transformation.

2. **Locations are first-class** — Every photo attaches to a Location node. Locations have hierarchy (Site → Area → Point) and each can have a hero image for navigation.

3. **Entities are nodes, tags are properties** — Structured entities (REC, Equipment, Observation) become nodes for traversal. Flat tags remain as searchable properties on Photos.

4. **Photos as navigation primitives** — Photos are the human-legible entry points into the graph. The UI centers on photos; the graph provides the connections underneath.

---

## Node Types

### Photo

The atomic unit of field capture.

```cypher
(:Photo {
  id: "uuid",
  timestamp: datetime,
  location: point({latitude: 37.7749, longitude: -122.4194}),
  compassHeading: 45.0,
  imageUrl: "https://...",           // or blob reference
  thumbnailUrl: "https://...",
  catalogTags: ["storm_drain", "staining", "concrete"],
  vlmDescription: "Concrete pad with visible staining near drain...",
  sessionTimestamp: 125.4,           // seconds into capture session
  isHeroImage: false
})
```

**Indexes:**
- Spatial index on `location`
- Full-text index on `catalogTags` and `vlmDescription`

---

### Location

A place in the world. Hierarchical — Sites contain Areas contain Points.

```cypher
(:Location {
  id: "uuid",
  name: "Northeast Corner - Former UST Area",
  locationType: "area",              // site | area | point
  boundary: point or polygon,        // centroid for points, boundary for areas
  heroImageId: "photo-uuid",         // reference to Photo node
  createdAt: datetime
})
```

**Location Types:**
- `site` — Top-level (a property, a project boundary)
- `area` — Sub-region (remediation zone, building, quadrant)
- `point` — Specific spot (a drain, a tank, a sample location)

---

### Project

A container for a body of work (a Phase 1 ESA, an inspection, etc.)

```cypher
(:Project {
  id: "uuid",
  name: "123 Main St - Phase 1 ESA",
  projectType: "phase1-esa",
  lead: "Jane Smith",
  createdAt: datetime,
  status: "active"
})
```

---

### Session

A single field visit / capture session.

```cypher
(:Session {
  id: "uuid",
  startTime: datetime,
  endTime: datetime,
  duration: 720,                     // seconds
  audioUrl: "https://...",
  transcriptText: "Full transcript...",
  status: "processed"
})
```

---

### Entity

A structured finding extracted from photos or transcript.

```cypher
(:Entity {
  id: "uuid",
  entityType: "REC",                 // REC | AOC | Equipment | Observation | ActionItem | Question
  description: "Staining observed near former UST location...",
  severity: "high",                  // high | medium | low | info
  recommendation: "Recommend Phase 2 soil sampling",
  confidence: 0.85
})
```

**Note:** Entity types are generic for now. A future version may resolve entities to specific real-world objects (e.g., this specific storm drain that appears in multiple photos).

**Entity types are workflow-specific.** ESA has RECs and USTs; construction has Defects and Incomplete items; asset management has Equipment and Condition. The `entityType` vocabulary is defined per project type in the project context schema.

---

### TranscriptSegment

A chunk of spoken audio tied to a time range.

```cypher
(:TranscriptSegment {
  id: "uuid",
  text: "This looks like the old UST removal area...",
  startTime: 120.5,                  // seconds into session
  endTime: 135.2,
  speaker: "consultant"              // optional, if diarization available
})
```

---

## Relationship Types

### TAKEN_AT
Photo was captured at a Location.

```cypher
(photo:Photo)-[:TAKEN_AT]->(location:Location)
```

---

### CONTAINS
Hierarchical containment.

```cypher
(site:Location)-[:CONTAINS]->(area:Location)
(area:Location)-[:CONTAINS]->(point:Location)
(project:Project)-[:CONTAINS]->(session:Session)
```

---

### CAPTURED_DURING
Photo was taken during a Session.

```cypher
(photo:Photo)-[:CAPTURED_DURING]->(session:Session)
```

---

### PART_OF
Session belongs to a Project.

```cypher
(session:Session)-[:PART_OF]->(project:Project)
```

---

### SHOWS
Photo depicts an Entity.

```cypher
(photo:Photo)-[:SHOWS {
  confidence: 0.85,
  boundingBox: [x, y, width, height]   // optional, if localized
}]->(entity:Entity)
```

**Handling uncertainty:** When a photo shows *signs of* something rather than confirming it, use lower confidence values and/or entity types that express uncertainty (e.g., `Potential_REC`, `Indicator`, `Suspected_Contamination`). The Entity's `recommendation` field captures next steps ("investigate further", "confirm with sampling"). No separate relationship type needed.

---

### MENTIONED_IN
Entity was mentioned in a TranscriptSegment.

```cypher
(entity:Entity)-[:MENTIONED_IN]->(segment:TranscriptSegment)
```

---

### SPOKEN_DURING
TranscriptSegment occurred while Photo was being taken (timestamp correlation).

```cypher
(segment:TranscriptSegment)-[:SPOKEN_DURING]->(photo:Photo)
```

---

### NEAR
Spatial proximity between Photos (computed, not captured).

```cypher
(photo1:Photo)-[:NEAR {
  distance: 15.2                     // meters
}]->(photo2:Photo)
```

**Note:** This is a derived relationship, computed at ingestion or query time based on GPS coordinates. Threshold TBD (e.g., <50m).

---

### HERO_IMAGE_OF
A Photo serves as the representative image for a Location.

```cypher
(photo:Photo)-[:HERO_IMAGE_OF]->(location:Location)
```

---

## Example Graph Fragment

```
(:Project {name: "123 Main St ESA"})
    |
    └──[:CONTAINS]──> (:Session {startTime: "2026-01-15T14:30:00"})
                           |
                           ├──[:PART_OF]──> (back to Project)
                           |
                           └──[:CAPTURED_DURING]<── (:Photo {id: "p1"})
                                                        |
                                                        ├──[:TAKEN_AT]──> (:Location {name: "NE Corner", type: "area"})
                                                        |                       |
                                                        |                       └──[:CONTAINS]<── (:Location {name: "Site", type: "site"})
                                                        |
                                                        ├──[:SHOWS]──> (:Entity {type: "REC", description: "Staining..."})
                                                        |
                                                        ├──[:SHOWS]──> (:Entity {type: "Equipment", description: "Former UST"})
                                                        |
                                                        └──[:SPOKEN_DURING]<── (:TranscriptSegment {text: "This is where the UST was..."})
```

---

## Portable Evidence Package: Graph-Ready Format

The `index.json` output should map directly to this schema. Proposed structure:

```json
{
  "version": "3.0-graph",
  "nodes": {
    "project": { "id": "...", "name": "...", "projectType": "..." },
    "session": { "id": "...", "startTime": "...", "endTime": "..." },
    "locations": [
      { "id": "...", "name": "...", "locationType": "site", "boundary": {...} },
      { "id": "...", "name": "...", "locationType": "area", "parentId": "..." }
    ],
    "photos": [
      {
        "id": "...",
        "filename": "001-ust-area.jpg",
        "timestamp": "...",
        "location": { "latitude": 37.7749, "longitude": -122.4194 },
        "compassHeading": 45.0,
        "catalogTags": ["staining", "concrete", "ust_area"],
        "vlmDescription": "...",
        "locationId": "...",
        "isHeroImage": false
      }
    ],
    "entities": [
      {
        "id": "...",
        "entityType": "REC",
        "description": "...",
        "severity": "high",
        "photoIds": ["..."],
        "segmentIds": ["..."]
      }
    ],
    "transcriptSegments": [
      {
        "id": "...",
        "text": "...",
        "startTime": 120.5,
        "endTime": 135.2,
        "photoIds": ["..."]
      }
    ]
  },
  "relationships": {
    "photo_locations": [
      { "photoId": "...", "locationId": "..." }
    ],
    "location_hierarchy": [
      { "parentId": "...", "childId": "..." }
    ],
    "hero_images": [
      { "photoId": "...", "locationId": "..." }
    ]
  }
}
```

**Ingestion script** reads this JSON and creates nodes/edges directly in Neo4j via Cypher or the Neo4j driver.

---

## Defensibility and Audit Trail

In regulated industries (environmental consulting, construction, inspections), decisions must be defensible. When someone asks "why did you conclude this is a REC?", you need to show the chain: evidence → interpretation → decision. You also need to show *who* made the decision, *when*, and whether it was human or AI.

The graph structure supports this natively.

### Decision Node

```cypher
(:Decision {
  id: "uuid",
  decisionType: "entity_classification",  // or "severity_assignment", "recommendation", etc.
  conclusion: "Confirmed REC",
  confidence: 1.0,
  madeBy: "human",                         // human | ai | human_override
  madeByUserId: "jane.smith",
  madeByAiModel: null,                     // or "claude-sonnet-4-5-20250929" if AI
  timestamp: datetime,
  rationale: "Visual staining consistent with petroleum release, confirmed by historical UST records",
  supersedes: "previous-decision-uuid"     // if overriding prior assessment
})
```

### Decision Relationships

```cypher
(decision:Decision)-[:ABOUT]->(entity:Entity)
(decision:Decision)-[:BASED_ON]->(photo:Photo)
(decision:Decision)-[:BASED_ON]->(document:Document)
(decision:Decision)-[:BASED_ON]->(segment:TranscriptSegment)
(decision:Decision)-[:OVERRIDES]->(priorDecision:Decision)
```

### What This Enables

| Defensibility need | How the graph answers it |
|-------------------|-------------------------|
| What evidence supports this? | Traverse `BASED_ON` edges to photos, documents, transcript |
| Who made this call? | `madeBy` + `madeByUserId` on Decision node |
| Was it AI or human? | `madeBy` field distinguishes `ai`, `human`, `human_override` |
| Did a human review the AI's suggestion? | `human_override` value + `OVERRIDES` edge to original AI decision |
| What changed and when? | Chain of Decision nodes with timestamps and `supersedes` references |
| Can I see the original evidence? | All evidence nodes preserved and linked, never deleted |

### AI Provenance

When AI suggests an entity classification, that creates a Decision node with `madeBy: "ai"` and `madeByAiModel` populated. When a human confirms or modifies it, that creates a *new* Decision node with `madeBy: "human_override"` that links via `OVERRIDES` to the AI decision.

Both decisions are preserved. The audit trail shows: "AI suggested X, human confirmed X" or "AI suggested X, human changed it to Y with rationale Z."

If regulators or opposing counsel ask "did AI make this determination?", the answer is auditable and defensible.

### Design Principles for Defensibility

1. **Never mutate — always append.** Entity confidence changes? New Decision node, not an edit to the old one.
2. **Capture evidence links at decision time.** Don't reconstruct them later; link `BASED_ON` when the decision is made.
3. **Distinguish AI from human from human-reviewing-AI.** Three distinct `madeBy` values.
4. **Preserve superseded decisions.** The `OVERRIDES` chain is the revision history.

---

## Conversational Schema Creation

Traditionally, entity schemas require upfront definition by a product team — weeks of scoping to support each new domain. With conversational agents, this changes fundamentally.

**The new approach:** A user describes their workflow in 5 minutes of conversation with a specialized agent. The agent outputs:
- `entityTypes` with names and descriptions
- Suggested `catalogTags` vocabulary
- `capturePrompts` for the field UI
- `visionAnalysisPrompt` for AI processing

The schema becomes a **conversation artifact**, not a product decision.

**Reuse and refinement:** Generated schemas can be saved as templates, reused across projects, and tweaked with short follow-up conversations. "Use my construction punch list setup from last month, but add a category for electrical issues."

This is a significant unlock: it makes the platform viable for the long tail of field workflows without requiring product teams to anticipate every domain.

---

## Open Questions

1. **Location creation:** Are Locations defined ahead of time (from parcel data, project setup) or created dynamically from photo GPS clustering?

2. **NEAR relationship threshold:** What distance defines "near"? 10m? 50m? Configurable per project type?

3. **Entity merging:** When two photos both `SHOW` a "storm drain," are they the same Entity node or two separate ones? (Deferred — treat as separate for now.)

4. **Hero image selection:** Manual curation or automatic (first photo at a location, or most representative via AI)?

5. **Integration with Compass:** How does this photo subgraph connect to existing Compass nodes (parcels, facilities, boreholes)? Via shared Location nodes? Spatial join at query time?

---

## Next Steps

1. Review schema with team
2. Build ingestion script (JSON → Neo4j)
3. Define Location creation strategy
4. Test with sample Portable Evidence Package
5. Connect to Compass graph via Location or spatial queries

---

*This schema is designed to be minimal but complete for the photo capture use case, with clear extension points for future integration.*
