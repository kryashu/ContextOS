import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import type { CalculationResult } from '@contextos/types';
import { TableCalculator } from '@contextos/calculator';
import { validateArtifactWrite, loadManifest } from '../safety.js';
import type { ContextOSTool, ToolExecutionContext } from '../types.js';

const RESULT_FILENAME = 'calculation-results.json';

const inputSchema = z.object({
  workspaceId: z.string().min(1),
  metric: z.string().min(1),
  operation: z.enum([
    'count', 'sum', 'average', 'min', 'max', 'median',
    'subtract', 'difference', 'percentage_change',
  ]),
  groupBy: z.string().optional(),
  filters: z.array(z.object({
    field: z.string(),
    operator: z.enum(['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'in']),
    value: z.union([z.string(), z.number(), z.array(z.string())]),
  })).optional(),
  sort: z.object({
    field: z.string(),
    direction: z.enum(['asc', 'desc']),
  }).optional(),
  limit: z.number().int().positive().optional(),
  compareBy: z.string().optional(),
  baseline: z.string().optional(),
  target: z.string().optional(),
});

const outputSchema = z.custom<CalculationResult>();

export const runCalculation: ContextOSTool<
  z.infer<typeof inputSchema>,
  CalculationResult
> = {
  id: 'runCalculation',
  name: 'Run Calculation',
  description: 'Run deterministic table calculations (sum, average, etc.) on normalized observations.',
  category: 'calculation',
  safetyLevel: 'artifact_write',
  allowedWrites: [RESULT_FILENAME],
  requiresCurrentAnalysis: true,
  requiresModel: false,
  inputSchema,
  outputSchema,
  async execute(input, context: ToolExecutionContext) {
    validateArtifactWrite(RESULT_FILENAME, this.allowedWrites!);

    const manifest = loadManifest(context);
    if (!manifest.capabilities?.hasNormalizedObservations) {
      throw new Error('No normalized observations available. Upload an Excel file and run analysis.');
    }

    const obsPath = resolve(context.outputDir, 'normalized-observations.json');
    if (!existsSync(obsPath)) {
      throw new Error('normalized-observations.json not found.');
    }

    const observations = JSON.parse(readFileSync(obsPath, 'utf-8'));
    if (!Array.isArray(observations)) {
      throw new Error('Invalid observations data.');
    }

    const calculator = new TableCalculator(observations);
    const { workspaceId: _wid, ...request } = input;
    const result = calculator.calculate(request as Parameters<typeof calculator.calculate>[0]);

    writeFileSync(
      resolve(context.outputDir, RESULT_FILENAME),
      JSON.stringify(result, null, 2),
    );

    return result;
  },
};
