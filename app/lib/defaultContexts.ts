// Default project contexts for each project type
// These provide sensible defaults when launching sessions

import { ProjectType, ProjectContext, EntitySchemaItem } from './types';

// Phase I ESA entity schema (ASTM E1527-21)
const phase1EsaEntities: EntitySchemaItem[] = [
  {
    name: 'REC',
    displayName: 'Recognized Environmental Condition',
    description: 'Evidence of release or likely release of hazardous substances',
    extractionKeywords: ['contamination', 'release', 'spill', 'leak', 'UST failure'],
    confidenceThreshold: 0.7,
  },
  {
    name: 'AST',
    displayName: 'Aboveground Storage Tank',
    description: 'Tanks visible above ground for fuel or chemical storage',
    extractionKeywords: ['above ground tank', 'AST', 'fuel tank', 'storage tank', 'oil tank'],
    confidenceThreshold: 0.8,
  },
  {
    name: 'UST',
    displayName: 'Underground Storage Tank',
    description: 'Tanks buried underground, often indicated by fill pipes or vent pipes',
    extractionKeywords: ['underground tank', 'UST', 'fill pipe', 'vent pipe', 'fuel tank'],
    confidenceThreshold: 0.8,
  },
  {
    name: 'staining',
    displayName: 'Surface Staining',
    description: 'Discoloration of soil, pavement, or surfaces indicating spills',
    extractionKeywords: ['stain', 'discoloration', 'oil stain', 'chemical stain', 'soil staining'],
    confidenceThreshold: 0.7,
  },
  {
    name: 'drums',
    displayName: 'Drums/Containers',
    description: 'Chemical storage drums, barrels, or containers',
    extractionKeywords: ['drum', 'barrel', '55-gallon', 'container', 'chemical storage'],
    confidenceThreshold: 0.8,
  },
  {
    name: 'historical_use',
    displayName: 'Historical Industrial Use',
    description: 'Evidence of past industrial activities',
    extractionKeywords: ['historical', 'former use', 'old equipment', 'industrial remnants'],
    confidenceThreshold: 0.6,
  },
];

// EIR/EIS entity schema (NEPA/CEQA)
const eirEisEntities: EntitySchemaItem[] = [
  {
    name: 'visual_impact',
    displayName: 'Visual Impact',
    description: 'Changes to viewshed or visual character',
    extractionKeywords: ['viewshed', 'visual', 'scenic', 'aesthetic', 'sight line'],
    confidenceThreshold: 0.7,
  },
  {
    name: 'environmental_constraint',
    displayName: 'Environmental Constraint',
    description: 'Features that may limit development',
    extractionKeywords: ['wetland', 'habitat', 'flood zone', 'slope', 'constraint'],
    confidenceThreshold: 0.7,
  },
  {
    name: 'sensitive_receptor',
    displayName: 'Sensitive Receptor',
    description: 'Schools, hospitals, residences near project',
    extractionKeywords: ['school', 'hospital', 'residence', 'daycare', 'sensitive'],
    confidenceThreshold: 0.8,
  },
  {
    name: 'wildlife',
    displayName: 'Wildlife Observation',
    description: 'Animal species or evidence of habitat use',
    extractionKeywords: ['wildlife', 'bird', 'mammal', 'species', 'habitat', 'nest'],
    confidenceThreshold: 0.7,
  },
  {
    name: 'vegetation',
    displayName: 'Vegetation Type',
    description: 'Plant communities and notable species',
    extractionKeywords: ['vegetation', 'tree', 'plant', 'invasive', 'native', 'species'],
    confidenceThreshold: 0.7,
  },
];

// Borehole/Geotechnical entity schema
const boreholeEntities: EntitySchemaItem[] = [
  {
    name: 'equipment',
    displayName: 'Drilling Equipment',
    description: 'Drill rig and associated equipment',
    extractionKeywords: ['drill', 'rig', 'auger', 'equipment', 'machinery'],
    confidenceThreshold: 0.8,
  },
  {
    name: 'stratum_change',
    displayName: 'Stratum Change',
    description: 'Visible change in soil or rock layers',
    extractionKeywords: ['stratum', 'layer', 'soil change', 'color change', 'lithology'],
    confidenceThreshold: 0.7,
  },
  {
    name: 'sample_location',
    displayName: 'Sample Location',
    description: 'Where samples were collected',
    extractionKeywords: ['sample', 'core', 'collection', 'depth', 'interval'],
    confidenceThreshold: 0.8,
  },
  {
    name: 'safety_compliance',
    displayName: 'Safety Compliance',
    description: 'Safety equipment and compliance items',
    extractionKeywords: ['safety', 'PPE', 'hard hat', 'barrier', 'compliance'],
    confidenceThreshold: 0.8,
  },
  {
    name: 'soil_type',
    displayName: 'Soil Type',
    description: 'Classification of soil encountered',
    extractionKeywords: ['clay', 'sand', 'gravel', 'silt', 'fill', 'bedrock'],
    confidenceThreshold: 0.7,
  },
  {
    name: 'contamination_indicator',
    displayName: 'Contamination Indicator',
    description: 'Signs of contamination in samples',
    extractionKeywords: ['odor', 'staining', 'sheen', 'discoloration', 'contamination'],
    confidenceThreshold: 0.7,
  },
];

// Generic entity schema (minimal)
const genericEntities: EntitySchemaItem[] = [
  {
    name: 'observation',
    displayName: 'General Observation',
    description: 'Notable site conditions',
    extractionKeywords: ['note', 'observation', 'condition', 'feature'],
    confidenceThreshold: 0.6,
  },
];

// Default capture prompts per project type
const phase1EsaPrompts = [
  'Document underground storage tanks (USTs) and fill pipes',
  'Photograph any staining, stressed vegetation, or odors',
  'Capture adjoining property conditions',
  'Note historical industrial equipment or structures',
  'Document drums, containers, or chemical storage areas',
  'Photograph floor drains and discharge points',
];

const eirEisPrompts = [
  'Document visual impacts and viewshed concerns',
  'Photograph sensitive environmental receptors',
  'Capture wildlife observations and habitat conditions',
  'Note public access points and community features',
  'Document vegetation types and notable species',
  'Photograph existing infrastructure and utilities',
];

const boreholePrompts = [
  'Document drilling equipment and setup',
  'Photograph stratum changes and soil samples',
  'Capture sample locations with GPS precision',
  'Note safety compliance and site conditions',
  'Document groundwater observations',
  'Photograph core samples before packaging',
];

const genericPrompts = [
  'Document site conditions and features',
  'Photograph notable observations',
  'Capture location context',
];

// Vision analysis prompts per project type
const phase1EsaVisionPrompt = `Analyze this photo for environmental concerns per ASTM E1527-21.
Identify potential Recognized Environmental Conditions (RECs), underground storage tanks,
aboveground storage tanks, staining, drums, or other indicators of contamination.
Assess REC potential (low/medium/high) and provide specific observations.`;

const eirEisVisionPrompt = `Analyze this photo for environmental impact assessment.
Identify visual impacts, sensitive receptors, environmental constraints, wildlife,
vegetation types, and community concerns. Assess significance level and NEPA/CEQA relevance.`;

const boreholeVisionPrompt = `Analyze this photo for geotechnical and environmental data.
Identify drilling equipment, soil types, stratum changes, sample locations, contamination
indicators, and safety compliance. Note any visual soil characteristics relevant to
Phase II investigation or remediation planning.`;

const genericVisionPrompt = `Analyze this photo and describe the site conditions,
notable features, and any observations relevant to environmental or engineering assessment.`;

// Export default contexts
export const DEFAULT_CONTEXTS: Record<ProjectType, ProjectContext> = {
  'phase1-esa': {
    projectType: 'phase1-esa',
    entitySchema: phase1EsaEntities,
    capturePrompts: phase1EsaPrompts,
    visionAnalysisPrompt: phase1EsaVisionPrompt,
  },
  'eir-eis': {
    projectType: 'eir-eis',
    entitySchema: eirEisEntities,
    capturePrompts: eirEisPrompts,
    visionAnalysisPrompt: eirEisVisionPrompt,
  },
  'borehole': {
    projectType: 'borehole',
    entitySchema: boreholeEntities,
    capturePrompts: boreholePrompts,
    visionAnalysisPrompt: boreholeVisionPrompt,
  },
  'generic': {
    projectType: 'generic',
    entitySchema: genericEntities,
    capturePrompts: genericPrompts,
    visionAnalysisPrompt: genericVisionPrompt,
  },
};

// Helper to get default context for a project type
export function getDefaultContext(projectType: ProjectType): ProjectContext {
  return DEFAULT_CONTEXTS[projectType] || DEFAULT_CONTEXTS['generic'];
}

// Helper to merge partial context with defaults
export function mergeWithDefaults(
  projectType: ProjectType,
  partialContext?: Partial<ProjectContext>
): ProjectContext {
  const defaults = getDefaultContext(projectType);

  if (!partialContext) {
    return defaults;
  }

  return {
    projectType,
    entitySchema: partialContext.entitySchema || defaults.entitySchema,
    capturePrompts: partialContext.capturePrompts || defaults.capturePrompts,
    visionAnalysisPrompt: partialContext.visionAnalysisPrompt || defaults.visionAnalysisPrompt,
  };
}
