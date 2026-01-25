// Model comparison framework for vision analysis testing
// Use this to compare OCR accuracy across GPT-4o-mini, GPT-4o, and Claude Sonnet

export type VisionModel = 'gpt-4o-mini' | 'gpt-4o' | 'claude-sonnet-4-5';

// Accuracy scores: 0 = wrong/hallucinated, 1 = partially correct, 2 = correct with issues, 3 = exact match
export type AccuracyScore = 0 | 1 | 2 | 3;

export interface GroundTruth {
  serialNumber?: string;
  modelNumber?: string;
  brand?: string;
  specs?: string;
  manufacturingDate?: string;
  fccId?: string;
  voltage?: string;
  wattage?: string;
}

export interface ModelComparisonResult {
  // Identity
  model: VisionModel;
  photoId: string;
  photoDescription: string;  // e.g., "Samsung TV back label"
  testCondition: 'direct' | 'angled' | 'poor_lighting' | 'partial_label';

  // Performance metrics
  responseTimeMs: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUSD: number;

  // OCR Accuracy (score 0-3 for each field)
  serialNumberAccuracy: AccuracyScore;
  modelNumberAccuracy: AccuracyScore;
  brandAccuracy: AccuracyScore;
  specsAccuracy: AccuracyScore;
  dateAccuracy: AccuracyScore;

  // Entity Quality
  entitiesExtracted: number;
  relevantEntities: number;      // Human-judged as useful
  hallucinatedEntities: number;  // Made up data not on label
  missedEntities: number;        // Obvious things not captured

  // Completeness checks
  suggestedFollowUpWhenNeeded: boolean;  // Did it suggest retake when appropriate?
  labelQualityAssessed: boolean;          // Did it note readability?
  usedPlaceholdersForUnclear: boolean;   // Did it use [?] for unclear chars?

  // Qualitative ratings
  descriptionQuality: 'poor' | 'adequate' | 'good' | 'excellent';
  extractedDataFormat: 'missing' | 'unstructured' | 'structured' | 'perfect';

  // Ground truth for comparison
  groundTruth: GroundTruth;

  // Raw response for debugging
  rawExtractedData?: string;
  rawDescription?: string;
}

// Cost per 1K tokens (as of early 2025)
export const COST_PER_1K_TOKENS: Record<VisionModel, { input: number; output: number }> = {
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'gpt-4o': { input: 0.0025, output: 0.01 },
  'claude-sonnet-4-5': { input: 0.003, output: 0.015 }
};

// Calculate estimated cost
export function calculateCost(model: VisionModel, inputTokens: number, outputTokens: number): number {
  const costs = COST_PER_1K_TOKENS[model];
  return (inputTokens / 1000) * costs.input + (outputTokens / 1000) * costs.output;
}

// Score OCR accuracy by comparing extracted text to ground truth
export function scoreOcrAccuracy(extracted: string | undefined, groundTruth: string | undefined): AccuracyScore {
  if (!groundTruth) return 3; // No ground truth to compare = assume correct
  if (!extracted) return 0;   // Missing extraction = wrong

  const normalizedExtracted = extracted.toLowerCase().replace(/[\s\-_\.]/g, '');
  const normalizedTruth = groundTruth.toLowerCase().replace(/[\s\-_\.]/g, '');

  if (normalizedExtracted === normalizedTruth) return 3; // Exact match
  if (normalizedExtracted.includes(normalizedTruth) || normalizedTruth.includes(normalizedExtracted)) return 2; // Partial match

  // Check for character-level similarity
  const similarity = calculateSimilarity(normalizedExtracted, normalizedTruth);
  if (similarity > 0.8) return 2;
  if (similarity > 0.5) return 1;
  return 0;
}

// Simple Levenshtein-based similarity
function calculateSimilarity(a: string, b: string): number {
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;

  if (longer.length === 0) return 1.0;

  const editDistance = levenshtein(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function levenshtein(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

// Parse extractedData field into key-value pairs
export function parseExtractedData(extractedData: string | undefined): Record<string, string> {
  if (!extractedData) return {};

  const result: Record<string, string> = {};
  // Parse pipe-separated format: "Brand: Samsung | Model: ABC123 | Serial: XYZ"
  const pairs = extractedData.split('|').map(p => p.trim());

  for (const pair of pairs) {
    const colonIndex = pair.indexOf(':');
    if (colonIndex > 0) {
      const key = pair.substring(0, colonIndex).trim().toLowerCase();
      const value = pair.substring(colonIndex + 1).trim();
      result[key] = value;
    }
  }

  return result;
}

// Generate comparison report
export function generateComparisonReport(results: ModelComparisonResult[]): string {
  const byModel = new Map<VisionModel, ModelComparisonResult[]>();

  for (const result of results) {
    const existing = byModel.get(result.model) || [];
    existing.push(result);
    byModel.set(result.model, existing);
  }

  let report = '# Vision Model Comparison Report\n\n';

  for (const [model, modelResults] of byModel) {
    const avgResponseTime = modelResults.reduce((sum, r) => sum + r.responseTimeMs, 0) / modelResults.length;
    const avgCost = modelResults.reduce((sum, r) => sum + r.estimatedCostUSD, 0) / modelResults.length;
    const avgSerialAccuracy = modelResults.reduce((sum, r) => sum + r.serialNumberAccuracy, 0) / modelResults.length;
    const avgModelAccuracy = modelResults.reduce((sum, r) => sum + r.modelNumberAccuracy, 0) / modelResults.length;
    const avgBrandAccuracy = modelResults.reduce((sum, r) => sum + r.brandAccuracy, 0) / modelResults.length;
    const totalHallucinations = modelResults.reduce((sum, r) => sum + r.hallucinatedEntities, 0);
    const totalMissed = modelResults.reduce((sum, r) => sum + r.missedEntities, 0);

    report += `## ${model}\n\n`;
    report += `- **Photos tested:** ${modelResults.length}\n`;
    report += `- **Avg response time:** ${Math.round(avgResponseTime)}ms\n`;
    report += `- **Avg cost per photo:** $${avgCost.toFixed(4)}\n`;
    report += `- **OCR Accuracy (0-3 scale):**\n`;
    report += `  - Serial Number: ${avgSerialAccuracy.toFixed(2)}\n`;
    report += `  - Model Number: ${avgModelAccuracy.toFixed(2)}\n`;
    report += `  - Brand: ${avgBrandAccuracy.toFixed(2)}\n`;
    report += `- **Hallucinations:** ${totalHallucinations}\n`;
    report += `- **Missed entities:** ${totalMissed}\n\n`;
  }

  return report;
}

// Test case template for manual scoring
export interface TestCase {
  photoId: string;
  description: string;
  condition: 'direct' | 'angled' | 'poor_lighting' | 'partial_label';
  groundTruth: GroundTruth;
}

// Example test cases for home inventory
export const EXAMPLE_TEST_CASES: TestCase[] = [
  {
    photoId: 'tv-back-label',
    description: 'Samsung 55" TV rear model plate',
    condition: 'direct',
    groundTruth: {
      brand: 'Samsung',
      modelNumber: 'UN55TU7000FXZA',
      serialNumber: 'Z4XT3ABC123456',
      manufacturingDate: '2023-03',
      voltage: '120V 60Hz',
      wattage: '145W'
    }
  },
  {
    photoId: 'microwave-label',
    description: 'Kitchen microwave interior door label',
    condition: 'angled',
    groundTruth: {
      brand: 'Panasonic',
      modelNumber: 'NN-SN67KS',
      wattage: '1200W'
    }
  },
  {
    photoId: 'router-bottom',
    description: 'WiFi router underside label',
    condition: 'poor_lighting',
    groundTruth: {
      brand: 'Netgear',
      modelNumber: 'RAX50',
      fccId: 'PY318300447'
    }
  }
];
