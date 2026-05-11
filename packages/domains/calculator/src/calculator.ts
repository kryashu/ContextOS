import type {
  NormalizedObservation,
  CalculationRequest,
  CalculationResult,
  CalculationResultRow,
  CalculationFilter,
  CalculationSourceRef,
} from '@contextos/types';

/** Groupable fields on NormalizedObservation */
const GROUPABLE_FIELDS = new Set([
  'sheet',
  'section',
  'variety',
  'plantPart',
  'treatment',
]);

/** Comparison operations that require baseline/target partitioning */
const COMPARISON_OPS = new Set(['subtract', 'difference', 'percentage_change']);

/**
 * Deterministic table calculation engine.
 * Operates on NormalizedObservation arrays — no LLM, no database.
 */
export class TableCalculator {
  constructor(private readonly observations: NormalizedObservation[]) {}

  // ── Public API ──────────────────────────────────────────────────

  calculate(request: CalculationRequest): CalculationResult {
    // Route comparison operations to separate path
    if (COMPARISON_OPS.has(request.operation)) {
      return this.calculateComparison(request);
    }

    const warnings: string[] = [];

    // 1. Filter to matching metric
    let matched = this.observations.filter(o => o.metric === request.metric);
    if (matched.length === 0) {
      warnings.push(`No observations found for metric "${request.metric}".`);
      return this.buildResult(request, [], warnings);
    }

    // 2. Apply user-supplied filters
    if (request.filters && request.filters.length > 0) {
      matched = this.applyFilters(matched, request.filters);
      if (matched.length === 0) {
        warnings.push('All observations were excluded by the applied filters.');
        return this.buildResult(request, [], warnings);
      }
    }

    // 3. Group observations
    const groups = this.groupObservations(matched, request.groupBy);

    // 4. Compute aggregate per group
    const rows: CalculationResultRow[] = [];
    for (const [groupKey, obs] of groups) {
      const numericValues = obs
        .filter(o => o.value !== null && typeof o.value === 'number' && isFinite(o.value))
        .map(o => o.value as number);

      const sourceRefs: CalculationSourceRef[] = obs.map(o => ({
        sourceCell: o.sourceCell,
        sourceRange: o.sourceRange,
      }));

      if (request.operation === 'count') {
        rows.push({
          group: groupKey || undefined,
          value: obs.length,
          count: obs.length,
          sourceRefs,
        });
        continue;
      }

      // For numeric ops, skip if no valid numbers
      if (numericValues.length === 0) {
        const skipped = obs.length - numericValues.length;
        if (skipped > 0) {
          warnings.push(
            `Group "${groupKey || '(all)'}": ${skipped} observation(s) with null/non-numeric values were skipped.`,
          );
        }
        continue;
      }

      const skipped = obs.length - numericValues.length;
      if (skipped > 0) {
        warnings.push(
          `Group "${groupKey || '(all)'}": ${skipped} observation(s) with null/non-numeric values were skipped.`,
        );
      }

      const value = this.computeAggregate(request.operation, numericValues);
      rows.push({
        group: groupKey || undefined,
        value,
        count: numericValues.length,
        sourceRefs,
      });
    }

    // 5. Sort result rows
    const sorted = this.applySortAndLimit(rows, request);

    return this.buildResult(request, sorted, warnings);
  }

  /** Distinct metric names present in the dataset */
  getAvailableMetrics(): string[] {
    return [...new Set(this.observations.map(o => o.metric))].sort();
  }

  /** Distinct values for a groupable field */
  getAvailableValues(field: string): string[] {
    if (!GROUPABLE_FIELDS.has(field)) return [];
    return [
      ...new Set(
        this.observations.map(o => o[field as keyof NormalizedObservation] as string).filter(Boolean),
      ),
    ].sort();
  }

  // ── Private helpers ─────────────────────────────────────────────

  private applyFilters(
    observations: NormalizedObservation[],
    filters: CalculationFilter[],
  ): NormalizedObservation[] {
    return observations.filter(obs => {
      return filters.every(f => {
        const fieldValue = obs[f.field as keyof NormalizedObservation];
        return this.matchesFilter(fieldValue, f);
      });
    });
  }

  private matchesFilter(
    fieldValue: string | number | null | undefined,
    filter: CalculationFilter,
  ): boolean {
    if (fieldValue === null || fieldValue === undefined) return false;

    switch (filter.operator) {
      case 'eq':
        return String(fieldValue) === String(filter.value);
      case 'neq':
        return String(fieldValue) !== String(filter.value);
      case 'gt':
        return Number(fieldValue) > Number(filter.value);
      case 'lt':
        return Number(fieldValue) < Number(filter.value);
      case 'gte':
        return Number(fieldValue) >= Number(filter.value);
      case 'lte':
        return Number(fieldValue) <= Number(filter.value);
      case 'in':
        if (Array.isArray(filter.value)) {
          return filter.value.map(String).includes(String(fieldValue));
        }
        return String(fieldValue) === String(filter.value);
      default:
        return true;
    }
  }

  private groupObservations(
    observations: NormalizedObservation[],
    groupBy?: string,
  ): Map<string, NormalizedObservation[]> {
    const groups = new Map<string, NormalizedObservation[]>();

    if (!groupBy) {
      groups.set('', observations);
      return groups;
    }

    // Support compound groupBy with '+' separator
    const fields = groupBy.split('+').map(f => f.trim());

    for (const obs of observations) {
      const keyParts = fields.map(field => {
        const val = obs[field as keyof NormalizedObservation];
        return val != null ? String(val) : '';
      });
      const key = keyParts.join(' | ');

      const arr = groups.get(key);
      if (arr) {
        arr.push(obs);
      } else {
        groups.set(key, [obs]);
      }
    }

    return groups;
  }

  private computeAggregate(
    operation: CalculationRequest['operation'],
    values: number[],
  ): number {
    switch (operation) {
      case 'count':
        return values.length;
      case 'sum':
        return values.reduce((a, b) => a + b, 0);
      case 'average':
        return values.reduce((a, b) => a + b, 0) / values.length;
      case 'min':
        return Math.min(...values);
      case 'max':
        return Math.max(...values);
      case 'median':
        return this.computeMedian(values);
      default:
        return 0;
    }
  }

  private computeMedian(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1]! + sorted[mid]!) / 2;
    }
    return sorted[mid]!;
  }

  private applySortAndLimit(
    rows: CalculationResultRow[],
    request: CalculationRequest,
  ): CalculationResultRow[] {
    let result = [...rows];

    if (request.sort) {
      const dir = request.sort.direction === 'desc' ? -1 : 1;
      const field = request.sort.field as keyof CalculationResultRow;
      result.sort((a, b) => {
        const aVal = a[field] ?? 0;
        const bVal = b[field] ?? 0;
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return (aVal - bVal) * dir;
        }
        return String(aVal).localeCompare(String(bVal)) * dir;
      });
    }

    if (request.limit && request.limit > 0) {
      result = result.slice(0, request.limit);
    }

    return result;
  }

  // ── Comparison operations ───────────────────────────────────────

  private calculateComparison(request: CalculationRequest): CalculationResult {
    const warnings: string[] = [];
    const { compareBy, baseline, target, metric, operation, groupBy, filters } = request;

    // Validate required fields
    if (!compareBy || !baseline || !target) {
      warnings.push('Comparison operations require compareBy, baseline, and target fields.');
      return this.buildResult(request, [], warnings);
    }

    // 1. Filter to matching metric
    let matched = this.observations.filter(o => o.metric === metric);
    if (matched.length === 0) {
      warnings.push(`No observations found for metric "${metric}".`);
      return this.buildResult(request, [], warnings);
    }

    // 2. Apply user-supplied filters (before splitting baseline/target)
    if (filters && filters.length > 0) {
      matched = this.applyFilters(matched, filters);
      if (matched.length === 0) {
        warnings.push('All observations were excluded by the applied filters.');
        return this.buildResult(request, [], warnings);
      }
    }

    // 3. Partition into baseline and target subsets
    const baselineObs = matched.filter(
      o => String(o[compareBy as keyof NormalizedObservation]) === baseline,
    );
    const targetObs = matched.filter(
      o => String(o[compareBy as keyof NormalizedObservation]) === target,
    );

    if (baselineObs.length === 0) {
      warnings.push(`No observations found for baseline "${baseline}" on field "${compareBy}".`);
    }
    if (targetObs.length === 0) {
      warnings.push(`No observations found for target "${target}" on field "${compareBy}".`);
    }
    if (baselineObs.length === 0 || targetObs.length === 0) {
      return this.buildResult(request, [], warnings);
    }

    // 4. Group each partition independently
    const baselineGroups = this.groupObservations(baselineObs, groupBy);
    const targetGroups = this.groupObservations(targetObs, groupBy);

    // 5. Compute comparison per group
    const allGroupKeys = new Set([...baselineGroups.keys(), ...targetGroups.keys()]);
    const rows: CalculationResultRow[] = [];

    for (const groupKey of allGroupKeys) {
      const bObs = baselineGroups.get(groupKey);
      const tObs = targetGroups.get(groupKey);

      if (!bObs || !tObs) {
        const missing = !bObs ? 'baseline' : 'target';
        warnings.push(
          `Group "${groupKey || '(all)'}": missing ${missing} — skipped.`,
        );
        continue;
      }

      const bValues = bObs
        .filter(o => o.value !== null && typeof o.value === 'number' && isFinite(o.value))
        .map(o => o.value as number);
      const tValues = tObs
        .filter(o => o.value !== null && typeof o.value === 'number' && isFinite(o.value))
        .map(o => o.value as number);

      if (bValues.length === 0 || tValues.length === 0) {
        const missing = bValues.length === 0 ? 'baseline' : 'target';
        warnings.push(
          `Group "${groupKey || '(all)'}": ${missing} has no numeric values — skipped.`,
        );
        continue;
      }

      const bAvg = bValues.reduce((a, b) => a + b, 0) / bValues.length;
      const tAvg = tValues.reduce((a, b) => a + b, 0) / tValues.length;

      let value: number;
      if (operation === 'subtract' || operation === 'difference') {
        value = tAvg - bAvg;
      } else {
        // percentage_change: ((target - baseline) / |baseline|) * 100
        if (bAvg === 0) {
          warnings.push(
            `Group "${groupKey || '(all)'}": baseline average is 0 — cannot compute percentage change.`,
          );
          continue;
        }
        value = ((tAvg - bAvg) / Math.abs(bAvg)) * 100;
      }

      const sourceRefs: CalculationSourceRef[] = [
        ...bObs.map(o => ({ sourceCell: o.sourceCell, sourceRange: o.sourceRange })),
        ...tObs.map(o => ({ sourceCell: o.sourceCell, sourceRange: o.sourceRange })),
      ];

      rows.push({
        group: groupKey || undefined,
        value,
        count: bValues.length + tValues.length,
        sourceRefs,
      });
    }

    // 6. Sort & limit
    const sorted = this.applySortAndLimit(rows, request);
    return this.buildResult(request, sorted, warnings);
  }

  private buildResult(
    request: CalculationRequest,
    rows: CalculationResultRow[],
    warnings: string[],
  ): CalculationResult {
    return {
      calculationId: `calc_${Date.now()}`,
      generatedAt: new Date().toISOString(),
      operation: request.operation,
      metric: request.metric,
      groupBy: request.groupBy,
      filters: request.filters,
      rows,
      warnings,
    };
  }
}
