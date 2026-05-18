import { z } from 'zod';
import { findDocumentsForKey as findDocumentsForKeyEngine } from '@contextos/key-intelligence';
import type { KeyIntelligenceResult } from '@contextos/key-intelligence';
import type { ContextOSTool, ToolExecutionContext } from '../types.js';

const inputSchema = z.object({
  workspaceId: z.string().min(1),
  value: z.string().min(1),
  keyType: z.enum([
    'email', 'phone', 'product_id', 'user_id', 'customer_id',
    'employee_id', 'license_number', 'registration_id', 'invoice_number',
    'order_id', 'serial_number', 'batch_number', 'asset_id', 'generic_id', 'unknown',
  ]).optional(),
});

const outputSchema = z.custom<KeyIntelligenceResult>();

export const findDocumentsForKey: ContextOSTool<
  z.infer<typeof inputSchema>,
  KeyIntelligenceResult
> = {
  id: 'findDocumentsForKey',
  name: 'Find Documents For Key',
  description: 'Find all documents and table rows that reference a specific key value.',
  category: 'analysis',
  safetyLevel: 'compute',
  requiresCurrentAnalysis: true,
  requiresModel: false,
  inputSchema,
  outputSchema,
  async execute(input, context: ToolExecutionContext) {
    return findDocumentsForKeyEngine({
      sourcesDir: context.sourcesDir,
      outputDir: context.outputDir,
      value: input.value,
      keyType: input.keyType,
    });
  },
};
