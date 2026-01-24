'use client';

import { Project } from '../lib/types';
import { getTypeConfig } from '../lib/projectTypeConfig';

interface ProjectCardProps {
  project: Project;
  onClick: () => void;
  onDelete: () => void;
}

export default function ProjectCard({ project, onClick, onDelete }: ProjectCardProps) {
  const typeConfig = getTypeConfig(project.projectType || 'phase1-esa');

  return (
    <div className="group relative bg-white/10 backdrop-blur-sm rounded-xl overflow-hidden transition-all hover:bg-white/15">
      <button
        onClick={onClick}
        className="w-full text-left flex items-stretch"
      >
        {/* Thumbnail Section */}
        <div className="relative flex-shrink-0 w-20 min-h-[80px]">
          {project.thumbnail ? (
            <img
              src={project.thumbnail}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-gray-800/80 flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}
          {/* Project type badge - bottom of thumbnail */}
          <span className={`absolute bottom-0 left-0 right-0 text-[9px] px-1.5 py-1 ${typeConfig.bgColor.replace('/80', '')} text-white font-medium text-center`}>
            {typeConfig.shortLabel}
          </span>
        </div>

        {/* Content Section */}
        <div className="flex-1 p-3 min-w-0">
          <div className="flex justify-between items-start">
            <div className="flex-1 pr-2 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <h3 className="font-semibold text-white truncate">{project.name}</h3>
                {/* Launched badge */}
                {project.launchSessionId && (
                  <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-purple-600 text-white">
                    Launched
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 mb-1">Lead: {project.lead}</p>
              {project.notes && (
                <p className="text-xs text-gray-500 line-clamp-1">{project.notes}</p>
              )}
            </div>

            {/* Stats */}
            <div className="flex-shrink-0 flex gap-3 text-right">
              <div>
                <div className="text-lg font-bold text-blue-400">{project.photoCount}</div>
                <div className="text-[10px] text-gray-500">photos</div>
              </div>
              <div>
                <div className="text-lg font-bold text-green-400">{project.audioCount || 0}</div>
                <div className="text-[10px] text-gray-500">audio</div>
              </div>
            </div>
          </div>

          {/* Timestamp */}
          <div className="flex gap-3 text-[10px] text-gray-600 mt-1">
            <span>Created: {new Date(project.createdAt).toLocaleDateString()}</span>
            <span>Modified: {new Date(project.modifiedAt).toLocaleDateString()}</span>
          </div>
        </div>
      </button>

      {/* Delete button - subtle, appears on hover */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="absolute top-2 right-2 text-gray-600 hover:text-red-400 transition-all p-1.5 rounded-full hover:bg-red-500/10 opacity-0 group-hover:opacity-100"
        aria-label="Delete project"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
