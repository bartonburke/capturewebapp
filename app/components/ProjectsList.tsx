'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Project } from '../lib/types';
import { getAllProjects, deleteProject } from '../lib/db';
import CreateProjectModal from './CreateProjectModal';

export default function ProjectsList() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [confirmDeleteProject, setConfirmDeleteProject] = useState<string | null>(null);
  const router = useRouter();

  const loadProjects = useCallback(async () => {
    try {
      const allProjects = await getAllProjects();
      setProjects(allProjects);
    } catch (error) {
      console.error('Failed to load projects:', error);
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
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white p-6">
      {/* Header */}
      <div className="max-w-2xl mx-auto mb-8">
        <h1 className="text-3xl font-bold mb-2">ChoraGraph Capture</h1>
        <p className="text-gray-400">Phase 1 ESA Site Assessment</p>
      </div>

      {/* Create New Project Button */}
      <div className="max-w-2xl mx-auto mb-6">
        <button
          onClick={() => setShowCreateModal(true)}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Project
        </button>
      </div>

      {/* Projects List */}
      <div className="max-w-2xl mx-auto space-y-3">
        {loading ? (
          <div className="text-center text-gray-400 py-8">Loading projects...</div>
        ) : projects.length === 0 ? (
          <div className="text-center text-gray-400 py-12">
            <p className="mb-2">No projects yet</p>
            <p className="text-sm">Create your first project to get started</p>
          </div>
        ) : (
          projects.map((project) => (
            <div
              key={project.id}
              className="w-full bg-white/10 backdrop-blur-sm rounded-lg p-4 transition-colors hover:bg-white/20 relative"
            >
              <button
                onClick={() => handleProjectClick(project.id)}
                className="w-full text-left"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1 pr-12">
                    <h3 className="font-semibold text-lg">{project.name}</h3>
                    <p className="text-sm text-gray-400">Lead: {project.lead}</p>
                  </div>
                  <div className="flex gap-4 text-right">
                    <div>
                      <div className="text-2xl font-bold text-blue-400">{project.photoCount}</div>
                      <div className="text-xs text-gray-400">photos</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-green-400">{project.audioCount || 0}</div>
                      <div className="text-xs text-gray-400">audio</div>
                    </div>
                  </div>
                </div>
                {project.notes && (
                  <p className="text-sm text-gray-300 mb-2 line-clamp-2">{project.notes}</p>
                )}
                <div className="flex gap-4 text-xs text-gray-500">
                  <span>Created: {new Date(project.createdAt).toLocaleDateString()}</span>
                  <span>Modified: {new Date(project.modifiedAt).toLocaleDateString()}</span>
                </div>
              </button>

              {/* Delete button - positioned absolutely */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmDeleteProject(project.id);
                }}
                className="absolute top-4 right-4 text-red-400 hover:text-red-300 transition-colors p-2 z-10"
                aria-label="Delete project"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))
        )}
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
          <div className="bg-gray-800 rounded-lg p-6 max-w-sm w-full border border-gray-700">
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
                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteProject(confirmDeleteProject)}
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
