/**
 * Tests for buildSearchIndex() with the home-inventory fixture data.
 * Verifies that items, attributes, rooms, containers, and descriptions are all indexed.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSearchIndex } from '../app/lib/synthesis/search-index.ts';
import { getSearchSchema } from '../app/lib/synthesis/configs.ts';

// Load home-inventory fixture
const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(
  readFileSync(join(__dirname, 'fixtures', 'home-inventory-ideal.json'), 'utf-8')
);

// Convert fixture photos to PhotoAnalysis format
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

// Helper: find an index entry by term
function findEntry(index: Array<{ term: string; type: string; matches: Array<{ photoId: string }> }>, term: string) {
  return index.find(e => e.term === term.toLowerCase());
}

// Helper: get all terms of a given type
function termsOfType(index: Array<{ term: string; type: string }>, type: string) {
  return index.filter(e => e.type === type).map(e => e.term);
}

describe('buildSearchIndex with home-inventory schema', () => {

  // Run the index once for all tests
  const index = buildSearchIndex(photoAnalyses, [], [], searchSchema);

  it('indexes item names from items[] array', () => {
    assert.ok(findEntry(index, 'hammer'), '"hammer" should be indexed');
    assert.ok(findEntry(index, 'stand mixer'), '"stand mixer" should be indexed');
    assert.ok(findEntry(index, 'cordless drill'), '"cordless drill" should be indexed');
    assert.ok(findEntry(index, 'laptop'), '"laptop" should be indexed');
    assert.ok(findEntry(index, 'first aid kit'), '"first aid kit" should be indexed');
  });

  it('indexes item attributes (brand)', () => {
    assert.ok(findEntry(index, 'KitchenAid'), '"KitchenAid" should be indexed as attribute');
    assert.ok(findEntry(index, 'DeWalt'), '"DeWalt" should be indexed as attribute');
    assert.ok(findEntry(index, 'MacBook Pro'), '"MacBook Pro" should be indexed as attribute');
  });

  it('indexes item attributes (color)', () => {
    assert.ok(findEntry(index, 'red'), '"red" should be indexed as attribute');
    assert.ok(findEntry(index, 'yellow'), '"yellow" should be indexed as attribute');
    assert.ok(findEntry(index, 'green'), '"green" should be indexed as attribute');
  });

  it('attribute entries have type "attribute"', () => {
    const kitchenaid = findEntry(index, 'KitchenAid');
    assert.ok(kitchenaid, 'KitchenAid should exist');
    assert.equal(kitchenaid!.type, 'attribute');

    const dewalt = findEntry(index, 'DeWalt');
    assert.ok(dewalt, 'DeWalt should exist');
    assert.equal(dewalt!.type, 'attribute');
  });

  it('indexes rooms directly from photos', () => {
    assert.ok(findEntry(index, 'kitchen'), '"kitchen" should be indexed');
    assert.ok(findEntry(index, 'garage'), '"garage" should be indexed');
    assert.ok(findEntry(index, 'bedroom'), '"bedroom" should be indexed');
    assert.ok(findEntry(index, 'bathroom'), '"bathroom" should be indexed');
    assert.ok(findEntry(index, 'office'), '"office" should be indexed');
    assert.ok(findEntry(index, 'living room'), '"living room" should be indexed');
  });

  it('room entries have type "room"', () => {
    const kitchen = findEntry(index, 'kitchen');
    assert.ok(kitchen);
    assert.equal(kitchen!.type, 'room');
  });

  it('indexes containers', () => {
    assert.ok(findEntry(index, 'tool drawer'), '"tool drawer" should be indexed');
    assert.ok(findEntry(index, 'cabinet'), '"cabinet" should be indexed');
    assert.ok(findEntry(index, 'top shelf'), '"top shelf" should be indexed');
    assert.ok(findEntry(index, 'plastic organizer bins'), '"plastic organizer bins" should be indexed');
  });

  it('container entries have type "container"', () => {
    const drawer = findEntry(index, 'tool drawer');
    assert.ok(drawer);
    assert.equal(drawer!.type, 'container');
  });

  it('indexes areas', () => {
    assert.ok(findEntry(index, 'left of stove'), '"left of stove" should be indexed');
    assert.ok(findEntry(index, 'closet'), '"closet" should be indexed');
    assert.ok(findEntry(index, 'desk'), '"desk" should be indexed');
  });

  it('indexes vlmDescription', () => {
    // vlmDescription is indexed as a whole string term
    const desc = findEntry(index, 'Tool drawer in kitchen with assorted hand tools');
    assert.ok(desc, 'vlmDescription should be indexed');
  });

  it('indexes notes as strings', () => {
    const note = findEntry(index, 'main tools for quick repairs');
    assert.ok(note, 'notes should be indexed');

    const chargerNote = findEntry(index, 'spare chargers are in the green bin');
    assert.ok(chargerNote, 'charger note should be indexed');
  });

  it('hammer matches include both photo-001 and photo-004', () => {
    const hammer = findEntry(index, 'hammer');
    assert.ok(hammer, 'hammer should exist');
    const photoIds = hammer!.matches.map(m => m.photoId);
    assert.ok(photoIds.includes('photo-001'), 'hammer should match photo-001');
    assert.ok(photoIds.includes('photo-004'), 'hammer should match photo-004');
  });

  it('stand mixer matches only photo-002', () => {
    const mixer = findEntry(index, 'stand mixer');
    assert.ok(mixer, 'stand mixer should exist');
    const photoIds = mixer!.matches.map(m => m.photoId);
    assert.ok(photoIds.includes('photo-002'), 'stand mixer should match photo-002');
    assert.equal(photoIds.length, 1, 'stand mixer should only appear in one photo');
  });

  it('still indexes catalog tags (base layer)', () => {
    assert.ok(findEntry(index, 'tools'), '"tools" tag should be indexed');
    assert.ok(findEntry(index, 'seasonal'), '"seasonal" tag should be indexed');
    assert.ok(findEntry(index, 'electronics'), '"electronics" tag should be indexed');
  });

  it('catalog tag entries have type "tag"', () => {
    const tools = findEntry(index, 'tools');
    assert.ok(tools);
    assert.equal(tools!.type, 'tag');
  });
});

describe('buildSearchIndex backward compatibility (no schema)', () => {

  it('works without searchSchema argument', () => {
    const index = buildSearchIndex(photoAnalyses, [], []);
    assert.ok(Array.isArray(index), 'Should return an array');
    // Should still have catalog tags
    assert.ok(findEntry(index, 'tools'), 'Should still index catalog tags');
  });

  it('does NOT index items[] without schema', () => {
    const index = buildSearchIndex(photoAnalyses, [], []);
    // Without the schema, items[].name should not be indexed
    const hammer = findEntry(index, 'hammer');
    assert.equal(hammer, undefined, 'hammer should NOT be indexed without schema');
  });

  it('does NOT index room without schema', () => {
    const index = buildSearchIndex(photoAnalyses, [], []);
    // Room might appear as a tag from catalogTags, but not as type "room"
    const rooms = termsOfType(index, 'room');
    assert.equal(rooms.length, 0, 'No room-type entries should exist without schema');
  });

  it('indexes entity clusters when provided', () => {
    const clusters = [
      {
        clusterId: 'c1',
        canonicalName: 'Test Item',
        entityType: 'item',
        photoIds: ['p1'],
        descriptions: ['desc'],
        mergedDescription: 'merged desc',
        locations: ['kitchen'],
        confidence: 0.9,
      },
    ];
    const index = buildSearchIndex([], clusters, []);
    const entry = findEntry(index, 'test item');
    assert.ok(entry, 'Entity cluster should be indexed');
    assert.equal(entry!.type, 'item');
    assert.equal(entry!.matches[0].photoId, 'p1');
  });

  it('indexes location hierarchy when provided', () => {
    const locations = [
      {
        id: 'loc1',
        name: 'Kitchen',
        level: 'room' as const,
        photoIds: ['p1', 'p2'],
        itemCount: 5,
      },
    ];
    const index = buildSearchIndex([], [], locations);
    const entry = findEntry(index, 'kitchen');
    assert.ok(entry, 'Location should be indexed');
    assert.equal(entry!.type, 'location');
    assert.equal(entry!.matches.length, 2);
  });
});

describe('buildSearchIndex edge cases', () => {

  it('handles null container gracefully', () => {
    const analyses = [{
      photoId: 'p1',
      vlmDescription: 'test',
      catalogTags: [],
      entities: [],
      transcriptSegment: null,
      timestamp: '2026-01-01',
      gps: null,
      room: 'kitchen',
      area: null,
      container: null,
      items: [{ name: 'fork', attributes: {} }],
      notes: [],
    }];
    const index = buildSearchIndex(analyses, [], [], searchSchema);
    // Should not crash, and should still index the room and item
    assert.ok(findEntry(index, 'kitchen'), 'Room should be indexed');
    assert.ok(findEntry(index, 'fork'), 'Item should be indexed');
  });

  it('handles empty items array', () => {
    const analyses = [{
      photoId: 'p1',
      vlmDescription: 'empty room',
      catalogTags: [],
      entities: [],
      transcriptSegment: null,
      timestamp: '2026-01-01',
      gps: null,
      room: 'hallway',
      area: null,
      container: null,
      items: [],
      notes: [],
    }];
    const index = buildSearchIndex(analyses, [], [], searchSchema);
    assert.ok(findEntry(index, 'hallway'), 'Room should still be indexed');
  });

  it('handles missing attributes on items', () => {
    const analyses = [{
      photoId: 'p1',
      vlmDescription: 'test',
      catalogTags: [],
      entities: [],
      transcriptSegment: null,
      timestamp: '2026-01-01',
      gps: null,
      room: 'garage',
      area: null,
      container: null,
      items: [{ name: 'wrench' }], // no attributes key at all
      notes: [],
    }];
    const index = buildSearchIndex(analyses, [], [], searchSchema);
    assert.ok(findEntry(index, 'wrench'), 'Item should still be indexed');
  });
});
