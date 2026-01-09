'use client';

import { useEffect, useRef, useState } from 'react';

type SessionState = 'NOT_STARTED' | 'RECORDING' | 'PAUSED' | 'ENDED';

export default function CaptureInterface() {
  const [sessionState, setSessionState] = useState<SessionState>('NOT_STARTED');
  const [duration, setDuration] = useState(0);
  const [photoCount, setPhotoCount] = useState(0);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize camera once when starting recording
  useEffect(() => {
    if (sessionState === 'RECORDING' && !stream) {
      initializeCamera();
    }
    // Only cleanup stream on unmount or when ending session
    // Don't stop tracks during pause/resume cycle
    return () => {
      if (sessionState === 'ENDED' && stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [sessionState, stream]);

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
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // rear camera
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });

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
    } catch (err) {
      setError('Camera access denied or unavailable');
      console.error('Camera initialization error:', err);
    }
  };

  const handleStartSession = () => {
    setSessionState('RECORDING');
    setDuration(0);
    setPhotoCount(0);
  };

  const handleCapturePhoto = () => {
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

    // Convert to blob and save (for now, just increment count)
    // In future: save to IndexedDB with GPS and timestamp
    canvas.toBlob((blob) => {
      if (blob) {
        // TODO: Save blob to IndexedDB with metadata
        setPhotoCount(prev => prev + 1);

        // Visual feedback
        const flash = document.getElementById('flash-overlay');
        if (flash) {
          flash.classList.remove('opacity-0');
          setTimeout(() => flash.classList.add('opacity-0'), 100);
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

  const handleEndSession = () => {
    setSessionState('ENDED');
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    // TODO: Trigger post-processing flow
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-white font-semibold text-lg">ESA Capture Agent</h1>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${getStatusColor()} ${sessionState === 'RECORDING' ? 'animate-pulse' : ''}`} />
              <span className="text-white text-sm font-medium">{getStatusText()}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-white font-mono text-sm">{formatDuration(duration)}</div>
            <div className="text-gray-300 text-xs">{photoCount} photos</div>
          </div>
        </div>
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
            <button
              onClick={() => setSessionState('NOT_STARTED')}
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors active:scale-95"
            >
              Start New Session
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
