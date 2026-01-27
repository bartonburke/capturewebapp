/**
 * Tests for SearchSchema config structure and helpers.
 * Validates that per-project-type search schemas are well-formed.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  SYNTHESIS_CONFIGS,
  getSynthesisConfig,
  getSearchSchema,
  buildSchemaPromptSection,
} from '../app/lib/synthesis/configs.ts';

describe('SearchSchema configs', () => {

  it('every config with a searchSchema has non-empty graph nodes', () => {
    for (const [type, config] of Object.entries(SYNTHESIS_CONFIGS)) {
      if (config?.searchSchema) {
        const nodes = config.searchSchema.graphSchema.nodeLabels;
        assert.ok(nodes.length > 0, `${type} has no graph node labels`);
      }
    }
  });

  it('every config with a searchSchema has non-empty relationships', () => {
    for (const [type, config] of Object.entries(SYNTHESIS_CONFIGS)) {
      if (config?.searchSchema) {
        const rels = config.searchSchema.graphSchema.relationships;
        assert.ok(rels.length > 0, `${type} has no graph relationships`);
      }
    }
  });

  it('every config with a searchSchema has example queries', () => {
    for (const [type, config] of Object.entries(SYNTHESIS_CONFIGS)) {
      if (config?.searchSchema) {
        const examples = config.searchSchema.exampleQueries;
        assert.ok(examples.length > 0, `${type} has no example queries`);
      }
    }
  });

  it('home-inventory has Item and Location nodes', () => {
    const schema = getSearchSchema('home-inventory');
    const labels = schema.graphSchema.nodeLabels.map(n => n.label);
    assert.ok(labels.includes('Item'), 'Missing Item node');
    assert.ok(labels.includes('Location'), 'Missing Location node');
    assert.ok(labels.includes('Photo'), 'Missing Photo node');
  });

  it('home-inventory has SHOWS_ITEM, STORED_IN, INSIDE relationships', () => {
    const schema = getSearchSchema('home-inventory');
    const relTypes = schema.graphSchema.relationships.map(r => r.type);
    assert.ok(relTypes.includes('SHOWS_ITEM'), 'Missing SHOWS_ITEM');
    assert.ok(relTypes.includes('STORED_IN'), 'Missing STORED_IN');
    assert.ok(relTypes.includes('INSIDE'), 'Missing INSIDE');
  });

  it('home-inventory indexableFields include room, items, container', () => {
    const schema = getSearchSchema('home-inventory');
    const fields = schema.indexableFields.map(f => f.fieldPath);
    assert.ok(fields.includes('room'), 'Missing room field');
    assert.ok(fields.includes('items'), 'Missing items field');
    assert.ok(fields.includes('container'), 'Missing container field');
    assert.ok(fields.includes('area'), 'Missing area field');
    assert.ok(fields.includes('vlmDescription'), 'Missing vlmDescription field');
  });

  it('home-inventory items field has attributeKeys for brand/color', () => {
    const schema = getSearchSchema('home-inventory');
    const itemsField = schema.indexableFields.find(f => f.fieldPath === 'items');
    assert.ok(itemsField, 'items field not found');
    assert.ok(itemsField!.attributeKeys?.includes('brand'), 'Missing brand attributeKey');
    assert.ok(itemsField!.attributeKeys?.includes('color'), 'Missing color attributeKey');
    assert.equal(itemsField!.termField, 'name', 'items termField should be "name"');
  });

  it('phase1-esa has Entity node with SHOWS relationship', () => {
    const schema = getSearchSchema('phase1-esa');
    const labels = schema.graphSchema.nodeLabels.map(n => n.label);
    assert.ok(labels.includes('Entity'), 'Missing Entity node');
    assert.ok(labels.includes('Photo'), 'Missing Photo node');

    const relTypes = schema.graphSchema.relationships.map(r => r.type);
    assert.ok(relTypes.includes('SHOWS'), 'Missing SHOWS relationship');
  });

  it('phase1-esa does NOT have Item or STORED_IN', () => {
    const schema = getSearchSchema('phase1-esa');
    const labels = schema.graphSchema.nodeLabels.map(n => n.label);
    assert.ok(!labels.includes('Item'), 'ESA should not have Item node');

    const relTypes = schema.graphSchema.relationships.map(r => r.type);
    assert.ok(!relTypes.includes('STORED_IN'), 'ESA should not have STORED_IN');
  });

  it('getSearchSchema falls back to generic for unknown types', () => {
    // @ts-expect-error testing unknown type
    const schema = getSearchSchema('nonexistent-type');
    assert.ok(schema, 'Should return a fallback schema');
    assert.ok(schema.graphSchema.nodeLabels.length > 0, 'Fallback should have nodes');
  });

  it('getSearchSchema falls back for types without searchSchema', () => {
    const schema = getSearchSchema('travel-log');
    assert.ok(schema, 'Should return a fallback schema');
    assert.ok(schema.graphSchema.nodeLabels.length > 0, 'Fallback should have nodes');
  });

  it('getSynthesisConfig returns config with searchSchema for home-inventory', () => {
    const config = getSynthesisConfig('home-inventory');
    assert.ok(config.searchSchema, 'home-inventory should have searchSchema');
    assert.equal(config.projectType, 'home-inventory');
  });
});

describe('buildSchemaPromptSection', () => {

  it('generates node labels for home-inventory schema', () => {
    const schema = getSearchSchema('home-inventory');
    const prompt = buildSchemaPromptSection(schema.graphSchema);

    assert.ok(prompt.includes(':Item'), 'Prompt should contain :Item');
    assert.ok(prompt.includes(':Location'), 'Prompt should contain :Location');
    assert.ok(prompt.includes(':Photo'), 'Prompt should contain :Photo');
  });

  it('generates relationship types for home-inventory', () => {
    const schema = getSearchSchema('home-inventory');
    const prompt = buildSchemaPromptSection(schema.graphSchema);

    assert.ok(prompt.includes('SHOWS_ITEM'), 'Prompt should contain SHOWS_ITEM');
    assert.ok(prompt.includes('STORED_IN'), 'Prompt should contain STORED_IN');
    assert.ok(prompt.includes('INSIDE'), 'Prompt should contain INSIDE');
  });

  it('includes enum values for properties', () => {
    const schema = getSearchSchema('home-inventory');
    const prompt = buildSchemaPromptSection(schema.graphSchema);

    // Location.level should show enum values
    assert.ok(prompt.includes('room'), 'Should include room level enum');
    assert.ok(prompt.includes('container'), 'Should include container level enum');
  });

  it('generates ESA schema without inventory terms', () => {
    const schema = getSearchSchema('phase1-esa');
    const prompt = buildSchemaPromptSection(schema.graphSchema);

    assert.ok(prompt.includes(':Entity'), 'ESA prompt should contain :Entity');
    assert.ok(prompt.includes('SHOWS'), 'ESA prompt should contain SHOWS');
    assert.ok(prompt.includes('recPotential'), 'ESA prompt should contain recPotential');
    assert.ok(!prompt.includes('STORED_IN'), 'ESA prompt should NOT contain STORED_IN');
    assert.ok(!prompt.includes(':Item'), 'ESA prompt should NOT contain :Item');
  });

  it('includes relationship property names', () => {
    const schema = getSearchSchema('phase1-esa');
    const prompt = buildSchemaPromptSection(schema.graphSchema);

    // SHOWS should have {confidence}
    assert.ok(prompt.includes('{confidence}'), 'Should include confidence property on relationship');
  });
});
