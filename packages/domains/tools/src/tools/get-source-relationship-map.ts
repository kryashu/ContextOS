import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import type { SourceRelationshipMap } from '@contextos/types';
import type { ContextOSTool, ToolExecutionContext } from '../types.js';

const inputSchema = z.object({
  workspaceId: z.string().min(1),
});

const outputSchema = z.custom<SourceRelationshipMap>();

/**
 * Reads workspace-relationships.json — the source-to-source relationship map from VS007.
 * NOT relationship-graph.json, which is the entity-level graph from extraction/generator.
 */
export const getSourceRelationshipMap: ContextOSTool<
  z.infer<typeof inputSchema>,
  SourceRelationshipMap
> = {
  id: 'getSourceRelationshipMap',
  name: 'Get Source Relationship Map',
  description: 'Returns source-to-source relationships (shared topics, entities, duplicates, isolated sources).',
  category: 'context',
  safetyLevel: 'read_only',
  requiresCurrentAnalysis: true,
  requiresModel: false,
  inputSchema,
  outputSchema,
  async execute(_input, context: ToolExecutionContext) {
    const filePath = resolve(context.outputDir, 'workspace-relationships.json');
    if (!existsSync(filePath)) {
      throw new Error('workspace-relationships.json not found. Run analysis first.');
    }
    return JSON.parse(readFileSync(filePath, 'utf-8')) as SourceRelationshipMap;
  },
};
