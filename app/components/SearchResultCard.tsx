'use client';

import { useState } from 'react';
import Link from 'next/link';

interface Entity {
  entityType: string;
  description: string;
  severity: string;
}

interface LocationEntry {
  name: string;
  level: string;
}

interface SearchResultCardProps {
  photoId: string;
  imageUrl: string;
  vlmDescription: string;
  recPotential: string;
  location: { latitude: number; longitude: number } | null;
  entities: Entity[];
  timestamp: string;
  projectType?: string;
  locations?: LocationEntry[];
}

export default function SearchResultCard({
  photoId,
  imageUrl,
  vlmDescription,
  recPotential,
  location,
  entities,
  timestamp,
  projectType,
  locations,
}: SearchResultCardProps) {
  const [imageError, setImageError] = useState(false);

  const isInventory = projectType === 'home-inventory';

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
        return 'bg-red-900/50 text-red-300 border-red-700';
      case 'medium':
        return 'bg-amber-900/50 text-amber-300 border-amber-700';
      case 'low':
        return 'bg-green-900/50 text-green-300 border-green-700';
      default:
        return 'bg-gray-700/50 text-gray-300 border-gray-600';
    }
  };

  // Extract short ID for display
  const shortId = photoId.split('-').slice(-1)[0];

  // Format GPS accuracy display
  const gpsDisplay = location
    ? `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`
    : null;

  // Truncate description
  const truncatedDescription =
    vlmDescription.length > 100
      ? vlmDescription.slice(0, 100) + '...'
      : vlmDescription;

  // Build location label for inventory
  const roomName = locations?.find(l => l.level === 'room')?.name;
  const containerName = locations?.find(l => l.level === 'container')?.name;

  return (
    <Link href={`/graph/photo/${photoId}`}>
      <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden hover:border-gray-500 transition-colors active:bg-gray-700 cursor-pointer">
        <div className="flex">
          {/* Photo thumbnail - 80px square */}
          <div className="w-20 h-20 flex-shrink-0 bg-gray-700 relative">
            {imageError ? (
              <div className="w-full h-full flex flex-col items-center justify-center">
                <svg
                  className="w-8 h-8 text-gray-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <span className="text-[10px] text-gray-500 mt-0.5">{shortId}</span>
              </div>
            ) : (
              <img
                src={imageUrl}
                alt={`Photo ${shortId}`}
                className="w-full h-full object-cover"
                onError={() => setImageError(true)}
              />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 p-3 min-w-0">
            {/* Top row: Context badge + GPS */}
            <div className="flex items-center justify-between mb-1.5">
              {isInventory ? (
                // Inventory: show room/location badge
                roomName ? (
                  <span className="text-xs font-medium px-2 py-0.5 rounded bg-indigo-600 text-white truncate max-w-[200px]">
                    {roomName}
                    {containerName && (
                      <span className="text-indigo-200"> &gt; {containerName}</span>
                    )}
                  </span>
                ) : (
                  <span className="text-xs font-medium px-2 py-0.5 rounded bg-gray-600 text-gray-300">
                    No location
                  </span>
                )
              ) : (
                // ESA/Generic: show REC badge
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded ${getRecBadgeColor(
                    recPotential
                  )}`}
                >
                  REC: {recPotential || 'none'}
                </span>
              )}
              {gpsDisplay && (
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    />
                  </svg>
                  GPS
                </span>
              )}
            </div>

            {/* Description */}
            <p className="text-sm text-gray-300 mb-2 line-clamp-2 leading-snug">
              {truncatedDescription}
            </p>

            {/* Entity badges */}
            {entities.length > 0 && (
              <div className="flex flex-wrap gap-1.5 overflow-hidden max-h-6">
                {entities.slice(0, 3).map((entity, idx) => (
                  <span
                    key={idx}
                    className={`text-[10px] px-1.5 py-0.5 rounded border ${
                      isInventory
                        ? 'bg-gray-700/50 text-gray-300 border-gray-600'
                        : getSeverityColor(entity.severity)
                    }`}
                  >
                    {isInventory ? entity.description : entity.entityType}
                  </span>
                ))}
                {entities.length > 3 && (
                  <span className="text-[10px] text-gray-500">
                    +{entities.length - 3}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
