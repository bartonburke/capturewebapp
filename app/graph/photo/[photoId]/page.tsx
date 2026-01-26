'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';

interface PhotoEntity {
  entityType: string;
  description: string;
  severity: string;
}

interface PhotoDetail {
  id: string;
  imageUrl: string;
  timestamp: string;
  sessionId: string;
  location: { latitude: number; longitude: number } | null;
  vlmDescription: string;
  recPotential: string;
  confidence: number;
  catalogTags: string[];
  entities: PhotoEntity[];
}

export default function PhotoViewerPage({
  params,
}: {
  params: Promise<{ photoId: string }>;
}) {
  const resolvedParams = use(params);
  const { photoId } = resolvedParams;

  const [photo, setPhoto] = useState<PhotoDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    async function fetchPhoto() {
      try {
        const res = await fetch(`/api/graph/photo/${photoId}`);
        const data = await res.json();

        if (!data.success) {
          setError(data.error || 'Failed to load photo');
        } else {
          setPhoto(data.photo);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load photo');
      } finally {
        setLoading(false);
      }
    }

    fetchPhoto();
  }, [photoId]);

  const getRecBadgeColor = (rec: string) => {
    switch (rec) {
      case 'high':
        return 'bg-red-600 text-white';
      case 'medium':
        return 'bg-amber-500 text-white';
      case 'low':
        return 'bg-green-600 text-white';
      default:
        return 'bg-gray-600 text-gray-300';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'bg-red-900/60 text-red-200 border-red-600';
      case 'medium':
        return 'bg-amber-900/60 text-amber-200 border-amber-600';
      case 'low':
        return 'bg-green-900/60 text-green-200 border-green-600';
      default:
        return 'bg-gray-700/60 text-gray-300 border-gray-500';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return timestamp;
    }
  };

  const openInMaps = () => {
    if (photo?.location) {
      const { latitude, longitude } = photo.location;
      // Use Apple Maps URL scheme on iOS, falls back to Google Maps on other platforms
      const url = `https://maps.apple.com/?ll=${latitude},${longitude}&q=Photo%20Location`;
      window.open(url, '_blank');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (error || !photo) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4">
        <svg
          className="w-16 h-16 text-gray-600 mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <p className="text-gray-400 mb-4">{error || 'Photo not found'}</p>
        <Link
          href="/graph"
          className="text-blue-400 hover:text-blue-300 flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Search
        </Link>
      </div>
    );
  }

  const shortId = photo.id.split('-').slice(-1)[0];

  return (
    <div className="min-h-screen bg-gray-900 text-white scrollable-y">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur-sm border-b border-gray-800">
        <div className="flex items-center justify-between px-4 py-3">
          <Link
            href="/graph"
            className="flex items-center gap-2 text-gray-400 hover:text-white"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span>Search</span>
          </Link>

          <span className="text-sm text-gray-500 font-mono">...{shortId}</span>
        </div>
      </header>

      {/* Photo */}
      <div className="relative bg-black">
        {imageError ? (
          <div className="aspect-[4/3] flex flex-col items-center justify-center bg-gray-800">
            <svg
              className="w-16 h-16 text-gray-600 mb-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <p className="text-gray-500 text-sm">Image not available</p>
          </div>
        ) : (
          <img
            src={photo.imageUrl}
            alt={`Photo ${shortId}`}
            className="w-full aspect-[4/3] object-contain bg-black"
            onError={() => setImageError(true)}
          />
        )}

        {/* REC badge overlay */}
        <div className="absolute top-3 left-3">
          <span
            className={`text-sm font-semibold px-3 py-1 rounded-full ${getRecBadgeColor(
              photo.recPotential
            )}`}
          >
            REC: {photo.recPotential || 'none'}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-5">
        {/* Timestamp + GPS row */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-gray-400">Captured</p>
            <p className="text-white">{formatTimestamp(photo.timestamp)}</p>
          </div>

          {photo.location && (
            <button
              onClick={openInMaps}
              className="flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              Open in Maps
            </button>
          )}
        </div>

        {/* GPS Coordinates */}
        {photo.location && (
          <div className="bg-gray-800 rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-1">GPS Coordinates</p>
            <p className="font-mono text-sm text-white">
              {photo.location.latitude.toFixed(6)}°, {photo.location.longitude.toFixed(6)}°
            </p>
          </div>
        )}

        {/* AI Description */}
        <div>
          <h3 className="text-sm font-medium text-gray-400 mb-2">AI Analysis</h3>
          <p className="text-white leading-relaxed">{photo.vlmDescription}</p>
        </div>

        {/* Entities */}
        {photo.entities.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-3">
              Entities ({photo.entities.length})
            </h3>
            <div className="space-y-2">
              {photo.entities.map((entity, idx) => (
                <div
                  key={idx}
                  className={`rounded-lg border p-3 ${getSeverityColor(entity.severity)}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium">{entity.entityType}</span>
                    <span className="text-xs opacity-75 capitalize">{entity.severity}</span>
                  </div>
                  <p className="text-sm opacity-90">{entity.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tags */}
        {photo.catalogTags.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-2">Tags</h3>
            <div className="flex flex-wrap gap-2">
              {photo.catalogTags.map((tag, idx) => (
                <span
                  key={idx}
                  className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Confidence */}
        {photo.confidence > 0 && (
          <div className="text-xs text-gray-500">
            AI confidence: {Math.round(photo.confidence * 100)}%
          </div>
        )}

        {/* Session link */}
        <div className="pt-4 border-t border-gray-800">
          <p className="text-xs text-gray-500">
            Session: <span className="font-mono">{photo.sessionId.slice(0, 8)}...</span>
          </p>
        </div>
      </div>

      {/* Bottom safe area padding */}
      <div className="h-8" />
    </div>
  );
}
