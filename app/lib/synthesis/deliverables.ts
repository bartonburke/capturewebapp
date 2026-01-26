/**
 * Deliverable Generators
 *
 * Generates project-type-specific outputs from synthesis results.
 */

import OpenAI from 'openai';
import {
  ProjectType,
  PhotoAnalysis,
  Transcript,
  EntityCluster,
  LocationNode,
  CoverageAnalysis,
  SynthesisDeliverable,
  SynthesisDeliverableType,
} from '@/app/lib/types';
import { SynthesisConfig, getSynthesisConfig } from './configs';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface DeliverableGeneratorInput {
  projectType: ProjectType;
  photoAnalyses: PhotoAnalysis[];
  transcript: Transcript;
  entityClusters: EntityCluster[];
  locationHierarchy: LocationNode[];
  coverageAnalysis: CoverageAnalysis;
  config?: SynthesisConfig;
}

/**
 * Generate all deliverables for the project type
 */
export async function generateDeliverables(
  input: DeliverableGeneratorInput
): Promise<SynthesisDeliverable[]> {
  const config = input.config || getSynthesisConfig(input.projectType);
  const deliverables: SynthesisDeliverable[] = [];

  console.log(`[Deliverables] Generating ${config.deliverables.length} deliverables for ${input.projectType}`);

  for (const deliverableConfig of config.deliverables) {
    try {
      const content = await generateSingleDeliverable(
        deliverableConfig.type,
        input
      );

      deliverables.push({
        id: `${deliverableConfig.type}-${Date.now()}`,
        type: deliverableConfig.type,
        title: deliverableConfig.title,
        format: deliverableConfig.format,
        content,
        generatedAt: new Date().toISOString(),
      });

      console.log(`[Deliverables] Generated: ${deliverableConfig.title}`);

    } catch (error) {
      console.error(`[Deliverables] Failed to generate ${deliverableConfig.type}:`, error);
      // Add error placeholder for required deliverables
      if (deliverableConfig.required) {
        deliverables.push({
          id: `${deliverableConfig.type}-${Date.now()}`,
          type: deliverableConfig.type,
          title: deliverableConfig.title,
          format: 'markdown',
          content: `*Error generating ${deliverableConfig.title}*`,
          generatedAt: new Date().toISOString(),
          metadata: { error: true },
        });
      }
    }
  }

  return deliverables;
}

/**
 * Generate a single deliverable
 */
async function generateSingleDeliverable(
  type: SynthesisDeliverableType,
  input: DeliverableGeneratorInput
): Promise<string> {
  switch (type) {
    case 'room-inventory':
      return generateRoomInventory(input);
    case 'item-index':
      return generateItemIndex(input);
    case 'storage-map':
      return generateStorageMap(input);
    case 'cross-references':
      return generateCrossReferences(input);
    case 'coverage-report':
      return generateCoverageReport(input);
    case 'findings-summary':
      return generateFindingsSummary(input);
    default:
      return `*Deliverable type "${type}" not yet implemented*`;
  }
}

/**
 * Room-by-Room Inventory
 */
async function generateRoomInventory(input: DeliverableGeneratorInput): Promise<string> {
  const { photoAnalyses, entityClusters, locationHierarchy } = input;

  // Build location tree
  const rooms = locationHierarchy.filter(l => l.level === 'room');
  const areas = locationHierarchy.filter(l => l.level === 'area' || l.level === 'container');

  // Group items by location from clusters
  const itemsByLocation = new Map<string, EntityCluster[]>();
  for (const cluster of entityClusters) {
    if (cluster.entityType !== 'item') continue;
    for (const loc of cluster.locations) {
      if (!itemsByLocation.has(loc)) {
        itemsByLocation.set(loc, []);
      }
      itemsByLocation.get(loc)!.push(cluster);
    }
  }

  // Generate markdown via LLM for better formatting
  const prompt = `Generate a room-by-room inventory in markdown format.

Location hierarchy:
${JSON.stringify(locationHierarchy, null, 2)}

Item clusters (items found in photos):
${JSON.stringify(entityClusters.filter(c => c.entityType === 'item').slice(0, 50), null, 2)}

Photo descriptions:
${photoAnalyses.slice(0, 20).map(p => `- ${p.vlmDescription}`).join('\n')}

Format as:
# Room-by-Room Inventory

## [Room Name]

### [Area/Container]
- Item 1
- Item 2

Keep it concise and scannable. Focus on findability.`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
  });

  return response.choices[0]?.message?.content || '# Room-by-Room Inventory\n\n*No data available*';
}

/**
 * Item Index (alphabetical)
 */
async function generateItemIndex(input: DeliverableGeneratorInput): Promise<string> {
  const { entityClusters, photoAnalyses } = input;

  // Get all items
  const items = entityClusters
    .filter(c => c.entityType === 'item')
    .map(c => ({
      name: c.canonicalName,
      location: c.mergedDescription,
      photoCount: c.photoIds.length,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  if (items.length === 0) {
    // Fall back to extracting from photo descriptions
    const prompt = `Extract an alphabetical item index from these photo descriptions.

${photoAnalyses.map(p => p.vlmDescription).join('\n')}

Format as markdown:
# Item Index

- **Item Name** - Location description
- **Another Item** - Where it's stored

Sort alphabetically. Include location for each item.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    });

    return response.choices[0]?.message?.content || '# Item Index\n\n*No items found*';
  }

  // Build markdown
  let markdown = '# Item Index\n\n';
  for (const item of items) {
    markdown += `- **${item.name}** - ${item.location}\n`;
  }

  return markdown;
}

/**
 * Storage Map
 */
async function generateStorageMap(input: DeliverableGeneratorInput): Promise<string> {
  const { photoAnalyses, locationHierarchy, entityClusters } = input;

  const containers = locationHierarchy.filter(l =>
    l.level === 'container' || l.level === 'shelf'
  );

  const prompt = `Generate a storage map showing what's in each container/drawer/shelf.

Containers found:
${JSON.stringify(containers, null, 2)}

Item clusters:
${JSON.stringify(entityClusters.filter(c => c.entityType === 'item').slice(0, 30), null, 2)}

Photo descriptions:
${photoAnalyses.slice(0, 15).map(p => p.vlmDescription).join('\n')}

Format as:
# Storage Map

## [Container/Area Name]
- Contents item 1
- Contents item 2

Group by container. List what's inside each.`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
  });

  return response.choices[0]?.message?.content || '# Storage Map\n\n*No storage data available*';
}

/**
 * Cross-References
 */
async function generateCrossReferences(input: DeliverableGeneratorInput): Promise<string> {
  const { entityClusters } = input;

  // Find items in multiple locations
  const crossRefs = entityClusters.filter(c =>
    c.entityType === 'item' && c.photoIds.length > 1
  );

  if (crossRefs.length === 0) {
    return '# Cross-References\n\nNo items found in multiple locations.';
  }

  let markdown = '# Cross-References\n\n';
  markdown += 'Items that appear in multiple photos/locations:\n\n';

  for (const ref of crossRefs) {
    markdown += `## ${ref.canonicalName}\n`;
    markdown += `${ref.mergedDescription}\n\n`;
    if (ref.descriptions.length > 1) {
      markdown += 'Locations:\n';
      for (const desc of ref.descriptions) {
        markdown += `- ${desc}\n`;
      }
      markdown += '\n';
    }
  }

  return markdown;
}

/**
 * Coverage Report
 */
async function generateCoverageReport(input: DeliverableGeneratorInput): Promise<string> {
  const { coverageAnalysis } = input;

  let markdown = '# Coverage Report\n\n';

  markdown += `## Completeness Score: ${Math.round(coverageAnalysis.completenessScore * 100)}%\n\n`;

  markdown += '## Photographed Locations\n';
  if (coverageAnalysis.photographedLocations.length > 0) {
    for (const loc of coverageAnalysis.photographedLocations) {
      markdown += `- ${loc}\n`;
    }
  } else {
    markdown += '*No location tags detected*\n';
  }
  markdown += '\n';

  markdown += '## Mentioned but Not Photographed\n';
  if (coverageAnalysis.missingLocations.length > 0) {
    for (const loc of coverageAnalysis.missingLocations) {
      markdown += `- ${loc}\n`;
    }
  } else {
    markdown += '*All mentioned locations have photos*\n';
  }
  markdown += '\n';

  markdown += '## Suggested Follow-ups\n';
  if (coverageAnalysis.suggestedFollowups.length > 0) {
    for (const suggestion of coverageAnalysis.suggestedFollowups) {
      markdown += `- ${suggestion}\n`;
    }
  } else {
    markdown += '*No additional captures suggested*\n';
  }

  return markdown;
}

/**
 * Generic findings summary (for non-home-inventory types)
 */
async function generateFindingsSummary(input: DeliverableGeneratorInput): Promise<string> {
  const { photoAnalyses, transcript, entityClusters } = input;

  const prompt = `Summarize the key findings from this field capture session.

Transcript excerpt:
"${transcript.fullText.substring(0, 1000)}"

Photo observations:
${photoAnalyses.slice(0, 10).map(p => `- ${p.vlmDescription}`).join('\n')}

Entity clusters:
${JSON.stringify(entityClusters.slice(0, 20), null, 2)}

Generate a markdown summary with:
# Session Summary

## Key Findings
- Finding 1
- Finding 2

## Observations
Brief narrative of what was captured.

## Next Steps
Suggested follow-up actions.`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
  });

  return response.choices[0]?.message?.content || '# Session Summary\n\n*No summary available*';
}
