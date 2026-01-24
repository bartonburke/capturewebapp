// Centralized project type configuration
// Used for UI display, categorization, and filtering

import { ProjectType, ProjectCategory } from './types';

export interface ProjectTypeConfig {
  type: ProjectType;
  label: string;
  shortLabel: string;
  icon: string;           // emoji
  bgColor: string;        // Tailwind class
  category: ProjectCategory;
  description: string;
}

export const PROJECT_TYPE_CONFIGS: Record<ProjectType, ProjectTypeConfig> = {
  // Work types
  'phase1-esa': {
    type: 'phase1-esa',
    label: 'Phase I ESA',
    shortLabel: 'ESA',
    icon: '🏭',
    bgColor: 'bg-green-600/80',
    category: 'work',
    description: 'Environmental Site Assessment per ASTM E1527-21',
  },
  'eir-eis': {
    type: 'eir-eis',
    label: 'EIR/EIS',
    shortLabel: 'EIR',
    icon: '🌿',
    bgColor: 'bg-blue-600/80',
    category: 'work',
    description: 'Environmental Impact Report/Statement',
  },
  'borehole': {
    type: 'borehole',
    label: 'Borehole Analysis',
    shortLabel: 'Borehole',
    icon: '🔩',
    bgColor: 'bg-orange-600/80',
    category: 'work',
    description: 'Geotechnical drilling and sampling',
  },
  'asset-tagging': {
    type: 'asset-tagging',
    label: 'Asset Tagging',
    shortLabel: 'Assets',
    icon: '🏷️',
    bgColor: 'bg-cyan-600/80',
    category: 'work',
    description: 'Inventory and equipment documentation',
  },
  'generic': {
    type: 'generic',
    label: 'General Site Visit',
    shortLabel: 'General',
    icon: '📋',
    bgColor: 'bg-gray-600/80',
    category: 'work',
    description: 'General-purpose site documentation',
  },
  // Personal types
  'home-inventory': {
    type: 'home-inventory',
    label: 'Home Inventory',
    shortLabel: 'Home',
    icon: '🏠',
    bgColor: 'bg-purple-600/80',
    category: 'personal',
    description: 'Document possessions for insurance',
  },
  'travel-log': {
    type: 'travel-log',
    label: 'Travel Log',
    shortLabel: 'Travel',
    icon: '✈️',
    bgColor: 'bg-pink-600/80',
    category: 'personal',
    description: 'Capture travel memories and experiences',
  },
  'personal-todos': {
    type: 'personal-todos',
    label: 'Personal To-dos',
    shortLabel: 'To-do',
    icon: '✅',
    bgColor: 'bg-yellow-600/80',
    category: 'personal',
    description: 'Capture tasks and reminders',
  },
};

// Get all configs for a specific category
export function getTypesByCategory(category: ProjectCategory): ProjectTypeConfig[] {
  return Object.values(PROJECT_TYPE_CONFIGS).filter(config => config.category === category);
}

// Get config for a specific type
export function getTypeConfig(type: ProjectType): ProjectTypeConfig {
  return PROJECT_TYPE_CONFIGS[type] || PROJECT_TYPE_CONFIGS['generic'];
}

// Get all project types
export function getAllProjectTypes(): ProjectTypeConfig[] {
  return Object.values(PROJECT_TYPE_CONFIGS);
}
