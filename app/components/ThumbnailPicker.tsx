'use client';

import { useState } from 'react';
import { PhotoMetadata } from '../lib/types';

interface ThumbnailPickerProps {
  photos: PhotoMetadata[];
  onSelect: (photoId: string, thumbnailData: string) => void;
  onSkip: () => void;
  sessionDuration: string;
  photoCount: number;
}

export default function ThumbnailPicker({
  photos,
  onSelect,
  onSkip,
  sessionDuration,
  photoCount,
}: ThumbnailPickerProps) {
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(
    photos.length > 0 ? photos[0].id : null
  );

  const handleConfirm = () => {
    if (selectedPhotoId) {
      const selectedPhoto = photos.find(p => p.id === selectedPhotoId);
      if (selectedPhoto) {
        onSelect(selectedPhotoId, selectedPhoto.imageData);
      }
    }
  };

  // If no photos, show a skip option
  if (photos.length === 0) {
    return (
      <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
        <div className="bg-gray-800 rounded-2xl p-6 max-w-sm w-full border border-gray-700 text-center">
          <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-white text-xl font-semibold mb-2">Session Complete</h2>
          <p className="text-gray-400 text-sm mb-6">
            Duration: {sessionDuration}
          </p>
          <p className="text-gray-500 text-sm mb-6">
            No photos were captured in this session.
          </p>
          <button
            onClick={onSkip}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition-colors"
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-gray-800">
        <div className="text-center">
          <h2 className="text-white text-xl font-semibold mb-1">Select Cover Photo</h2>
          <p className="text-gray-400 text-sm">
            {sessionDuration} | {photoCount} photos captured
          </p>
        </div>
      </div>

      {/* Photo Grid */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="grid grid-cols-3 gap-2">
          {photos.map((photo) => (
            <button
              key={photo.id}
              onClick={() => setSelectedPhotoId(photo.id)}
              className={`relative aspect-square rounded-lg overflow-hidden transition-all ${
                selectedPhotoId === photo.id
                  ? 'ring-3 ring-emerald-500 ring-offset-2 ring-offset-gray-900 scale-[0.96]'
                  : 'hover:opacity-80'
              }`}
            >
              <img
                src={photo.imageData}
                alt=""
                className="w-full h-full object-cover"
              />
              {/* Selection indicator */}
              {selectedPhotoId === photo.id && (
                <div className="absolute inset-0 bg-emerald-500/20 flex items-center justify-center">
                  <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="flex-shrink-0 p-4 border-t border-gray-800 bg-gray-900/80 backdrop-blur">
        <div className="flex gap-3">
          <button
            onClick={onSkip}
            className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-xl transition-colors"
          >
            Skip
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedPhotoId}
            className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
