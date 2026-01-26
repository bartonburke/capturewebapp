import { NextRequest, NextResponse } from 'next/server';
import {
  ProjectType,
  SessionSynthesis,
  PhotoAnalysis,
  Transcript,
  EntityCluster,
  LocationNode,
  SearchIndexEntry,
  CoverageAnalysis,
  SynthesisDeliverable,
} from '@/app/lib/types';
import { synthesizeSession, SynthesisInput } from '@/app/lib/synthesis';

export interface SynthesizeSessionRequest {
  sessionId: string;
  projectId: string;
  projectType: ProjectType;
  // Data from ProcessingResult (passed from client)
  photoAnalyses: PhotoAnalysis[];
  transcript: Transcript;
  forceRefresh?: boolean;
}

export interface SynthesizeSessionResponse {
  success: boolean;
  synthesis?: SessionSynthesis;
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<SynthesizeSessionResponse>> {
  try {
    const body: SynthesizeSessionRequest = await request.json();
    const { sessionId, projectId, projectType, photoAnalyses, transcript, forceRefresh } = body;

    // Validate required fields
    if (!sessionId || !projectId || !projectType) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: sessionId, projectId, projectType' },
        { status: 400 }
      );
    }

    if (!photoAnalyses || photoAnalyses.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No photo analyses provided for synthesis' },
        { status: 400 }
      );
    }

    console.log(`[SynthesizeSession] Starting synthesis for session ${sessionId}`);
    console.log(`[SynthesizeSession] Project type: ${projectType}, Photos: ${photoAnalyses.length}`);

    // Build synthesis input
    const input: SynthesisInput = {
      sessionId,
      projectId,
      projectType,
      photoAnalyses,
      transcript,
    };

    // Run synthesis
    const synthesis = await synthesizeSession(input);

    console.log(`[SynthesizeSession] Synthesis complete: ${synthesis.deliverables.length} deliverables generated`);

    return NextResponse.json({
      success: true,
      synthesis,
    });

  } catch (error: any) {
    console.error('[SynthesizeSession] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Synthesis failed' },
      { status: 500 }
    );
  }
}
