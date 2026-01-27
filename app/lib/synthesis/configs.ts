/**
 * Synthesis Configuration per Project Type
 *
 * Defines what deliverables to generate, how to build the search index,
 * and what graph schema to expose for NL→Cypher search — all per project type.
 */

import type { ProjectType, SynthesisDeliverableType } from '@/app/lib/types';

// ============================================================================
// Deliverable Config (existing)
// ============================================================================

export interface DeliverableConfig {
  type: SynthesisDeliverableType;
  title: string;
  description: string;
  format: 'markdown' | 'json' | 'html';
  required: boolean;
}

// ============================================================================
// Search Schema Config (new)
// ============================================================================

/** Describes a Neo4j node label and its queryable properties */
export interface NodeLabelConfig {
  label: string;                 // e.g., "Photo", "Item", "Location"
  properties: PropertyConfig[];
  description?: string;          // Prompt hint for the NL→Cypher LLM
}

/** A single property on a node or relationship */
export interface PropertyConfig {
  name: string;
  type: 'string' | 'string[]' | 'number' | 'point' | 'datetime' | 'boolean';
  description?: string;
  enumValues?: string[];         // e.g., ['high','medium','low']
}

/** Describes a Neo4j relationship type */
export interface RelationshipConfig {
  type: string;                  // e.g., "SHOWS", "STORED_IN"
  from: string;                  // Source node label
  to: string;                    // Target node label
  properties?: PropertyConfig[];
  description?: string;
}

/** Full Neo4j graph schema for a project type */
export interface GraphSchemaConfig {
  description: string;           // Human-readable summary for prompt preamble
  nodeLabels: NodeLabelConfig[];
  relationships: RelationshipConfig[];
}

/** Example NL→Cypher pair for few-shot prompting */
export interface SearchExample {
  naturalLanguage: string;
  cypher: string;
}

/**
 * Declares which PhotoAnalysis fields should be added to the local search index.
 *
 * The default indexing (entity clusters, location hierarchy, catalog tags) always runs.
 * These extra fields are indexed ON TOP of the defaults.
 */
export interface IndexableFieldConfig {
  /** Dot-path into PhotoAnalysis, e.g., "room", "items", "vlmDescription" */
  fieldPath: string;
  /** What SearchIndexEntry.type to assign */
  indexType: 'item' | 'location' | 'category' | 'tag' | 'container' | 'room' | 'attribute';
  /** Default relevance score (0-1) for matches from this field */
  relevanceWeight: number;
  /** For array-of-object fields: which sub-field holds the search term (e.g., "name" for items[].name) */
  termField?: string;
  /** For array-of-object fields: attribute keys to also index (e.g., ["brand", "color"] from items[].attributes) */
  attributeKeys?: string[];
}

/** Complete search schema for a project type */
export interface SearchSchema {
  graphSchema: GraphSchemaConfig;
  exampleQueries: SearchExample[];
  indexableFields: IndexableFieldConfig[];
  /** Extra instructions appended to the NL→Cypher system prompt */
  searchHints?: string[];
}

// ============================================================================
// SynthesisConfig (extended with searchSchema)
// ============================================================================

export interface SynthesisConfig {
  projectType: ProjectType;
  deliverables: DeliverableConfig[];
  synthesisPromptHints: string[];
  searchSchema?: SearchSchema;
}

// ============================================================================
// Search Schema Definitions
// ============================================================================

// -- Shared Photo node (used by all project types) --
const photoNodeBase: NodeLabelConfig = {
  label: 'Photo',
  properties: [
    { name: 'id', type: 'string' },
    { name: 'timestamp', type: 'datetime' },
    { name: 'location', type: 'point', description: 'GPS coordinates as Neo4j point' },
    { name: 'vlmDescription', type: 'string', description: 'AI description of photo contents' },
    { name: 'catalogTags', type: 'string[]', description: 'Searchable keyword tags' },
    { name: 'sessionId', type: 'string' },
  ],
  description: 'A captured photo with GPS and AI analysis',
};

// -- Home Inventory search schema --
const homeInventorySearchSchema: SearchSchema = {
  graphSchema: {
    description: 'Home inventory: items stored in rooms and containers',
    nodeLabels: [
      photoNodeBase,
      {
        label: 'Item',
        description: 'A household item identified in photos',
        properties: [
          { name: 'id', type: 'string' },
          { name: 'name', type: 'string', description: 'Common name (e.g., "hammer", "stand mixer")' },
          { name: 'description', type: 'string', description: 'Merged description across photos' },
          { name: 'entityType', type: 'string', enumValues: ['item'] },
          { name: 'confidence', type: 'number' },
          { name: 'photoCount', type: 'number' },
          { name: 'sessionId', type: 'string' },
        ],
      },
      {
        label: 'Location',
        description: 'A room, area, or container in the home',
        properties: [
          { name: 'id', type: 'string' },
          { name: 'name', type: 'string', description: 'e.g., "kitchen", "tool drawer", "plastic bin"' },
          { name: 'level', type: 'string', enumValues: ['room', 'area', 'container', 'shelf', 'spot'] },
          { name: 'itemCount', type: 'number' },
          { name: 'sessionId', type: 'string' },
        ],
      },
    ],
    relationships: [
      {
        type: 'SHOWS_ITEM',
        from: 'Photo',
        to: 'Item',
        properties: [{ name: 'confidence', type: 'number' }],
        description: 'Photo shows this item',
      },
      {
        type: 'STORED_IN',
        from: 'Item',
        to: 'Location',
        description: 'Item is stored at this location',
      },
      {
        type: 'INSIDE',
        from: 'Location',
        to: 'Location',
        description: 'Location hierarchy (e.g., drawer INSIDE kitchen)',
      },
    ],
  },
  exampleQueries: [
    {
      naturalLanguage: "where's the hammer?",
      cypher: "MATCH (p:Photo)-[:SHOWS_ITEM]->(i:Item)-[:STORED_IN]->(l:Location) WHERE toLower(i.name) CONTAINS 'hammer' RETURN p, i, l",
    },
    {
      naturalLanguage: "what's in the garage?",
      cypher: "MATCH (i:Item)-[:STORED_IN]->(l:Location) WHERE toLower(l.name) = 'garage' OR (l)-[:INSIDE]->(:Location {name: 'garage'}) MATCH (p:Photo)-[:SHOWS_ITEM]->(i) RETURN p, i, l",
    },
    {
      naturalLanguage: 'items in kitchen drawer',
      cypher: "MATCH (i:Item)-[:STORED_IN]->(c:Location)-[:INSIDE]->(r:Location) WHERE toLower(r.name) = 'kitchen' AND c.level = 'container' AND toLower(c.name) CONTAINS 'drawer' MATCH (p:Photo)-[:SHOWS_ITEM]->(i) RETURN p, i, c",
    },
    {
      naturalLanguage: 'photos from the bedroom',
      cypher: "MATCH (p:Photo)-[:SHOWS_ITEM]->(i:Item)-[:STORED_IN]->(l:Location) WHERE toLower(l.name) CONTAINS 'bedroom' RETURN DISTINCT p",
    },
    {
      naturalLanguage: 'all rooms',
      cypher: "MATCH (l:Location) WHERE l.level = 'room' RETURN l",
    },
    {
      naturalLanguage: 'DeWalt tools',
      cypher: "MATCH (p:Photo)-[:SHOWS_ITEM]->(i:Item) WHERE toLower(i.description) CONTAINS 'dewalt' RETURN p, i",
    },
  ],
  indexableFields: [
    { fieldPath: 'room', indexType: 'room', relevanceWeight: 1.0 },
    { fieldPath: 'area', indexType: 'location', relevanceWeight: 0.9 },
    { fieldPath: 'container', indexType: 'container', relevanceWeight: 0.9 },
    { fieldPath: 'items', indexType: 'item', relevanceWeight: 1.0, termField: 'name', attributeKeys: ['brand', 'color', 'type', 'quantity'] },
    { fieldPath: 'vlmDescription', indexType: 'tag', relevanceWeight: 0.6 },
    { fieldPath: 'notes', indexType: 'tag', relevanceWeight: 0.7 },
  ],
  searchHints: [
    'Users typically search for items by name ("where is my drill?")',
    'Location queries ask about rooms ("what\'s in the garage?")',
    'Container queries drill into specific storage ("what\'s in the top drawer?")',
    'Brand/attribute queries look for specific products ("DeWalt tools", "red toolbox")',
  ],
};

// -- Phase I ESA search schema --
const phase1EsaSearchSchema: SearchSchema = {
  graphSchema: {
    description: 'Environmental site assessment: photos with environmental findings',
    nodeLabels: [
      {
        ...photoNodeBase,
        properties: [
          ...photoNodeBase.properties,
          { name: 'recPotential', type: 'string', enumValues: ['high', 'medium', 'low', 'none'], description: 'REC potential assessment' },
          { name: 'confidence', type: 'number' },
        ],
      },
      {
        label: 'Entity',
        description: 'An environmental finding or site feature',
        properties: [
          { name: 'id', type: 'string' },
          { name: 'entityType', type: 'string', enumValues: ['REC', 'AOC', 'Feature', 'Condition', 'Observation'] },
          { name: 'description', type: 'string' },
          { name: 'severity', type: 'string', enumValues: ['high', 'medium', 'low', 'info'] },
          { name: 'sessionId', type: 'string' },
        ],
      },
    ],
    relationships: [
      {
        type: 'SHOWS',
        from: 'Photo',
        to: 'Entity',
        properties: [{ name: 'confidence', type: 'number' }],
        description: 'Photo shows this environmental finding',
      },
    ],
  },
  exampleQueries: [
    { naturalLanguage: 'all photos', cypher: 'MATCH (p:Photo) RETURN p LIMIT 50' },
    { naturalLanguage: 'photos with AOCs', cypher: "MATCH (p:Photo)-[:SHOWS]->(e:Entity) WHERE e.entityType = 'AOC' RETURN p, e" },
    { naturalLanguage: 'high severity findings', cypher: "MATCH (p:Photo)-[:SHOWS]->(e:Entity) WHERE e.severity = 'high' RETURN p, e" },
    { naturalLanguage: 'photos showing staining', cypher: "MATCH (p:Photo) WHERE toLower(p.vlmDescription) CONTAINS 'staining' RETURN p" },
    { naturalLanguage: 'environmental concerns', cypher: "MATCH (p:Photo)-[:SHOWS]->(e:Entity) WHERE e.entityType IN ['REC', 'AOC'] OR e.severity IN ['high', 'medium'] RETURN p, e" },
    { naturalLanguage: 'photos near 33.725, -118.305', cypher: 'MATCH (p:Photo) WHERE point.distance(p.location, point({latitude: 33.725, longitude: -118.305})) < 500 RETURN p' },
    { naturalLanguage: 'photos showing drains or pipes', cypher: "MATCH (p:Photo) WHERE toLower(p.vlmDescription) CONTAINS 'drain' OR toLower(p.vlmDescription) CONTAINS 'pipe' RETURN p" },
  ],
  indexableFields: [
    { fieldPath: 'vlmDescription', indexType: 'tag', relevanceWeight: 0.6 },
  ],
  searchHints: [
    'Users search for environmental conditions (RECs, AOCs, staining, drums)',
    'Severity-based queries are common (high/medium/low)',
    'Spatial queries use GPS coordinates (within X meters of location)',
  ],
};

// -- Generic fallback search schema --
const genericSearchSchema: SearchSchema = {
  graphSchema: {
    description: 'General capture session: photos with observations',
    nodeLabels: [
      photoNodeBase,
      {
        label: 'Entity',
        description: 'A general observation or finding',
        properties: [
          { name: 'id', type: 'string' },
          { name: 'entityType', type: 'string' },
          { name: 'description', type: 'string' },
          { name: 'severity', type: 'string', enumValues: ['high', 'medium', 'low', 'info'] },
          { name: 'sessionId', type: 'string' },
        ],
      },
    ],
    relationships: [
      {
        type: 'SHOWS',
        from: 'Photo',
        to: 'Entity',
        properties: [{ name: 'confidence', type: 'number' }],
        description: 'Photo shows this observation',
      },
    ],
  },
  exampleQueries: [
    { naturalLanguage: 'all photos', cypher: 'MATCH (p:Photo) RETURN p LIMIT 50' },
    { naturalLanguage: 'photos with findings', cypher: 'MATCH (p:Photo)-[:SHOWS]->(e:Entity) RETURN p, e' },
    { naturalLanguage: 'photos near a location', cypher: 'MATCH (p:Photo) WHERE point.distance(p.location, point({latitude: $lat, longitude: $lng})) < 500 RETURN p' },
  ],
  indexableFields: [
    { fieldPath: 'vlmDescription', indexType: 'tag', relevanceWeight: 0.6 },
  ],
  searchHints: [],
};

// ============================================================================
// Full Synthesis Configs
// ============================================================================

/**
 * Home Inventory synthesis config
 */
const homeInventoryConfig: SynthesisConfig = {
  projectType: 'home-inventory',
  deliverables: [
    {
      type: 'room-inventory',
      title: 'Room-by-Room Inventory',
      description: 'All items organized by room and area',
      format: 'markdown',
      required: true,
    },
    {
      type: 'item-index',
      title: 'Item Index',
      description: 'Alphabetical list of all items with locations',
      format: 'markdown',
      required: true,
    },
    {
      type: 'storage-map',
      title: 'Storage Map',
      description: 'What\'s in each container, drawer, and shelf',
      format: 'markdown',
      required: true,
    },
    {
      type: 'cross-references',
      title: 'Cross-References',
      description: 'Items that appear in multiple locations',
      format: 'markdown',
      required: false,
    },
    {
      type: 'coverage-report',
      title: 'Coverage Report',
      description: 'Areas mentioned but not photographed',
      format: 'markdown',
      required: false,
    },
  ],
  synthesisPromptHints: [
    'Focus on findability - how would someone locate these items?',
    'Use plain language, not technical terms',
    'Note visual landmarks and nearby items',
    'Identify containers and what they hold',
  ],
  searchSchema: homeInventorySearchSchema,
};

/**
 * Generic/fallback config
 */
const genericConfig: SynthesisConfig = {
  projectType: 'generic',
  deliverables: [
    {
      type: 'findings-summary',
      title: 'Session Summary',
      description: 'Overview of captured observations',
      format: 'markdown',
      required: true,
    },
  ],
  synthesisPromptHints: [
    'Summarize key observations',
    'Note any patterns or recurring themes',
  ],
  searchSchema: genericSearchSchema,
};

/**
 * Phase I ESA config
 */
const phase1EsaConfig: SynthesisConfig = {
  projectType: 'phase1-esa',
  deliverables: [
    {
      type: 'findings-summary',
      title: 'Site Findings Summary',
      description: 'RECs, AOCs, and site conditions',
      format: 'markdown',
      required: true,
    },
    {
      type: 'site-observations',
      title: 'Site Observations',
      description: 'Organized observations by category',
      format: 'markdown',
      required: true,
    },
    {
      type: 'recommendations',
      title: 'Recommendations',
      description: 'Suggested follow-up actions',
      format: 'markdown',
      required: false,
    },
  ],
  synthesisPromptHints: [
    'Identify potential environmental concerns',
    'Note evidence of current or historical contamination',
    'Document regulatory compliance observations',
  ],
  searchSchema: phase1EsaSearchSchema,
};

/**
 * Travel log config
 */
const travelLogConfig: SynthesisConfig = {
  projectType: 'travel-log',
  deliverables: [
    {
      type: 'findings-summary',
      title: 'Trip Summary',
      description: 'Overview of places visited',
      format: 'markdown',
      required: true,
    },
  ],
  synthesisPromptHints: [
    'Highlight memorable experiences',
    'Note locations and landmarks',
  ],
  // Falls back to generic search schema via getSearchSchema()
};

/**
 * All synthesis configs indexed by project type
 */
export const SYNTHESIS_CONFIGS: Partial<Record<ProjectType, SynthesisConfig>> = {
  'home-inventory': homeInventoryConfig,
  'phase1-esa': phase1EsaConfig,
  'travel-log': travelLogConfig,
  'generic': genericConfig,
  // Other types will fall back to generic
};

/**
 * Get config for a project type (with fallback)
 */
export function getSynthesisConfig(projectType: ProjectType): SynthesisConfig {
  return SYNTHESIS_CONFIGS[projectType] || genericConfig;
}

/**
 * Get search schema for a project type (with fallback to generic)
 */
export function getSearchSchema(projectType: ProjectType): SearchSchema {
  const config = SYNTHESIS_CONFIGS[projectType];
  return config?.searchSchema || genericSearchSchema;
}

/**
 * Build the full NL→Cypher system prompt from a SearchSchema.
 * Pure function: no external deps (neo4j, OpenAI), safe for testing.
 */
export function buildSystemPrompt(sessionId?: string, searchSchema?: SearchSchema): string {
  const schema = searchSchema || genericSearchSchema;

  const sessionFilter = sessionId
    ? `\n\nIMPORTANT: All queries MUST filter by sessionId = '${sessionId}'. Add this WHERE clause to every query.`
    : '';

  const schemaSection = buildSchemaPromptSection(schema.graphSchema);

  let examplesSection = '\nExamples:\n';
  for (const example of schema.exampleQueries) {
    examplesSection += `\nQ: "${example.naturalLanguage}"\nA: ${example.cypher}\n`;
  }

  if (sessionId && schema.exampleQueries.length > 0) {
    const first = schema.exampleQueries[0];
    examplesSection += `\nQ: "${first.naturalLanguage}" (with sessionId filter)\nA: ${first.cypher.replace('RETURN', `WHERE p.sessionId = '${sessionId}' RETURN`)}\n`;
  }

  const hintsSection = schema.searchHints && schema.searchHints.length > 0
    ? '\n\nSearch tips:\n' + schema.searchHints.map(h => `- ${h}`).join('\n')
    : '';

  return `You are a Cypher query generator for a photo graph database.

${schema.graphSchema.description}

${schemaSection}
Spatial functions:
- point.distance(p.location, point({latitude: $lat, longitude: $lng})) returns distance in meters
- point({latitude: $lat, longitude: $lng}) creates a point

Text search:
- Use CONTAINS for partial text matching (case-sensitive)
- Use toLower() for case-insensitive: toLower(p.vlmDescription) CONTAINS toLower('search term')
${sessionFilter}

Given a natural language query, generate ONLY the Cypher query. No explanation, no markdown, no backticks.
${examplesSection}${hintsSection}

Always include LIMIT 50 if no limit is specified to prevent large result sets.`;
}

/**
 * Build the graph schema section of an NL→Cypher system prompt from a SearchSchema.
 * This replaces hardcoded schema strings with config-driven generation.
 */
export function buildSchemaPromptSection(schema: GraphSchemaConfig): string {
  let section = 'Schema:\n';

  for (const node of schema.nodeLabels) {
    const propsStr = node.properties.map(p => {
      let desc = p.name;
      if (p.enumValues) {
        desc += `: [${p.enumValues.join(', ')}]`;
      } else if (p.type === 'string[]') {
        desc += ': [string]';
      } else if (p.type !== 'string') {
        desc += `: ${p.type}`;
      }
      return desc;
    }).join(', ');

    section += `- (:${node.label} {${propsStr}})`;
    if (node.description) section += `  // ${node.description}`;
    section += '\n';
  }

  section += '\nRelationships:\n';
  for (const rel of schema.relationships) {
    const propsStr = rel.properties
      ? ` {${rel.properties.map(p => p.name).join(', ')}}`
      : '';
    section += `- (${rel.from})-[:${rel.type}${propsStr}]->(${rel.to})`;
    if (rel.description) section += `  // ${rel.description}`;
    section += '\n';
  }

  return section;
}
