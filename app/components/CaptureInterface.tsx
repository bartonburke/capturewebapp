'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Project, SessionState, GpsStatus, GpsCoordinates, PhotoMetadata, AudioMetadata } from '../lib/types';
import { savePhoto, updateProject, saveAudio } from '../lib/db';

interface Props {
  project: Project;
}

export default function CaptureInterface({ project }: Props) {
  const router = useRouter();

  const [sessionState, setSessionState] = useState<SessionState>('NOT_STARTED');
  const [duration, setDuration] = useState(0);
  const [photoCount, setPhotoCount] = useState(project.photoCount);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  // GPS state
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>('NOT_REQUESTED');
  const [currentGps, setCurrentGps] = useState<GpsCoordinates | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // Audio recording state
  const [audioRecorder, setAudioRecorder] = useState<MediaRecorder | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const sessionIdRef = useRef<string>(crypto.randomUUID());

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const watchIdRef = useRef<number | null>(null);

  // Initialize camera once when starting recording
  useEffect(() => {
    console.log('Camera effect triggered - sessionState:', sessionState, 'stream:', stream ? 'exists' : 'null');
    if (sessionState === 'RECORDING' && !stream) {
      console.log('Conditions met, calling initializeCamera()');
      initializeCamera();
    }

    // Initialize audio recorder when stream is available and recording
    if (sessionState === 'RECORDING' && stream && !audioRecorder) {
      initializeAudioRecorder(stream);
    }

    // Only cleanup stream on unmount or when ending session
    // Don't stop tracks during pause/resume cycle
    return () => {
      if (sessionState === 'ENDED' && stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [sessionState, stream, audioRecorder]);

  // Attach stream to video element when stream changes
  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(err => {
        console.error('Error playing video in useEffect:', err);
      });
    }
  }, [stream]);

  // Timer logic
  useEffect(() => {
    if (sessionState === 'RECORDING') {
      timerRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [sessionState]);

  const initializeCamera = async () => {
    console.log('Initializing camera...');
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // rear camera
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      console.log('Media stream obtained:',
        mediaStream.getVideoTracks().length, 'video tracks,',
        mediaStream.getAudioTracks().length, 'audio tracks'
      );

      // Set stream first
      setStream(mediaStream);

      // Then attach to video element and ensure it plays
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        // Force play after setting srcObject
        videoRef.current.play().catch(err => {
          console.error('Error playing video:', err);
        });
      }

      setError(null);
      console.log('Camera initialized successfully');
    } catch (err) {
      const error = err as Error;

      if (error.name === 'NotAllowedError') {
        if (error.message?.includes('audio') || error.message?.includes('microphone')) {
          setAudioError('Microphone permission denied');
          setError('Camera access granted but microphone denied');
        } else {
          setError('Camera access denied or unavailable');
        }
      } else {
        setError('Camera/microphone access denied or unavailable');
      }

      console.error('Media initialization error:', error.name, error.message);
    }
  };

  const initializeAudioRecorder = (stream: MediaStream) => {
    try {
      // Check if audio tracks exist
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        setAudioError('No audio track available');
        return;
      }

      console.log('Initializing audio recorder...');

      // Determine best supported mime type
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4'; // Fallback for iOS

      const recorder = new MediaRecorder(stream, { mimeType });

      // Collect audio chunks as they're available
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          console.log('Audio chunk received:', event.data.size, 'bytes');
        }
      };

      // Handle recording stop
      recorder.onstop = async () => {
        console.log('Audio recording stopped, processing...');
        await saveAudioRecording();
      };

      recorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        setAudioError('Audio recording error occurred');
      };

      setAudioRecorder(recorder);
      setAudioError(null);
      console.log('Audio recorder initialized with mimeType:', mimeType);

    } catch (err) {
      const error = err as Error;
      console.error('Failed to initialize audio recorder:', error);
      setAudioError('Failed to initialize audio recording');
    }
  };

  const initializeGps = () => {
    if (!navigator.geolocation) {
      setGpsStatus('ERROR');
      setGpsError('GPS not supported');
      return;
    }

    setGpsStatus('REQUESTING');
    setGpsError(null);

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setCurrentGps({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp
        });
        setGpsStatus('ACTIVE');
        setGpsError(null);
      },
      (error) => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setGpsStatus('DENIED');
            setGpsError('Location permission denied');
            break;
          case error.POSITION_UNAVAILABLE:
            setGpsStatus('ERROR');
            setGpsError('Location unavailable');
            break;
          case error.TIMEOUT:
            setGpsStatus('ERROR');
            setGpsError('Location timeout');
            break;
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );

    watchIdRef.current = watchId;
  };

  const stopGps = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setGpsStatus('NOT_REQUESTED');
    setCurrentGps(null);
    setGpsError(null);
  };

  // Cleanup GPS on unmount
  useEffect(() => {
    return () => {
      stopGps();
    };
  }, []);

  // Audio recorder lifecycle - start/pause/resume/stop based on sessionState
  useEffect(() => {
    console.log('Audio effect triggered - sessionState:', sessionState, 'recorder:', audioRecorder ? `state=${audioRecorder.state}` : 'null');

    if (!audioRecorder) return;

    if (sessionState === 'RECORDING' && audioRecorder.state === 'inactive') {
      console.log('Starting audio recording');
      audioRecorder.start(1000); // Collect data every 1 second
    } else if (sessionState === 'PAUSED' && audioRecorder.state === 'recording') {
      console.log('Pausing audio recording');
      audioRecorder.pause();
    } else if (sessionState === 'RECORDING' && audioRecorder.state === 'paused') {
      console.log('Resuming audio recording');
      audioRecorder.resume();
    } else if (sessionState === 'ENDED' && audioRecorder.state !== 'inactive') {
      console.log('Stopping audio recording');
      audioRecorder.stop();
    }

  }, [sessionState, audioRecorder]);

  const handleStartSession = () => {
    console.log('Starting session for project:', project.name);

    // Generate new session ID for this capture session
    sessionIdRef.current = crypto.randomUUID();

    // Reset audio chunks for new session
    audioChunksRef.current = [];

    setSessionState('RECORDING');
    setDuration(0);
    initializeGps();

    // Initialize audio recorder when stream is ready
    if (stream) {
      initializeAudioRecorder(stream);
    }
  };

  const handleCapturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw current video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert to blob and save to IndexedDB
    canvas.toBlob(async (blob) => {
      if (blob) {
        try {
          // Convert blob to base64
          const reader = new FileReader();
          reader.readAsDataURL(blob);
          reader.onloadend = async () => {
            const base64data = reader.result as string;

            // Create photo metadata
            const photoMetadata: PhotoMetadata = {
              id: crypto.randomUUID(),
              timestamp: new Date().toISOString(),
              projectId: project.id,
              gps: currentGps ? { ...currentGps } : null,
              imageData: base64data,
              sessionTimestamp: duration,
            };

            // Save to IndexedDB
            await savePhoto(photoMetadata);

            // Update project photo count and modified date
            const updatedProject = {
              ...project,
              photoCount: project.photoCount + 1,
              modifiedAt: new Date().toISOString(),
            };
            await updateProject(updatedProject);

            // Update local state
            setPhotoCount(prev => prev + 1);

            // Debug log
            console.log('Photo captured:', {
              id: photoMetadata.id,
              projectName: project.name,
              gps: currentGps
                ? `${currentGps.latitude.toFixed(6)}, ${currentGps.longitude.toFixed(6)} (±${Math.round(currentGps.accuracy)}m)`
                : 'No GPS'
            });
          };

          // Visual feedback
          const flash = document.getElementById('flash-overlay');
          if (flash) {
            flash.classList.remove('opacity-0');
            setTimeout(() => flash.classList.add('opacity-0'), 100);
          }
        } catch (error) {
          console.error('Failed to save photo:', error);
          alert('Failed to save photo. Please try again.');
        }
      }
    }, 'image/jpeg', 0.9);
  };

  const handlePauseResume = () => {
    if (sessionState === 'PAUSED') {
      // Resume: ensure video plays if it was paused
      if (videoRef.current && stream) {
        videoRef.current.play().catch(err => {
          console.error('Error resuming video:', err);
        });
      }
      setSessionState('RECORDING');
    } else {
      // Pause: keep stream alive but stop video playback
      if (videoRef.current) {
        videoRef.current.pause();
      }
      setSessionState('PAUSED');
    }
  };

  const saveAudioRecording = async () => {
    try {
      if (audioChunksRef.current.length === 0) {
        console.log('No audio chunks to save');
        return;
      }

      console.log('Saving audio recording:', audioChunksRef.current.length, 'chunks');

      // Combine all audio chunks into single blob
      const audioBlob = new Blob(audioChunksRef.current, {
        type: audioRecorder?.mimeType || 'audio/webm'
      });

      console.log('Audio blob created:', audioBlob.size, 'bytes');

      // Convert to base64
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);

      reader.onloadend = async () => {
        const base64Audio = reader.result as string;

        const audioMetadata: AudioMetadata = {
          id: crypto.randomUUID(),
          projectId: project.id,
          sessionId: sessionIdRef.current,
          audioData: base64Audio,
          duration: duration,
          mimeType: audioRecorder?.mimeType || 'audio/webm',
          timestamp: new Date().toISOString(),
          fileSize: audioBlob.size,
        };

        // Save to IndexedDB
        await saveAudio(audioMetadata);

        // Update project audio count
        const updatedProject = {
          ...project,
          audioCount: (project.audioCount || 0) + 1,
          modifiedAt: new Date().toISOString(),
        };
        await updateProject(updatedProject);

        console.log('Audio saved successfully:', {
          id: audioMetadata.id,
          sessionId: audioMetadata.sessionId,
          duration: audioMetadata.duration,
          size: `${(audioMetadata.fileSize / 1024 / 1024).toFixed(2)} MB`
        });

        // Clear chunks after saving
        audioChunksRef.current = [];
      };

      reader.onerror = (error) => {
        console.error('Failed to convert audio to base64:', error);
        throw error;
      };

    } catch (error) {
      console.error('Failed to save audio:', error);
      alert('Failed to save audio recording. Please try again.');
    }
  };

  const handleEndSession = () => {
    setSessionState('ENDED');
    stopGps();

    // Stop audio recorder (will trigger onstop callback which saves audio)
    if (audioRecorder && audioRecorder.state !== 'inactive') {
      audioRecorder.stop();
    }

    // Stop all media tracks
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }

    // Reset audio recorder
    setAudioRecorder(null);
  };

  const formatDuration = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusColor = () => {
    switch (sessionState) {
      case 'RECORDING': return 'bg-red-500';
      case 'PAUSED': return 'bg-yellow-500';
      case 'ENDED': return 'bg-gray-500';
      default: return 'bg-gray-400';
    }
  };

  const getStatusText = () => {
    switch (sessionState) {
      case 'NOT_STARTED': return 'Ready';
      case 'RECORDING': return 'Recording';
      case 'PAUSED': return 'Paused';
      case 'ENDED': return 'Ended';
    }
  };

  const getGpsStatusColor = () => {
    switch (gpsStatus) {
      case 'ACTIVE': return 'text-green-400';
      case 'REQUESTING': return 'text-yellow-400 animate-pulse';
      case 'ERROR':
      case 'DENIED': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getGpsStatusText = () => {
    if (gpsStatus === 'ACTIVE' && currentGps) {
      return `±${Math.round(currentGps.accuracy)}m`;
    }
    switch (gpsStatus) {
      case 'REQUESTING': return 'Acquiring...';
      case 'DENIED': return 'Denied';
      case 'ERROR': return 'Unavailable';
      default: return '';
    }
  };

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      {/* Camera Preview */}
      <div className="absolute inset-0">
        {sessionState !== 'NOT_STARTED' && sessionState !== 'ENDED' && stream ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-900">
            <div className="text-center text-white px-6">
              <h1 className="text-2xl font-semibold mb-4">ChoraGraph Capture</h1>
              <p className="text-gray-400 mb-2">Phase 1 ESA Site Assessment</p>
              {error && <p className="text-red-400 text-sm mt-4">{error}</p>}
              {(sessionState === 'RECORDING' || sessionState === 'PAUSED') && !stream && (
                <p className="text-yellow-400 text-sm mt-4">Initializing camera...</p>
              )}
            </div>
          </div>
        )}

        {/* Flash overlay for photo capture feedback */}
        <div
          id="flash-overlay"
          className="absolute inset-0 bg-white opacity-0 pointer-events-none transition-opacity duration-100"
        />
      </div>

      {/* Hidden canvas for photo capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Header */}
      <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 to-transparent p-4 z-10">
        {/* Back button and project name */}
        <div className="flex items-center gap-3 mb-2">
          <button
            onClick={() => router.push('/')}
            className="text-white hover:text-gray-300 transition-colors"
            aria-label="Back to projects"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-white font-semibold text-lg truncate">{project.name}</h1>
        </div>

        {/* Session status and stats */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${getStatusColor()} ${sessionState === 'RECORDING' ? 'animate-pulse' : ''}`} />
              <span className="text-white text-sm font-medium">{getStatusText()}</span>

              {/* Audio recording dot */}
              {audioRecorder?.state === 'recording' && (
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse ml-1" />
              )}
            </div>

            {/* GPS Status */}
            {sessionState !== 'NOT_STARTED' && sessionState !== 'ENDED' && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-black/40">
                <svg
                  className={`w-3 h-3 ${getGpsStatusColor()}`}
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                </svg>
                <span className="text-xs text-white">
                  {getGpsStatusText()}
                </span>
              </div>
            )}
          </div>
          <div className="text-right">
            <div className="text-white font-mono text-sm">{formatDuration(duration)}</div>
            <div className="text-gray-300 text-xs">{photoCount} photos</div>
          </div>
        </div>

        {/* GPS Error Display */}
        {gpsError && sessionState !== 'NOT_STARTED' && sessionState !== 'ENDED' && (
          <div className="mt-2 bg-red-600/90 text-white text-xs px-3 py-2 rounded">
            GPS: {gpsError}
          </div>
        )}

        {/* Audio Error Display */}
        {audioError && sessionState !== 'NOT_STARTED' && sessionState !== 'ENDED' && (
          <div className="mt-2 bg-orange-600/90 text-white text-xs px-3 py-2 rounded">
            Audio: {audioError}
          </div>
        )}

        {/* Audio Recording Indicator */}
        {sessionState === 'RECORDING' && audioRecorder?.state === 'recording' && (
          <div className="mt-2 flex items-center gap-2 text-xs">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-white/80">Recording audio</span>
          </div>
        )}
      </div>

      {/* Bottom Controls */}
      <div className="absolute bottom-24 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent pb-6 pt-6 px-6 z-10">
        {sessionState === 'NOT_STARTED' && (
          <div className="flex flex-col gap-4">
            <button
              onClick={handleStartSession}
              className="w-full py-4 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors active:scale-95"
            >
              Start Session
            </button>
          </div>
        )}

        {(sessionState === 'RECORDING' || sessionState === 'PAUSED') && (
          <div className="space-y-6 mb-4">
            {/* Main capture button */}
            <div className="flex justify-center">
              <button
                onClick={handleCapturePhoto}
                disabled={sessionState === 'PAUSED'}
                className={`w-20 h-20 rounded-full border-4 border-white ${
                  sessionState === 'PAUSED'
                    ? 'bg-gray-600 opacity-50 cursor-not-allowed'
                    : 'bg-white/20 active:scale-95 hover:bg-white/30'
                } transition-all shadow-lg`}
                aria-label="Capture photo"
              />
            </div>

            {/* Control buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handlePauseResume}
                className={`py-3 px-6 ${
                  sessionState === 'PAUSED'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-yellow-600 hover:bg-yellow-700'
                } text-white font-semibold rounded-lg transition-colors active:scale-95`}
              >
                {sessionState === 'PAUSED' ? 'Resume' : 'Pause'}
              </button>
              <button
                onClick={handleEndSession}
                className="py-3 px-6 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors active:scale-95"
              >
                End Session
              </button>
            </div>
          </div>
        )}

        {sessionState === 'ENDED' && (
          <div className="flex flex-col gap-4 text-center">
            <div className="text-white mb-2">
              <p className="text-lg font-semibold mb-1">Session Complete</p>
              <p className="text-gray-300 text-sm">
                Duration: {formatDuration(duration)} | Photos: {photoCount}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => router.push('/')}
                className="py-3 px-6 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-colors active:scale-95"
              >
                Back to Projects
              </button>
              <button
                onClick={() => setSessionState('NOT_STARTED')}
                className="py-3 px-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors active:scale-95"
              >
                New Session
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
