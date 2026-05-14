// ── Agent goal types ────────────────────────────────────────────────

export type AgentGoalType =
  | 'workspace_overview'
  | 'next_actions'
  | 'report_generation'
  | 'readiness_check'
  | 'source_importance'
  | 'unknown';

// ── Agent run input / output ────────────────────────────────────────

export interface AgentRunInput {
  workspaceId: string;
  goal: string;
  allowWrites?: boolean;
}

export interface AgentRunResult {
  goal: AgentGoalType;
  answer: string;
  toolTrace: AgentToolTrace[];
  warnings: string[];
}

// ── Tool trace entry ────────────────────────────────────────────────

export type AgentToolTraceStatus = 'success' | 'failure' | 'skipped';

export interface AgentToolTrace {
  toolId: string;
  status: AgentToolTraceStatus;
  durationMs: number;
  error?: string;
  skippedReason?: string;
}
