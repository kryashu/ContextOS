// ── Filter operators ─────────────────────────────────────────────────

export type FilterOperator =
  | 'before'
  | 'after'
  | 'equals'
  | 'contains'
  | 'greater_than'
  | 'less_than';

export interface QueryFilter {
  field: string;
  operator: FilterOperator;
  value: string | number;
}

// ── Aggregation ─────────────────────────────────────────────────────

export type AggregationOperation = 'sum' | 'count' | 'average' | 'min' | 'max';

export interface QueryAggregation {
  field: string;
  operation: AggregationOperation;
  label?: string;
}

// ── Request (no workspaceId — injected at tool layer) ───────────────

export interface TableQueryRequest {
  fileScope?: string[];
  filters: QueryFilter[];
  aggregations: QueryAggregation[];
  includeRows?: boolean;
}

// ── Source reference ────────────────────────────────────────────────

export interface SourceRef {
  fileName: string;
  sheet?: string;
  row?: number;
  sourceRange?: string;
}

// ── Aggregation result ──────────────────────────────────────────────

export interface AggregationResult {
  label: string;
  field: string;
  resolvedColumn?: string;
  operation: string;
  value: number;
  sourceRefs: SourceRef[];
}

// ── Matched row ─────────────────────────────────────────────────────

export interface MatchedRow {
  fileName: string;
  sheet?: string;
  row: number;
  values: Record<string, string | number | null>;
}

// ── Resolved field info ─────────────────────────────────────────────

export interface ResolvedField {
  requestedField: string;
  resolvedColumn?: string;
  confidence: number;
  alternatives: string[];
}

// ── Result ──────────────────────────────────────────────────────────

export type TableQueryStatus =
  | 'success'
  | 'needs_clarification'
  | 'no_matches'
  | 'error';

export interface TableQueryResult {
  status: TableQueryStatus;
  matchedRowCount: number;
  aggregations: AggregationResult[];
  matchedRows?: MatchedRow[];
  resolvedFields: ResolvedField[];
  warnings: string[];
}

// ── Internal types ──────────────────────────────────────────────────

export interface TableRow {
  fileName: string;
  sheet?: string;
  rowIndex: number;
  values: Record<string, string | number | null>;
}

export interface LoadedTable {
  fileName: string;
  sheet?: string;
  columns: string[];
  rows: TableRow[];
}

export interface ColumnResolution {
  requestedField: string;
  resolvedColumn?: string;
  confidence: number;
  alternatives: string[];
}

export interface PerTableResolution {
  table: LoadedTable;
  columnMap: Map<string, string>; // requestedField → resolvedColumn
  resolutions: ColumnResolution[];
  usable: boolean; // false if any needed field is ambiguous
}
