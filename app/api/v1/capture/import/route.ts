// API Route: Import Portable Evidence Package
// Receives zip file, extracts to evidence/sessions/{sessionId}/
// Generates SESSION_SUMMARY.md for Claude Code context

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';

// Evidence storage base path
const EVIDENCE_BASE = process.env.EVIDENCE_BASE_PATH || './evidence/sessions';

interface ImportResponse {
  success: boolean;
  sessionId: string;
  outputPath: string;
  summary: {
    projectName: string;
    projectType: string;
    photoCount: number;
    hasTranscript: boolean;
    hasAudio: boolean;
    processingStage: string;
  };
  error?: string;
}

interface PortableEvidenceIndex {
  session_id: string;
  project_id?: string;
  project_type: string;
  project_name: string;
  timestamp_start: string;
  timestamp_end: string;
  location_start?: {
    latitude: number;
    longitude: number;
    accuracy: number;
  };
  photos: Array<{
    filename: string;
    gps?: { latitude: number; longitude: number; accuracy: number };
    timestamp: string;
    entities?: string[];
    vision_analysis?: {
      description: string;
      concerns: string[];
      rec_potential: string;
      confidence: number;
    };
    tags: string[];
  }>;
  transcript?: {
    full_text: string;
    language?: string;
    duration_seconds: number;
  };
  session_summary: {
    total_photos: number;
    total_duration_seconds: number;
    entities_extracted: Record<string, number>;
    key_observations: string[];
  };
  processing_stage: string;
  graph_ready: boolean;
  version: string;
}

/**
 * Generate SESSION_SUMMARY.md from index.json
 */
function generateSessionSummary(index: PortableEvidenceIndex): string {
  const lines: string[] = [
    `# Field Capture Session: ${index.project_name}`,
    '',
    `**Session ID:** ${index.session_id}`,
    `**Project Type:** ${formatProjectType(index.project_type)}`,
    `**Captured:** ${new Date(index.timestamp_start).toLocaleString()}`,
    '',
    '## Session Summary',
    '',
    `- **Photos:** ${index.session_summary.total_photos}`,
    `- **Audio Recording:** ${index.session_summary.total_duration_seconds > 0 ? `Yes (${index.session_summary.total_duration_seconds.toFixed(1)} seconds)` : 'No'}`,
    `- **Transcript:** ${index.transcript ? 'Yes' : 'No'}`,
    `- **Processing Stage:** ${index.processing_stage}`,
    `- **Graph Ready:** ${index.graph_ready ? 'Yes' : 'No'}`,
    '',
  ];

  // Add location if available
  if (index.location_start) {
    lines.push('## Location');
    lines.push('');
    lines.push(`- **Latitude:** ${index.location_start.latitude}`);
    lines.push(`- **Longitude:** ${index.location_start.longitude}`);
    lines.push(`- **Accuracy:** ${index.location_start.accuracy.toFixed(1)}m`);
    lines.push('');
  }

  // Add entity summary
  if (index.session_summary.entities_extracted) {
    const entities = index.session_summary.entities_extracted;
    if (Object.keys(entities).length > 0) {
      lines.push('## Entities Extracted');
      lines.push('');
      for (const [type, count] of Object.entries(entities)) {
        lines.push(`- **${type}:** ${count}`);
      }
      lines.push('');
    }
  }

  // Add transcript excerpt
  if (index.transcript?.full_text) {
    lines.push('## Transcript');
    lines.push('');
    const excerpt = index.transcript.full_text.slice(0, 500);
    lines.push(`> ${excerpt}${index.transcript.full_text.length > 500 ? '...' : ''}`);
    lines.push('');
  }

  // Add photo observations (only those with vision analysis)
  const photosWithAnalysis = index.photos.filter(p => p.vision_analysis?.description);
  if (photosWithAnalysis.length > 0) {
    lines.push('## Photo Observations');
    lines.push('');
    for (const photo of photosWithAnalysis) {
      lines.push(`### ${photo.filename}`);
      lines.push('');
      lines.push(photo.vision_analysis!.description);
      lines.push('');
      if (photo.vision_analysis!.rec_potential !== 'none' && photo.vision_analysis!.rec_potential !== 'low') {
        lines.push(`**REC Potential:** ${photo.vision_analysis!.rec_potential}`);
        lines.push('');
      }
    }
  }

  // Add key observations
  if (index.session_summary.key_observations?.length > 0) {
    lines.push('## Key Observations');
    lines.push('');
    for (const obs of index.session_summary.key_observations) {
      lines.push(`- ${obs}`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push(`*Imported from Portable Evidence Package v${index.version}*`);

  return lines.join('\n');
}

/**
 * Format project type for display
 */
function formatProjectType(type: string): string {
  const typeMap: Record<string, string> = {
    'phase1-esa': 'Phase I ESA',
    'eir-eis': 'EIR/EIS',
    'borehole': 'Borehole',
    'generic': 'Site Visit',
  };
  return typeMap[type] || type;
}

export async function POST(req: NextRequest) {
  try {
    // Parse multipart form data
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const sessionIdFromForm = formData.get('sessionId') as string | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'Missing file in form data' } as ImportResponse,
        { status: 400 }
      );
    }

    // Read file as buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log(`[Import] Received ${(buffer.length / 1024 / 1024).toFixed(2)}MB zip file`);

    // Extract zip
    const zip = new AdmZip(buffer);
    const entries = zip.getEntries();

    // Find and parse index.json
    const indexEntry = entries.find(e => e.entryName === 'index.json');
    if (!indexEntry) {
      return NextResponse.json(
        { success: false, error: 'Invalid package: missing index.json' } as ImportResponse,
        { status: 400 }
      );
    }

    const indexData: PortableEvidenceIndex = JSON.parse(indexEntry.getData().toString('utf8'));

    // Validate version
    if (indexData.version !== '2.0') {
      console.warn(`[Import] Package version is ${indexData.version}, expected 2.0`);
    }

    const sessionId = sessionIdFromForm || indexData.session_id;
    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'Invalid package: missing session_id' } as ImportResponse,
        { status: 400 }
      );
    }

    // Resolve evidence base path
    const evidenceBase = path.resolve(process.cwd(), EVIDENCE_BASE);
    const outputPath = path.join(evidenceBase, sessionId);
    const relativePath = `evidence/sessions/${sessionId}`;

    console.log(`[Import] Extracting to: ${outputPath}`);

    // Clean up existing session if present
    if (fs.existsSync(outputPath)) {
      console.log(`[Import] Session ${sessionId} exists, overwriting...`);
      fs.rmSync(outputPath, { recursive: true });
    }

    // Create directories
    fs.mkdirSync(outputPath, { recursive: true });
    fs.mkdirSync(path.join(outputPath, 'photos'), { recursive: true });

    // Extract files
    let photoCount = 0;
    let hasTranscript = false;
    let hasAudio = false;

    for (const entry of entries) {
      const entryName = entry.entryName;

      // Skip directories
      if (entry.isDirectory) continue;

      // Determine output location
      let outputFile: string;

      if (entryName === 'index.json') {
        outputFile = path.join(outputPath, 'index.json');
      } else if (entryName === 'transcript.txt') {
        outputFile = path.join(outputPath, 'transcript.txt');
        hasTranscript = true;
      } else if (entryName.startsWith('session-audio.')) {
        outputFile = path.join(outputPath, entryName);
        hasAudio = true;
      } else if (entryName.startsWith('photos/')) {
        const photoName = path.basename(entryName);
        if (photoName) {
          outputFile = path.join(outputPath, 'photos', photoName);
          photoCount++;
        } else {
          continue;
        }
      } else {
        // Unknown file, extract anyway
        outputFile = path.join(outputPath, entryName);
      }

      // Write file
      fs.writeFileSync(outputFile, entry.getData());
    }

    // Generate SESSION_SUMMARY.md
    const summary = generateSessionSummary(indexData);
    fs.writeFileSync(path.join(outputPath, 'SESSION_SUMMARY.md'), summary);

    console.log(`[Import] Success: ${photoCount} photos, transcript=${hasTranscript}, audio=${hasAudio}`);

    const response: ImportResponse = {
      success: true,
      sessionId,
      outputPath: relativePath,
      summary: {
        projectName: indexData.project_name,
        projectType: indexData.project_type,
        photoCount,
        hasTranscript,
        hasAudio,
        processingStage: indexData.processing_stage,
      },
    };

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('[Import] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Import failed' } as ImportResponse,
      { status: 500 }
    );
  }
}
