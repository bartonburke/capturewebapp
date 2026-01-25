# Spatial Search Architecture for ChoraGraph

*Draft v0.1 — January 2026*

---

## Overview

This document defines a 2-day MVP implementation for spatial photo search using Neo4j Aura Free. The goal: enable natural language queries like "photos within 500m of the former UST area showing staining" to return relevant photos from the graph.

---

## Why Neo4j Aura Free

| Aspect | Value |
|--------|-------|
| **Cost** | $0/month |
| **Node limit** | 200,000 nodes |
| **Relationship limit** | 400,000 relationships |
| **Storage** | Sufficient for MVP |

**Capacity estimate:** ~1,000 photos × ~5 entities each = ~6,000 nodes. Well within free tier limits.

**Why not self-hosted?** Aura Free eliminates infrastructure overhead. For MVP validation, managed hosting is the right trade-off.

---

## 2-Day Implementation Plan

### Day 1: Schema + Ingest

**Morning: Setup**
1. Create Neo4j Aura Free instance
2. Add environment variables to `.env.local`:
   ```
   NEO4J_URI=neo4j+s://xxxxx.databases.neo4j.io
   NEO4J_USER=neo4j
   NEO4J_PASSWORD=xxxxx
   ```
3. Install driver: `npm install neo4j-driver`
4. Create connection utility in `app/lib/neo4j.ts`

**Afternoon: Ingest Endpoint**

Create `/api/graph/ingest` endpoint that:
1. Receives a Portable Evidence Package (index.json)
2. Parses photos, entities, and relationships
3. Creates nodes in Neo4j:
   - `(:Photo {id, timestamp, latitude, longitude, vlmDescription, catalogTags})`
   - `(:Entity {id, entityType, description, severity})`
4. Creates relationships:
   - `(photo)-[:SHOWS]->(entity)`
5. Returns success/failure with node counts

**Schema (MVP subset):**
```cypher
// Photo node
CREATE (p:Photo {
  id: $id,
  timestamp: datetime($timestamp),
  location: point({latitude: $lat, longitude: $lng}),
  vlmDescription: $description,
  catalogTags: $tags,
  imageUrl: $url
})

// Entity node
CREATE (e:Entity {
  id: $id,
  entityType: $type,
  description: $description,
  severity: $severity
})

// Relationship
MATCH (p:Photo {id: $photoId}), (e:Entity {id: $entityId})
CREATE (p)-[:SHOWS {confidence: $confidence}]->(e)
```

**Indexes:**
```cypher
CREATE POINT INDEX photo_location FOR (p:Photo) ON (p.location)
CREATE INDEX photo_id FOR (p:Photo) ON (p.id)
CREATE INDEX entity_type FOR (e:Entity) ON (e.entityType)
CREATE FULLTEXT INDEX photo_description FOR (p:Photo) ON EACH [p.vlmDescription]
```

---

### Day 2: Search API

**Morning: NL→Cypher Translation**

Create `/api/graph/search` endpoint that:
1. Receives natural language query
2. Sends to Claude with system prompt for Cypher generation
3. Executes generated Cypher against Neo4j
4. Returns results (photo URLs, metadata, entities)

**System prompt for NL→Cypher:**
```
You are a Cypher query generator for a photo graph database.

Schema:
- (:Photo {id, timestamp, location: point, vlmDescription, catalogTags: [string], imageUrl})
- (:Entity {id, entityType, description, severity})
- (Photo)-[:SHOWS {confidence}]->(Entity)

Spatial functions:
- point.distance(p1.location, p2.location) returns meters
- point({latitude: $lat, longitude: $lng}) creates a point

Given a natural language query, generate ONLY the Cypher query. No explanation.

Examples:
Q: "photos near 37.7749, -122.4194"
A: MATCH (p:Photo) WHERE point.distance(p.location, point({latitude: 37.7749, longitude: -122.4194})) < 500 RETURN p

Q: "photos showing storm drains"
A: MATCH (p:Photo)-[:SHOWS]->(e:Entity) WHERE e.entityType = 'Equipment' AND e.description CONTAINS 'storm drain' RETURN p, e

Q: "high severity findings within 100m of the UST"
A: MATCH (p:Photo)-[:SHOWS]->(e:Entity) WHERE e.severity = 'high' RETURN p, e LIMIT 20
```

**Afternoon: Testing + Refinement**

1. Test with existing exported sessions
2. Refine Cypher generation prompt based on failures
3. Add error handling for invalid queries
4. Test spatial queries with real GPS coordinates

---

## MVP Scope

### Included
- Photo nodes with GPS coordinates
- Entity nodes linked via SHOWS
- Basic spatial queries (distance from point)
- Natural language → Cypher translation
- Full-text search on descriptions

### Deferred (Phase 2)
- Location node hierarchy (Site → Area → Point)
- TAKEN_AT relationships to Location nodes
- NEAR relationships between photos
- Transcript segments and SPOKEN_DURING
- Decision nodes for audit trail
- Session and Project nodes

---

## API Reference

### POST /api/graph/ingest

**Request:**
```json
{
  "sessionId": "abc123",
  "indexJson": { /* Portable Evidence Package contents */ }
}
```

**Response:**
```json
{
  "success": true,
  "nodesCreated": {
    "photos": 15,
    "entities": 42
  },
  "relationshipsCreated": 67
}
```

### POST /api/graph/search

**Request:**
```json
{
  "query": "photos within 500m of 37.7749, -122.4194 showing staining"
}
```

**Response:**
```json
{
  "results": [
    {
      "photo": {
        "id": "...",
        "imageUrl": "...",
        "timestamp": "...",
        "location": { "latitude": 37.775, "longitude": -122.420 }
      },
      "entities": [
        { "entityType": "Observation", "description": "Staining on concrete pad" }
      ]
    }
  ],
  "cypherQuery": "MATCH (p:Photo)...",
  "executionTimeMs": 45
}
```

---

## Environment Variables

```bash
# Neo4j Aura connection
NEO4J_URI=neo4j+s://xxxxx.databases.neo4j.io
NEO4J_USER=neo4j
NEO4J_PASSWORD=xxxxx

# Existing (already configured)
ANTHROPIC_API_KEY=xxxxx
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `app/lib/neo4j.ts` | Neo4j driver connection utility |
| `app/api/graph/ingest/route.ts` | Ingest Portable Evidence Package |
| `app/api/graph/search/route.ts` | Natural language search endpoint |

---

## Testing Strategy

1. **Unit tests:** Cypher generation with known inputs
2. **Integration tests:** Ingest → Search round-trip
3. **Manual testing:** Use existing session exports from `evidence/sessions/`

**Test queries:**
- "all photos" → should return all ingested photos
- "photos showing UST" → entity-based filter
- "photos within 100m of 37.7, -122.4" → spatial filter
- "high severity findings" → severity filter

---

## Future Expansion

Once MVP is validated:

1. **Full schema from photo-graph-schema.md**
   - Location hierarchy
   - Session and Project nodes
   - Transcript segments

2. **CMAP integration**
   - Same Neo4j instance or federated queries
   - Shared Location nodes with Compass Engine

3. **Decision nodes**
   - Audit trail for regulated industries
   - `madeBy` provenance (human vs AI)

4. **NEAR relationships**
   - Compute at ingest time based on GPS proximity
   - Configurable threshold (10m, 50m, etc.)

---

## References

- [docs/photo-graph-schema.md](photo-graph-schema.md) — Full Neo4j schema design
- [docs/graph-database-briefing.md](graph-database-briefing.md) — Neo4j fundamentals
- [docs/photos-as-navigation-primitives.md](photos-as-navigation-primitives.md) — Core concept
- [Neo4j Aura Free](https://neo4j.com/cloud/aura-free/) — Managed Neo4j hosting
- [Neo4j Cypher Manual](https://neo4j.com/docs/cypher-manual/current/) — Query language reference
