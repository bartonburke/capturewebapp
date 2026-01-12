// Export utilities for ChoraGraph Capture PWA

import JSZip from 'jszip';
import { Project, PhotoMetadata, AudioMetadata } from './types';

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
