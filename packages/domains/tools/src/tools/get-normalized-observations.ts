import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import type { NormalizedObservation } from '@contextos/types';
import type { ContextOSTool, ToolExecutionContext } from '../types.js';

const inputSchema = z.object({
  workspaceId: z.string().min(1),
});

const outputSchema = z.custom<NormalizedObservation[]>();

export const getNormalizedObservations: ContextOSTool<
  z.infer<typeof inputSchema>,
  NormalizedObservation[]
> = {
  id: 'getNormalizedObservations',
  name: 'Get Normalized Observations',
  description: 'Returns normalized observations extracted from workbook data for calculations.',
  category: 'context',
  safetyLevel: 'read_only',
  requiresCurrentAnalysis: true,
  requiresModel: false,
  inputSchema,
  outputSchema,
  async execute(_input, context: ToolExecutionContext) {
    const filePath = resolve(context.outputDir, 'normalized-observations.json');
    if (!existsSync(filePath)) {
      throw new Error('normalized-observations.json not found. Upload an Excel file and run analysis.');
    }
    return JSON.parse(readFileSync(filePath, 'utf-8')) as NormalizedObservation[];
  },
};
