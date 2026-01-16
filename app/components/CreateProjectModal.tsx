'use client';

import { useState } from 'react';
import { Project, ProjectType } from '../lib/types';
import { createProject } from '../lib/db';

interface Props {
  onClose: () => void;
  onProjectCreated: (project: Project) => void;
}

export default function CreateProjectModal({ onClose, onProjectCreated }: Props) {
  const [name, setName] = useState('');
  const [lead, setLead] = useState('');
  const [notes, setNotes] = useState('');
  const [projectType, setProjectType] = useState<ProjectType>('phase1-esa');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !lead.trim()) return;

    setSaving(true);
    try {
      const project: Project = {
        id: crypto.randomUUID(),
        name: name.trim(),
        lead: lead.trim(),
        notes: notes.trim() || undefined,
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
        photoCount: 0,
        audioCount: 0,
        projectType,
      };

      await createProject(project);
      onProjectCreated(project);
    } catch (error) {
      console.error('Failed to create project:', error);
      alert('Failed to create project. Please try again.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-gray-900 rounded-lg p-6 max-w-md w-full">
        <h2 className="text-2xl font-bold mb-4 text-white">New Project</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-white">Project Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., 123 Main St ESA"
              className="w-full px-4 py-2 bg-black/40 border border-white/30 rounded-lg focus:outline-none focus:border-blue-500 text-white placeholder-white/60"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-white">Project Lead *</label>
            <input
              type="text"
              value={lead}
              onChange={(e) => setLead(e.target.value)}
              placeholder="Your name"
              className="w-full px-4 py-2 bg-black/40 border border-white/30 rounded-lg focus:outline-none focus:border-blue-500 text-white placeholder-white/60"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-white">Project Type</label>
            <select
              value={projectType}
              onChange={(e) => setProjectType(e.target.value as ProjectType)}
              className="w-full px-4 py-2 bg-black/40 border border-white/30 rounded-lg focus:outline-none focus:border-blue-500 text-white"
            >
              <option value="phase1-esa">Phase I ESA</option>
              <option value="eir-eis">EIR/EIS</option>
              <option value="borehole">Borehole Analysis</option>
              <option value="generic">General Site Visit</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-white">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional project details..."
              rows={3}
              className="w-full px-4 py-2 bg-black/40 border border-white/30 rounded-lg focus:outline-none focus:border-blue-500 resize-none text-white placeholder-white/60"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 py-3 rounded-lg font-medium transition-colors text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || !lead.trim() || saving}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 py-3 rounded-lg font-medium transition-colors text-white"
            >
              {saving ? 'Creating...' : 'Create & Start'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
