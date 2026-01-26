/**
 * Script to ingest the home inventory test fixture into Neo4j
 *
 * Run with: npx ts-node --esm tests/ingest-test-fixture.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function ingestTestFixture() {
  // Load test fixture
  const fixturePath = path.join(__dirname, 'fixtures/home-inventory-ideal.json');
  const fixtureData = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));

  console.log('=== Ingesting Home Inventory Test Fixture ===\n');
  console.log(`Session ID: ${fixtureData.session_id}`);
  console.log(`Project Type: ${fixtureData.project_type}`);
  console.log(`Photos: ${fixtureData.photos.length}`);
  console.log();

  // Call the ingest API
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

  try {
    const response = await fetch(`${baseUrl}/api/graph/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        projectType: 'home-inventory',
        indexJson: {
          session_id: fixtureData.session_id,
          project_type: fixtureData.project_type,
          photos: fixtureData.photos,
        },
        photos: fixtureData.photos, // Also pass directly for home-inventory processing
      }),
    });

    const result = await response.json();

    if (result.success) {
      console.log('✓ Ingest successful!');
      console.log(`  Photos created: ${result.nodesCreated.photos}`);
      console.log(`  Entities created: ${result.nodesCreated.entities}`);
      console.log(`  Locations created: ${result.nodesCreated.locations || 0}`);
      console.log(`  Relationships created: ${result.relationshipsCreated}`);
    } else {
      console.log('✗ Ingest failed!');
      console.log(`  Errors: ${result.errors?.join(', ')}`);
    }
  } catch (error) {
    console.error('Error calling ingest API:', error);
    console.log('\nMake sure the dev server is running: npm run dev');
  }
}

ingestTestFixture().catch(console.error);
