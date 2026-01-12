import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { PhotoAnalysis, GpsCoordinates, PhotoEntity } from '@/app/lib/types';

// ESA-specific prompt for comprehensive photo analysis
function buildAnalysisPrompt(gps: GpsCoordinates | null, timestamp: string, sessionTimestamp: number): string {
  const gpsText = gps
    ? `[GPS coordinates: ${gps.latitude.toFixed(6)}, ${gps.longitude.toFixed(6)} ±${Math.round(gps.accuracy)}m]`
    : '[GPS coordinates: Not available]';

  return `You are assisting a Phase I Environmental Site Assessment (ESA) per ASTM E1527-21 standard.

Your role: Analyze site photographs to identify environmental conditions, potential contamination sources, and regulatory compliance issues. Focus on features that could indicate current or historical environmental impacts.

Analyze this photograph and provide:

1. VISUAL DESCRIPTION (2-4 sentences)
   - Describe what is visible in the photo with specificity
   - Note relevant environmental observations (staining, deterioration, storage practices)
   - Identify any potential Recognized Environmental Conditions (RECs) or Areas of Concern (AOCs)
   - Include context from GPS if provided (e.g., "exterior northeast corner" vs "interior space")

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

3. EXTRACTED ENTITIES (structured findings - be comprehensive)
   For each significant observation, create an entity with:
   - type: "REC" | "AOC" | "Feature" | "Equipment" | "Condition"
   - description: Detailed description with measurements/specifics when possible
   - severity: "high" | "medium" | "low" | "info"
   - recommendation: Follow-up action if applicable (sampling, further investigation, etc.)

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

${gpsText}
[Photo timestamp: ${timestamp}]
[Session duration: ${Math.round(sessionTimestamp)} seconds]

Respond ONLY with valid JSON in this exact structure:
{
  "description": "string",
  "catalogTags": ["string"],
  "entities": [
    {
      "type": "REC" | "AOC" | "Feature" | "Equipment" | "Condition",
      "description": "string",
      "severity": "high" | "medium" | "low" | "info",
      "recommendation": "string or null"
    }
  ]
}`;
}

export async function POST(req: NextRequest) {
  try {
    console.log('[AnalyzePhoto] Request received');

    // Parse request body
    const body = await req.json();
    const { photoId, imageData, gps, timestamp, sessionTimestamp } = body;

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

    // Build ESA-specific prompt
    const promptText = buildAnalysisPrompt(gps, timestamp, sessionTimestamp || 0);

    // Check for API key (using CLAUDE_API_KEY to avoid Anthropic SDK override)
    const apiKey = process.env.CLAUDE_API_KEY;

    if (!apiKey || apiKey.length === 0) {
      console.error('[AnalyzePhoto] CLAUDE_API_KEY not found or empty in environment');
      return NextResponse.json(
        { error: 'Anthropic API key not configured. Please add CLAUDE_API_KEY to .env.local' },
        { status: 500 }
      );
    }

    console.log('[AnalyzePhoto] API key loaded successfully');

    // Initialize Anthropic client
    const anthropic = new Anthropic({
      apiKey: apiKey
    });

    // Call Claude Vision API
    console.log('[AnalyzePhoto] Calling Claude Vision API...');
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

    console.log('[AnalyzePhoto] Claude response received');
    console.log('[AnalyzePhoto] Token usage:', {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      total_tokens: response.usage.input_tokens + response.usage.output_tokens
    });

    // Extract text content from response
    const textContent = response.content.find(block => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text content in Claude response');
    }

    // Parse JSON response
    let parsedResponse: {
      description: string;
      catalogTags: string[];
      entities: PhotoEntity[];
    };

    try {
      // Try to extract JSON from markdown code blocks if present
      const jsonMatch = textContent.text.match(/```json\n([\s\S]*?)\n```/) ||
                       textContent.text.match(/```\n([\s\S]*?)\n```/);

      const jsonText = jsonMatch ? jsonMatch[1] : textContent.text;
      parsedResponse = JSON.parse(jsonText);
    } catch (parseError) {
      console.error('[AnalyzePhoto] Failed to parse Claude response:', textContent.text);
      throw new Error('Claude returned invalid JSON format');
    }

    // Validate response structure
    if (!parsedResponse.description || !Array.isArray(parsedResponse.catalogTags) || !Array.isArray(parsedResponse.entities)) {
      throw new Error('Claude response missing required fields');
    }

    // Construct PhotoAnalysis object
    const analysis: PhotoAnalysis = {
      photoId,
      vlmDescription: parsedResponse.description,
      catalogTags: parsedResponse.catalogTags,
      entities: parsedResponse.entities,
      timestamp,
      gps: gps || null,
      transcriptSegment: null  // Phase 3 - timestamp correlation
    };

    console.log(`[AnalyzePhoto] Success - Generated ${analysis.catalogTags.length} tags and ${analysis.entities.length} entities`);

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
