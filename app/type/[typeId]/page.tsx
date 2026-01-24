'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Project, ProjectType } from '../../lib/types';
import { getAllProjects, deleteProject, getProjectPhotos, updateProject } from '../../lib/db';
import { getTypeConfig, PROJECT_TYPE_CONFIGS } from '../../lib/projectTypeConfig';
import ProjectCard from '../../components/ProjectCard';
import CreateProjectModal from '../../components/CreateProjectModal';

export default function TypeFilteredPage() {
  const params = useParams();
  const router = useRouter();
  const typeId = params.typeId as ProjectType;

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [confirmDeleteProject, setConfirmDeleteProject] = useState<string | null>(null);
  const thumbnailsGeneratedRef = useRef<Set<string>>(new Set());

  // Validate the type
  const typeConfig = PROJECT_TYPE_CONFIGS[typeId];
  const isValidType = !!typeConfig;

  const loadProjects = useCallback(async () => {
    if (!isValidType) {
      setLoading(false);
      return;
    }

    try {
      const allProjects = await getAllProjects();
      const filteredProjects = allProjects.filter(p => p.projectType === typeId);
      // Sort by modifiedAt descending
      filteredProjects.sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime());
      setProjects(filteredProjects);
    } catch (error) {
      console.error('[TypeFilteredPage] Failed to load projects:', error);
      alert('Failed to load projects: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [typeId, isValidType]);

  useEffect(() => {
    loadProjects();

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        loadProjects();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', loadProjects);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', loadProjects);
    };
  }, [loadProjects]);

  // Auto-generate thumbnails
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
          console.error('[TypeFilteredPage] Failed to generate thumbnail:', project.id, error);
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

  const handleBack = () => {
    router.push('/');
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

  // Show error for invalid type
  if (!isValidType) {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-gray-900 to-black text-white flex flex-col items-center justify-center p-4">
        <div className="text-5xl mb-4">❓</div>
        <h2 className="text-xl font-semibold mb-2">Unknown Project Type</h2>
        <p className="text-gray-400 mb-6">The project type "{typeId}" doesn't exist.</p>
        <button
          onClick={handleBack}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-xl font-semibold transition-colors"
        >
          Go Home
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gradient-to-b from-gray-900 to-black text-white overflow-y-scroll" style={{ WebkitOverflowScrolling: 'touch' }}>
      {/* Header */}
      <div className="sticky top-0 z-30 bg-gray-900/80 backdrop-blur-lg border-b border-white/10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={handleBack}
              className="p-2 -ml-2 hover:bg-white/10 rounded-lg transition-colors"
              aria-label="Go back"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{typeConfig.icon}</span>
              <h1 className="text-xl font-bold">{typeConfig.label}</h1>
            </div>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-xl font-semibold transition-colors text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            New
          </button>
        </div>
      </div>

      {/* Description */}
      <div className="max-w-2xl mx-auto px-4 py-3">
        <p className="text-gray-400 text-sm">{typeConfig.description}</p>
      </div>

      {/* Projects List */}
      <div className="max-w-2xl mx-auto px-4 pb-8">
        {loading ? (
          <div className="text-center text-gray-400 py-12">Loading projects...</div>
        ) : projects.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="text-5xl mb-4">{typeConfig.icon}</div>
            <h3 className="text-xl font-semibold text-white mb-2">No {typeConfig.label} projects</h3>
            <p className="text-gray-400 mb-6">
              Create your first {typeConfig.shortLabel.toLowerCase()} project to get started.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 rounded-xl font-semibold transition-colors"
            >
              Create Project
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {projects.map((project) => (
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

      {/* Create Project Modal with preselected type */}
      {showCreateModal && (
        <CreateProjectModal
          onClose={() => setShowCreateModal(false)}
          onProjectCreated={handleProjectCreated}
          preselectedType={typeId}
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
