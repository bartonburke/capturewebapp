'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Project, PhotoMetadata, AudioMetadata, ProcessingResult, Transcript, TranscriptSegment, PhotoAnalysis, ProcessingProgress } from '../../lib/types';
import { getProject, getProjectPhotos, getProjectAudio, deletePhoto, deleteAudio, updateProject, deleteProject, deleteLaunchSession, saveProcessingResult, getSessionProcessingResult } from '../../lib/db';
import { downloadBlob, exportPortableEvidencePackage, generatePortableFilename } from '../../lib/export';
import { findMatchingSegment } from '../../lib/correlation';

export default function ProjectDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;

  const [project, setProject] = useState<Project | null>(null);
  const [photos, setPhotos] = useState<PhotoMetadata[]>([]);
  const [audio, setAudio] = useState<AudioMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [confirmDeletePhoto, setConfirmDeletePhoto] = useState<string | null>(null);
  const [confirmDeleteAudio, setConfirmDeleteAudio] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [showExportDeleteConfirm, setShowExportDeleteConfirm] = useState(false);
  const [exportedFilename, setExportedFilename] = useState<string | null>(null);

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState<ProcessingProgress | null>(null);
  const [processingResult, setProcessingResult] = useState<ProcessingResult | null>(null);
  const [processingError, setProcessingError] = useState<string | null>(null);

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

  // Check for existing processing results when data loads
  useEffect(() => {
    const checkExistingResults = async () => {
      if (audio.length > 0) {
        const sessionId = audio[0].sessionId;
        const existingResult = await getSessionProcessingResult(sessionId);
        if (existingResult && existingResult.status === 'completed') {
          setProcessingResult(existingResult);
        }
      }
    };
    checkExistingResults();
  }, [audio]);

  // Batch process session: transcribe audio + analyze all photos
  const handleProcessSession = async () => {
    if (!project || audio.length === 0) return;

    setIsProcessing(true);
    setProcessingError(null);
    setProcessingProgress({ step: 'transcribing', progress: 0, message: 'Starting transcription...' });

    const sessionId = audio[0].sessionId;
    const audioItem = audio[0];

    try {
      // Step 1: Transcribe audio
      console.log('[ProcessSession] Starting transcription...');
      setProcessingProgress({ step: 'transcribing', progress: 10, message: 'Transcribing audio...' });

      const transcribeResponse = await fetch('/api/transcribe-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioData: audioItem.audioData,
          mimeType: audioItem.mimeType
        })
      });

      if (!transcribeResponse.ok) {
        const errorData = await transcribeResponse.json();
        throw new Error(errorData.error || 'Transcription failed');
      }

      const transcriptData = await transcribeResponse.json();
      const transcript: Transcript = transcriptData.transcript;
      console.log('[ProcessSession] Transcription complete:', transcript.fullText.substring(0, 100) + '...');

      setProcessingProgress({ step: 'analyzing_photos', progress: 30, message: `Analyzing ${photos.length} photos...`, currentItem: 0, totalItems: photos.length });

      // Step 2: Analyze each photo with transcript context
      const photoAnalyses: PhotoAnalysis[] = [];

      for (let i = 0; i < photos.length; i++) {
        const photo = photos[i];
        setProcessingProgress({
          step: 'analyzing_photos',
          progress: 30 + Math.round((i / photos.length) * 60),
          message: `Analyzing photo ${i + 1} of ${photos.length}...`,
          currentItem: i + 1,
          totalItems: photos.length
        });

        // Find matching transcript segment for this photo
        const matchedSegment = findMatchingSegment(photo.sessionTimestamp, transcript.segments);

        console.log(`[ProcessSession] Photo ${i + 1}: sessionTimestamp=${photo.sessionTimestamp}, matched segment:`, matchedSegment?.text?.substring(0, 50));

        try {
          const analyzeResponse = await fetch('/api/analyze-photo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              photoId: photo.id,
              imageData: photo.imageData,
              gps: photo.gps,
              timestamp: photo.timestamp,
              sessionTimestamp: photo.sessionTimestamp,
              transcriptSegment: matchedSegment,
              provider: 'openai',
              model: 'gpt-4o-mini'
            })
          });

          if (analyzeResponse.ok) {
            const analyzeData = await analyzeResponse.json();
            photoAnalyses.push(analyzeData.analysis);
          } else {
            console.error(`[ProcessSession] Failed to analyze photo ${i + 1}`);
            // Continue with other photos even if one fails
          }
        } catch (photoError) {
          console.error(`[ProcessSession] Error analyzing photo ${i + 1}:`, photoError);
        }
      }

      console.log(`[ProcessSession] Analyzed ${photoAnalyses.length} of ${photos.length} photos`);

      // Step 3: Save processing result
      setProcessingProgress({ step: 'saving', progress: 95, message: 'Saving results...' });

      const result: ProcessingResult = {
        id: crypto.randomUUID(),
        projectId: project.id,
        sessionId,
        createdAt: new Date().toISOString(),
        status: 'completed',
        transcript,
        photoAnalyses,
        entities: [] // Will extract in future phase
      };

      await saveProcessingResult(result);
      setProcessingResult(result);

      setProcessingProgress({ step: 'saving', progress: 100, message: 'Processing complete!' });
      console.log('[ProcessSession] Complete!');

    } catch (error: any) {
      console.error('[ProcessSession] Error:', error);
      setProcessingError(error.message || 'Processing failed');
    } finally {
      setIsProcessing(false);
    }
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

  const handleDeletePhoto = async (photoId: string) => {
    try {
      await deletePhoto(photoId);

      // Update local state
      const updatedPhotos = photos.filter(p => p.id !== photoId);
      setPhotos(updatedPhotos);

      // Update project photo count
      if (project) {
        const updatedProject = { ...project, photoCount: updatedPhotos.length };
        await updateProject(updatedProject);
        setProject(updatedProject);
      }

      // Close modal if we deleted the current photo
      if (selectedPhotoIndex !== null) {
        if (updatedPhotos.length === 0) {
          setSelectedPhotoIndex(null);
        } else if (selectedPhotoIndex >= updatedPhotos.length) {
          setSelectedPhotoIndex(updatedPhotos.length - 1);
        }
      }

      setConfirmDeletePhoto(null);
    } catch (error) {
      console.error('Failed to delete photo:', error);
      alert('Failed to delete photo. Please try again.');
    }
  };

  const handleDeleteAudio = async (audioId: string) => {
    try {
      await deleteAudio(audioId);

      // Update local state
      const updatedAudio = audio.filter(a => a.id !== audioId);
      setAudio(updatedAudio);

      // Update project audio count
      if (project) {
        const updatedProject = { ...project, audioCount: updatedAudio.length };
        await updateProject(updatedProject);
        setProject(updatedProject);
      }

      setConfirmDeleteAudio(null);
    } catch (error) {
      console.error('Failed to delete audio:', error);
      alert('Failed to delete audio. Please try again.');
    }
  };

  const handleExportAndDelete = async () => {
    if (!project) return;

    try {
      setIsExporting(true);

      // Generate portable evidence package (raw capture data, no AI processing)
      const zipBlob = await exportPortableEvidencePackage(project, photos, audio);
      const filename = generatePortableFilename(project.name);

      // Auto-upload to import API (sync to Claude Code working directory)
      const sessionId = project.launchSessionId || project.id;
      try {
        const formData = new FormData();
        formData.append('file', zipBlob, filename);
        formData.append('sessionId', sessionId);

        console.log('[Export] Auto-uploading to import API...');
        const importResponse = await fetch('/api/v1/capture/import', {
          method: 'POST',
          body: formData,
        });

        if (importResponse.ok) {
          const importResult = await importResponse.json();
          console.log('[Export] Auto-imported to:', importResult.outputPath);
        } else {
          const errorData = await importResponse.json();
          console.warn('[Export] Auto-import failed:', errorData.error);
        }
      } catch (importError) {
        // Don't fail the export if import fails - just log it
        console.warn('[Export] Auto-import error (continuing with download):', importError);
      }

      // Always download locally as backup
      downloadBlob(zipBlob, filename);

      // Track for confirmation
      setExportedFilename(filename);
      setShowExportDeleteConfirm(true);

    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Data not deleted.');
    } finally {
      setIsExporting(false);
    }
  };

  const confirmDeleteAfterExport = async () => {
    if (!project) return;

    try {
      await deleteProject(project.id);

      // Also delete launch session record if exists
      if (project.launchSessionId) {
        try {
          await deleteLaunchSession(project.launchSessionId);
        } catch (e) {
          // Ignore if launch session doesn't exist
          console.log('No launch session to delete');
        }
      }

      router.push('/');
    } catch (error) {
      console.error('Delete failed:', error);
      alert('Failed to delete project.');
    }
  };

  // Processing is now done on desktop via Claude Code skill after import
  // Mobile app only captures and exports raw data

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
    <div className="fixed inset-0 bg-gray-900 overflow-y-scroll" style={{ WebkitOverflowScrolling: 'touch' }}>
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
            <div className="flex gap-2">
              <button
                onClick={handleExportAndDelete}
                disabled={isExporting}
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-800 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors flex-shrink-0 flex items-center gap-2"
                aria-label="Export package for ChoraGraph Map"
                title="Export package for ChoraGraph Map"
              >
                {isExporting ? (
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                )}
                <span className="text-sm">Export Package</span>
              </button>
              <button
                onClick={() => router.push(`/capture/${projectId}`)}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors flex-shrink-0"
              >
                Resume
              </button>
            </div>
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
      <div className="max-w-4xl mx-auto px-4 py-6 pb-24">
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
                        <div className="text-white text-sm font-medium flex items-center gap-2">
                          Session {audioItem.sessionId.slice(0, 8)}
                          {processingResult && (
                            <span className="px-2 py-0.5 bg-green-600 text-white text-xs rounded-full">
                              Processed
                            </span>
                          )}
                        </div>
                        <div className="text-gray-400 text-xs">
                          {formatTimestamp(audioItem.timestamp)} • {formatDuration(audioItem.duration)} • {formatFileSize(audioItem.fileSize)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setConfirmDeleteAudio(audioItem.id)}
                          className="text-red-400 hover:text-red-300 transition-colors p-2"
                          aria-label="Delete audio"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
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

            {/* Process Session Button */}
            {!processingResult && photos.length > 0 && (
              <button
                onClick={handleProcessSession}
                disabled={isProcessing}
                className="mt-4 w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    Process Session (Transcribe + Analyze Photos)
                  </>
                )}
              </button>
            )}

            {processingError && (
              <p className="mt-2 text-red-400 text-sm text-center">{processingError}</p>
            )}

            {/* Transcript Display */}
            {processingResult?.transcript && (
              <div className="mt-4 bg-gray-800 rounded-lg p-4 border border-gray-700">
                <h3 className="text-white font-medium mb-2 flex items-center gap-2">
                  <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Transcript
                </h3>
                <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
                  {processingResult.transcript.fullText}
                </p>
                {processingResult.transcript.language && (
                  <p className="text-gray-500 text-xs mt-2">
                    Language: {processingResult.transcript.language} • Duration: {formatDuration(processingResult.transcript.duration)}
                  </p>
                )}
              </div>
            )}
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
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 bg-black/80 flex-shrink-0">
            <div className="text-white text-sm">
              {selectedPhotoIndex + 1} / {photos.length}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push(`/project/${projectId}/photo/${selectedPhoto.id}`)}
                className="text-blue-400 hover:text-blue-300 transition-colors p-2"
                aria-label="Photo details"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
              <button
                onClick={() => setConfirmDeletePhoto(selectedPhoto.id)}
                className="text-red-400 hover:text-red-300 transition-colors p-2"
                aria-label="Delete photo"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
              <button
                onClick={() => setSelectedPhotoIndex(null)}
                className="text-white hover:text-gray-300"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Scrollable Content Area */}
          <div className="flex-1 scrollable-y">
            {/* Image */}
            <div
              className="min-h-[60vh] flex items-center justify-center relative"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
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
        </div>
      )}

      {/* Processing Progress Modal */}
      {isProcessing && processingProgress && (
        <div className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-sm w-full border border-gray-700">
            <h3 className="text-white font-semibold text-lg mb-4 flex items-center gap-2">
              <svg className="animate-spin w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Processing Session
            </h3>

            {/* Progress bar */}
            <div className="mb-4">
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>{processingProgress.message}</span>
                <span>{processingProgress.progress}%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className="bg-purple-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${processingProgress.progress}%` }}
                />
              </div>
            </div>

            {/* Step indicators */}
            <div className="space-y-2 text-sm">
              <div className={`flex items-center gap-2 ${processingProgress.step === 'transcribing' ? 'text-purple-400' : processingProgress.progress > 30 ? 'text-green-400' : 'text-gray-500'}`}>
                {processingProgress.progress > 30 ? '✓' : processingProgress.step === 'transcribing' ? '○' : '○'} Transcribing audio
              </div>
              <div className={`flex items-center gap-2 ${processingProgress.step === 'analyzing_photos' ? 'text-purple-400' : processingProgress.progress > 90 ? 'text-green-400' : 'text-gray-500'}`}>
                {processingProgress.progress > 90 ? '✓' : processingProgress.step === 'analyzing_photos' ? '○' : '○'} Analyzing photos {processingProgress.currentItem && processingProgress.totalItems ? `(${processingProgress.currentItem}/${processingProgress.totalItems})` : ''}
              </div>
              <div className={`flex items-center gap-2 ${processingProgress.step === 'saving' ? 'text-purple-400' : processingProgress.progress >= 100 ? 'text-green-400' : 'text-gray-500'}`}>
                {processingProgress.progress >= 100 ? '✓' : processingProgress.step === 'saving' ? '○' : '○'} Saving results
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Photo Confirmation Dialog */}
      {confirmDeletePhoto && (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-sm w-full border border-gray-700">
            <h3 className="text-white font-semibold text-lg mb-3">Delete Photo?</h3>
            <p className="text-gray-300 text-sm mb-6">
              This photo will be permanently deleted. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDeletePhoto(null)}
                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeletePhoto(confirmDeletePhoto)}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Audio Confirmation Dialog */}
      {confirmDeleteAudio && (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-sm w-full border border-gray-700">
            <h3 className="text-white font-semibold text-lg mb-3">Delete Audio Recording?</h3>
            <p className="text-gray-300 text-sm mb-6">
              This audio recording will be permanently deleted. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDeleteAudio(null)}
                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteAudio(confirmDeleteAudio)}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export & Delete Confirmation Dialog */}
      {showExportDeleteConfirm && (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-sm w-full border border-gray-700">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-5 h-5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <h3 className="text-white font-semibold text-lg">Package Exported</h3>
            </div>
            <p className="text-gray-300 text-sm mb-2">
              Your evidence package is ready for ChoraGraph Map:
            </p>
            <p className="text-emerald-400 text-sm font-mono mb-4 break-all">{exportedFilename}</p>
            <p className="text-gray-400 text-sm mb-6">
              Delete from device to free up space?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowExportDeleteConfirm(false)}
                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                Keep on Device
              </button>
              <button
                onClick={confirmDeleteAfterExport}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
