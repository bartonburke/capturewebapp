// Export utilities for ChoraGraph Capture PWA

import JSZip from 'jszip';
import { Project, PhotoMetadata, AudioMetadata, ProcessingResult, GpsCoordinates, ProjectType, ProcessingStage } from './types';

interface ExportData {
  project: Omit<Project, 'photoCount' | 'audioCount'>;
  photos: Array<Omit<PhotoMetadata, 'imageData'> & { filename: string }>;
  audio: Array<Omit<AudioMetadata, 'audioData'> & { filename: string }>;
  exportedAt: string;
  version: string;
}

/**
 * Convert base64 data URL to Blob
 */
function dataURLtoBlob(dataURL: string): Blob {
  const arr = dataURL.split(',');
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

/**
 * Get file extension from MIME type
 */
function getExtensionFromMimeType(mimeType: string): string {
  const mimeMap: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'audio/webm': 'webm',
    'audio/mp4': 'mp4',
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
  };
  return mimeMap[mimeType] || 'bin';
}

/**
 * Sanitize filename by removing invalid characters
 */
function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-z0-9-_]/gi, '-')
    .replace(/-+/g, '-')
    .toLowerCase();
}

/**
 * Export project as a zip archive with JSON metadata and separate media files
 */
export async function exportProject(
  project: Project,
  photos: PhotoMetadata[],
  audio: AudioMetadata[]
): Promise<Blob> {
  const zip = new JSZip();

  // Create folders
  const photosFolder = zip.folder('photos');
  const audioFolder = zip.folder('audio');

  if (!photosFolder || !audioFolder) {
    throw new Error('Failed to create zip folders');
  }

  // Process photos
  const photoMetadata = photos.map((photo, index) => {
    const photoNumber = String(index + 1).padStart(3, '0');
    const timestamp = new Date(photo.timestamp).toISOString().replace(/[:.]/g, '-');
    const filename = `photo-${photoNumber}-${timestamp}.jpg`;

    // Add photo to zip
    const photoBlob = dataURLtoBlob(photo.imageData);
    photosFolder.file(filename, photoBlob);

    // Return metadata without base64 data
    return {
      id: photo.id,
      projectId: photo.projectId,
      timestamp: photo.timestamp,
      sessionTimestamp: photo.sessionTimestamp,
      gps: photo.gps,
      filename,
    };
  });

  // Process audio
  const audioMetadata = audio.map((audioItem, index) => {
    const audioNumber = String(index + 1).padStart(3, '0');
    const sessionId = audioItem.sessionId.slice(0, 8);
    const extension = getExtensionFromMimeType(audioItem.mimeType);
    const filename = `audio-${audioNumber}-session-${sessionId}.${extension}`;

    // Add audio to zip
    const audioBlob = dataURLtoBlob(audioItem.audioData);
    audioFolder.file(filename, audioBlob);

    // Return metadata without base64 data
    return {
      id: audioItem.id,
      projectId: audioItem.projectId,
      sessionId: audioItem.sessionId,
      timestamp: audioItem.timestamp,
      duration: audioItem.duration,
      mimeType: audioItem.mimeType,
      fileSize: audioItem.fileSize,
      filename,
    };
  });

  // Create metadata JSON
  const exportData: ExportData = {
    project: {
      id: project.id,
      name: project.name,
      lead: project.lead,
      notes: project.notes,
      createdAt: project.createdAt,
      modifiedAt: project.modifiedAt,
      projectType: project.projectType,
      externalProjectId: project.externalProjectId,
      launchSessionId: project.launchSessionId,
      context: project.context,
      processingStage: project.processingStage,
    },
    photos: photoMetadata,
    audio: audioMetadata,
    exportedAt: new Date().toISOString(),
    version: '1.0',
  };

  // Add metadata JSON to zip root
  zip.file('project.json', JSON.stringify(exportData, null, 2));

  // Generate zip file
  const zipBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  return zipBlob;
}

/**
 * Download a blob as a file
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generate filename for export
 */
export function generateExportFilename(projectName: string): string {
  const sanitized = sanitizeFilename(projectName);
  const date = new Date().toISOString().split('T')[0];
  return `${sanitized}-${date}.zip`;
}

// ============================================================
// Portable Evidence Package Export (v2.0)
// ============================================================

// Photo entry in portable evidence package index.json
interface PortablePhotoEntry {
  filename: string;
  gps?: GpsCoordinates;
  timestamp: string;
  audio_segment?: {
    start: string;  // "HH:MM:SS" format
    end: string;
  };
  transcript?: string;
  entities?: string[];
  vision_analysis?: {
    description: string;
    concerns: string[];
    rec_potential: 'high' | 'medium' | 'low' | 'none';
    confidence: number;
  };
  tags: string[];
}

// Portable evidence package index.json schema
interface PortableEvidenceIndex {
  session_id: string;
  project_id?: string;
  project_type: ProjectType;
  project_name: string;
  timestamp_start: string;
  timestamp_end: string;
  location_start?: GpsCoordinates;
  photos: PortablePhotoEntry[];
  // Full audio transcript included in JSON for programmatic access
  transcript?: {
    full_text: string;
    language?: string;
    duration_seconds: number;
    segments?: Array<{
      start: number;
      end: number;
      text: string;
    }>;
  };
  session_summary: {
    total_photos: number;
    total_duration_seconds: number;
    entities_extracted: Record<string, number>;
    key_observations: string[];
  };
  processing_stage: ProcessingStage;
  graph_ready: boolean;
  version: '2.0';
}

/**
 * Format seconds as HH:MM:SS string
 */
function formatTimestamp(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Determine REC potential from photo analysis
 */
function determineRecPotential(analysis: ProcessingResult['photoAnalyses'][0]): 'high' | 'medium' | 'low' | 'none' {
  if (!analysis?.entities?.length) return 'none';

  const hasHighSeverity = analysis.entities.some(e => e.severity === 'high');
  const hasMediumSeverity = analysis.entities.some(e => e.severity === 'medium');
  const hasRec = analysis.entities.some(e => e.type === 'REC');

  if (hasRec || hasHighSeverity) return 'high';
  if (hasMediumSeverity) return 'medium';
  return 'low';
}

/**
 * Count entities from processing result
 */
function countEntities(result?: ProcessingResult): Record<string, number> {
  if (!result?.photoAnalyses) return {};

  const counts: Record<string, number> = {};
  for (const analysis of result.photoAnalyses) {
    if (analysis.entities) {
      for (const entity of analysis.entities) {
        counts[entity.type] = (counts[entity.type] || 0) + 1;
      }
    }
  }
  return counts;
}

/**
 * Extract key observations from processing result
 */
function extractKeyObservations(result?: ProcessingResult): string[] {
  if (!result?.photoAnalyses) return [];

  const observations: string[] = [];

  // Get high-severity findings
  for (const analysis of result.photoAnalyses) {
    if (analysis.entities) {
      for (const entity of analysis.entities) {
        if (entity.severity === 'high' || entity.type === 'REC') {
          observations.push(entity.description);
        }
      }
    }
  }

  // Limit to 10 key observations
  return observations.slice(0, 10);
}

/**
 * Export project as a Portable Evidence Package (v2.0)
 * Structure:
 *   site-visit-YYYY-MM-DD-uuid/
 *   ├── index.json
 *   ├── session-audio.m4a
 *   ├── transcript.txt
 *   └── photos/
 *       ├── 001-contextual-name.jpg
 *       └── ...
 */
export async function exportPortableEvidencePackage(
  project: Project,
  photos: PhotoMetadata[],
  audio: AudioMetadata[],
  processingResult?: ProcessingResult
): Promise<Blob> {
  const zip = new JSZip();

  // Create photos folder
  const photosFolder = zip.folder('photos');
  if (!photosFolder) {
    throw new Error('Failed to create photos folder');
  }

  const photoEntries: PortablePhotoEntry[] = [];

  // Process photos with contextual filenames
  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];
    const analysis = processingResult?.photoAnalyses?.find(pa => pa.photoId === photo.id);

    // Generate contextual filename from analysis tags
    const photoNumber = String(i + 1).padStart(3, '0');
    let contextSuffix = 'site-photo';

    if (analysis?.catalogTags?.length) {
      // Use first 2 tags for filename context
      contextSuffix = analysis.catalogTags
        .slice(0, 2)
        .map(tag => sanitizeFilename(tag))
        .join('-');
    }

    const filename = `${photoNumber}-${contextSuffix}.jpg`;

    // Add photo to zip
    const photoBlob = dataURLtoBlob(photo.imageData);
    photosFolder.file(filename, photoBlob);

    // Build photo entry for index.json
    const entry: PortablePhotoEntry = {
      filename,
      timestamp: photo.timestamp,
      tags: analysis?.catalogTags || [],
    };

    // Add GPS if available
    if (photo.gps) {
      entry.gps = photo.gps;
    }

    // Add transcript segment if correlated
    if (analysis?.transcriptSegment) {
      entry.audio_segment = {
        start: formatTimestamp(analysis.transcriptSegment.start),
        end: formatTimestamp(analysis.transcriptSegment.end),
      };
      entry.transcript = analysis.transcriptSegment.text;
    }

    // Add entities if extracted
    if (analysis?.entities?.length) {
      entry.entities = analysis.entities.map(e => e.type);
    }

    // Add vision analysis if available
    if (analysis?.vlmDescription) {
      entry.vision_analysis = {
        description: analysis.vlmDescription,
        concerns: analysis.entities?.map(e => e.description) || [],
        rec_potential: determineRecPotential(analysis),
        confidence: 0.85, // Could be enhanced with actual confidence scores
      };
    }

    photoEntries.push(entry);
  }

  // Export audio as single session file (not in subfolder)
  if (audio.length > 0) {
    const primaryAudio = audio[0];
    const audioBlob = dataURLtoBlob(primaryAudio.audioData);
    const ext = getExtensionFromMimeType(primaryAudio.mimeType);
    zip.file(`session-audio.${ext}`, audioBlob);
  }

  // Export transcript as plain text
  if (processingResult?.transcript?.fullText) {
    zip.file('transcript.txt', processingResult.transcript.fullText);
  }

  // Build index.json
  const index: PortableEvidenceIndex = {
    session_id: project.launchSessionId || project.id,
    project_id: project.externalProjectId,
    project_type: project.projectType || 'phase1-esa',
    project_name: project.name,
    timestamp_start: project.createdAt,
    timestamp_end: project.modifiedAt,
    location_start: photos[0]?.gps || undefined,
    photos: photoEntries,
    // Include full transcript in JSON for programmatic access
    transcript: processingResult?.transcript ? {
      full_text: processingResult.transcript.fullText,
      language: processingResult.transcript.language,
      duration_seconds: processingResult.transcript.duration,
      segments: processingResult.transcript.segments?.map(seg => ({
        start: seg.start,
        end: seg.end,
        text: seg.text,
      })),
    } : undefined,
    session_summary: {
      total_photos: photos.length,
      total_duration_seconds: audio[0]?.duration || 0,
      entities_extracted: countEntities(processingResult),
      key_observations: extractKeyObservations(processingResult),
    },
    processing_stage: project.processingStage || 'captured',
    graph_ready: project.processingStage === 'graph_ready',
    version: '2.0',
  };

  zip.file('index.json', JSON.stringify(index, null, 2));

  // Generate zip file
  const zipBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  return zipBlob;
}

/**
 * Generate filename for portable evidence package
 */
export function generatePortableFilename(projectName: string): string {
  const sanitized = sanitizeFilename(projectName);
  const date = new Date().toISOString().split('T')[0];
  const shortId = crypto.randomUUID().slice(0, 8);
  return `site-visit-${date}-${sanitized}-${shortId}.zip`;
}
