/**
 * Integration test: validates search index against the fixture's queries_to_validate.
 * Uses the home-inventory-ideal.json fixture's ground truth expectations.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSearchIndex } from '../app/lib/synthesis/search-index.ts';
import { getSearchSchema } from '../app/lib/synthesis/configs.ts';

// Load fixture
const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(
  readFileSync(join(__dirname, 'fixtures', 'home-inventory-ideal.json'), 'utf-8')
);

// Convert fixture to PhotoAnalysis format
const photoAnalyses = fixture.photos.map((p: Record<string, unknown>) => ({
  photoId: p.photoId,
  vlmDescription: p.vlmDescription,
  catalogTags: p.catalogTags || [],
  entities: [],
  transcriptSegment: null,
  timestamp: p.timestamp,
  gps: p.gps || null,
  room: p.room,
  area: p.area,
  container: p.container,
  items: p.items,
  notes: p.notes,
}));

const searchSchema = getSearchSchema('home-inventory');
const index = buildSearchIndex(photoAnalyses, [], [], searchSchema);

// Helper: search the index for a term, return matching photo IDs
function searchIndex(query: string): string[] {
  const term = query.toLowerCase();
  const entry = index.find(e => e.term === term);
  if (!entry) return [];
  return entry.matches.map(m => m.photoId);
}

// Helper: find all entries whose term contains a substring
function searchContains(substring: string): Array<{ term: string; photoIds: string[] }> {
  const sub = substring.toLowerCase();
  return index
    .filter(e => e.term.includes(sub))
    .map(e => ({ term: e.term, photoIds: e.matches.map(m => m.photoId) }));
}

describe('Fixture query: "Where\'s the hammer?"', () => {
  // Expected: kitchen > tool drawer AND garage > workbench

  it('finds hammer in the index', () => {
    const photoIds = searchIndex('hammer');
    assert.ok(photoIds.length > 0, 'hammer should have matches');
  });

  it('hammer is in kitchen (photo-001) and garage (photo-004)', () => {
    const photoIds = searchIndex('hammer');
    assert.ok(photoIds.includes('photo-001'), 'Should find hammer in photo-001 (kitchen)');
    assert.ok(photoIds.includes('photo-004'), 'Should find hammer in photo-004 (garage)');
  });

  it('kitchen and garage rooms are also searchable', () => {
    const kitchenPhotos = searchIndex('kitchen');
    assert.ok(kitchenPhotos.includes('photo-001'), 'photo-001 should be in kitchen');

    const garagePhotos = searchIndex('garage');
    assert.ok(garagePhotos.includes('photo-004'), 'photo-004 should be in garage');
  });
});

describe('Fixture query: "What\'s in the garage?"', () => {
  // Expected items: christmas lights, ornaments, tree stand, wreath, cordless drill, circular saw, hammer

  const garagePhotoIds = searchIndex('garage');

  it('finds garage with both garage photos', () => {
    assert.ok(garagePhotoIds.includes('photo-003'), 'photo-003 should be in garage');
    assert.ok(garagePhotoIds.includes('photo-004'), 'photo-004 should be in garage');
  });

  it('all expected garage items are indexed', () => {
    const expectedItems = [
      'christmas lights',
      'ornaments',
      'tree stand',
      'wreath',
      'cordless drill',
      'circular saw',
      'hammer',
    ];

    for (const item of expectedItems) {
      const entry = index.find(e => e.term === item.toLowerCase());
      assert.ok(entry, `"${item}" should be in the index`);

      // Verify at least one match is a garage photo
      const matchedGaragePhotos = entry!.matches
        .filter(m => m.photoId === 'photo-003' || m.photoId === 'photo-004');
      assert.ok(matchedGaragePhotos.length > 0, `"${item}" should match a garage photo`);
    }
  });
});

describe('Fixture query: "Where are the spare chargers?"', () => {
  // Expected: office > closet > plastic organizer bins

  it('spare chargers are indexed', () => {
    const results = searchIndex('spare chargers');
    assert.ok(results.length > 0, 'spare chargers should be in index');
    assert.ok(results.includes('photo-009'), 'Should match photo-009 (office closet)');
  });

  it('office room is indexed for photo-009', () => {
    const officePhotos = searchIndex('office');
    assert.ok(officePhotos.includes('photo-009'), 'photo-009 should be in office');
  });

  it('plastic organizer bins container is indexed', () => {
    const bins = searchIndex('plastic organizer bins');
    assert.ok(bins.length > 0, 'plastic organizer bins should be in index');
    assert.ok(bins.includes('photo-009'), 'Should match photo-009');
  });
});

describe('Brand search across fixture', () => {
  it('KitchenAid matches photo-002 (kitchen counter)', () => {
    const results = searchIndex('KitchenAid');
    assert.ok(results.includes('photo-002'), 'KitchenAid should match photo-002');
  });

  it('DeWalt matches photo-004 (garage workbench)', () => {
    const results = searchIndex('DeWalt');
    assert.ok(results.includes('photo-004'), 'DeWalt should match photo-004');
  });

  it('Samsung matches photo-010 (living room TV)', () => {
    const results = searchIndex('Samsung');
    assert.ok(results.includes('photo-010'), 'Samsung should match photo-010');
  });
});

describe('Total index coverage', () => {
  it('has entries for all 10 photos', () => {
    const allPhotoIds = new Set<string>();
    for (const entry of index) {
      for (const match of entry.matches) {
        allPhotoIds.add(match.photoId);
      }
    }
    for (let i = 1; i <= 10; i++) {
      const id = `photo-${String(i).padStart(3, '0')}`;
      assert.ok(allPhotoIds.has(id), `${id} should appear in at least one index entry`);
    }
  });

  it('has a reasonable number of index entries', () => {
    // 10 photos × ~5 items each = ~50 items, plus rooms, containers, tags, descriptions
    assert.ok(index.length > 40, `Should have >40 entries, got ${index.length}`);
    assert.ok(index.length < 300, `Should have <300 entries, got ${index.length}`);
  });
});
