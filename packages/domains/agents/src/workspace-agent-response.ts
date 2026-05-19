import type { CommandIntent } from '@contextos/orchestrator';

// ── Status ──────────────────────────────────────────────────────────

export type WorkspaceAgentResponseStatus =
  | 'success'
  | 'needs_clarification'
  | 'no_matches'
  | 'error';

// ── Result type ─────────────────────────────────────────────────────

export type WorkspaceAgentResultType =
  | 'workspace_overview'
  | 'table_query'
  | 'key_intelligence'
  | 'document_lookup'
  | 'report'
  | 'clarification'
  | 'unknown';

// ── Sections ────────────────────────────────────────────────────────

export type AgentResponseSectionKind =
  | 'text'
  | 'metric_list'
  | 'table'
  | 'evidence'
  | 'warning'
  | 'downloads';

export interface AgentResponseSection {
  title: string;
  kind: AgentResponseSectionKind;
  content: unknown;
}

// ── Source reference (unified, superset of table + key intelligence) ─

export interface AgentSourceRef {
  workspaceId?: string;
  fileName: string;
  sheet?: string;
  row?: number;
  column?: string;
  sourceRange?: string;
  snippet?: string;
}

// ── Next action (suggested command) ─────────────────────────────────

export interface AgentNextAction {
  label: string;
  command: string;
  requiresWrite?: boolean;
}

// ── Downloads (artifactName-only for this slice; no signed URLs) ────

export interface AgentDownload {
  label: string;
  type: 'markdown' | 'pdf' | 'xlsx' | 'json';
  href?: string;
  artifactName?: string;
}

// ── Tool trace (spec shape: 'failed' not 'failure') ─────────────────

export type AgentToolTraceStatus = 'success' | 'failed' | 'skipped';

export interface AgentToolTrace {
  toolId: string;
  status: AgentToolTraceStatus;
  summary: string;
  durationMs?: number;
}

// ── Unified response ────────────────────────────────────────────────

export interface WorkspaceAgentResponse {
  status: WorkspaceAgentResponseStatus;
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
  generatedAt: string;
}

// ── Section content payloads (typed helpers for renderers) ──────────

export interface MetricListEntry {
  label: string;
  value: string | number;
  hint?: string;
}

export interface MetricListSectionContent {
  entries: MetricListEntry[];
}

export interface TableSectionContent {
  columns: string[];
  rows: Array<Array<string | number | null>>;
  truncated?: boolean;
  totalRowCount?: number;
}

export interface EvidenceSectionEntry {
  fileName: string;
  snippet: string;
  sourceRange?: string;
}

export interface EvidenceSectionContent {
  entries: EvidenceSectionEntry[];
}

export interface DownloadsSectionContent {
  downloads: AgentDownload[];
}
