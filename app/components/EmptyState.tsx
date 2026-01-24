'use client';

interface EmptyStateProps {
  onCreateProject: () => void;
}

export default function EmptyState({ onCreateProject }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6">
      {/* Illustration */}
      <div className="relative w-32 h-32 mb-6">
        {/* Background circle */}
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/40 to-gray-800/40 rounded-full" />

        {/* Camera icon */}
        <div className="absolute inset-0 flex items-center justify-center">
          <svg className="w-16 h-16 text-emerald-500/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>

        {/* Decorative elements */}
        <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500/30 rounded-full" />
        <div className="absolute -bottom-2 -left-2 w-6 h-6 bg-blue-500/20 rounded-full" />
        <div className="absolute top-1/2 -right-4 w-3 h-3 bg-purple-500/30 rounded-full" />
      </div>

      {/* Text content */}
      <h3 className="text-xl font-semibold text-white mb-2">No projects yet</h3>
      <p className="text-gray-400 text-center text-sm mb-6 max-w-xs">
        Create your first project to start capturing environmental field evidence
      </p>

      {/* CTA hint */}
      <div className="flex items-center gap-2 text-emerald-400 text-sm">
        <svg className="w-4 h-4 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
        <span>Tap below to get started</span>
      </div>
    </div>
  );
}
