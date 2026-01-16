'use client';

// Session handler page for launched sessions from Claude Code
// Route: /session/[sessionId]?data=base64url_encoded_context

import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import { Project, ProjectContext, LaunchSessionRecord } from '@/app/lib/types';
import {
  createProject,
  saveLaunchSession,
  getLaunchSession,
  getProject,
  updateLaunchSession,
} from '@/app/lib/db';
import CaptureInterface from '@/app/components/CaptureInterface';

// Loading component
function LoadingScreen({ message }: { message: string }) {
  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center">
      <div className="text-center text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white mx-auto mb-4"></div>
        <p className="text-lg">{message}</p>
      </div>
    </div>
  );
}

// Error component
function ErrorScreen({ title, message, onRetry }: { title: string; message: string; onRetry?: () => void }) {
  const router = useRouter();

  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center p-4">
      <div className="bg-red-900/50 border border-red-500 rounded-lg p-6 max-w-md text-center">
        <div className="text-red-400 text-4xl mb-4">!</div>
        <h2 className="text-white text-xl font-semibold mb-2">{title}</h2>
        <p className="text-gray-300 mb-6">{message}</p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
          >
            Go Home
          </button>
          {onRetry && (
            <button
              onClick={onRetry}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
            >
              Try Again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Session data interface (decoded from URL)
interface SessionData {
  sessionId: string;
  projectId?: string;
  projectType: 'phase1-esa' | 'eir-eis' | 'borehole' | 'generic';
  projectName: string;
  lead?: string;
  notes?: string;
  context: ProjectContext;
  expiresAt: string;
  createdAt: string;
}

// Main session content component
function SessionContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  const [project, setProject] = useState<Project | null>(null);
  const [context, setContext] = useState<ProjectContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Initializing session...');
  const [error, setError] = useState<{ title: string; message: string } | null>(null);

  useEffect(() => {
    initializeSession();
  }, [sessionId]);

  const initializeSession = async () => {
    try {
      setLoading(true);
      setError(null);

      // Check if we already have this session activated
      setLoadingMessage('Checking session status...');
      const existingSession = await getLaunchSession(sessionId);

      if (existingSession && existingSession.localProjectId) {
        // Session already activated - load existing project
        setLoadingMessage('Loading existing project...');
        const existingProject = await getProject(existingSession.localProjectId);

        if (existingProject) {
          console.log('[Session] Resuming existing session:', sessionId);
          setProject(existingProject);
          setContext(existingSession.context);
          setLoading(false);
          return;
        }
      }

      // Parse session data from URL
      setLoadingMessage('Decoding session data...');
      const encodedData = searchParams.get('data');

      if (!encodedData) {
        throw new Error('Missing session data. Please use a valid session URL.');
      }

      let sessionData: SessionData;
      try {
        // Browser-compatible base64url decoding
        // Replace base64url chars with standard base64, then decode
        const base64 = encodedData
          .replace(/-/g, '+')
          .replace(/_/g, '/');
        // Add padding if needed
        const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
        const decoded = atob(padded);
        sessionData = JSON.parse(decoded);
      } catch {
        throw new Error('Invalid session data format. The session URL may be corrupted.');
      }

      // Validate session ID matches
      if (sessionData.sessionId !== sessionId) {
        throw new Error('Session ID mismatch. Please use the correct session URL.');
      }

      // Check expiration
      if (new Date(sessionData.expiresAt) < new Date()) {
        throw new Error('This session has expired. Please request a new session from Claude Code.');
      }

      // Create local project from session data
      setLoadingMessage('Creating project...');
      const newProject: Project = {
        id: crypto.randomUUID(),
        name: sessionData.projectName,
        lead: sessionData.lead || 'Field User',
        notes: sessionData.notes,
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
        photoCount: 0,
        audioCount: 0,
        // Multi-project fields
        projectType: sessionData.projectType,
        externalProjectId: sessionData.projectId,
        launchSessionId: sessionId,
        context: sessionData.context,
        processingStage: 'captured',
      };

      await createProject(newProject);

      // Save launch session record for tracking
      const launchRecord: LaunchSessionRecord = {
        sessionId,
        externalProjectId: sessionData.projectId,
        projectType: sessionData.projectType,
        projectName: sessionData.projectName,
        lead: sessionData.lead,
        notes: sessionData.notes,
        context: sessionData.context,
        createdAt: sessionData.createdAt,
        expiresAt: sessionData.expiresAt,
        status: 'active',
        localProjectId: newProject.id,
      };

      // Try to save, update if already exists
      try {
        await saveLaunchSession(launchRecord);
      } catch {
        // Session might already exist from a previous attempt
        await updateLaunchSession(launchRecord);
      }

      console.log('[Session] Created new project from launch:', {
        sessionId,
        projectId: newProject.id,
        projectType: sessionData.projectType,
      });

      setProject(newProject);
      setContext(sessionData.context);

    } catch (err: unknown) {
      console.error('[Session] Initialization error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize session';
      setError({
        title: 'Session Error',
        message: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  // Render states
  if (loading) {
    return <LoadingScreen message={loadingMessage} />;
  }

  if (error) {
    return (
      <ErrorScreen
        title={error.title}
        message={error.message}
        onRetry={error.message.includes('expired') ? undefined : initializeSession}
      />
    );
  }

  if (!project || !context) {
    return (
      <ErrorScreen
        title="Session Not Found"
        message="Unable to load the capture session. Please try again or request a new session."
        onRetry={initializeSession}
      />
    );
  }

  // Render capture interface with context
  return <CaptureInterface project={project} context={context} />;
}

// Main page component with Suspense boundary
export default function SessionPage() {
  return (
    <Suspense fallback={<LoadingScreen message="Loading session..." />}>
      <SessionContent />
    </Suspense>
  );
}
