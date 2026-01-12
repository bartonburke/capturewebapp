'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PhotoMetadata, ProcessingResult, PhotoAnalysis } from '@/app/lib/types';
import { getProjectPhotos, getProjectAudio } from '@/app/lib/db';

export default function PhotoDetailPage() {
  const params = useParams();
  const router = useRouter();
  const photoId = params.photoId as string;
  const projectId = params.projectId as string;

  const [photo, setPhoto] = useState<PhotoMetadata | null>(null);
  const [analysis, setAnalysis] = useState<PhotoAnalysis | null>(null);
  const [loading, setLoading] = useState(true);

  // Override global overflow: hidden for this page
  useEffect(() => {
    document.body.style.overflow = 'auto';
    document.documentElement.style.overflow = 'auto';

    return () => {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    };
  }, []);

  useEffect(() => {
    loadPhotoData();
  }, [photoId]);

  const loadPhotoData = async () => {
    try {
      // Get all photos for this project to find the one we want
      const photos = await getProjectPhotos(projectId);
      const currentPhoto = photos.find(p => p.id === photoId);

      if (!currentPhoto) {
        console.error('Photo not found');
        setLoading(false);
        return;
      }

      setPhoto(currentPhoto);
      console.log('[PhotoDetail] Found photo:', currentPhoto.id);

      // Load processing results to find photo analysis
      const audio = await getProjectAudio(projectId);

      // Import getSessionProcessingResult dynamically to avoid circular deps
      const { getSessionProcessingResult } = await import('@/app/lib/db');

      console.log('[PhotoDetail] Checking', audio.length, 'audio sessions for analysis');

      for (const audioItem of audio) {
        const result = await getSessionProcessingResult(audioItem.sessionId);
        if (result?.photoAnalyses) {
          console.log('[PhotoDetail] Found', result.photoAnalyses.length, 'photo analyses in session', audioItem.sessionId);
          const photoAnalysis = result.photoAnalyses.find(pa => pa.photoId === photoId);
          if (photoAnalysis) {
            console.log('[PhotoDetail] Found analysis for this photo!', photoAnalysis);
            setAnalysis(photoAnalysis);
            break;
          }
        }
      }

      console.log('[PhotoDetail] Final analysis state:', analysis);
    } catch (error) {
      console.error('Failed to load photo data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!photo) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-gray-400">Photo not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header with Back Button */}
      <div className="flex items-center justify-between p-4 bg-black/90 sticky top-0 z-10">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-blue-400 hover:text-blue-300"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <div className="text-sm text-gray-400">Photo Details</div>
      </div>

      {/* Photo */}
      <div className="w-full">
        <img
          src={photo.imageData}
          alt="Photo"
          className="w-full"
        />
      </div>

      {/* Metadata Section */}
      <div className="p-4 space-y-4">
        {/* Timestamp */}
        <div>
          <div className="text-xs font-semibold text-gray-400 uppercase mb-1">
            Captured
          </div>
          <div className="text-sm text-gray-300">
            {formatTimestamp(photo.timestamp)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Session: {formatDuration(photo.sessionTimestamp)}
          </div>
        </div>

        {/* GPS Coordinates */}
        {photo.gps ? (
          <div>
            <div className="text-xs font-semibold text-gray-400 uppercase mb-1">
              Location
            </div>
            <div className="flex items-center gap-2 mb-1">
              <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
              </svg>
              <span className="text-gray-300 font-mono text-sm">
                {photo.gps.latitude.toFixed(6)}, {photo.gps.longitude.toFixed(6)}
              </span>
            </div>
            <div className="text-xs text-gray-500">
              Accuracy: ±{Math.round(photo.gps.accuracy)}m
            </div>
          </div>
        ) : (
          <div>
            <div className="text-xs font-semibold text-gray-400 uppercase mb-1">
              Location
            </div>
            <div className="text-sm text-gray-500">No GPS data available</div>
          </div>
        )}

        {/* Photo Analysis Section */}
        {analysis ? (
          <>
            {/* Visual Description */}
            <div className="border-t border-gray-700 pt-4">
              <div className="text-xs font-semibold text-gray-400 uppercase mb-2">
                Visual Analysis
              </div>
              <p className="text-sm text-gray-300 leading-relaxed">
                {analysis.vlmDescription}
              </p>
            </div>

            {/* Catalog Tags */}
            {analysis.catalogTags && analysis.catalogTags.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-gray-400 uppercase mb-2">
                  Tags
                </div>
                <div className="flex flex-wrap gap-2">
                  {analysis.catalogTags.map((tag, i) => (
                    <span
                      key={i}
                      className="px-2 py-1 bg-blue-500/20 text-blue-300 text-xs rounded"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Extracted Entities */}
            {analysis.entities && analysis.entities.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-gray-400 uppercase mb-2">
                  Findings
                </div>
                <div className="space-y-2">
                  {analysis.entities.map((entity, i) => (
                    <div
                      key={i}
                      className="p-3 bg-gray-800 rounded border-l-4"
                      style={{
                        borderColor:
                          entity.severity === 'high' ? '#ef4444' :
                          entity.severity === 'medium' ? '#f59e0b' :
                          entity.severity === 'low' ? '#3b82f6' :
                          '#6b7280'
                      }}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-gray-300">
                          {entity.type}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded bg-gray-700 text-gray-400">
                          {entity.severity}
                        </span>
                      </div>
                      <p className="text-sm text-gray-400">
                        {entity.description}
                      </p>
                      {entity.recommendation && (
                        <p className="text-xs text-blue-300 mt-2">
                          → {entity.recommendation}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="border-t border-gray-700 pt-4">
            <div className="text-sm text-gray-500 italic">
              No analysis available for this photo yet. Process the session to generate analysis.
            </div>
          </div>
        )}

        {/* Bottom Padding for Safe Scrolling */}
        <div className="h-8"></div>
      </div>
    </div>
  );
}
