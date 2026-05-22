// ── Command intent ───────────────────────────────────────────────────

export type CommandIntent =
  | 'workspace_overview'
  | 'next_actions'
  | 'report_generation'
  | 'source_relationship_lookup'
  | 'document_lookup'
  | 'table_aggregate_query'
  | 'duplicate_key_query'
  | 'evidence_lookup'
  | 'source_content_query'
  | 'unknown';

// ── Execution status ────────────────────────────────────────────────

export type CommandExecutionStatus =
  | 'executable'
  | 'planned_only'
  | 'unsupported'
  | 'needs_clarification';

// ── Confidence level ────────────────────────────────────────────────

export type ConfidenceLevel = 'low' | 'medium' | 'high';

// ── Filter / aggregation primitives ─────────────────────────────────

export type FilterOperator =
  | 'before'
  | 'after'
  | 'equals'
  | 'contains'
  | 'greater_than'
  | 'less_than';

export interface CommandFilter {
  field: string;
  operator: FilterOperator;
  value: string;
}

export type AggregationOperation = 'sum' | 'count' | 'average' | 'min' | 'max';

export interface CommandAggregation {
  field: string;
  operation: AggregationOperation;
  label?: string;
}

// ── Row request (source content / table inspection) ────────────────

export type RowRequestType = 'first' | 'last' | 'number' | 'headers' | 'sample';

export interface RowRequest {
  type: RowRequestType;
  rowNumber?: number;
}

// ── Extracted command data ──────────────────────────────────────────

export interface ExtractedCommandData {
  workspaceName?: string;
  targetFiles?: string[];
  keyValues?: string[];
  keyType?: string;
  keyValue?: string;
  fields?: string[];
  filters?: CommandFilter[];
  aggregations?: CommandAggregation[];
  fileName?: string;
  sourceHint?: string;
  rowRequest?: RowRequest;
}

// ── Command plan ────────────────────────────────────────────────────

export interface WorkspaceCommandPlan {
  commandId: string;
  originalCommand: string;
  intent: CommandIntent;
  status: CommandExecutionStatus;
  confidence: ConfidenceLevel;
  summary: string;
  extracted: ExtractedCommandData;
  requiredCapabilities: string[];
  warnings: string[];
  nextStep?: string;
}
