import { z } from 'zod';
import { LocalRetriever } from '@contextos/qa';
import type { ContextOSTool, ToolExecutionContext } from '../types.js';

const inputSchema = z.object({
  workspaceId: z.string().min(1),
});

const outputSchema = z.custom<Record<string, unknown> | null>();

export const getWorkbookProfile: ContextOSTool<
  z.infer<typeof inputSchema>,
  Record<string, unknown> | null
> = {
  id: 'getWorkbookProfile',
  name: 'Get Workbook Profile',
  description: 'Returns the workbook profile (sheet structure, table blocks) if Excel files were analyzed, or null.',
  category: 'context',
  safetyLevel: 'read_only',
  requiresCurrentAnalysis: true,
  requiresModel: false,
  inputSchema,
  outputSchema,
  async execute(_input, context: ToolExecutionContext) {
    const retriever = new LocalRetriever(context.outputDir, context.sourcesDir);
    return retriever.loadWorkbookProfile();
  },
};
