'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Project, SessionState, GpsStatus, GpsCoordinates, PhotoMetadata, AudioMetadata, ProjectContext, ProjectType, CompassStatus, CompassData } from '../lib/types';
import { savePhoto, updateProject, saveAudio, getProject, getProjectPhotos } from '../lib/db';
import ThumbnailPicker from './ThumbnailPicker';

interface Props {
  project: Project;
  context?: ProjectContext;
}

// Session length limits to prevent exceeding Vercel Blob 500MB limit
// At ~64kbps WebM Opus, 4 hours = ~115MB (well under limit)
const MAX_SESSION_DURATION_SECONDS = 4 * 60 * 60; // 4 hours
const WARNING_BEFORE_END_SECONDS = 5 * 60; // Warn 5 minutes before

// Project type badge configuration
const PROJECT_TYPE_BADGES: Record<ProjectType, { bg: string; label: string }> = {
  'phase1-esa': { bg: 'bg-green-600', label: 'Phase I ESA' },
  'eir-eis': { bg: 'bg-blue-600', label: 'EIR/EIS' },
  'borehole': { bg: 'bg-orange-600', label: 'Borehole' },
  'generic': { bg: 'bg-gray-600', label: 'Site Visit' },
};

export default function CaptureInterface({ project, context }: Props) {
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

  // Compass state
  const [compassStatus, setCompassStatus] = useState<CompassStatus>('NOT_REQUESTED');
  const [currentCompass, setCurrentCompass] = useState<CompassData | null>(null);
  const [compassError, setCompassError] = useState<string | null>(null);

  // Audio recording state
  const [audioRecorder, setAudioRecorder] = useState<MediaRecorder | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const sessionIdRef = useRef<string>(crypto.randomUUID());

  // Capture prompts rotation state
  const [currentPromptIndex, setCurrentPromptIndex] = useState(0);
  const capturePrompts = context?.capturePrompts || [];

  // Thumbnail picker state
  const [showThumbnailPicker, setShowThumbnailPicker] = useState(false);
  const [sessionPhotos, setSessionPhotos] = useState<PhotoMetadata[]>([]);

  // Session length limit warning
  const [showSessionWarning, setShowSessionWarning] = useState(false);

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

  // Capture prompts rotation (every 10 seconds during recording)
  useEffect(() => {
    if (sessionState !== 'RECORDING' || capturePrompts.length === 0) return;

    const interval = setInterval(() => {
      setCurrentPromptIndex(prev => (prev + 1) % capturePrompts.length);
    }, 10000);

    return () => clearInterval(interval);
  }, [sessionState, capturePrompts.length]);

  // Session length limit monitoring
  useEffect(() => {
    if (sessionState !== 'RECORDING') {
      setShowSessionWarning(false);
      return;
    }

    // Show warning 5 minutes before limit
    const warningTime = MAX_SESSION_DURATION_SECONDS - WARNING_BEFORE_END_SECONDS;
    if (duration >= warningTime && duration < MAX_SESSION_DURATION_SECONDS) {
      setShowSessionWarning(true);
    }

    // Auto-end at limit
    if (duration >= MAX_SESSION_DURATION_SECONDS) {
      console.log('[Session] Maximum duration reached, auto-ending session');
      handleEndSession();
    }
  }, [duration, sessionState]);

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

      // Create audio-only stream to avoid recording video frames
      // This dramatically reduces file size (from ~75MB to ~100KB for short recordings)
      const audioOnlyStream = new MediaStream(audioTracks);

      // Determine best supported mime type
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4'; // Fallback for iOS

      const recorder = new MediaRecorder(audioOnlyStream, { mimeType });

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

      // Start recording immediately if session is active
      // This prevents race conditions with useEffect timing
      if (recorder.state === 'inactive') {
        console.log('Starting audio recording immediately after initialization');
        recorder.start(1000); // Collect data every 1 second
      }

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

  // Compass initialization
  const initializeCompass = async () => {
    // Check if DeviceOrientationEvent is available
    if (!('DeviceOrientationEvent' in window)) {
      setCompassStatus('UNSUPPORTED');
      setCompassError('Compass not supported');
      return;
    }

    setCompassStatus('REQUESTING');
    setCompassError(null);

    // iOS 13+ requires explicit permission request
    const DeviceOrientationEventTyped = DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<'granted' | 'denied'>;
    };

    if (typeof DeviceOrientationEventTyped.requestPermission === 'function') {
      try {
        const permission = await DeviceOrientationEventTyped.requestPermission();
        if (permission !== 'granted') {
          setCompassStatus('DENIED');
          setCompassError('Compass permission denied');
          return;
        }
      } catch (err) {
        console.error('Compass permission error:', err);
        setCompassStatus('ERROR');
        setCompassError('Compass permission error');
        return;
      }
    }

    // Add event listener for device orientation
    const handleOrientation = (event: DeviceOrientationEvent) => {
      // webkitCompassHeading is available on iOS and gives true north heading
      // alpha gives rotation around z-axis (compass heading on Android, but needs calibration)
      const webkitHeading = (event as DeviceOrientationEvent & { webkitCompassHeading?: number }).webkitCompassHeading;
      const webkitAccuracy = (event as DeviceOrientationEvent & { webkitCompassAccuracy?: number }).webkitCompassAccuracy;

      let heading: number | null = null;

      if (typeof webkitHeading === 'number' && webkitHeading >= 0) {
        // iOS - use webkitCompassHeading (true north)
        heading = webkitHeading;
      } else if (typeof event.alpha === 'number') {
        // Android/other - alpha is rotation from north (but may need adjustment)
        // Note: On Android, alpha=0 means device is pointing in the same direction it was
        // when the sensor was last calibrated. For true north, we'd need to use
        // event.absolute === true, but this isn't widely supported.
        // For now, we use alpha as a relative heading (better than nothing)
        heading = (360 - event.alpha) % 360;
      }

      if (heading !== null) {
        setCurrentCompass({
          heading: Math.round(heading),
          accuracy: typeof webkitAccuracy === 'number' ? webkitAccuracy : undefined,
          timestamp: Date.now(),
        });
        setCompassStatus('ACTIVE');
        setCompassError(null);
      }
    };

    window.addEventListener('deviceorientation', handleOrientation, true);

    // Store cleanup function
    (window as Window & { _compassCleanup?: () => void })._compassCleanup = () => {
      window.removeEventListener('deviceorientation', handleOrientation, true);
    };
  };

  const stopCompass = () => {
    const cleanup = (window as Window & { _compassCleanup?: () => void })._compassCleanup;
    if (cleanup) {
      cleanup();
      delete (window as Window & { _compassCleanup?: () => void })._compassCleanup;
    }
    setCompassStatus('NOT_REQUESTED');
    setCurrentCompass(null);
    setCompassError(null);
  };

  // Cleanup GPS and compass on unmount
  useEffect(() => {
    return () => {
      stopGps();
      stopCompass();
    };
  }, []);

  // Audio recorder lifecycle - start/pause/resume/stop based on sessionState
  useEffect(() => {
    console.log('Audio effect triggered - sessionState:', sessionState, 'recorder:', audioRecorder ? `state=${audioRecorder.state}` : 'null');

    if (!audioRecorder) return;

    if (sessionState === 'RECORDING' && audioRecorder.state === 'inactive') {
      console.log('Starting audio recording (fallback)');
      audioRecorder.start(1000); // Collect data every 1 second
    } else if (sessionState === 'RECORDING' && audioRecorder.state === 'recording') {
      console.log('Audio already recording - no action needed');
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
    initializeCompass();

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
              compass: currentCompass ? { ...currentCompass } : null,
              imageData: base64data,
              sessionTimestamp: duration,
            };

            // Save to IndexedDB
            await savePhoto(photoMetadata);

            // Read current project from DB to get accurate photo count
            const currentProject = await getProject(project.id);
            if (currentProject) {
              // Update project photo count and modified date
              const updatedProject = {
                ...currentProject,
                photoCount: currentProject.photoCount + 1,
                modifiedAt: new Date().toISOString(),
              };
              await updateProject(updatedProject);
            }

            // Update local state
            setPhotoCount(prev => prev + 1);

            // Debug log
            console.log('Photo captured:', {
              id: photoMetadata.id,
              projectName: project.name,
              gps: currentGps
                ? `${currentGps.latitude.toFixed(6)}, ${currentGps.longitude.toFixed(6)} (±${Math.round(currentGps.accuracy)}m)`
                : 'No GPS',
              compass: currentCompass
                ? `${currentCompass.heading}° ${currentCompass.accuracy ? `(±${currentCompass.accuracy}°)` : ''}`
                : 'No compass'
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
        console.warn('[Audio] No audio chunks to save - recording may have failed to start');
        console.warn('[Audio] This can happen if: 1) microphone permission denied, 2) MediaRecorder.start() never called, 3) session was too short');
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

        // Read current project from DB to get accurate audio count
        const currentProject = await getProject(project.id);
        if (currentProject) {
          // Update project audio count
          const updatedProject = {
            ...currentProject,
            audioCount: (currentProject.audioCount || 0) + 1,
            modifiedAt: new Date().toISOString(),
          };
          await updateProject(updatedProject);
        }

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

  const handleEndSession = async () => {
    setSessionState('ENDED');
    stopGps();
    stopCompass();

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

    // Fetch photos for thumbnail picker
    try {
      const photos = await getProjectPhotos(project.id);
      // Sort by timestamp (most recent first for selection)
      photos.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setSessionPhotos(photos);
      setShowThumbnailPicker(true);
    } catch (error) {
      console.error('Failed to fetch photos for thumbnail picker:', error);
      // Navigate anyway if we can't fetch photos
      router.push(`/project/${project.id}`);
    }
  };

  const handleThumbnailSelect = async (photoId: string, thumbnailData: string) => {
    try {
      const currentProject = await getProject(project.id);
      if (currentProject) {
        // Create a smaller thumbnail from the selected photo
        const thumbnail = await createThumbnail(thumbnailData, 200);

        const updatedProject = {
          ...currentProject,
          thumbnailPhotoId: photoId,
          thumbnail: thumbnail,
          modifiedAt: new Date().toISOString(),
        };
        await updateProject(updatedProject);
        console.log('Thumbnail saved for project:', project.id);
      }
    } catch (error) {
      console.error('Failed to save thumbnail:', error);
    }

    // Navigate to project review page
    router.push(`/project/${project.id}`);
  };

  const handleThumbnailSkip = () => {
    // Navigate to project review without selecting thumbnail
    router.push(`/project/${project.id}`);
  };

  // Helper to create a smaller thumbnail from base64 image
  const createThumbnail = (base64Image: string, maxSize: number): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Calculate dimensions maintaining aspect ratio
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxSize) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx?.drawImage(img, 0, 0, width, height);

        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.src = base64Image;
    });
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

  const getCompassStatusColor = () => {
    switch (compassStatus) {
      case 'ACTIVE': return 'text-blue-400';
      case 'REQUESTING': return 'text-yellow-400 animate-pulse';
      case 'ERROR':
      case 'DENIED':
      case 'UNSUPPORTED': return 'text-gray-500';
      default: return 'text-gray-400';
    }
  };

  const getCompassStatusText = () => {
    if (compassStatus === 'ACTIVE' && currentCompass) {
      // Convert heading to cardinal direction
      const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
      const index = Math.round(currentCompass.heading / 45) % 8;
      return `${currentCompass.heading}° ${directions[index]}`;
    }
    switch (compassStatus) {
      case 'REQUESTING': return 'Calibrating...';
      case 'DENIED': return 'Denied';
      case 'ERROR': return 'Error';
      case 'UNSUPPORTED': return 'N/A';
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
              {/* Dynamic project type badge */}
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium mb-2 ${PROJECT_TYPE_BADGES[project.projectType || 'phase1-esa']?.bg || 'bg-gray-600'}`}>
                {PROJECT_TYPE_BADGES[project.projectType || 'phase1-esa']?.label || 'Site Visit'}
              </span>
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

            {/* Compass Status */}
            {sessionState !== 'NOT_STARTED' && sessionState !== 'ENDED' && compassStatus !== 'UNSUPPORTED' && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-black/40">
                <svg
                  className={`w-3 h-3 ${getCompassStatusColor()}`}
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 11.88a1 1 0 101.414 1.414l2.293-2.293A1 1 0 0011.707 10V7z" clipRule="evenodd" />
                </svg>
                <span className="text-xs text-white">
                  {getCompassStatusText()}
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

        {/* Session Length Warning */}
        {showSessionWarning && (
          <div className="mt-2 bg-yellow-600 text-white p-3 rounded-lg">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="font-medium">Session ending in {Math.ceil((MAX_SESSION_DURATION_SECONDS - duration) / 60)} minutes</span>
            </div>
            <p className="text-sm mt-1 opacity-90">Maximum session length reached. End session to save your work.</p>
          </div>
        )}

        {/* Rotating Capture Prompts */}
        {sessionState === 'RECORDING' && capturePrompts.length > 0 && (
          <div className="mt-3 bg-black/60 rounded-lg p-3 border border-yellow-500/30">
            <div className="flex items-start gap-2 text-yellow-400 text-sm">
              <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
              </svg>
              <span>{capturePrompts[currentPromptIndex]}</span>
            </div>
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

        {sessionState === 'ENDED' && !showThumbnailPicker && (
          <div className="flex flex-col gap-4 text-center">
            <div className="text-white mb-2">
              <p className="text-lg font-semibold mb-1">Processing...</p>
              <p className="text-gray-300 text-sm">
                Preparing your photos
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Thumbnail Picker Modal */}
      {showThumbnailPicker && (
        <ThumbnailPicker
          photos={sessionPhotos}
          onSelect={handleThumbnailSelect}
          onSkip={handleThumbnailSkip}
          sessionDuration={formatDuration(duration)}
          photoCount={photoCount}
        />
      )}
    </div>
  );
}
