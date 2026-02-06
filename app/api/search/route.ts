import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

interface ProjectSummary {
  id: string;
  name: string;
  type: string;
  typeLabel: string;
  lead: string;
  notes?: string;
  photoCount: number;
  audioCount: number;
  createdAt: string;
  modifiedAt: string;
  processingStage?: string;
  gpsLocations?: Array<{ lat: string; lng: string }>;
}

interface SearchResult {
  type: 'project' | 'photo';
  projectId: string;
  projectName: string;
  photoId?: string;
  reasoning: string;
  relevance: 'high' | 'medium' | 'low';
}

interface SearchRequest {
  query: string;
  projects: ProjectSummary[];
}

export async function POST(request: NextRequest) {
  try {
    const { query, projects }: SearchRequest = await request.json();

    if (!query || !projects) {
      return NextResponse.json(
        { error: 'Missing query or projects data' },
        { status: 400 }
      );
    }

    if (!process.env.ANTHROPIC_API_KEY && !process.env.CLAUDE_API_KEY) {
      return NextResponse.json(
        { error: 'Search unavailable: ANTHROPIC_API_KEY not configured. Set it in your environment variables.' },
        { status: 503 }
      );
    }

    const anthropic = new Anthropic();

    // Build project context for Claude
    const projectContext = projects.map(p => {
      const gpsInfo = p.gpsLocations && p.gpsLocations.length > 0
        ? `GPS: ${p.gpsLocations.map(g => `(${g.lat}, ${g.lng})`).join(', ')}`
        : 'No GPS data';

      return `- "${p.name}" (ID: ${p.id})
  Type: ${p.typeLabel}
  Lead: ${p.lead}
  ${p.notes ? `Notes: ${p.notes}` : ''}
  Photos: ${p.photoCount}, Audio: ${p.audioCount}
  Created: ${new Date(p.createdAt).toLocaleDateString()}
  Modified: ${new Date(p.modifiedAt).toLocaleDateString()}
  Status: ${p.processingStage || 'captured'}
  ${gpsInfo}`;
    }).join('\n\n');

    const systemPrompt = `You are a search assistant for a mobile photo/audio capture app. Users capture field sessions with photos and audio recordings. Each project has metadata including name, type (Phase I ESA, EIR, etc.), lead name, notes, GPS coordinates, and processing status.

Your job is to interpret natural language queries and find matching projects. Consider:
- Project names and notes (text matching)
- Project types (Phase I ESA, borehole, home inventory, travel log, etc.)
- Processing status: "captured", "transcribed", "analyzed", "graph_ready"
- GPS locations (if user mentions a place name, try to match coordinates or project names)
- Date ranges (created/modified dates)
- Media counts (projects with photos, audio)

Common query patterns:
- "unprocessed" or "needs processing" = processingStage is 'captured' or undefined
- "finished" or "processed" = processingStage is 'transcribed' or 'analyzed'
- "last week" = modified in the last 7 days
- "with photos" = photoCount > 0
- Location names = match against project names, notes, or nearby GPS coordinates

Respond with valid JSON only, no markdown code blocks.`;

    const userPrompt = `Here are the user's projects:

${projectContext}

User query: "${query}"

Return a JSON object with:
{
  "interpretation": "Brief explanation of how you interpreted the query",
  "results": [
    {
      "type": "project",
      "projectId": "the project ID",
      "projectName": "the project name",
      "reasoning": "Why this matches the query",
      "relevance": "high" | "medium" | "low"
    }
  ]
}

Return up to 10 most relevant results, sorted by relevance. If no projects match, return an empty results array.`;

    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 1024,
      messages: [
        { role: 'user', content: userPrompt }
      ],
      system: systemPrompt,
    });

    // Extract text response
    const textContent = response.content.find(c => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Claude');
    }

    // Parse JSON response
    let searchResults;
    try {
      // Remove any markdown code blocks if present
      let jsonText = textContent.text.trim();
      if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }
      searchResults = JSON.parse(jsonText);
    } catch (parseError) {
      console.error('[Search] Failed to parse Claude response:', textContent.text);
      throw new Error('Failed to parse search results');
    }

    return NextResponse.json(searchResults);
  } catch (error: any) {
    console.error('[Search] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Search failed' },
      { status: 500 }
    );
  }
}
