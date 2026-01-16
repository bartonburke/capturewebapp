// API Route: Transcribe Audio with OpenAI Whisper
// Receives base64 audio, converts to file, transcribes, returns structured transcript

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

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

    // Check file size
    const fileSizeMB = buffer.length / (1024 * 1024);
    console.log(`[Transcribe] Received ${fileSizeMB.toFixed(2)}MB audio file`);

    // Determine file extension from MIME type
    const extensionMap: Record<string, string> = {
      'audio/webm': 'webm',
      'audio/mp4': 'mp4',
      'audio/mpeg': 'mp3',
      'audio/wav': 'wav',
      'audio/m4a': 'm4a',
    };
    const extension = extensionMap[mimeType] || 'webm';

    // Create temporary file
    const tempPath = path.join('/tmp', `audio-${Date.now()}.${extension}`);
    fs.writeFileSync(tempPath, buffer);

    let finalPath = tempPath;

    // If file is too large for Whisper (>25MB), compress with ffmpeg
    if (fileSizeMB > 24) {
      console.log(`[Transcribe] File too large, compressing with ffmpeg...`);

      const compressedPath = path.join('/tmp', `audio-${Date.now()}-compressed.mp3`);

      try {
        // Convert to MP3 with lower bitrate (64kbps is fine for speech)
        // -ac 1 = mono, -ar 16000 = 16kHz sample rate (optimal for speech)
        execSync(
          `ffmpeg -i "${tempPath}" -vn -ac 1 -ar 16000 -ab 64k -f mp3 "${compressedPath}" -y`,
          { stdio: 'pipe' }
        );

        // Check compressed size
        const compressedStats = fs.statSync(compressedPath);
        const compressedSizeMB = compressedStats.size / (1024 * 1024);
        console.log(`[Transcribe] Compressed to ${compressedSizeMB.toFixed(2)}MB`);

        if (compressedSizeMB > 25) {
          // Still too large even after compression
          fs.unlinkSync(tempPath);
          fs.unlinkSync(compressedPath);
          return NextResponse.json(
            { error: `Audio too long. Compressed size: ${compressedSizeMB.toFixed(2)}MB (max 25MB). Try a shorter recording.` },
            { status: 413 }
          );
        }

        // Use compressed file
        finalPath = compressedPath;

      } catch (ffmpegError: any) {
        console.error('[Transcribe] ffmpeg compression failed:', ffmpegError.message);
        // Fall back to original file and let Whisper reject if too large
        console.log('[Transcribe] Falling back to original file...');
      }
    }

    console.log(`[Transcribe] Processing audio file: ${finalPath}`);

    // Call Whisper API
    const response = await openai.audio.transcriptions.create({
      file: fs.createReadStream(finalPath),
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['segment'],
    });

    // Clean up temporary files
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    if (finalPath !== tempPath && fs.existsSync(finalPath)) fs.unlinkSync(finalPath);

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
