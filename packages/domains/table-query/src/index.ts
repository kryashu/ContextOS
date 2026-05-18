// ── Types ────────────────────────────────────────────────────────────
export type {
  FilterOperator,
  QueryFilter,
  AggregationOperation,
  QueryAggregation,
  TableQueryRequest,
  SourceRef,
  AggregationResult,
  MatchedRow,
  ResolvedField,
  TableQueryStatus,
  TableQueryResult,
  TableRow,
  LoadedTable,
  ColumnResolution,
  PerTableResolution,
} from './types.js';

// ── Loader ──────────────────────────────────────────────────────────
export { loadTablesFromSources } from './table-loader.js';

// ── Column resolver ─────────────────────────────────────────────────
export { resolveColumn, resolveColumnsForTable } from './column-resolver.js';

// ── Filter engine ───────────────────────────────────────────────────
export { applyFilters } from './filter-engine.js';

// ── Aggregation engine ──────────────────────────────────────────────
export { computeAggregations } from './aggregation-engine.js';

// ── Query executor ──────────────────────────────────────────────────
export { executeTableQuery } from './query-executor.js';
