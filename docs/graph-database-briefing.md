# Graph Databases & Neo4j: A Briefing for Choragraph

*Prepared for migration planning from IndexedDB to Neo4j with geospatial capabilities*

---

## Part 1: What Is a Graph Database?

### The Core Idea

A graph database stores data as **nodes** (things) and **edges** (relationships between things). That's it.

Compare this to what you're used to:

| Concept | Spreadsheet/SQL | Graph |
|---------|-----------------|-------|
| A thing | Row | Node |
| Thing's details | Columns | Properties |
| How things connect | Foreign keys, JOIN tables | Edges (relationships) |

### Why This Matters

In a traditional database, if you want to know "which photos were taken near other photos from a different project," you'd write a complex query with JOINs, distance calculations, and subqueries.

In a graph, you'd ask: "Find photos connected by a `NEAR` relationship."

The relationships are **first-class citizens**, not afterthoughts computed at query time.

### Visual Example: Your Current Data as a Graph

```
                    [User: Bart]
                         |
                     OWNS (edge)
                         |
                    [Project: Site Survey]
                    /        |        \
               CONTAINS   CONTAINS   CONTAINS
                  /          |          \
           [Photo 1]    [Photo 2]    [Photo 3]
           lat: 37.7    lat: 37.7    lat: 37.8
           lng: -122.4  lng: -122.4  lng: -122.5
                 \          |          /
                  \    NEAR (50m)     /
                   \        |        /
                    SAME_SESSION
```

Each box is a **node**. Each arrow is an **edge** (relationship). Both can have **properties** (lat, lng, distance, etc.).

---

## Part 2: Graph Vocabulary

| Term | Meaning | Your Example |
|------|---------|--------------|
| **Node** | An entity/thing | A photo, a project, a user, a location |
| **Label** | Category of node | `:Photo`, `:Project`, `:User` |
| **Property** | Data on a node or edge | `latitude: 37.7749`, `timestamp: "2024-01..."` |
| **Edge/Relationship** | Connection between nodes | `CONTAINS`, `NEAR`, `TAGGED_WITH` |
| **Direction** | Edges have a direction | Project → CONTAINS → Photo |
| **Traversal** | Following edges through the graph | "Start at User, follow OWNS, then CONTAINS" |

---

## Part 3: Neo4j Specifically

### What Neo4j Is

Neo4j is the most popular graph database. It uses a query language called **Cypher** that reads almost like English:

```cypher
// Find all photos in a project
MATCH (p:Project {name: "Site Survey"})-[:CONTAINS]->(photo:Photo)
RETURN photo

// Find photos within 100 meters of each other
MATCH (p1:Photo)-[r:NEAR]->(p2:Photo)
WHERE r.distance < 100
RETURN p1, p2
```

### Neo4j's Geospatial Features

Neo4j has **built-in** support for:

1. **Point data type**: Store lat/lng natively
   ```cypher
   CREATE (p:Photo {location: point({latitude: 37.7749, longitude: -122.4194})})
   ```

2. **Distance functions**: Calculate distance between points
   ```cypher
   WHERE point.distance(p1.location, p2.location) < 100
   ```

3. **Spatial indexing**: Fast queries over geographic data
   ```cypher
   CREATE POINT INDEX FOR (p:Photo) ON (p.location)
   ```

4. **Bounding box queries**: Find everything in an area
   ```cypher
   WHERE point.withinBBox(p.location, point1, point2)
   ```

**What Neo4j does NOT do well:**
- Complex polygons (use PostGIS for that)
- Geometric operations (intersection, union, buffering)
- Raster data (satellite imagery, elevation maps)

For your use case (photos with lat/lng), Neo4j's geospatial is sufficient.

---

## Part 4: Why Graph for Choragraph?

### What You Gain

1. **Natural relationship queries**
   - "Find all photos that share entities with this photo"
   - "What observations connect these two site visits?"
   - "Show me the chain of related findings across projects"

2. **Implicit connections become explicit**
   - Photos taken at the same location = `NEAR` relationship
   - Photos mentioning same entity = `REFERENCES` relationship
   - You can traverse these without recalculating

3. **Flexible schema**
   - Add new node types (Equipment, Person, Issue) without migrations
   - Add new relationship types as your analysis evolves

4. **Path-finding**
   - "How is this photo connected to that equipment failure?"
   - Graph databases are optimized for this

### What You Lose (or Complicate)

1. **Simplicity**
   - IndexedDB is trivially simple: key-value lookups
   - Neo4j requires learning Cypher, thinking in graphs

2. **Offline-first**
   - Your current app works entirely offline
   - Neo4j requires a server (though there's Neo4j embedded/lite options)

3. **Aggregations**
   - "Count of photos per project" is clunky in Cypher
   - SQL-style aggregations are easier in relational databases

4. **Ecosystem maturity**
   - Fewer ORMs, tools, tutorials than PostgreSQL
   - Debugging is harder

---

## Part 5: The Hybrid Question

Many production systems use **both**:

| Database | Use For |
|----------|---------|
| PostgreSQL/PostGIS | Structured data, aggregations, complex geometry |
| Neo4j | Relationship traversal, recommendations, network analysis |
| IndexedDB (keep it!) | Offline capture, local cache |

Your current IndexedDB could remain as the **capture layer**, syncing to Neo4j when online for the **analysis layer**.

---

## Part 6: Key Trade-offs Summary

| Factor | IndexedDB (Current) | Neo4j (Proposed) |
|--------|---------------------|------------------|
| Offline support | Native | Requires sync layer |
| Query complexity | Simple lookups only | Powerful traversals |
| Geospatial | Manual calculations | Built-in functions |
| Learning curve | Minimal | Moderate |
| Relationship queries | Expensive (reconstruct) | Cheap (pre-computed) |
| Aggregations | Decent | Awkward |
| Scale (your case) | Fine for ~1000 photos | Overkill, but future-proof |
| Hosting | None (client-side) | Requires server |

---

## Part 7: Topics for Deeper Dives

Check the ones you want to explore:

- [ ] **Data modeling**: How to structure your nodes/edges for Choragraph specifically
- [ ] **Cypher basics**: Hands-on with the query language
- [ ] **Geospatial in Neo4j**: Point indexes, distance queries, spatial patterns
- [ ] **Sync architecture**: How to keep IndexedDB ↔ Neo4j in sync
- [ ] **Graph algorithms**: Clustering, centrality, pathfinding (what Neo4j is really good at)
- [ ] **Migration strategy**: How to transform your current data model
- [ ] **Neo4j deployment options**: AuraDB (cloud), self-hosted, embedded
- [ ] **Performance considerations**: When graphs slow down and how to prevent it
- [ ] **Alternative graph databases**: How Neo4j compares to others (if worth considering)

---

## Part 8: Schema as Conversation Artifact

A key insight for Choragraph: **entity schemas don't need to be defined by product teams upfront.**

Traditional approach: Product team anticipates domains (ESA, construction, inspection), defines entity types and vocabularies, ships configuration, users work within those constraints.

New approach: User describes their workflow to a conversational agent in 5 minutes. Agent generates the entity schema, capture prompts, and vision analysis instructions. User refines conversationally. Schema is saved as a reusable template.

This makes the graph viable for the long tail of field workflows — any domain where someone walks around capturing evidence — without requiring product teams to scope each one.

The project context structure you already have (`entitySchema`, `capturePrompts`, `visionAnalysisPrompt`) is the right shape. The agent is simply a friendlier interface to populate it.

---

## Questions This Briefing Doesn't Answer

1. What relationships matter most for your analysis workflows?
2. Will users need to query across all users' data, or just their own?
3. What's your tolerance for added infrastructure complexity?
4. Is real-time sync important, or can analysis be batch/async?

---

*Next step: Pick 2-3 topics from Part 7, or tell me what's unclear.*
