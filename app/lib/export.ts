// Export utilities for ChoraGraph Capture PWA

import JSZip from 'jszip';
import { Project, PhotoMetadata, AudioMetadata, GpsCoordinates, CompassData, ProjectType, ProcessingStage, ProcessingResult, SessionSynthesis } from './types';

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
      compass: photo.compass,
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
  compass?: CompassData;       // Compass heading when photo was taken
  timestamp: string;           // ISO8601 absolute timestamp
  session_seconds?: number;    // Seconds into session when photo was taken (for transcript correlation)
  audio_segment?: {
    start: string;  // "HH:MM:SS" format
    end: string;
  };
  transcript?: string;         // Matched transcript text (added by desktop processing)
  entities?: string[];
  vision_analysis?: {
    description: string;
    concerns: string[];
    rec_potential: 'high' | 'medium' | 'low' | 'none';
    confidence: number;
    ai_response?: string;      // Answer to consultant's question (if detected)
  };
  tags: string[];
  // Home inventory graph-ready fields
  room?: string;
  area?: string | null;
  container?: string | null;
  items?: Array<{ name: string; attributes?: Record<string, string> }>;
  notes?: string[];
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
  // Synthesis results (Phase 5)
  synthesis?: {
    entity_clusters: Array<{
      name: string;
      type: string;
      photo_ids: string[];
      description: string;
      confidence: number;
    }>;
    location_hierarchy: Array<{
      id: string;
      name: string;
      level: string;
      parent_id?: string;
      photo_ids: string[];
      item_count: number;
    }>;
    coverage: {
      completeness_score: number;
      photographed_locations: string[];
      missing_locations: string[];
      suggested_followups: string[];
    };
  };
  processing_stage: ProcessingStage;
  graph_ready: boolean;
  version: '2.0' | '2.1' | '3.0';  // 2.1 = raw capture, 3.0 = with synthesis
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
 * Export project as a Portable Evidence Package (v2.1 - Raw Capture)
 *
 * Mobile exports raw capture data only. AI processing happens on desktop.
 *
 * Structure:
 *   site-visit-YYYY-MM-DD-uuid/
 *   ├── index.json          (metadata, processing_stage: 'captured')
 *   ├── session-audio.webm  (raw audio recording)
 *   ├── thumbnail.jpg       (project thumbnail from first photo)
 *   └── photos/
 *       ├── 001-site-photo.jpg
 *       └── ...
 */
export async function exportPortableEvidencePackage(
  project: Project,
  photos: PhotoMetadata[],
  audio: AudioMetadata[]
): Promise<Blob> {
  const zip = new JSZip();

  // Create photos folder
  const photosFolder = zip.folder('photos');
  if (!photosFolder) {
    throw new Error('Failed to create photos folder');
  }

  const photoEntries: PortablePhotoEntry[] = [];

  // Process photos - simple sequential naming (AI will add contextual names)
  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];
    const photoNumber = String(i + 1).padStart(3, '0');
    const filename = `${photoNumber}-site-photo.jpg`;

    // Add photo to zip
    const photoBlob = dataURLtoBlob(photo.imageData);
    photosFolder.file(filename, photoBlob);

    // Build photo entry for index.json (raw metadata only)
    const entry: PortablePhotoEntry = {
      filename,
      timestamp: photo.timestamp,
      session_seconds: photo.sessionTimestamp, // Relative time for transcript correlation
      tags: [], // Will be populated by desktop AI processing
    };

    // Add GPS if available
    if (photo.gps) {
      entry.gps = photo.gps;
    }

    // Add compass heading if available
    if (photo.compass) {
      entry.compass = photo.compass;
    }

    photoEntries.push(entry);
  }

  // Generate thumbnail from first photo
  if (photos.length > 0) {
    const thumbnail = await generateThumbnail(photos[0].imageData, 200, 200);
    if (thumbnail) {
      const thumbnailBlob = dataURLtoBlob(thumbnail);
      zip.file('thumbnail.jpg', thumbnailBlob);
    }
  }

  // Export audio as single session file
  if (audio.length > 0) {
    const primaryAudio = audio[0];
    const audioBlob = dataURLtoBlob(primaryAudio.audioData);
    const ext = getExtensionFromMimeType(primaryAudio.mimeType);
    zip.file(`session-audio.${ext}`, audioBlob);
  }

  // Build index.json (raw capture metadata - no AI analysis)
  const index: PortableEvidenceIndex = {
    session_id: project.launchSessionId || project.id,
    project_id: project.externalProjectId,
    project_type: project.projectType || 'phase1-esa',
    project_name: project.name,
    timestamp_start: project.createdAt,
    timestamp_end: project.modifiedAt,
    location_start: photos[0]?.gps || undefined,
    photos: photoEntries,
    // No transcript yet - will be added by desktop processing
    transcript: undefined,
    session_summary: {
      total_photos: photos.length,
      total_duration_seconds: audio[0]?.duration || 0,
      entities_extracted: {}, // Will be populated by desktop AI processing
      key_observations: [],   // Will be populated by desktop AI processing
    },
    processing_stage: 'captured', // Always 'captured' - desktop will update to 'processed'
    graph_ready: false,
    version: '2.1', // Bump version to indicate raw capture format
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
 * Generate a thumbnail from an image data URL
 */
async function generateThumbnail(imageData: string, maxWidth: number, maxHeight: number): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      // Calculate dimensions maintaining aspect ratio
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }
      if (height > maxHeight) {
        width = (width * maxHeight) / height;
        height = maxHeight;
      }

      // Create canvas and draw resized image
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(null);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = () => resolve(null);
    img.src = imageData;
  });
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

/**
 * Export project as a Portable Evidence Package with full AI processing results (v3.0)
 *
 * Includes all processing results: transcript, photo analyses, entities, and synthesis.
 *
 * Structure:
 *   inventory-YYYY-MM-DD-uuid/
 *   ├── index.json              (full metadata with synthesis)
 *   ├── session-audio.webm      (raw audio recording)
 *   ├── thumbnail.jpg           (project thumbnail)
 *   ├── transcript.txt          (plain text transcript)
 *   ├── SESSION_SUMMARY.md      (human-readable summary)
 *   ├── deliverables/           (synthesis deliverables)
 *   │   ├── room-inventory.md
 *   │   ├── item-index.md
 *   │   └── ...
 *   └── photos/
 *       ├── 001-site-photo.jpg
 *       └── ...
 */
export async function exportProcessedSession(
  project: Project,
  photos: PhotoMetadata[],
  audio: AudioMetadata[],
  processingResult: ProcessingResult
): Promise<Blob> {
  const zip = new JSZip();

  // Create folders
  const photosFolder = zip.folder('photos');
  const deliverablesFolder = zip.folder('deliverables');
  if (!photosFolder || !deliverablesFolder) {
    throw new Error('Failed to create zip folders');
  }

  const photoEntries: PortablePhotoEntry[] = [];

  // Process photos with AI analysis data
  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];
    const photoNumber = String(i + 1).padStart(3, '0');

    // Find matching analysis for this photo
    const analysis = processingResult.photoAnalyses.find(a => a.photoId === photo.id);

    // Generate descriptive filename from analysis if available
    let filename: string;
    if (analysis?.vlmDescription) {
      const shortDesc = analysis.vlmDescription.slice(0, 30).replace(/[^a-z0-9]/gi, '-').toLowerCase();
      filename = `${photoNumber}-${shortDesc}.jpg`;
    } else {
      filename = `${photoNumber}-site-photo.jpg`;
    }

    // Add photo to zip
    const photoBlob = dataURLtoBlob(photo.imageData);
    photosFolder.file(filename, photoBlob);

    // Build photo entry with analysis data
    const entry: PortablePhotoEntry = {
      filename,
      timestamp: photo.timestamp,
      session_seconds: photo.sessionTimestamp,
      tags: analysis?.catalogTags || [],
    };

    if (photo.gps) {
      entry.gps = photo.gps;
    }

    if (photo.compass) {
      entry.compass = photo.compass;
    }

    if (analysis) {
      entry.vision_analysis = {
        description: analysis.vlmDescription,
        concerns: analysis.entities
          .filter(e => e.severity === 'high' || e.severity === 'medium')
          .map(e => e.description),
        rec_potential: 'none',  // Default for home inventory
        confidence: 0.9,
      };
      entry.entities = analysis.entities.map(e => e.description);

      // Preserve home-inventory graph-ready fields
      if (analysis.room) {
        entry.room = analysis.room;
        entry.area = analysis.area ?? null;
        entry.container = analysis.container ?? null;
        entry.items = analysis.items;
        entry.notes = analysis.entities
          .filter(e => e.type === 'note')
          .map(e => e.description);
      }
    }

    photoEntries.push(entry);
  }

  // Generate thumbnail
  if (photos.length > 0) {
    const thumbnail = await generateThumbnail(photos[0].imageData, 200, 200);
    if (thumbnail) {
      const thumbnailBlob = dataURLtoBlob(thumbnail);
      zip.file('thumbnail.jpg', thumbnailBlob);
    }
  }

  // Export audio
  if (audio.length > 0) {
    const primaryAudio = audio[0];
    const audioBlob = dataURLtoBlob(primaryAudio.audioData);
    const ext = getExtensionFromMimeType(primaryAudio.mimeType);
    zip.file(`session-audio.${ext}`, audioBlob);
  }

  // Add plain text transcript
  if (processingResult.transcript?.fullText) {
    zip.file('transcript.txt', processingResult.transcript.fullText);
  }

  // Add synthesis deliverables as separate files
  if (processingResult.synthesis?.deliverables) {
    for (const deliverable of processingResult.synthesis.deliverables) {
      const ext = deliverable.format === 'json' ? 'json' : 'md';
      const filename = `${deliverable.type}.${ext}`;
      zip.file(`deliverables/${filename}`, deliverable.content);
    }
  }

  // Generate SESSION_SUMMARY.md
  const sessionSummary = generateSessionSummaryMd(project, photos, audio, processingResult);
  zip.file('SESSION_SUMMARY.md', sessionSummary);

  // Build synthesis data for index.json
  const synthesisData = processingResult.synthesis ? {
    entity_clusters: processingResult.synthesis.entityClusters.map(c => ({
      name: c.canonicalName,
      type: c.entityType,
      photo_ids: c.photoIds,
      description: c.mergedDescription,
      confidence: c.confidence,
    })),
    location_hierarchy: processingResult.synthesis.locationHierarchy.map(l => ({
      id: l.id,
      name: l.name,
      level: l.level,
      parent_id: l.parentId,
      photo_ids: l.photoIds,
      item_count: l.itemCount,
    })),
    coverage: {
      completeness_score: processingResult.synthesis.coverageAnalysis.completenessScore,
      photographed_locations: processingResult.synthesis.coverageAnalysis.photographedLocations,
      missing_locations: processingResult.synthesis.coverageAnalysis.missingLocations,
      suggested_followups: processingResult.synthesis.coverageAnalysis.suggestedFollowups,
    },
  } : undefined;

  // Count entities by type
  const entitiesByType: Record<string, number> = {};
  for (const analysis of processingResult.photoAnalyses) {
    for (const entity of analysis.entities) {
      const type = entity.type || 'unknown';
      entitiesByType[type] = (entitiesByType[type] || 0) + 1;
    }
  }

  // Build index.json
  const index: PortableEvidenceIndex = {
    session_id: project.launchSessionId || project.id,
    project_id: project.externalProjectId,
    project_type: project.projectType || 'home-inventory',
    project_name: project.name,
    timestamp_start: project.createdAt,
    timestamp_end: project.modifiedAt,
    location_start: photos[0]?.gps || undefined,
    photos: photoEntries,
    transcript: processingResult.transcript ? {
      full_text: processingResult.transcript.fullText,
      language: processingResult.transcript.language,
      duration_seconds: processingResult.transcript.duration,
      segments: processingResult.transcript.segments,
    } : undefined,
    session_summary: {
      total_photos: photos.length,
      total_duration_seconds: audio[0]?.duration || 0,
      entities_extracted: entitiesByType,
      key_observations: processingResult.photoAnalyses
        .slice(0, 5)
        .map(a => a.vlmDescription)
        .filter(Boolean),
    },
    synthesis: synthesisData,
    processing_stage: 'graph_ready',
    graph_ready: true,
    version: '3.0',
  };

  zip.file('index.json', JSON.stringify(index, null, 2));

  // Generate zip
  return await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
}

/**
 * Generate human-readable SESSION_SUMMARY.md
 */
function generateSessionSummaryMd(
  project: Project,
  photos: PhotoMetadata[],
  audio: AudioMetadata[],
  processingResult: ProcessingResult
): string {
  const lines: string[] = [];

  lines.push(`# ${project.name}`);
  lines.push('');
  lines.push(`**Project Type:** ${project.projectType || 'generic'}`);
  lines.push(`**Captured:** ${new Date(project.createdAt).toLocaleString()}`);
  lines.push(`**Photos:** ${photos.length}`);
  lines.push(`**Audio Duration:** ${Math.round((audio[0]?.duration || 0) / 60)} minutes`);
  lines.push('');

  // Location info
  if (photos[0]?.gps) {
    const gps = photos[0].gps;
    lines.push(`**Location:** ${gps.latitude.toFixed(5)}, ${gps.longitude.toFixed(5)}`);
    lines.push('');
  }

  // Synthesis summary
  if (processingResult.synthesis) {
    const synthesis = processingResult.synthesis;

    lines.push('## Summary');
    lines.push('');
    lines.push(`- **Completeness:** ${Math.round(synthesis.coverageAnalysis.completenessScore * 100)}%`);
    lines.push(`- **Items Identified:** ${synthesis.entityClusters.filter(c => c.entityType === 'item').length}`);
    lines.push(`- **Locations Found:** ${synthesis.locationHierarchy.filter(l => l.level === 'room').length} rooms`);
    lines.push('');

    // Missing locations
    if (synthesis.coverageAnalysis.missingLocations.length > 0) {
      lines.push('### Areas to Document');
      for (const loc of synthesis.coverageAnalysis.missingLocations) {
        lines.push(`- ${loc}`);
      }
      lines.push('');
    }

    // Deliverables list
    if (synthesis.deliverables.length > 0) {
      lines.push('## Deliverables');
      lines.push('');
      for (const d of synthesis.deliverables) {
        lines.push(`- **${d.title}** - \`deliverables/${d.type}.md\``);
      }
      lines.push('');
    }
  }

  // Transcript excerpt
  if (processingResult.transcript?.fullText) {
    lines.push('## Transcript Excerpt');
    lines.push('');
    lines.push('```');
    lines.push(processingResult.transcript.fullText.slice(0, 500) + '...');
    lines.push('```');
    lines.push('');
  }

  // Photo observations
  if (processingResult.photoAnalyses.length > 0) {
    lines.push('## Photo Observations');
    lines.push('');
    for (const analysis of processingResult.photoAnalyses.slice(0, 10)) {
      lines.push(`- ${analysis.vlmDescription}`);
    }
    if (processingResult.photoAnalyses.length > 10) {
      lines.push(`- ... and ${processingResult.photoAnalyses.length - 10} more photos`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Generate filename for processed session export
 */
export function generateProcessedFilename(projectName: string, projectType: ProjectType): string {
  const sanitized = sanitizeFilename(projectName);
  const date = new Date().toISOString().split('T')[0];
  const shortId = crypto.randomUUID().slice(0, 8);
  const prefix = projectType === 'home-inventory' ? 'inventory' : 'session';
  return `${prefix}-${date}-${sanitized}-${shortId}.zip`;
}
