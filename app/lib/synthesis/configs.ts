/**
 * Synthesis Configuration per Project Type
 *
 * Defines what deliverables to generate and how for each project type.
 */

import { ProjectType, SynthesisDeliverableType } from '@/app/lib/types';

export interface DeliverableConfig {
  type: SynthesisDeliverableType;
  title: string;
  description: string;
  format: 'markdown' | 'json' | 'html';
  required: boolean;
}

export interface SynthesisConfig {
  projectType: ProjectType;
  deliverables: DeliverableConfig[];
  synthesisPromptHints: string[];  // Additional hints for LLM synthesis
}

/**
 * Home Inventory synthesis config
 */
const homeInventoryConfig: SynthesisConfig = {
  projectType: 'home-inventory',
  deliverables: [
    {
      type: 'room-inventory',
      title: 'Room-by-Room Inventory',
      description: 'All items organized by room and area',
      format: 'markdown',
      required: true,
    },
    {
      type: 'item-index',
      title: 'Item Index',
      description: 'Alphabetical list of all items with locations',
      format: 'markdown',
      required: true,
    },
    {
      type: 'storage-map',
      title: 'Storage Map',
      description: 'What\'s in each container, drawer, and shelf',
      format: 'markdown',
      required: true,
    },
    {
      type: 'cross-references',
      title: 'Cross-References',
      description: 'Items that appear in multiple locations',
      format: 'markdown',
      required: false,
    },
    {
      type: 'coverage-report',
      title: 'Coverage Report',
      description: 'Areas mentioned but not photographed',
      format: 'markdown',
      required: false,
    },
  ],
  synthesisPromptHints: [
    'Focus on findability - how would someone locate these items?',
    'Use plain language, not technical terms',
    'Note visual landmarks and nearby items',
    'Identify containers and what they hold',
  ],
};

/**
 * Generic/fallback config
 */
const genericConfig: SynthesisConfig = {
  projectType: 'generic',
  deliverables: [
    {
      type: 'findings-summary',
      title: 'Session Summary',
      description: 'Overview of captured observations',
      format: 'markdown',
      required: true,
    },
  ],
  synthesisPromptHints: [
    'Summarize key observations',
    'Note any patterns or recurring themes',
  ],
};

/**
 * Phase I ESA config (future)
 */
const phase1EsaConfig: SynthesisConfig = {
  projectType: 'phase1-esa',
  deliverables: [
    {
      type: 'findings-summary',
      title: 'Site Findings Summary',
      description: 'RECs, AOCs, and site conditions',
      format: 'markdown',
      required: true,
    },
    {
      type: 'site-observations',
      title: 'Site Observations',
      description: 'Organized observations by category',
      format: 'markdown',
      required: true,
    },
    {
      type: 'recommendations',
      title: 'Recommendations',
      description: 'Suggested follow-up actions',
      format: 'markdown',
      required: false,
    },
  ],
  synthesisPromptHints: [
    'Identify potential environmental concerns',
    'Note evidence of current or historical contamination',
    'Document regulatory compliance observations',
  ],
};

/**
 * Travel log config (future)
 */
const travelLogConfig: SynthesisConfig = {
  projectType: 'travel-log',
  deliverables: [
    {
      type: 'findings-summary',
      title: 'Trip Summary',
      description: 'Overview of places visited',
      format: 'markdown',
      required: true,
    },
  ],
  synthesisPromptHints: [
    'Highlight memorable experiences',
    'Note locations and landmarks',
  ],
};

/**
 * All synthesis configs indexed by project type
 */
export const SYNTHESIS_CONFIGS: Partial<Record<ProjectType, SynthesisConfig>> = {
  'home-inventory': homeInventoryConfig,
  'phase1-esa': phase1EsaConfig,
  'travel-log': travelLogConfig,
  'generic': genericConfig,
  // Other types will fall back to generic
};

/**
 * Get config for a project type (with fallback)
 */
export function getSynthesisConfig(projectType: ProjectType): SynthesisConfig {
  return SYNTHESIS_CONFIGS[projectType] || genericConfig;
}
