import type { TableRow, QueryAggregation, AggregationResult, SourceRef } from './types.js';

/**
 * Compute aggregations over matched rows.
 * columnMap: requestedField → resolvedColumn for this table.
 */
export function computeAggregations(
  rows: TableRow[],
  aggregations: QueryAggregation[],
  columnMap: Map<string, string>,
): { results: AggregationResult[]; warnings: string[] } {
  const results: AggregationResult[] = [];
  const warnings: string[] = [];

  for (const agg of aggregations) {
    const resolvedCol = columnMap.get(agg.field);
    if (!resolvedCol) {
      warnings.push(`Aggregation field "${agg.field}" could not be resolved.`);
      continue;
    }

    const numericValues: { value: number; row: TableRow }[] = [];
    let skippedNonNumeric = 0;

    for (const row of rows) {
      const raw = row.values[resolvedCol];
      const num = coerceNumber(raw);
      if (num !== null) {
        numericValues.push({ value: num, row });
      } else if (raw !== null && raw !== undefined && String(raw).trim() !== '') {
        skippedNonNumeric++;
      }
    }

    if (skippedNonNumeric > 0) {
      warnings.push(
        `Skipped ${skippedNonNumeric} non-numeric value(s) in column "${resolvedCol}" for ${agg.operation}.`,
      );
    }

    const value = computeValue(agg.operation, numericValues.map((v) => v.value));
    const sourceRefs: SourceRef[] = numericValues.map((v) => ({
      fileName: v.row.fileName,
      sheet: v.row.sheet,
      row: v.row.rowIndex,
      sourceRange: `${resolvedCol}:${v.row.rowIndex}`,
    }));

    results.push({
      label: agg.label ?? `${agg.operation} of ${agg.field}`,
      field: agg.field,
      resolvedColumn: resolvedCol,
      operation: agg.operation,
      value,
      sourceRefs,
    });
  }

  return { results, warnings };
}

function computeValue(operation: string, values: number[]): number {
  if (values.length === 0) return 0;

  switch (operation) {
    case 'sum':
      return values.reduce((a, b) => a + b, 0);
    case 'count':
      return values.length;
    case 'average':
      return values.reduce((a, b) => a + b, 0) / values.length;
    case 'min':
      return Math.min(...values);
    case 'max':
      return Math.max(...values);
    default:
      return 0;
  }
}

function coerceNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  const cleaned = String(value).replace(/[,$\s]/g, '');
  const n = Number(cleaned);
  return isNaN(n) ? null : n;
}
