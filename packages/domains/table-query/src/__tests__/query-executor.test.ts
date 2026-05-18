import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { executeTableQuery } from '../query-executor.js';

const TEST_DIR = resolve(process.cwd(), '__test_fixtures_executor__');

beforeAll(() => {
  mkdirSync(TEST_DIR, { recursive: true });

  const csv = `Product Name,Launch Date,Units Sold,Units In Transit
Widget A,2025-01-15,1200,300
Widget B,2025-06-01,800,150
Widget C,2025-04-20,950,200`;
  writeFileSync(resolve(TEST_DIR, 'products.csv'), csv);
});

afterAll(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('executeTableQuery', () => {
  it('returns success with correct sum for filtered rows', () => {
    const result = executeTableQuery(
      {
        filters: [{ field: 'launch date', operator: 'before', value: '2025-05-05' }],
        aggregations: [{ field: 'units sold', operation: 'sum' }],
      },
      TEST_DIR,
    );
    expect(result.status).toBe('success');
    expect(result.matchedRowCount).toBe(2); // Widget A + Widget C
    expect(result.aggregations.length).toBe(1);
    expect(result.aggregations[0]!.value).toBe(2150); // 1200 + 950
  });

  it('returns no_matches for impossible filter', () => {
    const result = executeTableQuery(
      {
        filters: [{ field: 'launch date', operator: 'after', value: '2099-01-01' }],
        aggregations: [{ field: 'units sold', operation: 'count' }],
      },
      TEST_DIR,
    );
    expect(result.status).toBe('no_matches');
    expect(result.matchedRowCount).toBe(0);
  });

  it('returns needs_clarification for unresolvable column', () => {
    const result = executeTableQuery(
      {
        filters: [],
        aggregations: [{ field: 'completely_unknown_field_xyz', operation: 'sum' }],
      },
      TEST_DIR,
    );
    expect(result.status).toBe('needs_clarification');
  });

  it('includes row-level source refs', () => {
    const result = executeTableQuery(
      {
        filters: [{ field: 'product name', operator: 'equals', value: 'Widget A' }],
        aggregations: [{ field: 'units sold', operation: 'sum' }],
      },
      TEST_DIR,
    );
    expect(result.status).toBe('success');
    expect(result.aggregations[0]!.sourceRefs.length).toBe(1);
    expect(result.aggregations[0]!.sourceRefs[0]!.fileName).toBe('products.csv');
    expect(result.aggregations[0]!.sourceRefs[0]!.row).toBe(2);
  });

  it('resolvedFields shows what was resolved', () => {
    const result = executeTableQuery(
      {
        filters: [],
        aggregations: [{ field: 'units in transit', operation: 'sum' }],
      },
      TEST_DIR,
    );
    expect(result.status).toBe('success');
    expect(result.resolvedFields.length).toBeGreaterThan(0);
    expect(result.resolvedFields[0]!.requestedField).toBe('units in transit');
    expect(result.resolvedFields[0]!.resolvedColumn).toBe('Units In Transit');
  });

  it('returns error when sourcesDir does not exist', () => {
    const result = executeTableQuery(
      {
        filters: [],
        aggregations: [{ field: 'units sold', operation: 'sum' }],
      },
      '/tmp/__nonexistent_sources_12345__',
    );
    expect(result.status === 'error' || result.status === 'no_matches').toBe(true);
  });

  it('computes average correctly', () => {
    const result = executeTableQuery(
      {
        filters: [],
        aggregations: [{ field: 'units sold', operation: 'average' }],
      },
      TEST_DIR,
    );
    expect(result.status).toBe('success');
    expect(result.aggregations[0]!.value).toBeCloseTo(983.33, 0);
  });

  it('supports includeRows', () => {
    const result = executeTableQuery(
      {
        filters: [{ field: 'product name', operator: 'contains', value: 'Widget' }],
        aggregations: [{ field: 'units sold', operation: 'count' }],
        includeRows: true,
      },
      TEST_DIR,
    );
    expect(result.status).toBe('success');
    expect(result.matchedRows).toBeDefined();
    expect(result.matchedRows!.length).toBe(3);
  });
});
