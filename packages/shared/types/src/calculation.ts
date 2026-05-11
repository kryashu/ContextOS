/**
 * Types for the deterministic table calculation engine (VS004.1).
 * No LLM involvement — pure numeric aggregation over NormalizedObservation data.
 */

// ── Observation (mirrors excel-parser output, avoids circular dep) ──

export interface NormalizedObservation {
  sheet: string;
  section: string;
  variety: string;
  plantPart: string;
  treatment: string;
  metric: string;
  value: number | null;
  unit: string;
  sourceCell: string;
  sourceRange: string;
}

// ── Request types ───────────────────────────────────────────────────

export type CalculationOperation =
  | 'count'
  | 'sum'
  | 'average'
  | 'min'
  | 'max'
  | 'median'
  | 'subtract'
  | 'difference'
  | 'percentage_change';

export interface CalculationFilter {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'in';
  value: string | number | string[];
}

export interface CalculationSort {
  field: string;
  direction: 'asc' | 'desc';
}

export interface CalculationRequest {
  metric: string;
  operation: CalculationOperation;
  /** Single field or compound key with '+' separator, e.g. 'treatment+plantPart' */
  groupBy?: string;
  filters?: CalculationFilter[];
  sort?: CalculationSort;
  limit?: number;
  /**
   * Comparison fields — required for subtract / difference / percentage_change.
   * compareBy: the observation field that distinguishes baseline from target (e.g. 'treatment').
   * baseline: the field value for the baseline group (e.g. 'CK').
   * target: the field value for the target group (e.g. 'As').
   */
  compareBy?: string;
  baseline?: string;
  target?: string;
}

// ── Result types ────────────────────────────────────────────────────

export interface CalculationSourceRef {
  sourceCell: string;
  sourceRange: string;
}

export interface CalculationResultRow {
  group?: string;
  value: number;
  count: number;
  sourceRefs: CalculationSourceRef[];
}

export interface CalculationResult {
  calculationId: string;
  generatedAt: string;
  operation: CalculationOperation;
  metric: string;
  groupBy?: string;
  filters?: CalculationFilter[];
  rows: CalculationResultRow[];
  warnings: string[];
}
