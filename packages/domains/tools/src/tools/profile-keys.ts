import { z } from 'zod';
import { analyzeKeys } from '@contextos/key-intelligence';
import type { KeyIntelligenceResult } from '@contextos/key-intelligence';
import type { ContextOSTool, ToolExecutionContext } from '../types.js';

const inputSchema = z.object({
  workspaceId: z.string().min(1),
  keyType: z.enum([
    'email', 'phone', 'product_id', 'user_id', 'customer_id',
    'employee_id', 'license_number', 'registration_id', 'invoice_number',
    'order_id', 'serial_number', 'batch_number', 'asset_id', 'generic_id', 'unknown',
  ]).optional(),
  fileScope: z.array(z.string()).optional(),
});

const outputSchema = z.custom<KeyIntelligenceResult>();

export const profileKeys: ContextOSTool<
  z.infer<typeof inputSchema>,
  KeyIntelligenceResult
> = {
  id: 'profileKeys',
  name: 'Profile Keys',
  description: 'Profile key/identifier columns across workspace tables and detect key types.',
  category: 'analysis',
  safetyLevel: 'compute',
  requiresCurrentAnalysis: true,
  requiresModel: false,
  inputSchema,
  outputSchema,
  async execute(input, context: ToolExecutionContext) {
    return analyzeKeys({
      sourcesDir: context.sourcesDir,
      outputDir: context.outputDir,
      keyType: input.keyType,
      fileScope: input.fileScope,
    });
  },
};
