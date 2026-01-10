'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Project, PhotoMetadata, AudioMetadata } from '../../lib/types';
import { getProject, getProjectPhotos, getProjectAudio } from '../../lib/db';

export default function ProjectDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;

  const [project, setProject] = useState<Project | null>(null);
  const [photos, setPhotos] = useState<PhotoMetadata[]>([]);
  const [audio, setAudio] = useState<AudioMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);

  // Touch handling for swipe
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);

  useEffect(() => {
    loadProjectData();
  }, [projectId]);

  const loadProjectData = async () => {
    try {
      const [projectData, projectPhotos, projectAudio] = await Promise.all([
        getProject(projectId),
        getProjectPhotos(projectId),
        getProjectAudio(projectId)
      ]);

      setProject(projectData);
      setPhotos(projectPhotos.sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      ));
      setAudio(projectAudio.sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      ));
    } catch (error) {
      console.error('Failed to load project data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
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

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (selectedPhotoIndex === null) return;

    const swipeDistance = touchStartX.current - touchEndX.current;
    const minSwipeDistance = 50;

    if (Math.abs(swipeDistance) > minSwipeDistance) {
      if (swipeDistance > 0) {
        // Swipe left - next photo
        navigatePhoto('next');
      } else {
        // Swipe right - previous photo
        navigatePhoto('prev');
      }
    }
  };

  const navigatePhoto = (direction: 'next' | 'prev') => {
    if (selectedPhotoIndex === null) return;

    if (direction === 'next' && selectedPhotoIndex < photos.length - 1) {
      setSelectedPhotoIndex(selectedPhotoIndex + 1);
    } else if (direction === 'prev' && selectedPhotoIndex > 0) {
      setSelectedPhotoIndex(selectedPhotoIndex - 1);
    }
  };

  const selectedPhoto = selectedPhotoIndex !== null ? photos[selectedPhotoIndex] : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-center">
          <p className="mb-4">Project not found</p>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg"
          >
            Back to Projects
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 overflow-y-auto pb-24">
      {/* Header - Sticky */}
      <div className="bg-gray-800 border-b border-gray-700 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={() => router.push('/')}
              className="text-gray-400 hover:text-white transition-colors"
              aria-label="Back to projects"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-white font-semibold text-xl truncate">{project.name}</h1>
              <p className="text-gray-400 text-sm">Lead: {project.lead}</p>
            </div>
            <button
              onClick={() => router.push(`/capture/${projectId}`)}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors flex-shrink-0"
            >
              Resume
            </button>
          </div>

          {/* Project Stats */}
          <div className="flex gap-4 text-sm">
            <div className="text-gray-400">
              <span className="text-white font-semibold">{photos.length}</span> photos
            </div>
            <div className="text-gray-400">
              <span className="text-white font-semibold">{audio.length}</span> audio
            </div>
            <div className="text-gray-400">
              Created {new Date(project.createdAt).toLocaleDateString()}
            </div>
          </div>

          {project.notes && (
            <p className="mt-2 text-gray-300 text-sm">{project.notes}</p>
          )}
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Audio Section */}
        {audio.length > 0 && (
          <section className="mb-8">
            <h2 className="text-white font-semibold text-lg mb-4">Audio Recordings</h2>
            <div className="space-y-3">
              {audio.map((audioItem) => (
                <div
                  key={audioItem.id}
                  className="bg-gray-800 rounded-lg p-4 border border-gray-700"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex-1">
                      <div className="text-white text-sm font-medium">
                        Session {audioItem.sessionId.slice(0, 8)}
                      </div>
                      <div className="text-gray-400 text-xs">
                        {formatTimestamp(audioItem.timestamp)} • {formatDuration(audioItem.duration)} • {formatFileSize(audioItem.fileSize)}
                      </div>
                    </div>
                  </div>
                  <audio
                    controls
                    className="w-full h-10"
                    src={audioItem.audioData}
                    style={{ filter: 'invert(0.9)' }}
                  >
                    Your browser does not support audio playback.
                  </audio>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Photos Section */}
        {photos.length > 0 ? (
          <section className="pb-6">
            <h2 className="text-white font-semibold text-lg mb-4">Photos</h2>
            <div className="grid grid-cols-2 gap-3">
              {photos.map((photo, index) => (
                <button
                  key={photo.id}
                  onClick={() => setSelectedPhotoIndex(index)}
                  className="relative aspect-square bg-gray-800 rounded-lg overflow-hidden border border-gray-700 hover:border-blue-500 transition-colors"
                >
                  <img
                    src={photo.imageData}
                    alt={`Photo from ${formatTimestamp(photo.timestamp)}`}
                    className="w-full h-full object-cover"
                  />
                  {/* GPS Overlay */}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-2">
                    {photo.gps ? (
                      <>
                        <div className="flex items-center gap-1 text-white text-xs mb-0.5">
                          <svg className="w-3 h-3 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                          </svg>
                          <span className="font-mono">±{Math.round(photo.gps.accuracy)}m</span>
                        </div>
                        <div className="text-[10px] text-gray-300 font-mono truncate">
                          {photo.gps.latitude.toFixed(4)}, {photo.gps.longitude.toFixed(4)}
                        </div>
                      </>
                    ) : (
                      <div className="text-xs text-gray-400">No GPS</div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </section>
        ) : (
          <div className="text-center text-gray-400 py-12">
            <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p>No photos captured yet</p>
            <button
              onClick={() => router.push(`/capture/${projectId}`)}
              className="mt-4 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors"
            >
              Start Capturing
            </button>
          </div>
        )}
      </div>

      {/* Photo Detail Modal */}
      {selectedPhoto && selectedPhotoIndex !== null && (
        <div
          className="fixed inset-0 bg-black z-50 flex flex-col"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 bg-black/80">
            <div className="text-white text-sm">
              {selectedPhotoIndex + 1} / {photos.length}
            </div>
            <button
              onClick={() => setSelectedPhotoIndex(null)}
              className="text-white hover:text-gray-300"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Image */}
          <div className="flex-1 flex items-center justify-center relative">
            <img
              src={selectedPhoto.imageData}
              alt="Full size photo"
              className="max-w-full max-h-full object-contain"
            />

            {/* Navigation Arrows */}
            {selectedPhotoIndex > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigatePhoto('prev');
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-3 rounded-full"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}

            {selectedPhotoIndex < photos.length - 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigatePhoto('next');
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-3 rounded-full"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}
          </div>

          {/* Metadata Footer */}
          <div className="bg-black/80 p-4 text-white space-y-2">
            <div className="text-sm text-gray-300">
              {formatTimestamp(selectedPhoto.timestamp)}
            </div>
            {selectedPhoto.gps ? (
              <>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-gray-300 font-mono text-sm">
                    {selectedPhoto.gps.latitude.toFixed(6)}, {selectedPhoto.gps.longitude.toFixed(6)}
                  </span>
                </div>
                <div className="text-gray-400 text-xs">
                  Accuracy: ±{Math.round(selectedPhoto.gps.accuracy)}m • Session: {formatDuration(selectedPhoto.sessionTimestamp)}
                </div>
              </>
            ) : (
              <div className="text-gray-400 text-sm">No GPS data • Session: {formatDuration(selectedPhoto.sessionTimestamp)}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
