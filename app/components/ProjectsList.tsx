'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Project } from '../lib/types';
import { getAllProjects, deleteProject, getProjectPhotos, updateProject } from '../lib/db';
import CreateProjectModal from './CreateProjectModal';
import ProjectCard from './ProjectCard';
import EmptyState from './EmptyState';

export default function ProjectsList() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [confirmDeleteProject, setConfirmDeleteProject] = useState<string | null>(null);
  const router = useRouter();
  const thumbnailsGeneratedRef = useRef<Set<string>>(new Set());

  const loadProjects = useCallback(async () => {
    try {
      console.log('[ProjectsList] Loading projects...');
      const allProjects = await getAllProjects();
      console.log('[ProjectsList] Loaded', allProjects.length, 'projects');
      setProjects(allProjects);
    } catch (error) {
      console.error('[ProjectsList] Failed to load projects:', error);
      // Show error to user
      alert('Failed to load projects: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Always reload on mount/remount (which happens when navigating back)
    loadProjects();

    // Also reload when page becomes visible
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('Page visible, reloading projects');
        loadProjects();
      }
    };

    const handleFocus = () => {
      console.log('Window focused, reloading projects');
      loadProjects();
    };

    // Set up a periodic refresh every 2 seconds when page is active
    const intervalId = setInterval(() => {
      if (!document.hidden) {
        loadProjects();
      }
    }, 2000);

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [loadProjects]);

  // Auto-generate thumbnails for projects that have photos but no thumbnail
  useEffect(() => {
    const generateMissingThumbnails = async () => {
      for (const project of projects) {
        // Skip if already has thumbnail or no photos or already attempted
        if (project.thumbnail || project.photoCount === 0 || thumbnailsGeneratedRef.current.has(project.id)) {
          continue;
        }

        thumbnailsGeneratedRef.current.add(project.id);

        try {
          const photos = await getProjectPhotos(project.id);
          if (photos.length > 0) {
            // Sort by timestamp and get the first photo
            photos.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
            const firstPhoto = photos[0];

            // Create thumbnail
            const thumbnail = await createThumbnail(firstPhoto.imageData, 200);

            // Update project
            const updatedProject = {
              ...project,
              thumbnail,
              thumbnailPhotoId: firstPhoto.id,
            };
            await updateProject(updatedProject);

            // Update local state
            setProjects(prev => prev.map(p => p.id === project.id ? updatedProject : p));
            console.log('[ProjectsList] Generated thumbnail for project:', project.name);
          }
        } catch (error) {
          console.error('[ProjectsList] Failed to generate thumbnail for project:', project.id, error);
        }
      }
    };

    if (!loading && projects.length > 0) {
      generateMissingThumbnails();
    }
  }, [projects, loading]);

  // Helper to create a smaller thumbnail from base64 image
  const createThumbnail = (base64Image: string, maxSize: number): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

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
      img.onerror = () => resolve(''); // Return empty on error
      img.src = base64Image;
    });
  };

  const handleProjectClick = (projectId: string) => {
    router.push(`/project/${projectId}`);
  };

  const handleProjectCreated = (project: Project) => {
    setProjects(prev => [project, ...prev]);
    setShowCreateModal(false);
    router.push(`/capture/${project.id}`);
  };

  const handleDeleteProject = async (projectId: string) => {
    try {
      await deleteProject(projectId);
      setProjects(prev => prev.filter(p => p.id !== projectId));
      setConfirmDeleteProject(null);
    } catch (error) {
      console.error('Failed to delete project:', error);
      alert('Failed to delete project. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-b from-gray-900 to-black text-white overflow-y-scroll" style={{ WebkitOverflowScrolling: 'touch' }}>
      {/* Header */}
      <div className="max-w-2xl mx-auto px-6 pt-6 pb-4">
        <h1 className="text-3xl font-bold mb-1">ChoraGraph Capture</h1>
        <p className="text-gray-400 text-sm">Environmental Field Evidence</p>
      </div>

      {/* Projects List */}
      <div className="max-w-2xl mx-auto px-4 space-y-3 pb-28">
        {loading ? (
          <div className="text-center text-gray-400 py-8">Loading projects...</div>
        ) : projects.length === 0 ? (
          <EmptyState onCreateProject={() => setShowCreateModal(true)} />
        ) : (
          projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onClick={() => handleProjectClick(project.id)}
              onDelete={() => setConfirmDeleteProject(project.id)}
            />
          ))
        )}
      </div>

      {/* Floating New Project Button - Bottom Center - Liquid Glass Style */}
      <div className="fixed bottom-6 left-0 right-0 flex justify-center z-40 px-4">
        <button
          onClick={() => {
            console.log('[ProjectsList] New Project button clicked');
            setShowCreateModal(true);
          }}
          className="group relative px-8 py-4 rounded-full font-semibold transition-all duration-300 ease-out active:scale-95 hover:scale-105"
        >
          {/* Outer glow */}
          <div className="absolute inset-0 rounded-full bg-emerald-500/20 blur-xl group-hover:bg-emerald-400/30 transition-all duration-300" />

          {/* Glass background with blur */}
          <div className="absolute inset-0 rounded-full backdrop-blur-xl bg-white/10 border border-white/20 shadow-lg shadow-black/20" />

          {/* Top highlight reflection */}
          <div className="absolute inset-x-2 top-0.5 h-1/2 rounded-t-full bg-gradient-to-b from-white/25 to-transparent" />

          {/* Inner gradient for depth */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-b from-emerald-400/30 via-emerald-500/20 to-emerald-600/30" />

          {/* Bottom edge highlight */}
          <div className="absolute inset-x-4 bottom-1 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

          {/* Content */}
          <span className="relative flex items-center gap-2 text-white drop-shadow-sm">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            New Project
          </span>
        </button>
      </div>

      {/* Create Project Modal */}
      {showCreateModal && (
        <CreateProjectModal
          onClose={() => setShowCreateModal(false)}
          onProjectCreated={handleProjectCreated}
        />
      )}

      {/* Delete Project Confirmation Dialog */}
      {confirmDeleteProject && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-xl p-6 max-w-sm w-full border border-gray-700">
            <h3 className="text-white font-semibold text-lg mb-3">Delete Project?</h3>
            <p className="text-gray-300 text-sm mb-2">
              This will permanently delete the project and all associated photos and audio recordings.
            </p>
            <p className="text-red-400 text-sm font-semibold mb-6">
              This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDeleteProject(null)}
                className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteProject(confirmDeleteProject)}
                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-colors"
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
