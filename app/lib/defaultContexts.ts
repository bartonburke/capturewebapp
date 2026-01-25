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

// Asset Tagging entity schema
const assetTaggingEntities: EntitySchemaItem[] = [
  {
    name: 'asset',
    displayName: 'Asset',
    description: 'Equipment, furniture, or inventory item',
    extractionKeywords: ['equipment', 'asset', 'item', 'device', 'machine', 'unit', 'appliance'],
    confidenceThreshold: 0.7,
  },
  {
    name: 'serial_number',
    displayName: 'Serial Number',
    description: 'Manufacturer serial, model number, or asset tag',
    extractionKeywords: ['serial', 'model', 'part number', 'asset tag', 'barcode', 'QR code'],
    confidenceThreshold: 0.8,
  },
  {
    name: 'location',
    displayName: 'Location',
    description: 'Room, floor, zone, rack position, or area description',
    extractionKeywords: ['room', 'floor', 'zone', 'rack', 'area', 'building', 'section'],
    confidenceThreshold: 0.7,
  },
  {
    name: 'condition',
    displayName: 'Condition',
    description: 'Physical state of the asset',
    extractionKeywords: ['new', 'good', 'fair', 'poor', 'damaged', 'needs repair', 'worn'],
    confidenceThreshold: 0.7,
  },
  {
    name: 'category',
    displayName: 'Category',
    description: 'Asset classification type',
    extractionKeywords: ['IT equipment', 'furniture', 'HVAC', 'safety equipment', 'tools', 'electronics'],
    confidenceThreshold: 0.7,
  },
  {
    name: 'manufacturer',
    displayName: 'Manufacturer',
    description: 'Brand or make information',
    extractionKeywords: ['brand', 'manufacturer', 'make', 'vendor', 'company'],
    confidenceThreshold: 0.7,
  },
  {
    name: 'action_item',
    displayName: 'Action Item',
    description: 'Maintenance needed, replacement due, or missing documentation',
    extractionKeywords: ['maintenance', 'repair', 'replace', 'missing', 'overdue', 'inspection'],
    confidenceThreshold: 0.6,
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

// Home Inventory entity schema (v2 - OCR-optimized)
const homeInventoryEntities: EntitySchemaItem[] = [
  {
    name: 'item',
    displayName: 'Inventory Item',
    description: 'Primary item being documented',
    extractionKeywords: ['item', 'appliance', 'furniture', 'electronics', 'device', 'equipment'],
    confidenceThreshold: 0.7,
  },
  {
    name: 'identifier',
    displayName: 'Product Identifier',
    description: 'Serial number, model number, UPC, SKU - EXACT characters only',
    extractionKeywords: ['serial', 'S/N', 'model', 'M/N', 'part', 'P/N', 'UPC', 'SKU', 'barcode', 'QR'],
    confidenceThreshold: 0.9,  // High threshold - only report what you can clearly read
  },
  {
    name: 'manufacturer',
    displayName: 'Manufacturer Info',
    description: 'Brand, make, manufacturer name and country of origin',
    extractionKeywords: ['brand', 'made by', 'manufactured', 'company', 'logo'],
    confidenceThreshold: 0.8,
  },
  {
    name: 'specs',
    displayName: 'Technical Specifications',
    description: 'Dimensions, capacity, power rating, voltage, wattage',
    extractionKeywords: ['watts', 'volts', 'amps', 'capacity', 'size', 'dimensions', 'weight', 'BTU'],
    confidenceThreshold: 0.8,
  },
  {
    name: 'date_info',
    displayName: 'Date Information',
    description: 'Manufacturing date, purchase date, warranty expiration',
    extractionKeywords: ['date', 'manufactured', 'MFG', 'warranty', 'expires', 'purchased'],
    confidenceThreshold: 0.8,
  },
  {
    name: 'condition',
    displayName: 'Condition Assessment',
    description: 'Physical state, wear indicators, damage',
    extractionKeywords: ['new', 'good', 'fair', 'poor', 'damaged', 'worn', 'scratched', 'dented'],
    confidenceThreshold: 0.7,
  },
  {
    name: 'location',
    displayName: 'Location',
    description: 'Room, area, or storage location within home',
    extractionKeywords: ['room', 'bedroom', 'kitchen', 'living', 'garage', 'basement', 'closet', 'attic'],
    confidenceThreshold: 0.7,
  },
  {
    name: 'compliance',
    displayName: 'Compliance/Safety Info',
    description: 'UL listing, FCC ID, energy ratings, safety certifications',
    extractionKeywords: ['UL', 'ETL', 'FCC', 'CE', 'Energy Star', 'rated', 'certified', 'approved'],
    confidenceThreshold: 0.8,
  },
  {
    name: 'follow_up',
    displayName: 'Follow-Up Needed',
    description: 'Label not visible, angle needed, additional photo required',
    extractionKeywords: ['unclear', 'partial', 'obscured', 'need better', 'retake'],
    confidenceThreshold: 0.6,
  },
];

// Travel Log entity schema
const travelLogEntities: EntitySchemaItem[] = [
  {
    name: 'location',
    displayName: 'Location',
    description: 'Place visited or landmark',
    extractionKeywords: ['place', 'city', 'landmark', 'attraction', 'restaurant', 'hotel'],
    confidenceThreshold: 0.7,
  },
  {
    name: 'experience',
    displayName: 'Experience',
    description: 'Activity or experience',
    extractionKeywords: ['activity', 'tour', 'hike', 'meal', 'event', 'show'],
    confidenceThreshold: 0.6,
  },
  {
    name: 'expense',
    displayName: 'Expense',
    description: 'Cost or expense incurred',
    extractionKeywords: ['cost', 'price', 'paid', 'tip', 'bill', 'budget'],
    confidenceThreshold: 0.6,
  },
  {
    name: 'memory',
    displayName: 'Memory',
    description: 'Notable moment or memory',
    extractionKeywords: ['memory', 'moment', 'highlight', 'favorite', 'amazing'],
    confidenceThreshold: 0.5,
  },
];

// Personal To-dos entity schema
const personalTodosEntities: EntitySchemaItem[] = [
  {
    name: 'task',
    displayName: 'Task',
    description: 'Action item to complete',
    extractionKeywords: ['task', 'todo', 'need to', 'should', 'must', 'reminder'],
    confidenceThreshold: 0.7,
  },
  {
    name: 'deadline',
    displayName: 'Deadline',
    description: 'Due date or time constraint',
    extractionKeywords: ['deadline', 'due', 'by', 'before', 'date', 'tomorrow', 'next week'],
    confidenceThreshold: 0.7,
  },
  {
    name: 'priority',
    displayName: 'Priority',
    description: 'Urgency or importance level',
    extractionKeywords: ['urgent', 'important', 'critical', 'priority', 'asap'],
    confidenceThreshold: 0.6,
  },
  {
    name: 'context',
    displayName: 'Context',
    description: 'Where or when to do the task',
    extractionKeywords: ['at home', 'at work', 'when', 'where', 'call', 'email', 'buy'],
    confidenceThreshold: 0.5,
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

const assetTaggingPrompts = [
  'Read the serial number and model aloud',
  'Describe the asset\'s current condition',
  'Note the exact location - room, floor, and position',
  'Mention any visible damage or wear',
  'State the asset category and purpose',
  'Note any maintenance tags or inspection dates',
];

const genericPrompts = [
  'Document site conditions and features',
  'Photograph notable observations',
  'Capture location context',
];

const homeInventoryPrompts = [
  'Read the serial number character by character - S/N colon...',
  'Read the model number exactly as printed',
  'Note the brand name and where it\'s displayed',
  'Describe the condition - any scratches, dents, or wear?',
  'What room or area is this item located in?',
  'Check for labels on the back, bottom, or power cord',
  'Look for manufacturing date or warranty stickers',
  'Note the voltage and wattage if visible',
];

const travelLogPrompts = [
  'Describe where you are and what you see',
  'Note the name of this landmark or location',
  'Share what makes this place memorable',
  'Mention any costs or tips for future reference',
  'Describe the food, atmosphere, or experience',
  'Capture the local culture or unique details',
];

const personalTodosPrompts = [
  'Describe the task that needs to be done',
  'Mention any deadline or due date',
  'Note the priority or urgency',
  'Say where or when this should be done',
  'Capture any reference materials',
  'Add any context or details needed',
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

const assetTaggingVisionPrompt = `Analyze this photo for asset inventory and identification.
Identify and extract:
- Asset type and description (equipment, furniture, electronics, machinery, etc.)
- Visible serial numbers, barcodes, QR codes, or asset tags
- Brand/manufacturer if visible on labels or equipment
- Condition assessment (new, good, fair, poor, damaged)
- Location context from surroundings (room type, floor, position)
- Warning labels, inspection stickers, or compliance tags
- Any maintenance indicators or service due dates
Provide specific observations for inventory documentation.`;

const genericVisionPrompt = `Analyze this photo and describe the site conditions,
notable features, and any observations relevant to environmental or engineering assessment.`;

const homeInventoryVisionPrompt = `You are documenting household items for insurance inventory. Your PRIMARY goal is EXACT OCR extraction of all text visible on labels, tags, and screens.

## OCR EXTRACTION RULES (CRITICAL)
1. **Exact Characters Only**: Report EXACTLY what you see. "SN: ABC-123" not "serial number present"
2. **Character Confidence**: If a character is unclear, use [?] placeholder: "Model: XK[?]7-2B"
3. **Preserve Formatting**: Keep original formatting: "Model No. UN55TU7000FXZA" not "Model UN55TU7000FXZA"
4. **Multiple Labels**: Extract from ALL visible labels, stickers, and screens
5. **No Guessing**: If you can't read it, say "partially visible" or "obscured"

## LABEL LOCATIONS TO CHECK
- **Back/rear panel**: Main model plate, serial number sticker
- **Bottom/underside**: FCC ID, UL listing, manufacturing info
- **Power cord tag**: Voltage, wattage, cord specs
- **Screen/display**: Model info, settings screens
- **Packaging**: If visible - UPC barcode, SKU
- **Warranty stickers**: Date stamps, service tags

## PHOTO QUALITY ASSESSMENT
Rate label readability in your description: CLEAR (all text readable) | PARTIAL (some text unclear) | POOR (retake needed)
If PARTIAL or POOR, specify in suggestedFollowUp exactly what angle/lighting needed.

## STRUCTURED EXTRACTION FORMAT
For the extractedData field, use pipe-separated key-value pairs:
"Brand: Samsung | Model: UN55TU7000FXZA | Serial: Z4XT3ABC123456 | MFG Date: 2023-03 | Voltage: 120V 60Hz | Power: 145W"

## WHAT TO CAPTURE (in priority order)
1. **Identifiers**: Serial number (S/N), Model number (M/N), Part number (P/N), UPC/SKU
2. **Manufacturer**: Brand name, logo text, country of manufacture
3. **Specs**: Dimensions, capacity, power rating (volts/amps/watts)
4. **Dates**: Manufacturing date, warranty period, purchase date (if receipt visible)
5. **Compliance**: UL, ETL, FCC ID, Energy Star rating, CE mark
6. **Condition**: Visible wear, damage, scratches, dents, stains

## RESPONSE PRIORITY
1. Always extract identifiers first - critical for insurance claims
2. Note what you CAN'T read and why (glare, angle, damage, small print)
3. Include suggestedFollowUp if important info is not captured

Provide specific observations for insurance documentation and replacement value estimation.`;

const travelLogVisionPrompt = `Analyze this travel photo and describe:
- Location or landmark identification if recognizable
- Key visual elements and atmosphere
- Cultural or historical significance if apparent
- Text visible on signs, menus, or plaques (translate if needed)
- Memorable details worth noting
- Suggestions for future visitors based on what's shown
Capture the essence of this travel moment.`;

const personalTodosVisionPrompt = `Analyze this photo for task-related content.
Identify and extract:
- Any text visible (notes, lists, reminders)
- Action items that can be inferred
- Deadlines or dates mentioned
- Context clues about what needs to be done
- Reference information that might be useful
Convert visual content into actionable task items.`;

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
  'asset-tagging': {
    projectType: 'asset-tagging',
    entitySchema: assetTaggingEntities,
    capturePrompts: assetTaggingPrompts,
    visionAnalysisPrompt: assetTaggingVisionPrompt,
  },
  'generic': {
    projectType: 'generic',
    entitySchema: genericEntities,
    capturePrompts: genericPrompts,
    visionAnalysisPrompt: genericVisionPrompt,
  },
  'home-inventory': {
    projectType: 'home-inventory',
    entitySchema: homeInventoryEntities,
    capturePrompts: homeInventoryPrompts,
    visionAnalysisPrompt: homeInventoryVisionPrompt,
  },
  'travel-log': {
    projectType: 'travel-log',
    entitySchema: travelLogEntities,
    capturePrompts: travelLogPrompts,
    visionAnalysisPrompt: travelLogVisionPrompt,
  },
  'personal-todos': {
    projectType: 'personal-todos',
    entitySchema: personalTodosEntities,
    capturePrompts: personalTodosPrompts,
    visionAnalysisPrompt: personalTodosVisionPrompt,
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
