import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { PhotoAnalysis, GpsCoordinates, PhotoEntity, TranscriptSegment } from '@/app/lib/types';

type VisionProvider = 'claude' | 'openai';
type VisionModel = 'claude-sonnet-4-5-20250929' | 'gpt-4o-mini' | 'gpt-4o';

// ESA-specific prompt for comprehensive photo analysis
// Now includes transcript context for intelligent analysis
function buildAnalysisPrompt(
  gps: GpsCoordinates | null,
  timestamp: string,
  sessionTimestamp: number,
  transcriptContext: TranscriptSegment | null
): string {
  const gpsText = gps
    ? `[GPS coordinates: ${gps.latitude.toFixed(6)}, ${gps.longitude.toFixed(6)} ±${Math.round(gps.accuracy)}m]`
    : '[GPS coordinates: Not available]';

  // Build transcript context section
  let transcriptSection = '';
  if (transcriptContext) {
    transcriptSection = `
## CONSULTANT'S VERBAL CONTEXT
The field consultant said the following while taking this photo:
"${transcriptContext.text}"

**IMPORTANT**: Use this verbal context to:
1. **Answer questions**: If the consultant asks "What is this?" or "I wonder if...", try to answer based on what you see
2. **Extract action items**: If they say "add to to-do" or "need to check later", create an ActionItem entity
3. **Note their observations**: If they share context like "the site manager said..." or "this used to be...", incorporate it
4. **Validate hypotheses**: If they say "this looks like a UST" or "might be contamination", confirm or challenge based on visual evidence
5. **Flag uncertainties**: If they express uncertainty, note it and provide your assessment
`;
  }

  return `You are assisting a Phase I Environmental Site Assessment (ESA) per ASTM E1527-21 standard.

Your role: Analyze site photographs to identify environmental conditions, potential contamination sources, and regulatory compliance issues. Focus on features that could indicate current or historical environmental impacts.
${transcriptSection}
Analyze this photograph and provide:

1. VISUAL DESCRIPTION (2-4 sentences)
   - Describe what is visible in the photo with specificity
   - Note relevant environmental observations (staining, deterioration, storage practices)
   - Identify any potential Recognized Environmental Conditions (RECs) or Areas of Concern (AOCs)
   - Include context from GPS if provided (e.g., "exterior northeast corner" vs "interior space")
   ${transcriptContext ? '- Address any questions or observations from the consultant\'s verbal context' : ''}

2. CATALOG TAGS (searchable keywords - comprehensive list)
   Include ALL relevant tags from these categories:

   **Surfaces & Ground:** asphalt, concrete, gravel, soil, grass, bare_soil, pavement_cracking, potholes, subsidence, erosion

   **Structures:** building, warehouse, garage, shed, loading_dock, roof, wall, foundation, slab, floor_drain

   **Equipment & Machinery:** tank, drum, ibc_tote, compressor, generator, transformer, hvac, piping, valves, pumps, equipment_pad

   **Environmental Features:** storm_drain, catch_basin, manhole, sump, ust_fill_port, ust_vent, oil_water_separator, french_drain, culvert

   **Indicators & Conditions:** staining, discoloration, pooled_liquid, spill, sheen, debris, waste, deterioration, corrosion, rust, peeling_paint, cracking

   **Vegetation:** overgrowth, dead_vegetation, stressed_vegetation, landscaping, weeds, trees

   **Utilities:** electrical, overhead_lines, pole_transformer, gas_meter, water_meter, sewer, utility_pole

   **Storage & Materials:** drum_storage, tank_farm, chemical_storage, waste_storage, dumpster, roll_off, recycling

   **Signage & Safety:** hazmat_placard, nfpa_diamond, safety_signage, warning_label, no_trespassing

   **Risk Flags:** potential_rec, potential_aoc, hazmat_concern, requires_sampling, compliance_issue, historical_use_indicator
   ${transcriptContext ? '\n   **Transcript-derived:** action_item, question_raised, consultant_observation, needs_verification' : ''}

3. EXTRACTED ENTITIES (structured findings - be comprehensive)
   For each significant observation, create an entity with:
   - type: One of:
     - "REC" - Recognized Environmental Condition
     - "AOC" - Area of Concern
     - "Feature" - Site feature
     - "Equipment" - Equipment/machinery
     - "Condition" - Observable condition
     ${transcriptContext ? `- "ActionItem" - Something the consultant wants to follow up on
     - "Question" - A question the consultant asked (include your answer)
     - "Observation" - Consultant's verbal observation worth noting` : ''}
   - description: Detailed description with measurements/specifics when possible
   - severity: "high" | "medium" | "low" | "info"
   - recommendation: Follow-up action if applicable (sampling, further investigation, etc.)
   ${transcriptContext ? `- consultantContext: (optional) Quote what the consultant said that relates to this entity
   - aiResponse: (optional) Your answer if responding to a question` : ''}

   **Severity Guidelines:**
   - high: Confirmed or highly likely REC (active leaking, extensive staining, hazmat storage issues)
   - medium: Potential AOC requiring investigation (minor staining, suspect features, unclear conditions)
   - low: Minor observation warranting documentation (aging equipment, cosmetic deterioration)
   - info: General site feature documentation (storm drains, building features, utilities)

CRITICAL: Be thorough and comprehensive. Tag everything visible that could be relevant for:
- Environmental compliance
- Historical site use inference
- Potential contamination sources
- Future investigation needs
- Report completeness
${transcriptContext ? '- Consultant questions and to-do items' : ''}

${gpsText}
[Photo timestamp: ${timestamp}]
[Session duration: ${Math.round(sessionTimestamp)} seconds]

Respond ONLY with valid JSON in this exact structure:
{
  "description": "string",
  "catalogTags": ["string"],
  "entities": [
    {
      "type": "REC" | "AOC" | "Feature" | "Equipment" | "Condition"${transcriptContext ? ' | "ActionItem" | "Question" | "Observation"' : ''},
      "description": "string",
      "severity": "high" | "medium" | "low" | "info",
      "recommendation": "string or null"${transcriptContext ? `,
      "consultantContext": "string or null",
      "aiResponse": "string or null"` : ''}
    }
  ]
}`;
}

// Call OpenAI GPT-4o-mini for vision analysis
async function analyzeWithOpenAI(
  model: 'gpt-4o-mini' | 'gpt-4o',
  base64Data: string,
  mediaType: string,
  promptText: string
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const openai = new OpenAI({ apiKey });

  const response = await openai.chat.completions.create({
    model,
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image_url',
          image_url: {
            url: `data:image/${mediaType};base64,${base64Data}`,
            detail: 'high'
          }
        },
        {
          type: 'text',
          text: promptText
        }
      ]
    }]
  });

  return {
    text: response.choices[0]?.message?.content || '',
    inputTokens: response.usage?.prompt_tokens || 0,
    outputTokens: response.usage?.completion_tokens || 0
  };
}

// Call Claude for vision analysis
async function analyzeWithClaude(
  base64Data: string,
  mediaType: string,
  promptText: string
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const apiKey = process.env.CLAUDE_API_KEY;

  if (!apiKey) {
    throw new Error('CLAUDE_API_KEY not configured');
  }

  const anthropic = new Anthropic({ apiKey });

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: `image/${mediaType}` as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
            data: base64Data
          }
        },
        {
          type: 'text',
          text: promptText
        }
      ]
    }]
  });

  const textContent = response.content.find(block => block.type === 'text');

  return {
    text: textContent?.type === 'text' ? textContent.text : '',
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens
  };
}

export async function POST(req: NextRequest) {
  try {
    console.log('[AnalyzePhoto] Request received');

    // Parse request body
    const body = await req.json();
    const { photoId, imageData, gps, timestamp, sessionTimestamp, transcriptSegment, provider = 'openai', model = 'gpt-4o-mini' } = body;

    // Validation
    if (!photoId || typeof photoId !== 'string') {
      return NextResponse.json(
        { error: 'Invalid photoId' },
        { status: 400 }
      );
    }

    if (!imageData || typeof imageData !== 'string') {
      return NextResponse.json(
        { error: 'Invalid imageData' },
        { status: 400 }
      );
    }

    if (!timestamp || typeof timestamp !== 'string') {
      return NextResponse.json(
        { error: 'Invalid timestamp' },
        { status: 400 }
      );
    }

    // Extract base64 data from data URL (remove "data:image/jpeg;base64," prefix)
    const base64Match = imageData.match(/^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/);
    if (!base64Match) {
      return NextResponse.json(
        { error: 'Invalid image data format. Expected data URL with base64 encoding.' },
        { status: 400 }
      );
    }

    const mediaType = base64Match[1] === 'jpg' ? 'jpeg' : base64Match[1];
    const base64Data = base64Match[2];

    console.log(`[AnalyzePhoto] Processing photo ${photoId}`);
    console.log(`[AnalyzePhoto] Image format: ${mediaType}, size: ${Math.round(base64Data.length / 1024)}KB`);
    console.log(`[AnalyzePhoto] GPS: ${gps ? 'available' : 'not available'}`);
    console.log(`[AnalyzePhoto] Transcript context: ${transcriptSegment ? `"${transcriptSegment.text.substring(0, 50)}..."` : 'none'}`);

    // Build ESA-specific prompt with transcript context
    const promptText = buildAnalysisPrompt(
      gps,
      timestamp,
      sessionTimestamp || 0,
      transcriptSegment || null
    );

    // Call the appropriate vision API based on provider
    console.log(`[AnalyzePhoto] Using provider: ${provider}, model: ${model}`);

    let responseText: string;
    let inputTokens: number;
    let outputTokens: number;

    if (provider === 'claude') {
      const result = await analyzeWithClaude(base64Data, mediaType, promptText);
      responseText = result.text;
      inputTokens = result.inputTokens;
      outputTokens = result.outputTokens;
    } else {
      // Default to OpenAI
      const openaiModel = model === 'gpt-4o' ? 'gpt-4o' : 'gpt-4o-mini';
      const result = await analyzeWithOpenAI(openaiModel, base64Data, mediaType, promptText);
      responseText = result.text;
      inputTokens = result.inputTokens;
      outputTokens = result.outputTokens;
    }

    console.log(`[AnalyzePhoto] Response received from ${provider}`);
    console.log('[AnalyzePhoto] Token usage:', {
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      total_tokens: inputTokens + outputTokens
    });

    if (!responseText) {
      throw new Error(`No text content in ${provider} response`);
    }

    // Parse JSON response
    let parsedResponse: {
      description: string;
      catalogTags: string[];
      entities: PhotoEntity[];
    };

    try {
      // Try to extract JSON from markdown code blocks if present
      const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/) ||
                       responseText.match(/```\n([\s\S]*?)\n```/);

      const jsonText = jsonMatch ? jsonMatch[1] : responseText;
      parsedResponse = JSON.parse(jsonText);
    } catch (parseError) {
      console.error(`[AnalyzePhoto] Failed to parse ${provider} response:`, responseText);
      throw new Error(`${provider} returned invalid JSON format`);
    }

    // Validate response structure
    if (!parsedResponse.description || !Array.isArray(parsedResponse.catalogTags) || !Array.isArray(parsedResponse.entities)) {
      throw new Error(`${provider} response missing required fields`);
    }

    // Construct PhotoAnalysis object
    const analysis: PhotoAnalysis = {
      photoId,
      vlmDescription: parsedResponse.description,
      catalogTags: parsedResponse.catalogTags,
      entities: parsedResponse.entities,
      timestamp,
      gps: gps || null,
      // Store the transcript segment that was used for context
      transcriptSegment: transcriptSegment || null
    };

    console.log(`[AnalyzePhoto] Success - Generated ${analysis.catalogTags.length} tags and ${analysis.entities.length} entities`);

    // Log if we found action items or questions
    const actionItems = analysis.entities.filter(e => e.type === 'ActionItem');
    const questions = analysis.entities.filter(e => e.type === 'Question');
    if (actionItems.length > 0) {
      console.log(`[AnalyzePhoto] Found ${actionItems.length} action item(s)`);
    }
    if (questions.length > 0) {
      console.log(`[AnalyzePhoto] Answered ${questions.length} question(s)`);
    }

    return NextResponse.json({ analysis });

  } catch (error: any) {
    console.error('[AnalyzePhoto] Error:', error);

    // Handle rate limit errors
    if (error.status === 429) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please wait a moment and try again.' },
        { status: 429 }
      );
    }

    // Handle API key errors
    if (error.status === 401) {
      return NextResponse.json(
        { error: 'Invalid API key. Please check your Anthropic API configuration.' },
        { status: 401 }
      );
    }

    // Generic error
    return NextResponse.json(
      { error: error.message || 'Failed to analyze photo' },
      { status: 500 }
    );
  }
}
