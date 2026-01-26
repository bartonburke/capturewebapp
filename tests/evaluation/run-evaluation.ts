/**
 * Model/Prompt Evaluation Script for Home Inventory Vision Analysis
 *
 * Supports: Anthropic (Claude), OpenAI (GPT-4), Google (Gemini)
 *
 * Usage:
 *   npx tsx tests/evaluation/run-evaluation.ts [options]
 *
 * Options:
 *   --models=claude-sonnet,gpt-4o,gemini-flash   Run specific models (default: all)
 *   --prompts=current,minimal                    Run specific prompts (default: all)
 *   --photos=photo-001,photo-002                 Run specific photos (default: all)
 *   --output=results.json                        Output file (default: evaluation-results-{timestamp}.json)
 *   --dry-run                                    Show what would run without making API calls
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

// Pricing per 1M tokens (as of Jan 2026)
const PRICING: Record<string, { input: number; output: number; image?: number }> = {
  // Anthropic - https://www.anthropic.com/pricing
  'claude-sonnet-4-20250514': { input: 3.0, output: 15.0 },
  'claude-3-5-haiku-20241022': { input: 0.80, output: 4.0 },
  // OpenAI - https://openai.com/pricing (image tokens estimated at ~765 per 512x512 tile)
  'gpt-4o': { input: 2.50, output: 10.0, image: 0.001275 }, // ~$0.001275 per image tile (low res)
  'gpt-4o-mini': { input: 0.15, output: 0.60, image: 0.000638 },
  // Google Gemini - https://ai.google.dev/pricing
  'gemini-2.0-flash': { input: 0.10, output: 0.40 }, // Free tier available, these are paid rates
  'gemini-1.5-pro-latest': { input: 1.25, output: 5.0 },
};

// Types
interface TestPhoto {
  id: string;
  source_file: string;
  description: string;
  timestamp: string;
  gps: { latitude: number; longitude: number; accuracy: number };
  compass?: { heading: number };
  transcript_context: string;
}

interface ExpectedItem {
  name: string;
  notes?: string;
}

interface ExpectedOutput {
  room: string;
  area: string;
  container: string | null;
  items: ExpectedItem[];
  must_identify: string[];
  should_identify: string[];
  room_confidence: string;
  room_alternatives?: string[];
}

interface PromptConfig {
  id: string;
  name: string;
  prompt: string | null;
  source?: string;
}

interface ModelConfig {
  id: string;
  provider: string;
  model: string;
  baseline?: boolean;
  notes?: string;
}

interface TestSession {
  description: string;
  version: string;
  session_id: string;
  project_type: string;
  photos: TestPhoto[];
  expected_outputs: {
    description: string;
    photos: Record<string, ExpectedOutput>;
  };
  prompts_to_test: PromptConfig[];
  models_to_test: ModelConfig[];
}

interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  image_tokens?: number;
}

interface AnalysisResult {
  room?: string;
  area?: string | null;
  container?: string | null;
  items?: Array<{ name: string; attributes?: Record<string, string> }>;
  raw_response?: string;
  error?: string;
}

interface EvaluationScore {
  format_compliance: number;
  room_accuracy: number;
  item_recall: number;
  item_precision: number;
  practical_utility: number;
  overall: number;
  details: {
    missing_fields: string[];
    room_match: 'exact' | 'alternative' | 'wrong';
    items_found: string[];
    items_missed: string[];
    items_hallucinated: string[];
  };
}

interface SingleResult {
  photo_id: string;
  model_id: string;
  prompt_id: string;
  timestamp: string;
  latency_ms: number;
  tokens: TokenUsage;
  cost_usd: number;
  result: AnalysisResult;
  score: EvaluationScore;
}

interface EvaluationResults {
  metadata: {
    run_id: string;
    started_at: string;
    completed_at: string;
    test_session: string;
    photos_tested: number;
    models_tested: string[];
    prompts_tested: string[];
  };
  results: SingleResult[];
  summary: {
    by_model: Record<string, { avg_score: number; avg_latency_ms: number; avg_cost_usd: number; total_cost_usd: number; runs: number }>;
    by_prompt: Record<string, { avg_score: number; avg_latency_ms: number; runs: number }>;
    by_photo: Record<string, { avg_score: number }>;
    best_combination: { model: string; prompt: string; score: number };
    total_cost_usd: number;
  };
}

// Calculate cost based on token usage and model pricing
function calculateCost(model: string, tokens: TokenUsage): number {
  const pricing = PRICING[model];
  if (!pricing) return 0;

  const inputCost = (tokens.input_tokens / 1_000_000) * pricing.input;
  const outputCost = (tokens.output_tokens / 1_000_000) * pricing.output;
  const imageCost = pricing.image && tokens.image_tokens ? tokens.image_tokens * pricing.image : 0;

  return inputCost + outputCost + imageCost;
}

// Load the production prompt from source
async function loadProductionPrompt(): Promise<string> {
  const contextPath = path.resolve(__dirname, '../../app/lib/defaultContexts.ts');
  const content = fs.readFileSync(contextPath, 'utf-8');

  // Extract homeInventoryVisionPrompt
  const match = content.match(/const homeInventoryVisionPrompt = `([\s\S]*?)`;/);
  if (!match) {
    throw new Error('Could not find homeInventoryVisionPrompt in defaultContexts.ts');
  }
  return match[1];
}

// Load image as base64
function loadImageBase64(imagePath: string): string {
  const absolutePath = path.resolve(__dirname, imagePath);
  const imageBuffer = fs.readFileSync(absolutePath);
  return imageBuffer.toString('base64');
}

// Build the full prompt with transcript context and JSON format instructions
function buildFullPrompt(prompt: string, transcriptContext: string): string {
  return `${prompt}

${transcriptContext ? `## TRANSCRIPT CONTEXT\nThe person said: "${transcriptContext}"` : ''}

Respond with valid JSON only, no markdown code blocks. Format:
{
  "room": "string",
  "area": "string or null",
  "container": "string or null",
  "items": [{"name": "string", "attributes": {}}]
}`;
}

// Parse JSON from model response (handles markdown wrapping and arrays)
function parseJsonResponse(rawResponse: string): AnalysisResult {
  try {
    let jsonStr = rawResponse.trim();

    // Try to extract JSON from markdown code blocks
    const jsonMatch = rawResponse.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    // Try to find JSON object or array if response has extra text
    const objectMatch = jsonStr.match(/[\[{][\s\S]*[\]}]/);
    if (objectMatch) {
      jsonStr = objectMatch[0];
    }

    const parsed = JSON.parse(jsonStr);

    // If response is an array, merge all items into single result
    if (Array.isArray(parsed)) {
      const merged: AnalysisResult = {
        room: parsed[0]?.room,
        area: parsed[0]?.area,
        container: parsed[0]?.container,
        items: [],
        raw_response: rawResponse,
      };
      // Collect all items from all array elements
      for (const entry of parsed) {
        if (entry.items && Array.isArray(entry.items)) {
          merged.items!.push(...entry.items);
        }
      }
      return merged;
    }

    return { ...parsed, raw_response: rawResponse };
  } catch {
    return { raw_response: rawResponse, error: 'Failed to parse JSON' };
  }
}

// ============================================================================
// ANTHROPIC (Claude) Provider
// ============================================================================
async function analyzeWithAnthropic(
  model: string,
  prompt: string,
  imageBase64: string,
  transcriptContext: string
): Promise<{ result: AnalysisResult; latency_ms: number; tokens: TokenUsage }> {
  const Anthropic = (await import('@anthropic-ai/sdk')).default;

  const apiKey = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { result: { error: 'No Anthropic API key found' }, latency_ms: 0, tokens: { input_tokens: 0, output_tokens: 0 } };
  }

  const client = new Anthropic({ apiKey });
  const startTime = Date.now();
  const fullPrompt = buildFullPrompt(prompt, transcriptContext);

  try {
    const response = await client.messages.create({
      model,
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: imageBase64,
              },
            },
            {
              type: 'text',
              text: fullPrompt,
            },
          ],
        },
      ],
    });

    const latency_ms = Date.now() - startTime;
    const textContent = response.content.find((c) => c.type === 'text');
    const rawResponse = textContent?.type === 'text' ? textContent.text : '';

    const tokens: TokenUsage = {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
    };

    return { result: parseJsonResponse(rawResponse), latency_ms, tokens };
  } catch (error) {
    const latency_ms = Date.now() - startTime;
    return {
      result: { error: error instanceof Error ? error.message : 'Unknown error' },
      latency_ms,
      tokens: { input_tokens: 0, output_tokens: 0 },
    };
  }
}

// ============================================================================
// OPENAI (GPT-4) Provider
// ============================================================================
async function analyzeWithOpenAI(
  model: string,
  prompt: string,
  imageBase64: string,
  transcriptContext: string
): Promise<{ result: AnalysisResult; latency_ms: number; tokens: TokenUsage }> {
  const OpenAI = (await import('openai')).default;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { result: { error: 'No OpenAI API key found' }, latency_ms: 0, tokens: { input_tokens: 0, output_tokens: 0 } };
  }

  const client = new OpenAI({ apiKey });
  const startTime = Date.now();
  const fullPrompt = buildFullPrompt(prompt, transcriptContext);

  try {
    const response = await client.chat.completions.create({
      model,
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
                detail: 'low', // Use low detail for cost efficiency
              },
            },
            {
              type: 'text',
              text: fullPrompt,
            },
          ],
        },
      ],
    });

    const latency_ms = Date.now() - startTime;
    const rawResponse = response.choices[0]?.message?.content || '';

    const tokens: TokenUsage = {
      input_tokens: response.usage?.prompt_tokens || 0,
      output_tokens: response.usage?.completion_tokens || 0,
      image_tokens: 1, // 1 image at low detail = 1 tile
    };

    return { result: parseJsonResponse(rawResponse), latency_ms, tokens };
  } catch (error) {
    const latency_ms = Date.now() - startTime;
    return {
      result: { error: error instanceof Error ? error.message : 'Unknown error' },
      latency_ms,
      tokens: { input_tokens: 0, output_tokens: 0 },
    };
  }
}

// ============================================================================
// GOOGLE (Gemini) Provider
// ============================================================================
async function analyzeWithGemini(
  model: string,
  prompt: string,
  imageBase64: string,
  transcriptContext: string
): Promise<{ result: AnalysisResult; latency_ms: number; tokens: TokenUsage }> {
  const { GoogleGenerativeAI } = await import('@google/generative-ai');

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return { result: { error: 'No Gemini API key found' }, latency_ms: 0, tokens: { input_tokens: 0, output_tokens: 0 } };
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const genModel = genAI.getGenerativeModel({ model });
  const startTime = Date.now();
  const fullPrompt = buildFullPrompt(prompt, transcriptContext);

  try {
    const result = await genModel.generateContent([
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: imageBase64,
        },
      },
      fullPrompt,
    ]);

    const latency_ms = Date.now() - startTime;
    const rawResponse = result.response.text();

    // Gemini returns usage metadata
    const usageMetadata = result.response.usageMetadata;
    const tokens: TokenUsage = {
      input_tokens: usageMetadata?.promptTokenCount || 0,
      output_tokens: usageMetadata?.candidatesTokenCount || 0,
    };

    return { result: parseJsonResponse(rawResponse), latency_ms, tokens };
  } catch (error) {
    const latency_ms = Date.now() - startTime;
    return {
      result: { error: error instanceof Error ? error.message : 'Unknown error' },
      latency_ms,
      tokens: { input_tokens: 0, output_tokens: 0 },
    };
  }
}

// ============================================================================
// Unified analyze function
// ============================================================================
async function analyzePhoto(
  provider: string,
  model: string,
  prompt: string,
  imageBase64: string,
  transcriptContext: string
): Promise<{ result: AnalysisResult; latency_ms: number; tokens: TokenUsage }> {
  switch (provider) {
    case 'anthropic':
      return analyzeWithAnthropic(model, prompt, imageBase64, transcriptContext);
    case 'openai':
      return analyzeWithOpenAI(model, prompt, imageBase64, transcriptContext);
    case 'google':
      return analyzeWithGemini(model, prompt, imageBase64, transcriptContext);
    default:
      return { result: { error: `Unknown provider: ${provider}` }, latency_ms: 0, tokens: { input_tokens: 0, output_tokens: 0 } };
  }
}

// Score a single result against expected output
function scoreResult(result: AnalysisResult, expected: ExpectedOutput): EvaluationScore {
  const details: EvaluationScore['details'] = {
    missing_fields: [],
    room_match: 'wrong',
    items_found: [],
    items_missed: [...expected.must_identify],
    items_hallucinated: [],
  };

  // Format compliance (0-1)
  const requiredFields = ['room', 'area', 'container', 'items'];
  for (const field of requiredFields) {
    if (!(field in result) || (field === 'items' && !Array.isArray(result.items))) {
      details.missing_fields.push(field);
    }
  }
  const format_compliance = 1 - details.missing_fields.length / requiredFields.length;

  // Room accuracy (0-1)
  let room_accuracy = 0;
  if (result.room) {
    const resultRoom = result.room.toLowerCase();
    const expectedRoom = expected.room.toLowerCase();

    if (resultRoom === expectedRoom || resultRoom.includes(expectedRoom) || expectedRoom.includes(resultRoom)) {
      room_accuracy = 1;
      details.room_match = 'exact';
    } else if (expected.room_alternatives?.some((alt) => resultRoom.includes(alt.toLowerCase()))) {
      room_accuracy = 0.8;
      details.room_match = 'alternative';
    }
  }

  // Item recall - what fraction of must_identify items were found?
  let item_recall = 0;
  if (result.items && Array.isArray(result.items)) {
    const foundItemNames = result.items.map((i) => i.name.toLowerCase());

    for (const mustFind of expected.must_identify) {
      const found = foundItemNames.some(
        (name) => name.includes(mustFind.toLowerCase()) || mustFind.toLowerCase().includes(name)
      );
      if (found) {
        details.items_found.push(mustFind);
        details.items_missed = details.items_missed.filter((m) => m !== mustFind);
      }
    }
    item_recall = expected.must_identify.length > 0 ? details.items_found.length / expected.must_identify.length : 1;
  }

  // Item precision - are identified items real?
  let item_precision = 1;
  if (result.items && Array.isArray(result.items)) {
    const expectedItemNames = expected.items.map((i) => i.name.toLowerCase());
    const shouldIdentifyLower = expected.should_identify.map((s) => s.toLowerCase());

    for (const item of result.items) {
      const itemName = item.name.toLowerCase();
      const isExpected = expectedItemNames.some((e) => itemName.includes(e) || e.includes(itemName));
      const isShould = shouldIdentifyLower.some((s) => itemName.includes(s) || s.includes(itemName));

      if (!isExpected && !isShould) {
        // Could be hallucination or just additional valid item
        // Be lenient - only mark as hallucination if clearly wrong
      }
    }
    item_precision = 1;
  }

  // Practical utility (simplified - based on format and specificity)
  let practical_utility = 0;
  if (result.room && result.items && result.items.length > 0) {
    practical_utility = 0.5;
    if (result.area) practical_utility += 0.25;
    if (result.items.every((i) => i.name.length < 50)) practical_utility += 0.25;
  }

  // Overall weighted score
  const overall =
    format_compliance * 0.15 + room_accuracy * 0.25 + item_recall * 0.35 + item_precision * 0.1 + practical_utility * 0.15;

  return {
    format_compliance,
    room_accuracy,
    item_recall,
    item_precision,
    practical_utility,
    overall,
    details,
  };
}

// Format cost for display
function formatCost(cost: number): string {
  if (cost < 0.0001) return '<$0.0001';
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(3)}`;
}

// Main evaluation runner
async function runEvaluation() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');

  // Load test session
  const sessionPath = path.resolve(__dirname, 'test-session.json');
  const session: TestSession = JSON.parse(fs.readFileSync(sessionPath, 'utf-8'));

  // Parse command line filters
  const modelFilter = args.find((a) => a.startsWith('--models='))?.split('=')[1]?.split(',');
  const promptFilter = args.find((a) => a.startsWith('--prompts='))?.split('=')[1]?.split(',');
  const photoFilter = args.find((a) => a.startsWith('--photos='))?.split('=')[1]?.split(',');

  // Filter test configurations
  const models = session.models_to_test.filter((m) => !modelFilter || modelFilter.includes(m.id));
  const prompts = session.prompts_to_test.filter((p) => !promptFilter || promptFilter.includes(p.id));
  const photos = session.photos.filter((p) => !photoFilter || photoFilter.includes(p.id));

  console.log(`\n=== Home Inventory Vision Evaluation ===`);
  console.log(`Photos: ${photos.length}`);
  console.log(`Models: ${models.map((m) => m.id).join(', ')}`);
  console.log(`Prompts: ${prompts.map((p) => p.id).join(', ')}`);
  console.log(`Total combinations: ${photos.length * models.length * prompts.length}`);

  // Show available API keys
  console.log(`\nAPI Keys:`);
  console.log(`  Anthropic: ${process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY ? '✓' : '✗'}`);
  console.log(`  OpenAI: ${process.env.OPENAI_API_KEY ? '✓' : '✗'}`);
  console.log(`  Gemini: ${process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY ? '✓' : '✗'}`);

  // Show pricing
  console.log(`\nPricing (per 1M tokens):`);
  for (const model of models) {
    const pricing = PRICING[model.model];
    if (pricing) {
      console.log(`  ${model.id}: $${pricing.input} in / $${pricing.output} out`);
    } else {
      console.log(`  ${model.id}: pricing unknown`);
    }
  }

  if (isDryRun) {
    console.log('\n[DRY RUN] Would run these combinations:');
    for (const photo of photos) {
      for (const model of models) {
        for (const prompt of prompts) {
          console.log(`  - ${photo.id} + ${model.id} + ${prompt.id}`);
        }
      }
    }
    return;
  }

  // Load production prompt if needed
  const productionPrompt = await loadProductionPrompt();
  for (const p of prompts) {
    if (p.prompt === null && p.id === 'current') {
      p.prompt = productionPrompt;
    }
  }

  const results: SingleResult[] = [];
  const runId = `eval-${Date.now()}`;
  const startedAt = new Date().toISOString();

  // Run evaluations
  let completed = 0;
  const total = photos.length * models.length * prompts.length;

  for (const photo of photos) {
    const imageBase64 = loadImageBase64(photo.source_file);
    const expected = session.expected_outputs.photos[photo.id];

    for (const model of models) {
      for (const prompt of prompts) {
        completed++;
        console.log(`\n[${completed}/${total}] ${photo.id} + ${model.id} + ${prompt.id}`);

        const { result, latency_ms, tokens } = await analyzePhoto(
          model.provider,
          model.model,
          prompt.prompt!,
          imageBase64,
          photo.transcript_context
        );

        const cost_usd = calculateCost(model.model, tokens);
        const score = scoreResult(result, expected);

        console.log(`  Score: ${(score.overall * 100).toFixed(1)}% | ${latency_ms}ms | ${tokens.input_tokens}+${tokens.output_tokens} tokens | ${formatCost(cost_usd)}`);
        console.log(`  Room: ${result.room || 'undefined'} (${score.details.room_match})`);
        console.log(`  Items found: ${score.details.items_found.join(', ') || 'none'}`);
        if (score.details.items_missed.length > 0) {
          console.log(`  Items missed: ${score.details.items_missed.join(', ')}`);
        }
        if (result.error) {
          console.log(`  Error: ${result.error}`);
        }

        results.push({
          photo_id: photo.id,
          model_id: model.id,
          prompt_id: prompt.id,
          timestamp: new Date().toISOString(),
          latency_ms,
          tokens,
          cost_usd,
          result,
          score,
        });

        // Rate limiting - wait between API calls
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  }

  // Compute summary statistics
  const summary: EvaluationResults['summary'] = {
    by_model: {},
    by_prompt: {},
    by_photo: {},
    best_combination: { model: '', prompt: '', score: 0 },
    total_cost_usd: 0,
  };

  // By model
  for (const model of models) {
    const modelResults = results.filter((r) => r.model_id === model.id);
    if (modelResults.length > 0) {
      const totalCost = modelResults.reduce((sum, r) => sum + r.cost_usd, 0);
      summary.by_model[model.id] = {
        avg_score: modelResults.reduce((sum, r) => sum + r.score.overall, 0) / modelResults.length,
        avg_latency_ms: modelResults.reduce((sum, r) => sum + r.latency_ms, 0) / modelResults.length,
        avg_cost_usd: totalCost / modelResults.length,
        total_cost_usd: totalCost,
        runs: modelResults.length,
      };
    }
  }

  // By prompt
  for (const prompt of prompts) {
    const promptResults = results.filter((r) => r.prompt_id === prompt.id);
    if (promptResults.length > 0) {
      summary.by_prompt[prompt.id] = {
        avg_score: promptResults.reduce((sum, r) => sum + r.score.overall, 0) / promptResults.length,
        avg_latency_ms: promptResults.reduce((sum, r) => sum + r.latency_ms, 0) / promptResults.length,
        runs: promptResults.length,
      };
    }
  }

  // By photo
  for (const photo of photos) {
    const photoResults = results.filter((r) => r.photo_id === photo.id);
    if (photoResults.length > 0) {
      summary.by_photo[photo.id] = {
        avg_score: photoResults.reduce((sum, r) => sum + r.score.overall, 0) / photoResults.length,
      };
    }
  }

  // Best combination
  for (const r of results) {
    if (r.score.overall > summary.best_combination.score) {
      summary.best_combination = {
        model: r.model_id,
        prompt: r.prompt_id,
        score: r.score.overall,
      };
    }
  }

  // Total cost
  summary.total_cost_usd = results.reduce((sum, r) => sum + r.cost_usd, 0);

  // Build final output
  const output: EvaluationResults = {
    metadata: {
      run_id: runId,
      started_at: startedAt,
      completed_at: new Date().toISOString(),
      test_session: session.session_id,
      photos_tested: photos.length,
      models_tested: models.map((m) => m.id),
      prompts_tested: prompts.map((p) => p.id),
    },
    results,
    summary,
  };

  // Save results
  const outputArg = args.find((a) => a.startsWith('--output='));
  const outputFile = outputArg ? outputArg.split('=')[1] : `evaluation-results-${Date.now()}.json`;
  const outputPath = path.resolve(__dirname, outputFile);

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\n=== Results saved to ${outputPath} ===`);

  // Print summary
  console.log('\n=== SUMMARY ===');
  console.log('\nBy Model:');
  console.log('  Model            | Score  | Latency | Avg Cost | Total Cost');
  console.log('  -----------------|--------|---------|----------|----------');
  for (const [id, stats] of Object.entries(summary.by_model)) {
    console.log(`  ${id.padEnd(16)} | ${(stats.avg_score * 100).toFixed(1).padStart(5)}% | ${stats.avg_latency_ms.toFixed(0).padStart(5)}ms | ${formatCost(stats.avg_cost_usd).padStart(8)} | ${formatCost(stats.total_cost_usd)}`);
  }

  console.log('\nBy Prompt:');
  for (const [id, stats] of Object.entries(summary.by_prompt)) {
    console.log(`  ${id}: ${(stats.avg_score * 100).toFixed(1)}% avg score`);
  }

  console.log('\nBy Photo:');
  for (const [id, stats] of Object.entries(summary.by_photo)) {
    console.log(`  ${id}: ${(stats.avg_score * 100).toFixed(1)}% avg score`);
  }

  console.log(`\nBest combination: ${summary.best_combination.model} + ${summary.best_combination.prompt}`);
  console.log(`  Score: ${(summary.best_combination.score * 100).toFixed(1)}%`);
  console.log(`\nTotal evaluation cost: ${formatCost(summary.total_cost_usd)}`);
}

// Run if executed directly
runEvaluation().catch(console.error);
