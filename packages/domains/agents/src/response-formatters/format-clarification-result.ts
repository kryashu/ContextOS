import type { WorkspaceCommandPlan, CommandIntent } from '@contextos/orchestrator';
import type {
  WorkspaceAgentResponse,
  AgentResponseSection,
  AgentToolTrace,
} from '../workspace-agent-response.js';

const EXAMPLE_COMMANDS = [
  'Give me an overview of this workspace.',
  'Find duplicate emails.',
  'Show documents related to ABC-123.',
  'Calculate total units sold for products launched before 5 May 2025.',
];

export interface FormatClarificationInput {
  plan: WorkspaceCommandPlan;
  toolTrace: AgentToolTrace[];
  /** Optional override when the agent itself decides clarification is needed (missing keyValue/aggregations). */
  reason?: string;
  intentOverride?: CommandIntent;
}

export function formatClarificationResult(
  input: FormatClarificationInput,
): WorkspaceAgentResponse {
  const { plan, toolTrace, reason, intentOverride } = input;
  const intent = intentOverride ?? plan.intent;

  const message =
    reason ??
    plan.nextStep ??
    'I could not determine a specific workflow for this command. Try rephrasing it.';

  const sections: AgentResponseSection[] = [
    { title: 'What I need', kind: 'text', content: message },
    {
      title: 'Examples you can try',
      kind: 'text',
      content: EXAMPLE_COMMANDS.map((c) => `- ${c}`).join('\n'),
    },
  ];

  if (plan.warnings.length > 0) {
    sections.push({
      title: 'Notes',
      kind: 'warning',
      content: { messages: plan.warnings },
    });
  }

  return {
    status: 'needs_clarification',
    intent,
    resultType: 'clarification',
    summary: 'I need more details to act on this command.',
    answer: message,
    sections,
    sourceRefs: [],
    warnings: plan.warnings,
    nextActions: EXAMPLE_COMMANDS.map((c) => ({ label: c, command: c })),
    toolTrace,
    generatedAt: new Date().toISOString(),
  };
}
