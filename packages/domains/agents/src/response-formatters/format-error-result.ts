import type { CommandIntent } from '@contextos/orchestrator';
import type {
  WorkspaceAgentResponse,
  AgentToolTrace,
} from '../workspace-agent-response.js';

export interface FormatErrorInput {
  intent: CommandIntent;
  /** Safe, user-facing message. Must not contain stack traces or paths. */
  message: string;
  toolTrace: AgentToolTrace[];
}

/**
 * Safe error response. Never embeds stack traces, file paths, or raw
 * Error.message values from unknown throwables.
 */
export function formatErrorResult(input: FormatErrorInput): WorkspaceAgentResponse {
  const { intent, message, toolTrace } = input;
  return {
    status: 'error',
    intent,
    resultType: 'unknown',
    summary: 'The workspace agent encountered an error.',
    answer: message,
    sections: [
      { title: 'Error', kind: 'warning', content: { messages: [message] } },
    ],
    sourceRefs: [],
    warnings: [message],
    nextActions: [],
    toolTrace,
    generatedAt: new Date().toISOString(),
  };
}
