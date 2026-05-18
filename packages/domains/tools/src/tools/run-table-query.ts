import { z } from 'zod';
import { executeTableQuery } from '@contextos/table-query';
import type { TableQueryResult } from '@contextos/table-query';
import type { ContextOSTool, ToolExecutionContext } from '../types.js';

const inputSchema = z.object({
  workspaceId: z.string().min(1),
  fileScope: z.array(z.string()).optional(),
  filters: z.array(
    z.object({
      field: z.string().min(1),
      operator: z.enum(['before', 'after', 'equals', 'contains', 'greater_than', 'less_than']),
      value: z.union([z.string(), z.number()]),
    }),
  ),
  aggregations: z.array(
    z.object({
      field: z.string().min(1),
      operation: z.enum(['sum', 'count', 'average', 'min', 'max']),
      label: z.string().optional(),
    }),
  ),
  includeRows: z.boolean().optional(),
});

const outputSchema = z.custom<TableQueryResult>();

export const runTableQuery: ContextOSTool<
  z.infer<typeof inputSchema>,
  TableQueryResult
> = {
  id: 'runTableQuery',
  name: 'Run Table Query',
  description: 'Run deterministic table queries (filter + aggregate) across CSV/Excel source files.',
  category: 'calculation',
  safetyLevel: 'compute',
  requiresCurrentAnalysis: true,
  requiresModel: false,
  inputSchema,
  outputSchema,
  async execute(input, context: ToolExecutionContext) {
    const { workspaceId: _wid, ...request } = input;
    return executeTableQuery(request, context.sourcesDir);
  },
};
