import exifr from 'exifr';
import { GpsCoordinates } from './types';

export interface ExifData {
  gps: GpsCoordinates | null;
  timestamp: string | null;
  cameraInfo: string | null;
}

/**
 * Extract EXIF metadata from an image file
 * Returns GPS coordinates, timestamp, and camera info if available
 */
export async function extractExifData(file: File): Promise<ExifData> {
  try {
    // Parse EXIF data from the file
    const exif = await exifr.parse(file, {
      // Only parse the tags we need for efficiency
      pick: ['GPSLatitude', 'GPSLongitude', 'GPSAltitude', 'DateTimeOriginal', 'CreateDate', 'Make', 'Model'],
      gps: true, // Enable GPS parsing (converts to decimal degrees)
    });

    if (!exif) {
      return { gps: null, timestamp: null, cameraInfo: null };
    }

    // Extract GPS coordinates
    let gps: GpsCoordinates | null = null;
    if (exif.latitude !== undefined && exif.longitude !== undefined) {
      gps = {
        latitude: exif.latitude,
        longitude: exif.longitude,
        accuracy: 10, // EXIF doesn't include accuracy, use reasonable default
        timestamp: Date.now(),
      };
    }

    // Extract timestamp (try DateTimeOriginal first, then CreateDate)
    let timestamp: string | null = null;
    if (exif.DateTimeOriginal) {
      timestamp = new Date(exif.DateTimeOriginal).toISOString();
    } else if (exif.CreateDate) {
      timestamp = new Date(exif.CreateDate).toISOString();
    }

    // Extract camera info
    let cameraInfo: string | null = null;
    if (exif.Make || exif.Model) {
      const parts = [exif.Make, exif.Model].filter(Boolean);
      cameraInfo = parts.join(' ');
    }

    return { gps, timestamp, cameraInfo };
  } catch (error) {
    console.error('[EXIF] Failed to extract EXIF data:', error);
    return { gps: null, timestamp: null, cameraInfo: null };
  }
}

/**
 * Convert a File to base64 data URL
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read file as base64'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}
