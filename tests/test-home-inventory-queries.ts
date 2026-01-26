/**
 * Test script for home inventory graph queries
 *
 * Run with: npx ts-node tests/test-home-inventory-queries.ts
 *
 * Prerequisites:
 * 1. Neo4j is running and accessible
 * 2. Test data has been ingested via /api/graph/ingest
 */

import { runReadTransaction } from '../app/lib/neo4j';

const SESSION_ID = 'test-home-inventory-001';

async function testQueries() {
  console.log('=== Home Inventory Graph Query Tests ===\n');

  // Test 1: Where's the hammer?
  console.log('Test 1: Where\'s the hammer?');
  try {
    const hammerResult = await runReadTransaction(async (tx) => {
      const result = await tx.run(`
        MATCH (e:Entity {entityType: 'item'})-[:STORED_IN]->(c:Location)-[:INSIDE]->(r:Location)
        WHERE e.description CONTAINS 'hammer'
        RETURN e.description as item, c.name as container, r.name as room
        UNION
        MATCH (e:Entity {entityType: 'item'})-[:STORED_IN]->(r:Location {level: 'room'})
        WHERE e.description CONTAINS 'hammer'
        RETURN e.description as item, null as container, r.name as room
      `);
      return result.records.map(r => ({
        item: r.get('item'),
        container: r.get('container'),
        room: r.get('room'),
      }));
    });
    console.log('  Results:', hammerResult);
    console.log('  Expected: kitchen > tool drawer, garage > workbench\n');
  } catch (error) {
    console.error('  Error:', error);
  }

  // Test 2: What's in the kitchen?
  console.log('Test 2: What\'s in the kitchen?');
  try {
    const kitchenResult = await runReadTransaction(async (tx) => {
      const result = await tx.run(`
        MATCH (r:Location {name: 'kitchen', level: 'room'})
        OPTIONAL MATCH (r)<-[:INSIDE]-(c:Location)<-[:STORED_IN]-(e1:Entity {entityType: 'item'})
        OPTIONAL MATCH (r)<-[:STORED_IN]-(e2:Entity {entityType: 'item'})
        WITH r, c, collect(DISTINCT e1.description) as containerItems, collect(DISTINCT e2.description) as roomItems
        RETURN r.name as room, c.name as container, containerItems, roomItems
      `);
      return result.records.map(r => ({
        room: r.get('room'),
        container: r.get('container'),
        containerItems: r.get('containerItems'),
        roomItems: r.get('roomItems'),
      }));
    });
    console.log('  Results:', JSON.stringify(kitchenResult, null, 2));
    console.log('  Expected: items in tool drawer + items on counter\n');
  } catch (error) {
    console.error('  Error:', error);
  }

  // Test 3: Where are the spare chargers?
  console.log('Test 3: Where are the spare chargers?');
  try {
    const chargersResult = await runReadTransaction(async (tx) => {
      const result = await tx.run(`
        MATCH (e:Entity {entityType: 'item'})-[:STORED_IN]->(c:Location)-[:INSIDE]->(r:Location)
        WHERE e.description CONTAINS 'charger'
        RETURN e.description as item, c.name as container, r.name as room
      `);
      return result.records.map(r => ({
        item: r.get('item'),
        container: r.get('container'),
        room: r.get('room'),
      }));
    });
    console.log('  Results:', chargersResult);
    console.log('  Expected: office > closet > plastic organizer bins\n');
  } catch (error) {
    console.error('  Error:', error);
  }

  // Test 4: Count all locations
  console.log('Test 4: Count all locations by level');
  try {
    const locationCount = await runReadTransaction(async (tx) => {
      const result = await tx.run(`
        MATCH (l:Location {sessionId: $sessionId})
        RETURN l.level as level, count(l) as count
      `, { sessionId: SESSION_ID });
      return result.records.map(r => ({
        level: r.get('level'),
        count: r.get('count').toNumber(),
      }));
    });
    console.log('  Results:', locationCount);
    console.log('  Expected: ~6 rooms, ~5 containers\n');
  } catch (error) {
    console.error('  Error:', error);
  }

  // Test 5: Count all items
  console.log('Test 5: Count all items');
  try {
    const itemCount = await runReadTransaction(async (tx) => {
      const result = await tx.run(`
        MATCH (e:Entity {sessionId: $sessionId, entityType: 'item'})
        RETURN count(e) as itemCount
      `, { sessionId: SESSION_ID });
      return result.records[0]?.get('itemCount').toNumber() || 0;
    });
    console.log('  Results:', itemCount);
    console.log('  Expected: ~42 items\n');
  } catch (error) {
    console.error('  Error:', error);
  }

  console.log('=== Tests Complete ===');
}

// Run if called directly
testQueries().catch(console.error);
