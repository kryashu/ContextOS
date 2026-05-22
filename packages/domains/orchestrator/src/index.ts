// ── Types ────────────────────────────────────────────────────────────
export type {
  CommandIntent,
  CommandExecutionStatus,
  ConfidenceLevel,
  FilterOperator,
  CommandFilter,
  AggregationOperation,
  CommandAggregation,
  ExtractedCommandData,
  WorkspaceCommandPlan,  RowRequest,
  RowRequestType,} from './types.js';

// ── Router ──────────────────────────────────────────────────────────
export { routeCommand } from './command-router.js';
export type { RouteResult } from './command-router.js';

// ── Parser helpers ──────────────────────────────────────────────────
export {
  normalizeDateToIsoLikeString,
  extractDates,
  extractPossibleKeyValues,
  extractAggregateFields,
  extractFilterExpressions,
  detectAggregationOperation,
  extractKeyType,
  extractFileName,
  extractSourceHint,
  extractRowRequest,
} from './command-parser.js';

// ── Plan builder ────────────────────────────────────────────────────
export { createWorkspaceCommandPlan } from './command-plan.js';
