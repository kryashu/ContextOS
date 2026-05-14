import { z } from 'zod';
import type { WorkspaceAnswer } from '@contextos/types';
import { LocalRetriever, WorkspaceAnswerComposer } from '@contextos/qa';
import type { ContextOSTool, ToolExecutionContext } from '../types.js';

const MAX_QUESTION_LENGTH = 500;

const inputSchema = z.object({
  workspaceId: z.string().min(1),
  question: z.string().min(1).max(MAX_QUESTION_LENGTH),
  /**
   * Optional model factory for document_fact intent questions.
   * When absent, deterministic intents still work; document_fact may fail
   * if it requires LLM reasoning over retrieved snippets.
   */
  modelFactory: z.function().returns(z.promise(z.any())).optional(),
});

const outputSchema = z.custom<WorkspaceAnswer>();

/**
 * requiresModel: false — deterministic intents (about, irrelevant_files,
 * capabilities, sheet_query, source_relationships) never call a model.
 * Only document_fact may lazily invoke the modelFactory.
 */
export const askWorkspaceQuestion: ContextOSTool<
  z.infer<typeof inputSchema>,
  WorkspaceAnswer
> = {
  id: 'askWorkspaceQuestion',
  name: 'Ask Workspace Question',
  description: 'Answer a question about the workspace, grounded in analyzed artifacts and source files.',
  category: 'qa',
  safetyLevel: 'compute',
  requiresCurrentAnalysis: true,
  requiresModel: false,
  inputSchema,
  outputSchema,
  async execute(input, context: ToolExecutionContext) {
    const retriever = new LocalRetriever(context.outputDir, context.sourcesDir);
    const composer = new WorkspaceAnswerComposer(
      retriever,
      undefined,
      input.modelFactory,
    );
    return composer.answer(input.question);
  },
};
