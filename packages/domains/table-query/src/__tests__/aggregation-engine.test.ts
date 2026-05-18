import { describe, it, expect } from 'vitest';
import { computeAggregations } from '../aggregation-engine.js';
import type { TableRow } from '../types.js';

const ROWS: TableRow[] = [
  { fileName: 'data.csv', rowIndex: 2, values: { 'Units Sold': '1200', 'Revenue': '24000' } },
  { fileName: 'data.csv', rowIndex: 3, values: { 'Units Sold': '800', 'Revenue': '16000' } },
  { fileName: 'data.csv', rowIndex: 4, values: { 'Units Sold': '950', 'Revenue': '19000' } },
];

const COLUMN_MAP = new Map([
  ['units sold', 'Units Sold'],
  ['revenue', 'Revenue'],
]);

describe('computeAggregations', () => {
  it('computes sum', () => {
    const { results } = computeAggregations(
      ROWS,
      [{ field: 'units sold', operation: 'sum' }],
      COLUMN_MAP,
    );
    expect(results.length).toBe(1);
    expect(results[0]!.value).toBe(2950);
    expect(results[0]!.operation).toBe('sum');
    expect(results[0]!.resolvedColumn).toBe('Units Sold');
  });

  it('computes count', () => {
    const { results } = computeAggregations(
      ROWS,
      [{ field: 'units sold', operation: 'count' }],
      COLUMN_MAP,
    );
    expect(results[0]!.value).toBe(3);
  });

  it('computes average', () => {
    const { results } = computeAggregations(
      ROWS,
      [{ field: 'revenue', operation: 'average' }],
      COLUMN_MAP,
    );
    expect(results[0]!.value).toBeCloseTo(19666.67, 0);
  });

  it('computes min', () => {
    const { results } = computeAggregations(
      ROWS,
      [{ field: 'units sold', operation: 'min' }],
      COLUMN_MAP,
    );
    expect(results[0]!.value).toBe(800);
  });

  it('computes max', () => {
    const { results } = computeAggregations(
      ROWS,
      [{ field: 'revenue', operation: 'max' }],
      COLUMN_MAP,
    );
    expect(results[0]!.value).toBe(24000);
  });

  it('includes source refs per row', () => {
    const { results } = computeAggregations(
      ROWS,
      [{ field: 'units sold', operation: 'sum' }],
      COLUMN_MAP,
    );
    expect(results[0]!.sourceRefs.length).toBe(3);
    expect(results[0]!.sourceRefs[0]!.fileName).toBe('data.csv');
    expect(results[0]!.sourceRefs[0]!.row).toBe(2);
  });

  it('handles multiple aggregations', () => {
    const { results } = computeAggregations(
      ROWS,
      [
        { field: 'units sold', operation: 'sum' },
        { field: 'revenue', operation: 'average' },
      ],
      COLUMN_MAP,
    );
    expect(results.length).toBe(2);
    expect(results[0]!.operation).toBe('sum');
    expect(results[1]!.operation).toBe('average');
  });

  it('warns about unresolved field', () => {
    const { warnings } = computeAggregations(
      ROWS,
      [{ field: 'unknown_field', operation: 'sum' }],
      COLUMN_MAP,
    );
    expect(warnings.length).toBeGreaterThan(0);
  });
});
