// API Route: Transcribe Audio with OpenAI Whisper
// Receives base64 audio OR blob URL, converts to file, transcribes, returns structured transcript
// Works in Vercel serverless environment using toFile helper (no filesystem access needed)
// For large files (>4MB), use audioUrl from Vercel Blob storage to bypass body size limits

import { NextRequest, NextResponse } from 'next/server';
import OpenAI, { toFile } from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface TranscribeRequest {
  audioData?: string;  // Base64 data URL (e.g., "data:audio/webm;base64,...") - for small files
  audioUrl?: string;   // Vercel Blob URL - for large files (>4MB)
  mimeType: string;    // e.g., "audio/webm"
  duration?: number;   // Optional duration in seconds for validation
}

interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

interface TranscribeResponse {
  transcript: {
    fullText: string;
    segments: TranscriptSegment[];
    language?: string;
    duration: number;
  };
}

export async function POST(req: NextRequest) {
  try {
    // Parse request
    const body: TranscribeRequest = await req.json();
    const { audioData, audioUrl, mimeType } = body;

    // Validate request - need either audioData or audioUrl
    if (!mimeType) {
      return NextResponse.json(
        { error: 'Missing mimeType' },
        { status: 400 }
      );
    }

    if (!audioData && !audioUrl) {
      return NextResponse.json(
        { error: 'Missing audioData or audioUrl' },
        { status: 400 }
      );
    }

    let buffer: Buffer;

    if (audioUrl) {
      // Fetch audio from Vercel Blob storage (for large files)
      console.log(`[Transcribe] Fetching audio from blob: ${audioUrl}`);
      const fetchResponse = await fetch(audioUrl);

      if (!fetchResponse.ok) {
        return NextResponse.json(
          { error: `Failed to fetch audio from blob storage: ${fetchResponse.status}` },
          { status: 500 }
        );
      }

      buffer = Buffer.from(await fetchResponse.arrayBuffer());
      console.log(`[Transcribe] Fetched ${(buffer.length / (1024 * 1024)).toFixed(2)}MB from blob`);
    } else if (audioData) {
      // Use base64 data directly (for small files)
      if (!audioData.startsWith('data:')) {
        return NextResponse.json(
          { error: 'audioData must be a data URL' },
          { status: 400 }
        );
      }

      // Extract base64 data
      const base64Data = audioData.split(',')[1];
      if (!base64Data) {
        return NextResponse.json(
          { error: 'Invalid data URL format' },
          { status: 400 }
        );
      }

      // Convert base64 to Buffer
      buffer = Buffer.from(base64Data, 'base64');
    } else {
      return NextResponse.json(
        { error: 'No audio data provided' },
        { status: 400 }
      );
    }

    // Check file size
    const fileSizeMB = buffer.length / (1024 * 1024);
    console.log(`[Transcribe] Received ${fileSizeMB.toFixed(2)}MB audio file`);

    // Check if file is too large for Whisper (25MB limit)
    if (fileSizeMB > 25) {
      return NextResponse.json(
        { error: `Audio file too large: ${fileSizeMB.toFixed(2)}MB (max 25MB). Try a shorter recording.` },
        { status: 413 }
      );
    }

    // Determine file extension from MIME type
    const extensionMap: Record<string, string> = {
      'audio/webm': 'webm',
      'audio/webm;codecs=opus': 'webm',
      'audio/mp4': 'mp4',
      'audio/mpeg': 'mp3',
      'audio/wav': 'wav',
      'audio/m4a': 'm4a',
    };
    // Clean mimeType (remove codecs if present)
    const baseMimeType = mimeType.split(';')[0];
    const extension = extensionMap[baseMimeType] || extensionMap[mimeType] || 'webm';
    const filename = `audio.${extension}`;

    console.log(`[Transcribe] Processing audio: ${filename}, mime: ${mimeType}`);

    // Use OpenAI's toFile helper to create a file-like object from buffer
    // This works in serverless environments without filesystem access
    const file = await toFile(buffer, filename, { type: baseMimeType });

    // Call Whisper API
    const response = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['segment'],
    });

    // Structure response
    const result: TranscribeResponse = {
      transcript: {
        fullText: response.text,
        segments: (response.segments || []).map((seg: any) => ({
          start: seg.start,
          end: seg.end,
          text: seg.text,
        })),
        language: response.language,
        duration: response.duration || 0,
      },
    };

    console.log(`[Transcribe] Success: ${result.transcript.segments.length} segments, ${result.transcript.fullText.length} chars`);

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('[Transcribe] Error:', error);

    // Handle specific OpenAI errors
    if (error.status === 401) {
      return NextResponse.json(
        { error: 'Invalid OpenAI API key' },
        { status: 500 }
      );
    }

    if (error.status === 429) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 503 }
      );
    }

    // Generic error
    return NextResponse.json(
      { error: error.message || 'Transcription failed' },
      { status: 500 }
    );
  }
}

// Next.js App Router configuration for large request bodies
// Note: Vercel has a 4.5MB limit on serverless functions by default
// For larger files (>4MB), use audioUrl with Vercel Blob storage
