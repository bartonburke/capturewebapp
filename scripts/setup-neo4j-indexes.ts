/**
 * One-time setup script for Neo4j indexes
 *
 * Run with: npx ts-node scripts/setup-neo4j-indexes.ts
 *
 * Or with env vars:
 * NEO4J_URI=neo4j+s://xxx.databases.neo4j.io \
 * NEO4J_USER=neo4j \
 * NEO4J_PASSWORD=xxx \
 * npx ts-node scripts/setup-neo4j-indexes.ts
 */

import * as dotenv from 'dotenv';
import neo4j from 'neo4j-driver';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const INDEX_QUERIES = [
  // Point index for spatial queries (within distance)
  {
    name: 'photo_location',
    query: `CREATE POINT INDEX photo_location IF NOT EXISTS FOR (p:Photo) ON (p.location)`,
    description: 'Spatial index on Photo.location for distance queries',
  },
  // Standard indexes for lookups
  {
    name: 'photo_id',
    query: `CREATE INDEX photo_id IF NOT EXISTS FOR (p:Photo) ON (p.id)`,
    description: 'Index on Photo.id for direct lookups',
  },
  {
    name: 'photo_session',
    query: `CREATE INDEX photo_session IF NOT EXISTS FOR (p:Photo) ON (p.sessionId)`,
    description: 'Index on Photo.sessionId for session-based queries',
  },
  {
    name: 'entity_type',
    query: `CREATE INDEX entity_type IF NOT EXISTS FOR (e:Entity) ON (e.entityType)`,
    description: 'Index on Entity.entityType for type filtering',
  },
  {
    name: 'entity_session',
    query: `CREATE INDEX entity_session IF NOT EXISTS FOR (e:Entity) ON (e.sessionId)`,
    description: 'Index on Entity.sessionId for session-based queries',
  },
  // Fulltext index for natural language search
  {
    name: 'photo_description',
    query: `CREATE FULLTEXT INDEX photo_description IF NOT EXISTS FOR (p:Photo) ON EACH [p.vlmDescription]`,
    description: 'Fulltext index on Photo.vlmDescription for text search',
  },
];

async function createIndexes() {
  const uri = process.env.NEO4J_URI;
  const user = process.env.NEO4J_USER;
  const password = process.env.NEO4J_PASSWORD;

  if (!uri || !user || !password) {
    console.error('Error: Missing Neo4j credentials');
    console.error('Set NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD environment variables');
    console.error('');
    console.error('Example:');
    console.error('  NEO4J_URI=neo4j+s://xxx.databases.neo4j.io \\');
    console.error('  NEO4J_USER=neo4j \\');
    console.error('  NEO4J_PASSWORD=xxx \\');
    console.error('  npx ts-node scripts/setup-neo4j-indexes.ts');
    process.exit(1);
  }

  console.log('Connecting to Neo4j...');
  console.log(`  URI: ${uri}`);
  console.log(`  User: ${user}`);

  const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));

  try {
    // Verify connection
    const serverInfo = await driver.getServerInfo();
    console.log(`\nConnected to Neo4j ${serverInfo.agent}`);
    console.log(`  Address: ${serverInfo.address}`);
    console.log('');

    const session = driver.session();

    try {
      console.log('Creating indexes...\n');

      for (const index of INDEX_QUERIES) {
        console.log(`  Creating: ${index.name}`);
        console.log(`    ${index.description}`);

        try {
          await session.run(index.query);
          console.log(`    ✓ Success\n`);
        } catch (error) {
          // Index might already exist with different settings
          const errorMessage = error instanceof Error ? error.message : String(error);
          if (errorMessage.includes('already exists')) {
            console.log(`    ✓ Already exists\n`);
          } else {
            console.error(`    ✗ Failed: ${errorMessage}\n`);
          }
        }
      }

      // List all indexes
      console.log('Verifying indexes...\n');
      const result = await session.run('SHOW INDEXES');

      console.log('Current indexes:');
      for (const record of result.records) {
        const name = record.get('name');
        const type = record.get('type');
        const state = record.get('state');
        const labelsOrTypes = record.get('labelsOrTypes');
        const properties = record.get('properties');

        console.log(`  - ${name} (${type})`);
        console.log(`    Labels: ${labelsOrTypes?.join(', ')}`);
        console.log(`    Properties: ${properties?.join(', ')}`);
        console.log(`    State: ${state}`);
        console.log('');
      }

      console.log('Setup complete!');
    } finally {
      await session.close();
    }
  } finally {
    await driver.close();
  }
}

createIndexes().catch((error) => {
  console.error('Setup failed:', error);
  process.exit(1);
});
