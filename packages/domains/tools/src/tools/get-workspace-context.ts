import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import type { WorkspaceContext } from '@contextos/types';
import type { ContextOSTool, ToolExecutionContext } from '../types.js';

const inputSchema = z.object({
  workspaceId: z.string().min(1),
});

const outputSchema = z.custom<WorkspaceContext>();

export const getWorkspaceContext: ContextOSTool<
  z.infer<typeof inputSchema>,
  WorkspaceContext
> = {
  id: 'getWorkspaceContext',
  name: 'Get Workspace Context',
  description: 'Returns the global workspace context including theme, topics, entities, and capabilities.',
  category: 'context',
  safetyLevel: 'read_only',
  requiresCurrentAnalysis: true,
  requiresModel: false,
  inputSchema,
  outputSchema,
  async execute(_input, context: ToolExecutionContext) {
    const filePath = resolve(context.outputDir, 'workspace-context.json');
    if (!existsSync(filePath)) {
      throw new Error('workspace-context.json not found. Run analysis first.');
    }
    return JSON.parse(readFileSync(filePath, 'utf-8')) as WorkspaceContext;
  },
};
