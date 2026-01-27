import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { PhotoAnalysis, GpsCoordinates, PhotoEntity, ProjectType, EntitySchemaItem } from '@/app/lib/types';
import { getDefaultContext } from '@/app/lib/defaultContexts';

type VisionProvider = 'claude' | 'openai' | 'gemini';
type VisionModel = 'claude-sonnet-4-5-20250929' | 'gpt-4o-mini' | 'gpt-4o' | 'gemini-2.0-flash';

// Build analysis prompt based on project type and context
// Dynamically adapts to different project types (ESA, EIR/EIS, Borehole, Generic)
function buildAnalysisPrompt(
  projectType: ProjectType,
  gps: GpsCoordinates | null,
  timestamp: string,
  sessionTimestamp: number,
  transcriptContext: string | null  // Now a combined string from context window
): string {
  const context = getDefaultContext(projectType);
  const basePrompt = context.visionAnalysisPrompt;
  const entitySchema = context.entitySchema;

  const gpsText = gps
    ? `[GPS coordinates: ${gps.latitude.toFixed(6)}, ${gps.longitude.toFixed(6)} ±${Math.round(gps.accuracy)}m]`
    : '[GPS coordinates: Not available]';

  // Home inventory uses a simplified, graph-ready output format
  if (projectType === 'home-inventory') {
    const transcriptNote = transcriptContext
      ? `\n\n## TRANSCRIPT CONTEXT\nAround this photo, the person said: "${transcriptContext}"\nPay attention to ALL items mentioned - the speaker may describe things before or after taking the photo. Include mentioned items/locations in your response.`
      : '';

    return `${basePrompt}${transcriptNote}

${gpsText}
[Photo timestamp: ${timestamp}]

Output valid JSON only (no markdown code blocks):
{"description":"brief findable description","room":"lowercase room type","area":"location in room or null","container":"what holds items or null","items":[{"name":"item","attributes":{}}],"catalogTags":["tag1","tag2"],"notes":["context"]}

CRITICAL:
- room is REQUIRED - use ONE specific room type from the list above, always lowercase
- items: list EVERY visible item including background (pets, plants, art)
- container: only null if items are loose on floor or wall-mounted
- attributes: include color/brand/size only if helpful for finding
- Ensure complete valid JSON with all closing braces and brackets`;
  }

  // Build transcript context section
  let transcriptSection = '';
  if (transcriptContext) {
    transcriptSection = `
## CONSULTANT'S VERBAL CONTEXT
Around this photo, the field consultant said:
"${transcriptContext}"

**IMPORTANT**: This is a context window - it includes speech from before and after the photo was taken.
Pay attention to ALL items mentioned, as the speaker may describe things before or after clicking the shutter.

**IMPORTANT**: Use this verbal context to enhance your analysis:

1. **Answer questions**: If the consultant asks "What is this?" or "I wonder if...", try to answer based on what you see

2. **Extract action items**: If they say "add to to-do", "need to check later", "follow up on", or express intent to return, create an ActionItem entity

3. **Note their observations**: If they share context like "the site manager said..." or "this used to be...", incorporate it into your description

4. **Validate hypotheses**: If they mention what something might be, confirm or challenge based on visual evidence

5. **Flag uncertainties**: If they express uncertainty, note it and provide your assessment

6. **Extract specific details requested**: If the consultant mentions wanting to capture specific information (serial numbers, model numbers, dates, measurements visible in the photo), extract and highlight that exact data in the extractedData field

7. **Handle comparison requests**: If the consultant says "this looks similar to...", "compare this to what we saw earlier", or references previous observations, note the comparison being made and describe relevant similarities or differences visible in this photo

8. **Detect priority signals**: If the consultant expresses urgency ("this is critical", "high priority", "needs immediate attention", "red flag") or concern, flag the entity with severity "high" and explain why in priorityReason

9. **Extract measurements**: If the consultant mentions dimensions, quantities, or asks you to estimate size ("about 10 feet", "three tanks", "looks like 500 gallons"), include those measurements in extractedData and verify against visual evidence if possible

10. **Suggest follow-up photos**: If the current photo doesn't fully capture what the consultant mentioned (e.g., they asked about a label but it's not visible, or mentioned something out of frame), include a recommendation in suggestedFollowUp

11. **Link verbal context to visual evidence**: When the consultant provides history ("this was installed in 1985", "they said it hasn't been serviced"), cross-reference with visible evidence (dates on equipment, condition indicators) to validate or note discrepancies
`;
  }

  // Build entity types list from schema
  const entityTypes = entitySchema.map(e => e.name).join(' | ');
  const entityDescriptions = entitySchema.map(e => `     - "${e.name}" - ${e.displayName}: ${e.description || ''}`).join('\n');

  // Build catalog tags based on project type
  const catalogTagsSection = buildCatalogTags(projectType, transcriptContext !== null);

  return `${basePrompt}
${transcriptSection}
Analyze this photograph and provide:

1. VISUAL DESCRIPTION (2-4 sentences)
   - Describe what is visible in the photo with specificity
   - Note relevant observations for this type of assessment
   - Include context from GPS if provided
   ${transcriptContext ? '- Address any questions or observations from the consultant\'s verbal context' : ''}

2. CATALOG TAGS (searchable keywords - comprehensive list)
${catalogTagsSection}
   ${transcriptContext ? '\n   **Transcript-derived:** action_item, question_raised, consultant_observation, needs_verification, comparison_requested, measurement_noted, follow_up_needed, high_priority_verbal, data_extraction_request, historical_context' : ''}

3. EXTRACTED ENTITIES (structured findings - be comprehensive)
   For each significant observation, create an entity with:
   - type: One of:
${entityDescriptions}
     ${transcriptContext ? `- "ActionItem" - Something the consultant wants to follow up on
     - "Question" - A question the consultant asked (include your answer)
     - "Observation" - Consultant's verbal observation worth noting` : ''}
   - description: Brief description of what was found
   - severity: "high" | "medium" | "low" | "info"
   - recommendation: Follow-up action if applicable
   - extractedData: **CRITICAL for "identifier" type - put EXACT OCR text here in format "Key: Value | Key2: Value2"**
   - suggestedFollowUp: If label/text not fully captured, specify what photo angle is needed

   **Severity Guidelines:**
   - high: Critical finding requiring immediate attention or investigation
   - medium: Notable finding warranting follow-up
   - low: Minor observation for documentation
   - info: General feature documentation

   **For inventory/asset projects:** When you see text on labels, put the EXACT characters in extractedData, NOT in description.

${gpsText}
[Photo timestamp: ${timestamp}]
[Session duration: ${Math.round(sessionTimestamp)} seconds]
[Project type: ${projectType}]

Respond ONLY with valid JSON in this exact structure:
{
  "description": "string",
  "catalogTags": ["string"],
  "entities": [
    {
      "type": "${entityTypes}"${transcriptContext ? ' | "ActionItem" | "Question" | "Observation"' : ''},
      "description": "string",
      "severity": "high" | "medium" | "low" | "info",
      "recommendation": "string or null",
      "extractedData": "string or null (USE THIS for exact OCR text: 'Brand: X | Model: Y | Serial: Z')",
      "suggestedFollowUp": "string or null (suggest retake if label not fully visible)"${transcriptContext ? `,
      "consultantContext": "string or null",
      "aiResponse": "string or null",
      "priorityReason": "string or null"` : ''}
    }
  ]
}`;
}

// Build catalog tags section based on project type
function buildCatalogTags(projectType: ProjectType, hasTranscript: boolean): string {
  const commonTags = `
   **General:** building, structure, equipment, vegetation, ground, surface`;

  switch (projectType) {
    case 'phase1-esa':
      return `   Include ALL relevant tags from these categories:

   **Surfaces & Ground:** asphalt, concrete, gravel, soil, grass, bare_soil, pavement_cracking, potholes, subsidence, erosion

   **Structures:** building, warehouse, garage, shed, loading_dock, roof, wall, foundation, slab, floor_drain

   **Equipment & Machinery:** tank, drum, ibc_tote, compressor, generator, transformer, hvac, piping, valves, pumps, equipment_pad

   **Environmental Features:** storm_drain, catch_basin, manhole, sump, ust_fill_port, ust_vent, oil_water_separator, french_drain, culvert

   **Indicators & Conditions:** staining, discoloration, pooled_liquid, spill, sheen, debris, waste, deterioration, corrosion, rust, peeling_paint, cracking

   **Vegetation:** overgrowth, dead_vegetation, stressed_vegetation, landscaping, weeds, trees

   **Utilities:** electrical, overhead_lines, pole_transformer, gas_meter, water_meter, sewer, utility_pole

   **Storage & Materials:** drum_storage, tank_farm, chemical_storage, waste_storage, dumpster, roll_off, recycling

   **Signage & Safety:** hazmat_placard, nfpa_diamond, safety_signage, warning_label, no_trespassing

   **Risk Flags:** potential_rec, potential_aoc, hazmat_concern, requires_sampling, compliance_issue, historical_use_indicator`;

    case 'eir-eis':
      return `   Include ALL relevant tags from these categories:

   **Landscape & Terrain:** hillside, valley, ridgeline, slope, flat, drainage, watershed, viewshed

   **Vegetation:** native_plants, invasive_species, trees, shrubs, grassland, wetland_vegetation, riparian

   **Wildlife:** bird, mammal, reptile, amphibian, nest, burrow, tracks, habitat, migration_corridor

   **Water Features:** stream, creek, pond, lake, wetland, vernal_pool, drainage_channel, flood_zone

   **Human Elements:** residence, school, hospital, park, trail, road, utility, fence, signage

   **Environmental Sensitivity:** sensitive_habitat, protected_species, cultural_resource, archaeological, scenic_resource

   **Impact Indicators:** erosion, sedimentation, disturbance, construction_activity, grading, clearing`;

    case 'borehole':
      return `   Include ALL relevant tags from these categories:

   **Equipment:** drill_rig, auger, core_barrel, sample_tube, tripod, pump, generator, water_tank

   **Soil & Geology:** clay, silt, sand, gravel, bedrock, fill, topsoil, weathered_rock, groundwater

   **Samples:** soil_sample, core_sample, water_sample, split_spoon, shelby_tube, jar_sample

   **Conditions:** wet, dry, saturated, moist, odor, staining, sheen, discoloration

   **Safety:** hard_hat, safety_vest, barrier, caution_tape, decontamination, ppe

   **Documentation:** depth_marker, label, log_sheet, field_notes, measurement`;

    case 'home-inventory':
      return `   Include ALL relevant tags from these categories:

   **Room:**
   - kitchen, living_room, dining_room, bedroom, master_bedroom, kids_room, guest_room
   - bathroom, garage, basement, attic, office, home_office, laundry_room
   - closet, pantry, mudroom, entryway, patio, shed, workshop

   **Storage/Area:**
   - drawer, shelf, cabinet, closet, bin, box, basket, bag, container
   - rack, hook, mounted, counter, table, floor, wall
   - top_shelf, bottom_shelf, upper_cabinet, lower_cabinet, under_sink

   **Category:**
   - tools, kitchen_stuff, electronics, clothes, shoes, toys, games, books
   - documents, seasonal, holiday, camping, sports, crafts, office_supplies
   - cleaning, medicine, first_aid, pet_stuff, baby_stuff, linens, decor

   **Item Type:**
   - appliance, furniture, device, equipment, supplies, accessories
   - collection, set, pair, spare, backup

   **Descriptors:**
   - frequently_used, rarely_used, seasonal, everyday
   - valuable, sentimental, inherited, antique
   - bulk, organized, misc, junk_drawer

   **Color (if helpful for finding):**
   - red, blue, green, yellow, black, white, gray, brown, clear, multicolor`;

    case 'asset-tagging':
      return `   Include ALL relevant tags from these categories:

   **Asset Type:**
   - it_equipment, computer, server, network_device, printer, phone_system
   - furniture, desk, chair, table, cabinet, shelf, workstation
   - hvac, electrical, plumbing, safety_equipment
   - tools, machinery, vehicles

   **Location:**
   - floor, room, zone, rack, building, section, warehouse, office

   **Condition:**
   - new, good, fair, poor, damaged, needs_repair, decommissioned

   **Identification:**
   - serial_captured, asset_tag_visible, barcode_scanned, qr_scanned
   - label_readable, label_partial, label_missing

   **Compliance:**
   - inspection_current, inspection_due, maintenance_required
   - safety_compliant, warranty_active`;

    case 'generic':
    default:
      return `   Include ALL relevant tags that describe:

   **Location:** interior, exterior, ground_level, elevated, adjacent_property

   **Features:** structure, equipment, vegetation, surface, utility, signage

   **Conditions:** good_condition, deterioration, damage, staining, debris

   **Documentation:** overview, detail, measurement, comparison`;
  }
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

// Call Google Gemini 2.0 Flash for vision analysis
async function analyzeWithGemini(
  model: 'gemini-2.0-flash',
  base64Data: string,
  mediaType: string,
  promptText: string
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const { GoogleGenerativeAI } = await import('@google/generative-ai');

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const genModel = genAI.getGenerativeModel({ model });

  const result = await genModel.generateContent([
    {
      inlineData: {
        mimeType: `image/${mediaType}`,
        data: base64Data,
      },
    },
    promptText,
  ]);

  const rawResponse = result.response.text();
  const usageMetadata = result.response.usageMetadata;

  return {
    text: rawResponse,
    inputTokens: usageMetadata?.promptTokenCount || 0,
    outputTokens: usageMetadata?.candidatesTokenCount || 0
  };
}

export async function POST(req: NextRequest) {
  try {
    console.log('[AnalyzePhoto] Request received');

    // Parse request body
    const body = await req.json();
    const { photoId, imageData, gps, timestamp, sessionTimestamp, transcriptContext, provider = 'gemini', model = 'gemini-2.0-flash', projectType = 'phase1-esa' } = body;

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
    console.log(`[AnalyzePhoto] Project type: ${projectType}`);
    console.log(`[AnalyzePhoto] Transcript context: ${transcriptContext ? `"${transcriptContext.substring(0, 80)}..."` : 'none'}`);

    // Build project-type-specific prompt with transcript context (now a context window string)
    const promptText = buildAnalysisPrompt(
      projectType as ProjectType,
      gps,
      timestamp,
      sessionTimestamp || 0,
      transcriptContext || null
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
    } else if (provider === 'gemini') {
      const result = await analyzeWithGemini('gemini-2.0-flash', base64Data, mediaType, promptText);
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
    let parsedResponse: Record<string, unknown>;

    try {
      // Try to extract JSON from markdown code blocks if present
      const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/) ||
                       responseText.match(/```\n([\s\S]*?)\n```/);

      let jsonText = jsonMatch ? jsonMatch[1] : responseText;

      // Try to find JSON object or array if response has extra text
      const objectMatch = jsonText.match(/[\[{][\s\S]*[\]}]/);
      if (objectMatch) {
        jsonText = objectMatch[0];
      }

      const parsed = JSON.parse(jsonText);

      // Gemini sometimes returns arrays - merge them into single result
      if (Array.isArray(parsed)) {
        parsedResponse = {
          description: parsed[0]?.description,
          catalogTags: parsed[0]?.catalogTags || [],
          entities: [],
          room: parsed[0]?.room,
          area: parsed[0]?.area,
          container: parsed[0]?.container,
          items: [],
        };
        // Collect all entities/items from all array elements
        for (const entry of parsed) {
          if (entry.entities && Array.isArray(entry.entities)) {
            (parsedResponse.entities as unknown[]).push(...entry.entities);
          }
          if (entry.items && Array.isArray(entry.items)) {
            (parsedResponse.items as unknown[]).push(...entry.items);
          }
          if (entry.catalogTags && Array.isArray(entry.catalogTags)) {
            for (const tag of entry.catalogTags) {
              if (!(parsedResponse.catalogTags as string[]).includes(tag)) {
                (parsedResponse.catalogTags as string[]).push(tag);
              }
            }
          }
        }
      } else {
        parsedResponse = parsed;
      }
    } catch (parseError) {
      console.error(`[AnalyzePhoto] Failed to parse ${provider} response:`, responseText);
      throw new Error(`${provider} returned invalid JSON format`);
    }

    // Handle home-inventory format (graph-ready structure)
    let analysis: PhotoAnalysis;

    if (projectType === 'home-inventory') {
      // Validate home-inventory response structure
      if (!parsedResponse.description || !parsedResponse.room) {
        throw new Error(`${provider} response missing required fields (description, room)`);
      }

      // Convert items array to entities for compatibility
      const items = (parsedResponse.items as Array<{name: string; attributes?: Record<string, string>}>) || [];
      const entities: PhotoEntity[] = [];

      // Add location entity
      const locationParts = [parsedResponse.room as string];
      if (parsedResponse.area) locationParts.push(parsedResponse.area as string);
      if (parsedResponse.container) locationParts.push(parsedResponse.container as string);

      entities.push({
        type: 'location',
        description: locationParts.join(' > '),
        severity: 'info',
      });

      // Add container entity if present
      if (parsedResponse.container) {
        entities.push({
          type: 'container',
          description: parsedResponse.container as string,
          severity: 'info',
        });
      }

      // Add item entities
      for (const item of items) {
        const attrStr = item.attributes
          ? Object.entries(item.attributes).map(([k, v]) => `${k}: ${v}`).join(', ')
          : '';
        entities.push({
          type: 'item',
          description: item.name,
          severity: 'info',
          extractedData: attrStr || undefined,
        });
      }

      // Add notes as note entities
      const notes = (parsedResponse.notes as string[]) || [];
      for (const note of notes) {
        entities.push({
          type: 'note',
          description: note,
          severity: 'info',
        });
      }

      analysis = {
        photoId,
        vlmDescription: parsedResponse.description as string,
        catalogTags: (parsedResponse.catalogTags as string[]) || [],
        entities,
        timestamp,
        gps: gps || null,
        transcriptSegment: transcriptContext || null,  // Now stores context window string
        // Store the graph-ready fields for later ingestion
        room: parsedResponse.room as string,
        area: (parsedResponse.area as string) || null,
        container: (parsedResponse.container as string) || null,
        items: items,
      };

      console.log(`[AnalyzePhoto] Success (home-inventory) - Room: ${analysis.room}, Items: ${items.length}, Entities: ${entities.length}`);
    } else {
      // Standard format for other project types
      const standardResponse = parsedResponse as {
        description: string;
        catalogTags: string[];
        entities: PhotoEntity[];
      };

      // Validate response structure
      if (!standardResponse.description || !Array.isArray(standardResponse.catalogTags) || !Array.isArray(standardResponse.entities)) {
        throw new Error(`${provider} response missing required fields`);
      }

      analysis = {
        photoId,
        vlmDescription: standardResponse.description,
        catalogTags: standardResponse.catalogTags,
        entities: standardResponse.entities,
        timestamp,
        gps: gps || null,
        transcriptSegment: transcriptContext || null  // Now stores context window string
      };

      console.log(`[AnalyzePhoto] Success - Generated ${analysis.catalogTags.length} tags and ${analysis.entities.length} entities`);
    }

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
