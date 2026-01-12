// API Route: Transcribe Audio with OpenAI Whisper
// Receives base64 audio, converts to file, transcribes, returns structured transcript

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface TranscribeRequest {
  audioData: string;  // Base64 data URL (e.g., "data:audio/webm;base64,...")
  mimeType: string;   // e.g., "audio/webm"
  duration?: number;  // Optional duration in seconds for validation
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
    const { audioData, mimeType } = body;

    // Validate request
    if (!audioData || !mimeType) {
      return NextResponse.json(
        { error: 'Missing audioData or mimeType' },
        { status: 400 }
      );
    }

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
    const buffer = Buffer.from(base64Data, 'base64');

    // Check file size (Whisper limit is 25MB)
    const fileSizeMB = buffer.length / (1024 * 1024);
    if (fileSizeMB > 25) {
      return NextResponse.json(
        { error: `Audio file too large: ${fileSizeMB.toFixed(2)}MB (max 25MB)` },
        { status: 413 }
      );
    }

    // Determine file extension from MIME type
    const extensionMap: Record<string, string> = {
      'audio/webm': 'webm',
      'audio/mp4': 'mp4',
      'audio/mpeg': 'mp3',
      'audio/wav': 'wav',
      'audio/m4a': 'm4a',
    };
    const extension = extensionMap[mimeType] || 'webm';

    // Create temporary file (Whisper API requires a file)
    const tempPath = path.join('/tmp', `audio-${Date.now()}.${extension}`);
    fs.writeFileSync(tempPath, buffer);

    console.log(`[Transcribe] Processing ${fileSizeMB.toFixed(2)}MB audio file`);

    // Call Whisper API
    const response = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempPath),
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['segment'],
    });

    // Clean up temporary file
    fs.unlinkSync(tempPath);

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
