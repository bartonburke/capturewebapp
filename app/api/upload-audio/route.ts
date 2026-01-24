// API Route: Handle audio file uploads to Vercel Blob Storage
// Used for large audio files (>4MB) that exceed Vercel's serverless body limit

import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextRequest, NextResponse } from 'next/server';

// Support both BLOB_READ_WRITE_TOKEN (default) and Audio_READ_WRITE_TOKEN (Vercel auto-generated)
const token = process.env.BLOB_READ_WRITE_TOKEN || process.env.Audio_READ_WRITE_TOKEN;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as HandleUploadBody;

    const jsonResponse = await handleUpload({
      body,
      request: req,
      token,
      onBeforeGenerateToken: async (pathname) => {
        // Validate it's an audio/video file and set size limits
        // Note: MediaRecorder on iOS may produce video/webm even for audio-only streams
        return {
          allowedContentTypes: [
            'audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/m4a',
            'video/webm', 'video/mp4'  // iOS MediaRecorder sometimes reports video MIME type
          ],
          maximumSizeInBytes: 100 * 1024 * 1024, // 100MB max
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
