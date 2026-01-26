'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Project, PhotoMetadata, AudioMetadata, ProcessingResult, Transcript, TranscriptSegment, PhotoAnalysis, ProcessingProgress, SessionSynthesis } from '../../lib/types';
import { getProject, getProjectPhotos, getProjectAudio, deletePhoto, deleteAudio, updateProject, deleteProject, deleteLaunchSession, saveProcessingResult, getSessionProcessingResult, savePhoto } from '../../lib/db';
import { downloadBlob, exportPortableEvidencePackage, generatePortableFilename, exportProcessedSession, generateProcessedFilename } from '../../lib/export';
import { findMatchingSegment } from '../../lib/correlation';
import { extractExifData, fileToBase64 } from '../../lib/exif';

export default function ProjectDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;

  const [project, setProject] = useState<Project | null>(null);
  const [photos, setPhotos] = useState<PhotoMetadata[]>([]);
  const [audio, setAudio] = useState<AudioMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDeletePhoto, setConfirmDeletePhoto] = useState<string | null>(null);
  const [confirmDeleteAudio, setConfirmDeleteAudio] = useState<string | null>(null);
  const [confirmDeleteProject, setConfirmDeleteProject] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showExportDeleteConfirm, setShowExportDeleteConfirm] = useState(false);
  const [exportedFilename, setExportedFilename] = useState<string | null>(null);

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState<ProcessingProgress | null>(null);
  const [processingResult, setProcessingResult] = useState<ProcessingResult | null>(null);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [showAudioTooLargeDialog, setShowAudioTooLargeDialog] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Helper to convert data URL to Blob for upload
  const dataURLtoBlob = (dataURL: string): Blob => {
    const [header, base64] = dataURL.split(',');
    const mimeMatch = header.match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'audio/webm';
    const binary = atob(base64);
    const array = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      array[i] = binary.charCodeAt(i);
    }
    return new Blob([array], { type: mime });
  };

  // Batch process session: transcribe audio + analyze all photos
  // skipAudio: true to skip transcription (for corrupted/oversized audio from old captures)
  const handleProcessSession = async (skipAudio: boolean = false) => {
    if (!project) return;
    if (!skipAudio && audio.length === 0) return;

    // Check if audio is too large (pre-fix captures with video frames)
    if (!skipAudio && audio.length > 0) {
      const audioItem = audio[0];
      const fileSizeMB = audioItem.fileSize / (1024 * 1024);
      // If audio is >25MB, it's likely a pre-fix capture with video frames
      if (fileSizeMB > 25) {
        console.log(`[ProcessSession] Audio too large (${fileSizeMB.toFixed(2)}MB), showing dialog`);
        setShowAudioTooLargeDialog(true);
        return;
      }
    }

    setIsProcessing(true);
    setProcessingError(null);
    setShowAudioTooLargeDialog(false);

    const sessionId = audio.length > 0 ? audio[0].sessionId : crypto.randomUUID();
    const audioItem = audio.length > 0 ? audio[0] : null;

    try {
      let transcript: Transcript | null = null;

      // Step 1: Handle audio (skip if requested or no audio)
      if (!skipAudio && audioItem) {
        const fileSizeMB = audioItem.fileSize / (1024 * 1024);
        console.log(`[ProcessSession] Audio size: ${fileSizeMB.toFixed(2)}MB`);
        setProcessingProgress({ step: 'transcribing', progress: 0, message: 'Starting transcription...' });

        let audioUrl: string | undefined;
        let audioData: string | undefined;

        if (fileSizeMB > 4) {
          // Large file - upload to Vercel Blob first
          console.log('[ProcessSession] Large file detected, uploading to blob storage...');
          setProcessingProgress({ step: 'uploading', progress: 5, message: 'Uploading audio...' });

          try {
            const { upload } = await import('@vercel/blob/client');
            const audioBlob = dataURLtoBlob(audioItem.audioData);

            // Add timestamp to avoid conflicts with previous upload attempts
            const result = await upload(
              `audio-${audioItem.sessionId}-${Date.now()}.webm`,
              audioBlob,
              {
                access: 'public',
                handleUploadUrl: '/api/upload-audio',
              }
            );

            audioUrl = result.url;
            console.log('[ProcessSession] Audio uploaded to:', audioUrl);
          } catch (uploadError: any) {
            console.error('[ProcessSession] Blob upload failed:', uploadError);
            throw new Error(`Failed to upload large audio file: ${uploadError.message}`);
          }
        } else {
          // Small file - send directly as base64
          audioData = audioItem.audioData;
        }

        // Transcribe audio
        console.log('[ProcessSession] Starting transcription...');
        setProcessingProgress({ step: 'transcribing', progress: 10, message: 'Transcribing audio...' });

        const transcribeResponse = await fetch('/api/transcribe-audio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audioUrl,
            audioData,
            mimeType: audioItem.mimeType
          })
        });

        if (!transcribeResponse.ok) {
          const errorData = await transcribeResponse.json();
          throw new Error(errorData.error || 'Transcription failed');
        }

        const transcriptData = await transcribeResponse.json();
        transcript = transcriptData.transcript;
        console.log('[ProcessSession] Transcription complete:', transcript!.fullText.substring(0, 100) + '...');
      } else {
        console.log('[ProcessSession] Skipping audio transcription');
        setProcessingProgress({ step: 'analyzing_photos', progress: 10, message: 'Skipping audio (photos only)...' });
      }

      setProcessingProgress({ step: 'analyzing_photos', progress: 30, message: `Analyzing ${photos.length} photos...`, currentItem: 0, totalItems: photos.length });

      // Step 2: Analyze each photo with transcript context (if available)
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

        // Find matching transcript segment for this photo (if transcript available)
        const matchedSegment = transcript ? findMatchingSegment(photo.sessionTimestamp, transcript.segments) : null;

        console.log(`[ProcessSession] Photo ${i + 1}: sessionTimestamp=${photo.sessionTimestamp}, matched segment:`, matchedSegment?.text?.substring(0, 50) || '(no transcript)');

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
              projectType: project.projectType,
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

      // Create empty transcript if skipped
      const finalTranscript: Transcript = transcript || {
        fullText: skipAudio ? '(Audio skipped - photos only)' : '',
        segments: [],
        duration: 0
      };

      const result: ProcessingResult = {
        id: crypto.randomUUID(),
        projectId: project.id,
        sessionId,
        createdAt: new Date().toISOString(),
        status: 'completed',
        transcript: finalTranscript,
        photoAnalyses,
        entities: [] // Will extract in future phase
      };

      await saveProcessingResult(result);
      setProcessingResult(result);

      // Step 4: Sync to Neo4j graph
      setProcessingProgress({ step: 'syncing', progress: 97, message: 'Syncing to knowledge graph...' });
      console.log('[ProcessSession] Syncing to Neo4j...');

      try {
        // Build Portable Evidence Package format for ingest
        const indexJson = {
          session_id: sessionId,
          project_type: project.projectType,
          project_name: project.name,
          timestamp_start: photos[0]?.timestamp || new Date().toISOString(),
          timestamp_end: photos[photos.length - 1]?.timestamp || new Date().toISOString(),
          photos: photoAnalyses.map((analysis, i) => {
            const photo = photos.find(p => p.id === analysis.photoId);
            return {
              filename: `photo-${String(i + 1).padStart(3, '0')}.jpg`,
              timestamp: analysis.timestamp,
              gps: analysis.gps ? {
                latitude: analysis.gps.latitude,
                longitude: analysis.gps.longitude,
                accuracy: analysis.gps.accuracy || 0,
                timestamp: analysis.gps.timestamp || Date.now(),
              } : undefined,
              entities: analysis.entities.map(e => e.type),
              vision_analysis: {
                description: analysis.vlmDescription,
                concerns: analysis.entities.map(e => e.description),
                rec_potential: (analysis.entities.some(e => e.severity === 'high') ? 'high' :
                               analysis.entities.some(e => e.severity === 'medium') ? 'medium' :
                               analysis.entities.some(e => e.severity === 'low') ? 'low' : 'none') as 'high' | 'medium' | 'low' | 'none',
                confidence: 0.85,
              },
              tags: analysis.catalogTags,
            };
          }),
          session_summary: {
            total_photos: photos.length,
            entities_extracted: photoAnalyses.reduce((acc, a) => {
              a.entities.forEach(e => {
                acc[e.type] = (acc[e.type] || 0) + 1;
              });
              return acc;
            }, {} as Record<string, number>),
          },
          processing_stage: 'graph_ready',
          version: '2.0',
        };

        const ingestResponse = await fetch('/api/graph/ingest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ indexJson }),
        });

        const ingestResult = await ingestResponse.json();
        if (ingestResult.success) {
          console.log(`[ProcessSession] Neo4j sync complete: ${ingestResult.nodesCreated.photos} photos, ${ingestResult.nodesCreated.entities} entities`);
        } else {
          console.warn('[ProcessSession] Neo4j sync failed:', ingestResult.errors);
          // Don't fail the whole process - sync is non-critical
        }
      } catch (syncError) {
        console.warn('[ProcessSession] Neo4j sync error (non-critical):', syncError);
        // Continue - sync failure shouldn't block processing completion
      }

      // Step 5: Session Synthesis (for home-inventory and other supported types)
      if (project.projectType === 'home-inventory') {
        setProcessingProgress({ step: 'synthesizing', progress: 98, message: 'Synthesizing inventory...' });
        console.log('[ProcessSession] Starting synthesis...');

        try {
          const synthesizeResponse = await fetch('/api/synthesize-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId,
              projectId: project.id,
              projectType: project.projectType,
              photoAnalyses,
              transcript: finalTranscript,
            }),
          });

          if (synthesizeResponse.ok) {
            const synthesizeResult = await synthesizeResponse.json();
            if (synthesizeResult.success && synthesizeResult.synthesis) {
              console.log(`[ProcessSession] Synthesis complete: ${synthesizeResult.synthesis.deliverables.length} deliverables`);

              // Update result with synthesis
              result.synthesis = synthesizeResult.synthesis;
              await saveProcessingResult(result);
              setProcessingResult(result);
            }
          } else {
            console.warn('[ProcessSession] Synthesis failed:', await synthesizeResponse.text());
            // Non-critical - continue without synthesis
          }
        } catch (synthError) {
          console.warn('[ProcessSession] Synthesis error (non-critical):', synthError);
          // Continue - synthesis failure shouldn't block processing completion
        }
      }

      setProcessingProgress({ step: 'synthesizing', progress: 100, message: 'Processing complete!' });
      console.log('[ProcessSession] Complete!');

    } catch (error: any) {
      console.error('[ProcessSession] Error:', error);
      setProcessingError(error.message || 'Processing failed');
    } finally {
      setIsProcessing(false);
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

  const handleUploadPhotos = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !project) return;

    setIsUploading(true);
    setUploadProgress({ current: 0, total: files.length });

    try {
      const newPhotos: PhotoMetadata[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadProgress({ current: i + 1, total: files.length });

        // Extract EXIF data (GPS, timestamp)
        const exifData = await extractExifData(file);

        // Convert to base64
        const imageData = await fileToBase64(file);

        // Create photo metadata
        const photoMetadata: PhotoMetadata = {
          id: crypto.randomUUID(),
          projectId: project.id,
          gps: exifData.gps,
          compass: null, // Uploaded photos don't have compass data
          imageData,
          timestamp: exifData.timestamp || new Date().toISOString(),
          sessionTimestamp: 0, // Uploaded photos don't have session timestamps
        };

        // Save to IndexedDB
        await savePhoto(photoMetadata);
        newPhotos.push(photoMetadata);
      }

      // Update local state
      setPhotos(prev => [...newPhotos, ...prev]);

      // Update project photo count
      const updatedProject = { ...project, photoCount: project.photoCount + newPhotos.length };
      await updateProject(updatedProject);
      setProject(updatedProject);

      console.log(`[Upload] Successfully uploaded ${newPhotos.length} photos`);
    } catch (error) {
      console.error('Failed to upload photos:', error);
      alert('Failed to upload some photos. Please try again.');
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
      // Reset input so same files can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteProject = async () => {
    if (!project) return;

    try {
      await deleteProject(project.id);

      // If this was a launched session, also delete the launch record
      if (project.launchSessionId) {
        try {
          await deleteLaunchSession(project.launchSessionId);
        } catch (e) {
          console.log('No launch session to delete or already deleted');
        }
      }

      router.push('/');
    } catch (error) {
      console.error('Failed to delete project:', error);
      alert('Failed to delete project. Please try again.');
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
                onClick={() => router.push(`/graph?sessionId=${project.launchSessionId || project.id}`)}
                className="p-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl transition-colors flex-shrink-0"
                aria-label="Search in project"
                title="Search in project"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
              <button
                onClick={() => setConfirmDeleteProject(true)}
                className="p-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-colors flex-shrink-0"
                aria-label="Delete project"
                title="Delete project"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
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
        {/* Add to Inventory Button - Primary CTA for home-inventory projects */}
        {project.projectType === 'home-inventory' && (
          <button
            onClick={() => router.push(`/capture/${projectId}`)}
            className="w-full mb-6 py-4 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white font-bold text-lg rounded-xl shadow-lg transition-all flex items-center justify-center gap-3"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Add to Inventory
          </button>
        )}

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
                onClick={() => handleProcessSession()}
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

          </section>
        )}

        {/* Synthesis Deliverables Section - Home Inventory */}
        {processingResult?.synthesis && processingResult.synthesis.deliverables.length > 0 && (
          <section className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-semibold text-lg flex items-center gap-2">
                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                Inventory Summary
              </h2>
              <button
                onClick={async () => {
                  if (!project || !processingResult) return;
                  setIsExporting(true);
                  try {
                    const zipBlob = await exportProcessedSession(project, photos, audio, processingResult);
                    const filename = generateProcessedFilename(project.name, project.projectType || 'home-inventory');
                    downloadBlob(zipBlob, filename);
                    setExportedFilename(filename);
                    setShowExportDeleteConfirm(true);
                  } catch (error) {
                    console.error('Export failed:', error);
                    alert('Export failed. Please try again.');
                  } finally {
                    setIsExporting(false);
                  }
                }}
                disabled={isExporting}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-800 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5"
              >
                {isExporting ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Exporting...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Export
                  </>
                )}
              </button>
            </div>
            <div className="space-y-4">
              {processingResult.synthesis.deliverables.map((deliverable) => (
                <details
                  key={deliverable.id}
                  className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden"
                >
                  <summary className="px-4 py-3 cursor-pointer hover:bg-gray-750 flex items-center justify-between">
                    <span className="text-white font-medium">{deliverable.title}</span>
                    <svg className="w-5 h-5 text-gray-400 transform transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </summary>
                  <div className="px-4 py-3 border-t border-gray-700">
                    <div className="prose prose-invert prose-sm max-w-none">
                      <pre className="whitespace-pre-wrap text-gray-300 text-sm font-sans leading-relaxed bg-transparent p-0 m-0">
                        {deliverable.content}
                      </pre>
                    </div>
                  </div>
                </details>
              ))}
            </div>

            {/* Coverage Score */}
            {processingResult.synthesis.coverageAnalysis && (
              <div className="mt-4 p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm">Coverage</span>
                  <span className="text-white font-medium">
                    {Math.round(processingResult.synthesis.coverageAnalysis.completenessScore * 100)}%
                  </span>
                </div>
                {processingResult.synthesis.coverageAnalysis.missingLocations.length > 0 && (
                  <p className="text-yellow-400 text-xs mt-1">
                    Missing: {processingResult.synthesis.coverageAnalysis.missingLocations.join(', ')}
                  </p>
                )}
              </div>
            )}
          </section>
        )}

        {/* Hidden file input for photo upload */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleUploadPhotos}
          className="hidden"
        />

        {/* Photos Section */}
        {photos.length > 0 ? (
          <section className="pb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-semibold text-lg">Photos</h2>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5"
              >
                {isUploading ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {uploadProgress ? `${uploadProgress.current}/${uploadProgress.total}` : 'Uploading...'}
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    Upload
                  </>
                )}
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {photos.map((photo) => (
                <button
                  key={photo.id}
                  onClick={() => router.push(`/project/${projectId}/photo/${photo.id}`)}
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
          <section className="pb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-semibold text-lg">Photos</h2>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5"
              >
                {isUploading ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {uploadProgress ? `${uploadProgress.current}/${uploadProgress.total}` : 'Uploading...'}
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    Upload
                  </>
                )}
              </button>
            </div>
            <div className="text-center text-gray-400 py-12 bg-gray-800/50 rounded-lg border border-gray-700">
              <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p>No photos captured yet</p>
              <div className="flex gap-2 justify-center mt-4">
                <button
                  onClick={() => router.push(`/capture/${projectId}`)}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors"
                >
                  Start Capturing
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
                >
                  Upload Photos
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Transcript Section - At Bottom */}
        {processingResult?.transcript && processingResult.transcript.fullText && (
          <section className="mt-8 pb-6">
            <details className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
              <summary className="px-4 py-3 cursor-pointer hover:bg-gray-750 flex items-center justify-between">
                <span className="text-white font-medium flex items-center gap-2">
                  <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Transcript
                  {processingResult.transcript.language && (
                    <span className="text-gray-500 text-xs ml-2">
                      ({processingResult.transcript.language} • {formatDuration(processingResult.transcript.duration)})
                    </span>
                  )}
                </span>
                <svg className="w-5 h-5 text-gray-400 transform transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <div className="px-4 py-3 border-t border-gray-700">
                <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
                  {processingResult.transcript.fullText}
                </p>
              </div>
            </details>
          </section>
        )}
      </div>

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
              {processingProgress.step === 'uploading' && (
                <div className="flex items-center gap-2 text-purple-400">
                  ○ Uploading audio (large file)
                </div>
              )}
              <div className={`flex items-center gap-2 ${processingProgress.step === 'transcribing' ? 'text-purple-400' : processingProgress.progress > 30 ? 'text-green-400' : 'text-gray-500'}`}>
                {processingProgress.progress > 30 ? '✓' : processingProgress.step === 'transcribing' ? '○' : '○'} Transcribing audio
              </div>
              <div className={`flex items-center gap-2 ${processingProgress.step === 'analyzing_photos' ? 'text-purple-400' : processingProgress.progress > 90 ? 'text-green-400' : 'text-gray-500'}`}>
                {processingProgress.progress > 90 ? '✓' : processingProgress.step === 'analyzing_photos' ? '○' : '○'} Analyzing photos {processingProgress.currentItem && processingProgress.totalItems ? `(${processingProgress.currentItem}/${processingProgress.totalItems})` : ''}
              </div>
              <div className={`flex items-center gap-2 ${processingProgress.step === 'syncing' ? 'text-purple-400' : processingProgress.progress > 96 ? 'text-green-400' : 'text-gray-500'}`}>
                {processingProgress.progress > 96 ? '✓' : processingProgress.step === 'syncing' ? '○' : '○'} Syncing to graph
              </div>
              <div className={`flex items-center gap-2 ${processingProgress.step === 'synthesizing' ? 'text-purple-400' : processingProgress.progress >= 100 ? 'text-green-400' : 'text-gray-500'}`}>
                {processingProgress.progress >= 100 ? '✓' : processingProgress.step === 'synthesizing' ? '○' : '○'} Building inventory
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

      {/* Delete Project Confirmation Dialog */}
      {confirmDeleteProject && (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-xl p-6 max-w-sm w-full border border-gray-700">
            <h3 className="text-white font-semibold text-lg mb-3">Delete Project?</h3>
            <p className="text-gray-300 text-sm mb-2">
              This will permanently delete <span className="font-semibold text-white">{project?.name}</span> and all associated photos and audio recordings.
            </p>
            <p className="text-red-400 text-sm font-semibold mb-6">
              This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDeleteProject(false)}
                className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteProject}
                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-colors"
              >
                Delete Project
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

      {/* Audio Too Large Dialog */}
      {showAudioTooLargeDialog && audio.length > 0 && (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-sm w-full border border-gray-700">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <h3 className="text-white font-semibold text-lg">Audio File Too Large</h3>
            </div>
            <p className="text-gray-300 text-sm mb-2">
              This audio recording is <span className="text-yellow-400 font-medium">{(audio[0].fileSize / (1024 * 1024)).toFixed(1)}MB</span> (max 25MB for transcription).
            </p>
            <p className="text-gray-400 text-sm mb-4">
              This capture was recorded before a bug fix. The audio includes video data which inflates the file size.
            </p>
            <p className="text-gray-300 text-sm mb-6">
              You can still analyze the photos without transcription, or delete this capture and re-record with the fixed app.
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  setShowAudioTooLargeDialog(false);
                  handleProcessSession(true); // Skip audio, analyze photos only
                }}
                className="w-full px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Analyze Photos Only
              </button>
              <button
                onClick={() => setShowAudioTooLargeDialog(false)}
                className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
