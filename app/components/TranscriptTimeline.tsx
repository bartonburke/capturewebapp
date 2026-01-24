'use client';

import { useState } from 'react';
import { Transcript, TranscriptSegment, PhotoMetadata, PhotoAnalysis } from '../lib/types';
import { formatDuration } from '../lib/correlation';

interface TimelineProps {
  transcript: Transcript;
  photos: PhotoMetadata[];
  photoAnalyses: PhotoAnalysis[];
  onPhotoClick: (photoId: string) => void;
}

/**
 * Visual timeline showing transcript segments with photo markers.
 * Allows users to see the relationship between what was said and what was photographed.
 */
export default function TranscriptTimeline({
  transcript,
  photos,
  photoAnalyses,
  onPhotoClick
}: TimelineProps) {
  const [expanded, setExpanded] = useState(false);

  // Handle edge cases
  if (!transcript.segments || transcript.segments.length === 0) {
    return null;
  }

  const duration = transcript.duration ||
    Math.max(...transcript.segments.map(s => s.end), ...photos.map(p => p.sessionTimestamp));

  // Calculate position percentage for each photo
  const getPhotoPosition = (sessionTimestamp: number): number => {
    if (duration <= 0) return 0;
    return Math.min(100, Math.max(0, (sessionTimestamp / duration) * 100));
  };

  // Find photos that match each segment
  const getPhotosForSegment = (segment: TranscriptSegment): PhotoMetadata[] => {
    return photos.filter(photo => {
      const analysis = photoAnalyses.find(pa => pa.photoId === photo.id);
      if (!analysis?.transcriptSegment) return false;
      return analysis.transcriptSegment.start === segment.start &&
             analysis.transcriptSegment.end === segment.end;
    });
  };

  // Count matched photos
  const matchedCount = photoAnalyses.filter(pa => pa.transcriptSegment !== null).length;

  return (
    <div className="mt-4 border-t border-gray-700 pt-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-sm font-medium text-gray-300 hover:text-white transition-colors w-full"
      >
        <svg
          className={`w-4 h-4 transition-transform ${expanded ? 'rotate-90' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span>Timeline View</span>
        <span className="text-gray-500 text-xs ml-2">
          ({photos.length} photos, {transcript.segments.length} segments, {matchedCount} matched)
        </span>
      </button>

      {expanded && (
        <div className="mt-4 space-y-4">
          {/* Visual Timeline Bar */}
          <div className="relative h-10 bg-gray-800 rounded-lg overflow-visible">
            {/* Segment backgrounds (speech periods) */}
            {transcript.segments.map((segment, idx) => {
              const left = (segment.start / duration) * 100;
              const width = ((segment.end - segment.start) / duration) * 100;
              return (
                <div
                  key={idx}
                  className="absolute top-0 h-full bg-purple-900/50 border-r border-purple-700/50"
                  style={{
                    left: `${left}%`,
                    width: `${Math.max(0.5, width)}%`
                  }}
                  title={`${formatDuration(segment.start)} - ${formatDuration(segment.end)}`}
                />
              );
            })}

            {/* Photo markers */}
            {photos.map((photo) => {
              const position = getPhotoPosition(photo.sessionTimestamp);
              const analysis = photoAnalyses.find(pa => pa.photoId === photo.id);
              const isMatched = analysis?.transcriptSegment !== null;

              return (
                <button
                  key={photo.id}
                  onClick={() => onPhotoClick(photo.id)}
                  className={`absolute top-1 w-8 h-8 -ml-4 rounded-full border-2 shadow-lg
                             transition-all hover:scale-110 flex items-center justify-center
                             ${isMatched
                               ? 'bg-blue-500 hover:bg-blue-400 border-white'
                               : 'bg-gray-600 hover:bg-gray-500 border-gray-400'
                             }`}
                  style={{ left: `${position}%` }}
                  title={`Photo at ${formatDuration(photo.sessionTimestamp)}${isMatched ? ' (matched)' : ' (no match)'}`}
                >
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                  </svg>
                </button>
              );
            })}
          </div>

          {/* Time labels */}
          <div className="flex justify-between text-xs text-gray-500 px-1">
            <span>0:00</span>
            <span>{formatDuration(duration / 2)}</span>
            <span>{formatDuration(duration)}</span>
          </div>

          {/* Legend */}
          <div className="flex gap-4 text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-purple-900/50 rounded" />
              <span>Speech</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-blue-500 rounded-full" />
              <span>Photo (matched)</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-gray-600 rounded-full" />
              <span>Photo (no match)</span>
            </div>
          </div>

          {/* Segment list with photo thumbnails */}
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {transcript.segments.map((segment, idx) => {
              const segmentPhotos = getPhotosForSegment(segment);
              const hasPhotos = segmentPhotos.length > 0;

              return (
                <div
                  key={idx}
                  className={`p-3 rounded-lg transition-colors ${
                    hasPhotos
                      ? 'bg-purple-900/30 border border-purple-700/50'
                      : 'bg-gray-800/50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="text-xs text-gray-500 whitespace-nowrap pt-0.5 font-mono">
                      {formatDuration(segment.start)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-300 leading-relaxed">
                        {segment.text}
                      </p>

                      {/* Photo thumbnails for this segment */}
                      {hasPhotos && (
                        <div className="flex gap-2 mt-3 flex-wrap">
                          {segmentPhotos.map(photo => (
                            <button
                              key={photo.id}
                              onClick={() => onPhotoClick(photo.id)}
                              className="relative w-14 h-14 rounded-lg overflow-hidden border-2
                                       border-blue-500 hover:border-blue-400 transition-colors
                                       shadow-lg hover:shadow-blue-500/20"
                            >
                              <img
                                src={photo.imageData}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                              <div className="absolute bottom-0.5 left-0.5 right-0.5 text-[10px] text-white text-center">
                                {formatDuration(photo.sessionTimestamp)}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
