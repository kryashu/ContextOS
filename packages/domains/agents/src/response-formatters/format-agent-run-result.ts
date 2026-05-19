import type { AgentRunResult, AgentToolTrace as AnalystToolTrace } from '../types.js';
import type { CommandIntent } from '@contextos/orchestrator';
import type {
  WorkspaceAgentResponse,
  AgentResponseSection,
  AgentToolTrace,
  AgentDownload,
  WorkspaceAgentResultType,
} from '../workspace-agent-response.js';
import { buildResponse } from './assert-evidence.js';

export interface FormatAgentRunResultInput {
  workspaceId: string;
  command: string;
  intent: CommandIntent;
  result: AgentRunResult;
  /** Additional traces collected outside the analyst agent (e.g. planning). */
  extraToolTrace: AgentToolTrace[];
}

const INTENT_TO_RESULT_TYPE: Record<string, WorkspaceAgentResultType> = {
  workspace_overview: 'workspace_overview',
  next_actions: 'workspace_overview',
  readiness_check: 'workspace_overview',
  source_importance: 'workspace_overview',
  report_generation: 'report',
};

export function formatAgentRunResult(
  input: FormatAgentRunResultInput,
): WorkspaceAgentResponse {
  const { result, intent, extraToolTrace } = input;
  const resultType = INTENT_TO_RESULT_TYPE[intent] ?? 'workspace_overview';

  const mappedTrace: AgentToolTrace[] = [
    ...extraToolTrace,
    ...result.toolTrace.map(mapAnalystTrace),
  ];

  const sections: AgentResponseSection[] = [];
  if (result.answer.trim().length > 0) {
    sections.push({ title: 'Answer', kind: 'text', content: result.answer });
  }
  if (result.warnings.length > 0) {
    sections.push({
      title: 'Warnings',
      kind: 'warning',
      content: { messages: result.warnings },
    });
  }

  const downloads = extractDownloads(intent, result.answer);
  if (downloads.length > 0) {
    sections.push({
      title: 'Downloads',
      kind: 'downloads',
      content: { downloads },
    });
  }

  // Detect analyst-level failures: workflow returned an error message and
  // no successful tool ran. We treat that as 'error' rather than 'success'.
  const anyToolSucceeded = mappedTrace.some((t) => t.status === 'success');
  const looksLikeFailure =
    !anyToolSucceeded ||
    /^(workflow ".*" failed|failed to check analysis state)/i.test(
      result.answer.trim().split('\n')[0] ?? '',
    );

  let status: WorkspaceAgentResponse['status'];
  if (!looksLikeFailure) {
    status = 'success';
  } else if (mappedTrace.length > 0) {
    status = 'no_matches';
  } else {
    status = 'error';
  }

  return buildResponse({
    status,
    intent,
    resultType,
    summary: summaryForIntent(intent, result),
    answer: result.answer || 'No answer produced.',
    sections,
    sourceRefs: [],
    warnings: result.warnings,
    nextActions: [],
    downloads: downloads.length > 0 ? downloads : undefined,
    toolTrace: mappedTrace,
  });
}

function mapAnalystTrace(t: AnalystToolTrace): AgentToolTrace {
  let status: AgentToolTrace['status'];
  if (t.status === 'failure') {
    status = 'failed';
  } else if (t.status === 'skipped') {
    status = 'skipped';
  } else {
    status = 'success';
  }
  const summaryParts: string[] = [];
  if (t.error) summaryParts.push(`error: ${t.error}`);
  if (t.skippedReason) summaryParts.push(`skipped: ${t.skippedReason}`);
  if (summaryParts.length === 0) summaryParts.push(`${t.toolId} ${status}`);
  return {
    toolId: t.toolId,
    status,
    summary: summaryParts.join(' — '),
    durationMs: t.durationMs,
  };
}

function summaryForIntent(intent: CommandIntent, result: AgentRunResult): string {
  switch (intent) {
    case 'workspace_overview':
      return 'Workspace overview generated.';
    case 'next_actions':
      return 'Suggested next actions.';
    case 'report_generation':
      return result.answer.includes('generated:')
        ? 'Report artifact generated.'
        : 'Report generation skipped.';
    default:
      return result.answer.split('\n')[0]?.slice(0, 140) ?? 'Workflow complete.';
  }
}

/**
 * Best-effort extraction of artifact names from the analyst answer string.
 * Per locked guard #5: artifactName only, no signed URLs.
 */
function extractDownloads(intent: CommandIntent, answer: string): AgentDownload[] {
  if (intent !== 'report_generation') return [];
  const match = /generated:\s*(\S+)/.exec(answer);
  if (!match || !match[1]) return [];
  const artifactName = match[1];
  const type: AgentDownload['type'] = artifactName.endsWith('.pdf') ? 'pdf' : 'markdown';
  return [{ label: 'Report artifact', type, artifactName }];
}
