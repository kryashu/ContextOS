import { existsSync } from 'node:fs';
import { z } from 'zod';
import type { ManifestCapabilities } from '@contextos/types';
import { loadManifest, assertAnalysisCurrent } from '../safety.js';
import type { ContextOSTool, ToolExecutionContext } from '../types.js';

const inputSchema = z.object({
  workspaceId: z.string().min(1),
});

interface AnalysisState {
  state: 'current' | 'stale' | 'none';
  capabilities?: ManifestCapabilities;
}

const outputSchema = z.custom<AnalysisState>();

export const checkAnalysisState: ContextOSTool<
  z.infer<typeof inputSchema>,
  AnalysisState
> = {
  id: 'checkAnalysisState',
  name: 'Check Analysis State',
  description: 'Returns whether the workspace analysis is current, stale, or missing.',
  category: 'analysis',
  safetyLevel: 'read_only',
  requiresCurrentAnalysis: false,
  requiresModel: false,
  inputSchema,
  outputSchema,
  async execute(_input, context: ToolExecutionContext) {
    if (!existsSync(context.manifestPath)) {
      return { state: 'none' as const };
    }

    try {
      assertAnalysisCurrent(context);
      const manifest = loadManifest(context);
      return { state: 'current' as const, capabilities: manifest.capabilities };
    } catch {
      // assertAnalysisCurrent throws StaleAnalysisError or other errors
      try {
        const manifest = loadManifest(context);
        return { state: 'stale' as const, capabilities: manifest.capabilities };
      } catch {
        return { state: 'none' as const };
      }
    }
  },
};
