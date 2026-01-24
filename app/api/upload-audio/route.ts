// API Route: Handle audio file uploads to Vercel Blob Storage
// Used for large audio files (>4MB) that exceed Vercel's serverless body limit

import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as HandleUploadBody;

    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        // Validate it's an audio file and set size limits
        return {
          allowedContentTypes: ['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/m4a'],
          maximumSizeInBytes: 100 * 1024 * 1024, // 100MB max (well under Whisper's 25MB limit, but allows for overhead)
        };
      },
      onUploadCompleted: async ({ blob }) => {
        console.log('[UploadAudio] Upload complete:', blob.url);
      },
    });

    return NextResponse.json(jsonResponse);

  } catch (error: any) {
    console.error('[UploadAudio] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Upload failed' },
      { status: 500 }
    );
  }
}
