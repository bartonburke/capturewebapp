// Launch API endpoint for creating capture sessions from external systems (Claude Code)
// POST /api/v1/capture/launch

import { NextRequest, NextResponse } from 'next/server';
import { LaunchSessionRequest, LaunchSessionResponse, ProjectType } from '@/app/lib/types';
import { mergeWithDefaults } from '@/app/lib/defaultContexts';

// Validate project type
function isValidProjectType(type: string): type is ProjectType {
  return ['phase1-esa', 'eir-eis', 'borehole', 'generic'].includes(type);
}

export async function POST(req: NextRequest) {
  try {
    const body: LaunchSessionRequest = await req.json();

    // Validate required fields
    if (!body.projectType) {
      return NextResponse.json(
        { error: 'Missing required field: projectType' },
        { status: 400 }
      );
    }

    if (!body.projectName || body.projectName.trim() === '') {
      return NextResponse.json(
        { error: 'Missing required field: projectName' },
        { status: 400 }
      );
    }

    if (!isValidProjectType(body.projectType)) {
      return NextResponse.json(
        { error: `Invalid projectType: ${body.projectType}. Must be one of: phase1-esa, eir-eis, borehole, generic` },
        { status: 400 }
      );
    }

    // Generate session ID and expiration
    const sessionId = crypto.randomUUID();
    const expiresAt = body.expiresAt ||
      new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours default

    // Validate expiration is in the future
    if (new Date(expiresAt) <= new Date()) {
      return NextResponse.json(
        { error: 'expiresAt must be in the future' },
        { status: 400 }
      );
    }

    // Merge provided context with defaults for this project type
    const context = mergeWithDefaults(body.projectType, body.context);

    // Build session data to encode in URL
    const sessionData = {
      sessionId,
      projectId: body.projectId,
      projectType: body.projectType,
      projectName: body.projectName.trim(),
      lead: body.lead?.trim(),
      notes: body.notes?.trim(),
      context,
      expiresAt,
      createdAt: new Date().toISOString(),
    };

    // Encode session data in URL (base64url encoding)
    // This allows the session page to decode without needing server-side storage
    const encodedSession = Buffer.from(JSON.stringify(sessionData)).toString('base64url');

    // Build capture URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ||
      (req.headers.get('host') ? `https://${req.headers.get('host')}` : 'http://localhost:3000');
    const captureUrl = `${baseUrl}/session/${sessionId}?data=${encodedSession}`;

    console.log('[Launch API] Created session:', {
      sessionId,
      projectType: body.projectType,
      projectName: body.projectName,
      expiresAt,
    });

    const response: LaunchSessionResponse = {
      sessionId,
      captureUrl,
      expiresAt,
    };

    return NextResponse.json(response);

  } catch (error: unknown) {
    console.error('[Launch API] Error:', error);

    // Handle JSON parse errors
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const errorMessage = error instanceof Error ? error.message : 'Failed to create launch session';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

// GET endpoint for testing/verification
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/v1/capture/launch',
    method: 'POST',
    description: 'Create a new capture session with project context',
    required_fields: ['projectType', 'projectName'],
    optional_fields: ['projectId', 'lead', 'notes', 'context', 'expiresAt'],
    project_types: ['phase1-esa', 'eir-eis', 'borehole', 'generic'],
    example_request: {
      projectType: 'phase1-esa',
      projectName: 'Industrial Property - 123 Main St',
      lead: 'John Smith',
      notes: 'Phase I ESA site visit',
    },
  });
}
