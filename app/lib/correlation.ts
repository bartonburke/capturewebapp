/**
 * Phase 3: Photo-Transcript Correlation
 *
 * Matches photos to transcript segments based on timestamps.
 * When a consultant is narrating while taking photos, this links
 * what they said to what they photographed.
 */

import { PhotoMetadata, Transcript, TranscriptSegment } from './types';

/** Maximum seconds between photo and transcript segment for correlation */
export const CORRELATION_THRESHOLD_SECONDS = 15;

/**
 * Correlate photos to transcript segments based on session timestamps.
 *
 * Algorithm:
 * 1. For each photo, check if sessionTimestamp falls within a segment's start-end range
 * 2. If no exact match, find the closest segment within threshold
 * 3. Return null if no segment is within threshold
 *
 * @param photos - Photos with sessionTimestamp (seconds into recording)
 * @param transcript - Transcript with segments having start/end times
 * @returns Map of photoId to matched TranscriptSegment (or null)
 */
export function correlatePhotosToTranscript(
  photos: PhotoMetadata[],
  transcript: Transcript
): Map<string, TranscriptSegment | null> {
  const correlations = new Map<string, TranscriptSegment | null>();

  // Handle edge case: no segments
  if (!transcript.segments || transcript.segments.length === 0) {
    for (const photo of photos) {
      correlations.set(photo.id, null);
    }
    return correlations;
  }

  for (const photo of photos) {
    const photoTime = photo.sessionTimestamp;

    // Handle invalid timestamp
    if (photoTime < 0 || !Number.isFinite(photoTime)) {
      correlations.set(photo.id, null);
      continue;
    }

    let bestMatch: TranscriptSegment | null = null;
    let bestDistance = Infinity;

    for (const segment of transcript.segments) {
      // Strategy 1: Exact match - photo taken during this segment
      if (photoTime >= segment.start && photoTime <= segment.end) {
        bestMatch = segment;
        bestDistance = 0;
        break; // Can't do better than exact match
      }

      // Strategy 2: Find closest segment within threshold
      // Calculate distance to segment (closest edge or midpoint)
      let distance: number;

      if (photoTime < segment.start) {
        // Photo before segment - distance to start
        distance = segment.start - photoTime;
      } else {
        // Photo after segment - distance to end
        distance = photoTime - segment.end;
      }

      if (distance < bestDistance && distance <= CORRELATION_THRESHOLD_SECONDS) {
        bestMatch = segment;
        bestDistance = distance;
      }
    }

    correlations.set(photo.id, bestMatch);
  }

  return correlations;
}

/**
 * Format seconds as M:SS for display
 */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '0:00';
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Get correlation statistics for debugging/display
 */
export function getCorrelationStats(
  correlations: Map<string, TranscriptSegment | null>
): { matched: number; unmatched: number; total: number } {
  let matched = 0;
  let unmatched = 0;

  for (const segment of correlations.values()) {
    if (segment !== null) {
      matched++;
    } else {
      unmatched++;
    }
  }

  return {
    matched,
    unmatched,
    total: matched + unmatched
  };
}
