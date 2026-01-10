'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Project } from '../lib/types';
import { getAllProjects } from '../lib/db';
import CreateProjectModal from './CreateProjectModal';

export default function ProjectsList() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const allProjects = await getAllProjects();
      setProjects(allProjects);
    } catch (error) {
      console.error('Failed to load projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProjectClick = (projectId: string) => {
    router.push(`/capture/${projectId}`);
  };

  const handleProjectCreated = (project: Project) => {
    setProjects(prev => [project, ...prev]);
    setShowCreateModal(false);
    router.push(`/capture/${project.id}`);
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
            <button
              key={project.id}
              onClick={() => handleProjectClick(project.id)}
              className="w-full bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-lg p-4 text-left transition-colors"
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-semibold text-lg">{project.name}</h3>
                  <p className="text-sm text-gray-400">Lead: {project.lead}</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-blue-400">{project.photoCount}</div>
                  <div className="text-xs text-gray-400">photos</div>
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
    </div>
  );
}
