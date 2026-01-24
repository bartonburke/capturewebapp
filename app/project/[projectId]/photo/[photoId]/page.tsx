'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PhotoMetadata, ProcessingResult, PhotoAnalysis } from '@/app/lib/types';
import { getProjectPhotos, getProjectAudio } from '@/app/lib/db';
import { formatDuration } from '@/app/lib/correlation';

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

      {/* REC Potential Banner - Displayed prominently below photo */}
      {analysis && (
        <div className={`px-4 py-3 ${
          analysis.entities?.some(e => e.severity === 'high')
            ? 'bg-red-600'
            : analysis.entities?.some(e => e.severity === 'medium')
            ? 'bg-amber-500'
            : analysis.entities?.some(e => e.severity === 'low')
            ? 'bg-blue-600'
            : 'bg-gray-600'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span className="font-semibold text-white">
                REC Potential: {
                  analysis.entities?.some(e => e.severity === 'high')
                    ? 'High'
                    : analysis.entities?.some(e => e.severity === 'medium')
                    ? 'Medium'
                    : analysis.entities?.some(e => e.severity === 'low')
                    ? 'Low'
                    : 'None Identified'
                }
              </span>
            </div>
            <span className="text-white/80 text-sm">
              {analysis.entities?.length || 0} finding{(analysis.entities?.length || 0) !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      )}

      {/* No Analysis Banner */}
      {!analysis && (
        <div className="px-4 py-3 bg-gray-700">
          <div className="flex items-center gap-2 text-gray-300">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <span className="text-sm">Process session to analyze for environmental concerns</span>
          </div>
        </div>
      )}

      {/* Metadata Section */}
      <div className="p-4 space-y-4">
        {/* Findings Section - Promoted to top when analysis exists */}
        {analysis && analysis.entities && analysis.entities.length > 0 && (
          <div className="pb-4 border-b border-gray-700">
            <div className="text-xs font-semibold text-gray-400 uppercase mb-3">
              Environmental Findings
            </div>
            <div className="space-y-3">
              {analysis.entities.map((entity, i) => (
                <div
                  key={i}
                  className={`p-4 rounded-lg border-l-4 ${
                    // Special styling for transcript-derived entity types
                    entity.type === 'ActionItem'
                      ? 'bg-purple-900/30 border-purple-500'
                      : entity.type === 'Question'
                      ? 'bg-cyan-900/30 border-cyan-500'
                      : entity.type === 'Observation'
                      ? 'bg-indigo-900/30 border-indigo-500'
                      : entity.severity === 'high'
                      ? 'bg-red-900/30 border-red-500'
                      : entity.severity === 'medium'
                      ? 'bg-amber-900/30 border-amber-500'
                      : entity.severity === 'low'
                      ? 'bg-blue-900/30 border-blue-500'
                      : 'bg-gray-800 border-gray-600'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-sm font-semibold ${
                      entity.type === 'ActionItem'
                        ? 'text-purple-300'
                        : entity.type === 'Question'
                        ? 'text-cyan-300'
                        : entity.type === 'Observation'
                        ? 'text-indigo-300'
                        : entity.severity === 'high'
                        ? 'text-red-300'
                        : entity.severity === 'medium'
                        ? 'text-amber-300'
                        : entity.severity === 'low'
                        ? 'text-blue-300'
                        : 'text-gray-300'
                    }`}>
                      {entity.type === 'ActionItem' ? 'To-Do' : entity.type === 'Question' ? 'Q&A' : entity.type}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                      entity.type === 'ActionItem'
                        ? 'bg-purple-500/30 text-purple-200'
                        : entity.type === 'Question'
                        ? 'bg-cyan-500/30 text-cyan-200'
                        : entity.type === 'Observation'
                        ? 'bg-indigo-500/30 text-indigo-200'
                        : entity.severity === 'high'
                        ? 'bg-red-500/30 text-red-200'
                        : entity.severity === 'medium'
                        ? 'bg-amber-500/30 text-amber-200'
                        : entity.severity === 'low'
                        ? 'bg-blue-500/30 text-blue-200'
                        : 'bg-gray-600 text-gray-300'
                    }`}>
                      {entity.severity?.toUpperCase() || 'INFO'}
                    </span>
                  </div>

                  {/* Show consultant's original context if available */}
                  {entity.consultantContext && (
                    <div className="mb-2 p-2 bg-gray-800/50 rounded text-xs">
                      <span className="text-gray-500">Consultant said: </span>
                      <span className="text-gray-400 italic">&ldquo;{entity.consultantContext}&rdquo;</span>
                    </div>
                  )}

                  <p className="text-sm text-gray-300 leading-relaxed">
                    {entity.description}
                  </p>

                  {/* Show AI's response for Question type */}
                  {entity.aiResponse && (
                    <div className="mt-2 p-2 bg-cyan-900/20 rounded">
                      <span className="text-xs text-cyan-400 font-medium">AI Response: </span>
                      <span className="text-sm text-cyan-200">{entity.aiResponse}</span>
                    </div>
                  )}

                  {entity.recommendation && (
                    <p className="text-sm text-emerald-400 mt-2 flex items-start gap-1">
                      <span className="text-emerald-500">→</span>
                      {entity.recommendation}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Visual Analysis Description */}
        {analysis && (
          <div className="pb-4 border-b border-gray-700">
            <div className="text-xs font-semibold text-gray-400 uppercase mb-2">
              AI Visual Analysis
            </div>
            <p className="text-sm text-gray-300 leading-relaxed">
              {analysis.vlmDescription}
            </p>
            {/* Catalog Tags inline */}
            {analysis.catalogTags && analysis.catalogTags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {analysis.catalogTags.map((tag, i) => (
                  <span
                    key={i}
                    className="px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

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

        {/* Matched Transcript Section */}
        {analysis?.transcriptSegment && (
          <div className="border-t border-gray-700 pt-4">
            <div className="text-xs font-semibold text-gray-400 uppercase mb-2 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
              Audio Context
            </div>
            <div className="bg-gray-800 rounded-lg p-3">
              <div className="text-xs text-gray-500 mb-2">
                {formatDuration(analysis.transcriptSegment.start)} - {formatDuration(analysis.transcriptSegment.end)}
              </div>
              <p className="text-sm text-gray-300 italic leading-relaxed">
                &ldquo;{analysis.transcriptSegment.text}&rdquo;
              </p>
            </div>
            <div className="text-xs text-gray-500 mt-2">
              Photo taken at {formatDuration(photo.sessionTimestamp)} into session
            </div>
          </div>
        )}

        {/* Bottom Padding for Safe Scrolling */}
        <div className="h-8"></div>
      </div>
    </div>
  );
}
