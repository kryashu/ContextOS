import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import type { SourceProfile } from '@contextos/types';
import type { ContextOSTool, ToolExecutionContext } from '../types.js';

const inputSchema = z.object({
  workspaceId: z.string().min(1),
});

const outputSchema = z.custom<SourceProfile[]>();

export const getSourceProfiles: ContextOSTool<
  z.infer<typeof inputSchema>,
  SourceProfile[]
> = {
  id: 'getSourceProfiles',
  name: 'Get Source Profiles',
  description: 'Returns per-file analysis profiles with topics, entities, relevance scores, and warnings.',
  category: 'context',
  safetyLevel: 'read_only',
  requiresCurrentAnalysis: true,
  requiresModel: false,
  inputSchema,
  outputSchema,
  async execute(_input, context: ToolExecutionContext) {
    const filePath = resolve(context.outputDir, 'source-profiles.json');
    if (!existsSync(filePath)) {
      throw new Error('source-profiles.json not found. Run analysis first.');
    }
    return JSON.parse(readFileSync(filePath, 'utf-8')) as SourceProfile[];
  },
};
