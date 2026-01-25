'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Project, ProjectType } from '../lib/types';
import { getAllProjects, deleteProject, getProjectPhotos, updateProject } from '../lib/db';
import { getTypesByCategory, getTypeConfig } from '../lib/projectTypeConfig';
import HorizontalScrollRow from './HorizontalScrollRow';
import ProjectTypeCard from './ProjectTypeCard';
import AddMoreCard from './AddMoreCard';
import ProjectCard from './ProjectCard';
export default function HomePage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDeleteProject, setConfirmDeleteProject] = useState<string | null>(null);
  const router = useRouter();
  const thumbnailsGeneratedRef = useRef<Set<string>>(new Set());

  const workTypes = getTypesByCategory('work');
  const personalTypes = getTypesByCategory('personal');

  const loadProjects = useCallback(async () => {
    try {
      const allProjects = await getAllProjects();
      setProjects(allProjects);
    } catch (error) {
      console.error('[HomePage] Failed to load projects:', error);
      alert('Failed to load projects: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        loadProjects();
      }
    };

    const handleFocus = () => {
      loadProjects();
    };

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
        if (project.thumbnail || project.photoCount === 0 || thumbnailsGeneratedRef.current.has(project.id)) {
          continue;
        }

        thumbnailsGeneratedRef.current.add(project.id);

        try {
          const photos = await getProjectPhotos(project.id);
          if (photos.length > 0) {
            photos.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
            const firstPhoto = photos[0];
            const thumbnail = await createThumbnail(firstPhoto.imageData, 200);

            const updatedProject = {
              ...project,
              thumbnail,
              thumbnailPhotoId: firstPhoto.id,
            };
            await updateProject(updatedProject);
            setProjects(prev => prev.map(p => p.id === project.id ? updatedProject : p));
          }
        } catch (error) {
          console.error('[HomePage] Failed to generate thumbnail:', project.id, error);
        }
      }
    };

    if (!loading && projects.length > 0) {
      generateMissingThumbnails();
    }
  }, [projects, loading]);

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
      img.onerror = () => resolve('');
      img.src = base64Image;
    });
  };

  // Get project count by type
  const getProjectCountByType = (type: ProjectType): number => {
    return projects.filter(p => p.projectType === type).length;
  };

  // Get all projects sorted by modifiedAt (most recent first)
  const recentProjects = [...projects]
    .sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime());

  const handleTypeClick = (type: ProjectType) => {
    router.push(`/type/${type}`);
  };

  const handleProjectClick = (projectId: string) => {
    router.push(`/project/${projectId}`);
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
      <div className="max-w-2xl mx-auto px-4 pt-10 pb-6 text-center">
        <h1 className="text-3xl font-bold mb-1">ChoraGraph Capture</h1>
        <p className="text-gray-400 text-sm">
          Capture, document, remember <span className="font-bold text-white">what</span> and <span className="font-bold text-white">where</span>.
        </p>
      </div>

      {/* Work Types Row */}
      <HorizontalScrollRow title="Work">
        {workTypes.map(config => (
          <ProjectTypeCard
            key={config.type}
            config={config}
            projectCount={getProjectCountByType(config.type)}
            onClick={() => handleTypeClick(config.type)}
          />
        ))}
        <AddMoreCard />
      </HorizontalScrollRow>

      {/* Personal Types Row */}
      <HorizontalScrollRow title="Personal">
        {personalTypes.map(config => (
          <ProjectTypeCard
            key={config.type}
            config={config}
            projectCount={getProjectCountByType(config.type)}
            onClick={() => handleTypeClick(config.type)}
          />
        ))}
        <AddMoreCard />
      </HorizontalScrollRow>

      {/* Recent Projects Section */}
      <div className="max-w-2xl mx-auto px-8 pb-32">
        <h2 className="text-lg font-semibold text-white mb-4">Recent Projects</h2>

        {loading ? (
          <div className="text-center text-gray-400 py-8">Loading projects...</div>
        ) : recentProjects.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="text-5xl mb-4">📸</div>
            <h3 className="text-xl font-semibold text-white mb-2">No projects yet</h3>
            <p className="text-gray-400 mb-6">
              Tap a category above to create your first project
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {recentProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onClick={() => handleProjectClick(project.id)}
                onDelete={() => setConfirmDeleteProject(project.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Floating Search Button */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          onClick={() => router.push('/search')}
          className="group relative w-14 h-14 rounded-full font-semibold transition-all duration-300 ease-out active:scale-95 hover:scale-105"
        >
          <div className="absolute inset-0 rounded-full bg-blue-500/20 blur-xl group-hover:bg-blue-400/30 transition-all duration-300" />
          <div className="absolute inset-0 rounded-full backdrop-blur-xl bg-white/10 border border-white/20 shadow-lg shadow-black/20" />
          <div className="absolute inset-x-2 top-0.5 h-1/2 rounded-t-full bg-gradient-to-b from-white/25 to-transparent" />
          <div className="absolute inset-0 rounded-full bg-gradient-to-b from-blue-400/30 via-blue-500/20 to-blue-600/30" />
          <span className="relative flex items-center justify-center text-white drop-shadow-sm">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
        </button>
      </div>

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
