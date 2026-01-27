/**
 * Tests for the graph search system prompt generation.
 * Verifies that buildSystemPrompt() produces correct, type-aware prompts.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getSearchSchema, buildSystemPrompt } from '../app/lib/synthesis/configs.ts';

describe('buildSystemPrompt for home-inventory', () => {
  const schema = getSearchSchema('home-inventory');
  const prompt = buildSystemPrompt(undefined, schema);

  it('includes Item and Location node labels', () => {
    assert.ok(prompt.includes(':Item'), 'Prompt should contain :Item');
    assert.ok(prompt.includes(':Location'), 'Prompt should contain :Location');
    assert.ok(prompt.includes(':Photo'), 'Prompt should contain :Photo');
  });

  it('includes inventory relationships', () => {
    assert.ok(prompt.includes('SHOWS_ITEM'), 'Should contain SHOWS_ITEM');
    assert.ok(prompt.includes('STORED_IN'), 'Should contain STORED_IN');
    assert.ok(prompt.includes('INSIDE'), 'Should contain INSIDE');
  });

  it('includes example queries for inventory', () => {
    assert.ok(prompt.includes('hammer'), 'Should contain hammer example');
    assert.ok(prompt.includes('garage'), 'Should contain garage example');
  });

  it('includes search hints', () => {
    assert.ok(prompt.includes('where is my drill'), 'Should contain item search hint');
  });

  it('does NOT include ESA-specific terms', () => {
    assert.ok(!prompt.includes('recPotential'), 'Should NOT contain recPotential');
    assert.ok(!prompt.includes('REC, AOC'), 'Should NOT contain ESA entity types');
  });

  it('includes graph description preamble', () => {
    assert.ok(prompt.includes('Home inventory'), 'Should contain description');
  });
});

describe('buildSystemPrompt for phase1-esa', () => {
  const schema = getSearchSchema('phase1-esa');
  const prompt = buildSystemPrompt(undefined, schema);

  it('includes Entity node and SHOWS relationship', () => {
    assert.ok(prompt.includes(':Entity'), 'Should contain :Entity');
    assert.ok(prompt.includes('SHOWS'), 'Should contain SHOWS');
  });

  it('includes ESA-specific properties', () => {
    assert.ok(prompt.includes('recPotential'), 'Should contain recPotential');
    assert.ok(prompt.includes('severity'), 'Should contain severity');
  });

  it('includes ESA example queries', () => {
    assert.ok(prompt.includes('AOC'), 'Should contain AOC example');
    assert.ok(prompt.includes('staining'), 'Should contain staining example');
  });

  it('does NOT include inventory-specific terms', () => {
    assert.ok(!prompt.includes('STORED_IN'), 'Should NOT contain STORED_IN');
    assert.ok(!prompt.includes(':Item'), 'Should NOT contain :Item');
    assert.ok(!prompt.includes('SHOWS_ITEM'), 'Should NOT contain SHOWS_ITEM');
  });
});

describe('buildSystemPrompt with session filter', () => {
  const schema = getSearchSchema('home-inventory');
  const prompt = buildSystemPrompt('test-session-123', schema);

  it('includes session filter instruction', () => {
    assert.ok(prompt.includes('test-session-123'), 'Should contain session ID');
    assert.ok(prompt.includes('MUST filter by sessionId'), 'Should contain filter instruction');
  });

  it('includes session-filtered example', () => {
    assert.ok(prompt.includes('sessionId filter'), 'Should contain session filter example');
  });
});

describe('buildSystemPrompt fallback (no schema)', () => {
  const prompt = buildSystemPrompt();

  it('returns a valid prompt with generic schema', () => {
    assert.ok(prompt.includes(':Photo'), 'Fallback should contain :Photo');
    assert.ok(prompt.includes(':Entity'), 'Fallback should contain :Entity');
    assert.ok(prompt.includes('SHOWS'), 'Fallback should contain SHOWS');
  });

  it('includes spatial function instructions', () => {
    assert.ok(prompt.includes('point.distance'), 'Should contain spatial functions');
  });

  it('includes text search instructions', () => {
    assert.ok(prompt.includes('CONTAINS'), 'Should contain text search instructions');
    assert.ok(prompt.includes('toLower'), 'Should contain case-insensitive search');
  });

  it('includes LIMIT instruction', () => {
    assert.ok(prompt.includes('LIMIT 50'), 'Should contain LIMIT instruction');
  });
});
