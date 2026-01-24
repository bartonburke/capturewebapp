'use client';

import { ProjectTypeConfig } from '../lib/projectTypeConfig';

interface ProjectTypeCardProps {
  config: ProjectTypeConfig;
  projectCount: number;
  onClick: () => void;
}

export default function ProjectTypeCard({ config, projectCount, onClick }: ProjectTypeCardProps) {
  return (
    <button
      onClick={onClick}
      className={`relative flex-shrink-0 w-24 h-28 rounded-2xl ${config.bgColor}
        flex flex-col items-center justify-center gap-1.5
        transition-transform duration-150 active:scale-95
        snap-start shadow-lg shadow-black/30`}
    >
      {/* Icon */}
      <span className="text-3xl">{config.icon}</span>

      {/* Label */}
      <span className="text-xs font-medium text-white/90 text-center px-1 leading-tight">
        {config.shortLabel}
      </span>

      {/* Project count badge */}
      {projectCount > 0 && (
        <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1
          rounded-full bg-white/25 backdrop-blur-sm
          text-[10px] font-bold text-white flex items-center justify-center">
          {projectCount > 99 ? '99+' : projectCount}
        </span>
      )}
    </button>
  );
}
