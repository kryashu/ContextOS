import type {
  WorkspaceAgentResponse,
  AgentResponseSection,
  AgentSourceRef,
  AgentNextAction,
  AgentToolTrace,
  AgentDownload,
  WorkspaceAgentResultType,
} from '../workspace-agent-response.js';
import type { CommandIntent } from '@contextos/orchestrator';

/**
 * Evidence guard: a response may only carry status='success' if it has at
 * least one of:
 *  - non-empty sourceRefs
 *  - non-empty downloads
 *  - a tool-backed metric_list section with at least one entry having a
 *    finite numeric value (a "clear tool-backed computed metric")
 *  - a deterministic workspace-summary text/evidence section produced from
 *    an executed tool (we treat any non-empty text/evidence/table section
 *    paired with at least one successful toolTrace entry as deterministic
 *    tool-sourced)
 *
 * Used internally by every formatter — if the guard fails, the formatter
 * must downgrade status to 'no_matches' (no usable result) before returning.
 */
export function hasEvidence(response: WorkspaceAgentResponse): boolean {
  if (response.sourceRefs.length > 0) return true;
  if ((response.downloads?.length ?? 0) > 0) return true;

  const hasComputedMetric = response.sections.some(
    (s) =>
      s.kind === 'metric_list' &&
      hasFiniteMetric(s.content),
  );
  if (hasComputedMetric) return true;

  const hasToolBackedSummary =
    response.toolTrace.some((t) => t.status === 'success') &&
    response.sections.some(
      (s) =>
        (s.kind === 'text' || s.kind === 'evidence') &&
        hasNonEmptyContent(s.content),
    );

  return hasToolBackedSummary;
}

function hasFiniteMetric(content: unknown): boolean {
  if (!content || typeof content !== 'object') return false;
  const entries = (content as { entries?: unknown }).entries;
  if (!Array.isArray(entries)) return false;
  return entries.some((e) => {
    if (!e || typeof e !== 'object') return false;
    const v = (e as { value?: unknown }).value;
    return typeof v === 'number' && Number.isFinite(v);
  });
}

function hasNonEmptyContent(content: unknown): boolean {
  if (typeof content === 'string') return content.trim().length > 0;
  if (!content || typeof content !== 'object') return false;
  if (Array.isArray(content)) return content.length > 0;
  const obj = content as Record<string, unknown>;
  if (Array.isArray(obj.entries)) return obj.entries.length > 0;
  if (Array.isArray(obj.rows)) return obj.rows.length > 0;
  return Object.keys(obj).length > 0;
}

/**
 * Build a response with the evidence guard applied. If status would be
 * 'success' but evidence is missing, downgrades to 'no_matches' and appends
 * a clarifying warning.
 */
export function buildResponse(args: {
  status: WorkspaceAgentResponse['status'];
  intent: CommandIntent;
  resultType: WorkspaceAgentResultType;
  summary: string;
  answer: string;
  sections: AgentResponseSection[];
  sourceRefs: AgentSourceRef[];
  warnings: string[];
  nextActions: AgentNextAction[];
  downloads?: AgentDownload[];
  toolTrace: AgentToolTrace[];
}): WorkspaceAgentResponse {
  const response: WorkspaceAgentResponse = {
    status: args.status,
    intent: args.intent,
    resultType: args.resultType,
    summary: args.summary,
    answer: args.answer,
    sections: args.sections,
    sourceRefs: args.sourceRefs,
    warnings: [...args.warnings],
    nextActions: args.nextActions,
    downloads: args.downloads,
    toolTrace: args.toolTrace,
    generatedAt: new Date().toISOString(),
  };

  if (response.status === 'success' && !hasEvidence(response)) {
    response.status = 'no_matches';
    response.warnings.push(
      'Result downgraded: no source references, downloads, or tool-backed metrics were produced.',
    );
  }

  return response;
}
