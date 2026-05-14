import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import type { WorkspaceContext } from '@contextos/types';
import type { ContextOSTool, ToolExecutionContext } from '../types.js';

const inputSchema = z.object({
  workspaceId: z.string().min(1),
});

const outputSchema = z.array(z.string());

/**
 * Primary: reads suggested-questions.json (VS013 artifact).
 * Fallback: derives from workspace-context.json recommendedActions.
 */
export const getSuggestedQuestions: ContextOSTool<
  z.infer<typeof inputSchema>,
  string[]
> = {
  id: 'getSuggestedQuestions',
  name: 'Get Suggested Questions',
  description: 'Returns suggested questions for this workspace, from the VS013 artifact or derived from context.',
  category: 'context',
  safetyLevel: 'read_only',
  requiresCurrentAnalysis: true,
  requiresModel: false,
  inputSchema,
  outputSchema,
  async execute(_input, context: ToolExecutionContext) {
    // Primary: read dedicated artifact
    const suggestedPath = resolve(context.outputDir, 'suggested-questions.json');
    if (existsSync(suggestedPath)) {
      const data = JSON.parse(readFileSync(suggestedPath, 'utf-8'));
      if (Array.isArray(data)) return data as string[];
    }

    // Fallback: derive from workspace context recommendedActions
    const contextPath = resolve(context.outputDir, 'workspace-context.json');
    if (existsSync(contextPath)) {
      const ctx = JSON.parse(readFileSync(contextPath, 'utf-8')) as WorkspaceContext;
      if (ctx.recommendedActions && ctx.recommendedActions.length > 0) {
        return ctx.recommendedActions.map((a) => a.action);
      }
    }

    return [];
  },
};
