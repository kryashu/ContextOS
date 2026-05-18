import { z } from 'zod';
import { findDuplicateKeys as findDuplicateKeysEngine } from '@contextos/key-intelligence';
import type { KeyIntelligenceResult } from '@contextos/key-intelligence';
import type { ContextOSTool, ToolExecutionContext } from '../types.js';

const inputSchema = z.object({
  workspaceId: z.string().min(1),
  keyType: z.enum([
    'email', 'phone', 'product_id', 'user_id', 'customer_id',
    'employee_id', 'license_number', 'registration_id', 'invoice_number',
    'order_id', 'serial_number', 'batch_number', 'asset_id', 'generic_id', 'unknown',
  ]).optional(),
  fieldName: z.string().optional(),
  fileScope: z.array(z.string()).optional(),
});

const outputSchema = z.custom<KeyIntelligenceResult>();

export const findDuplicateKeys: ContextOSTool<
  z.infer<typeof inputSchema>,
  KeyIntelligenceResult
> = {
  id: 'findDuplicateKeys',
  name: 'Find Duplicate Keys',
  description: 'Find duplicate key values (emails, phones, IDs) across workspace tables.',
  category: 'analysis',
  safetyLevel: 'compute',
  requiresCurrentAnalysis: true,
  requiresModel: false,
  inputSchema,
  outputSchema,
  async execute(input, context: ToolExecutionContext) {
    return findDuplicateKeysEngine({
      sourcesDir: context.sourcesDir,
      outputDir: context.outputDir,
      keyType: input.keyType,
      fieldName: input.fieldName,
      fileScope: input.fileScope,
    });
  },
};
