import { describe, it, expect } from 'vitest';
import type { TableQueryResult } from '@contextos/table-query';
import { formatTableQueryResult } from '../response-formatters/format-table-query-result.js';

function emptyTrace() {
  return [{ toolId: 'runTableQuery', status: 'success' as const, summary: 'ok' }];
}

describe('formatTableQueryResult', () => {
  it('returns success with sourceRefs copied 1:1 from aggregations', () => {
    const result: TableQueryResult = {
      status: 'success',
      matchedRowCount: 3,
      aggregations: [
        {
          label: 'Total units sold',
          field: 'units_sold',
          resolvedColumn: 'UnitsSold',
          operation: 'sum',
          value: 1234,
          sourceRefs: [
            { fileName: 'sales.xlsx', sheet: 'Q1', row: 2 },
            { fileName: 'sales.xlsx', sheet: 'Q1', row: 3 },
          ],
        },
      ],
      matchedRows: [
        { fileName: 'sales.xlsx', sheet: 'Q1', row: 2, values: { UnitsSold: 500 } },
        { fileName: 'sales.xlsx', sheet: 'Q1', row: 3, values: { UnitsSold: 734 } },
      ],
      resolvedFields: [
        { requestedField: 'units_sold', resolvedColumn: 'UnitsSold', confidence: 0.95, alternatives: [] },
      ],
      warnings: [],
    };

    const response = formatTableQueryResult({
      workspaceId: 'ws_1',
      command: 'calculate total units sold',
      result,
      toolTrace: emptyTrace(),
    });

    expect(response.status).toBe('success');
    expect(response.resultType).toBe('table_query');
    expect(response.intent).toBe('table_aggregate_query');
    expect(response.sourceRefs).toHaveLength(2);
    expect(response.sourceRefs[0]).toMatchObject({
      workspaceId: 'ws_1',
      fileName: 'sales.xlsx',
      sheet: 'Q1',
      row: 2,
    });

    const metric = response.sections.find((s) => s.kind === 'metric_list');
    expect(metric).toBeDefined();
    expect((metric!.content as { entries: Array<{ value: number }> }).entries[0]?.value).toBe(1234);
  });

  it('does NOT invent source refs beyond what the tool result contained', () => {
    const result: TableQueryResult = {
      status: 'success',
      matchedRowCount: 1,
      aggregations: [
        { label: 'count', field: 'id', operation: 'count', value: 1, sourceRefs: [{ fileName: 'a.csv' }] },
      ],
      matchedRows: [{ fileName: 'a.csv', row: 1, values: { id: 'X' } }],
      resolvedFields: [],
      warnings: [],
    };
    const response = formatTableQueryResult({
      workspaceId: 'ws_1',
      command: 'count ids',
      result,
      toolTrace: emptyTrace(),
    });

    expect(response.sourceRefs.map((r) => r.fileName)).toEqual(['a.csv']);
  });

  // ── Hallucination safeguards ────────────────────────────────────────

  it('matched rows > 0 + valid aggregations + no source refs → success (computed metric is sufficient)', () => {
    const result: TableQueryResult = {
      status: 'success',
      matchedRowCount: 5,
      aggregations: [
        // no sourceRefs but valid computed value
        { label: 'sum sales', field: 'sales', operation: 'sum', value: 999, sourceRefs: [] },
      ],
      matchedRows: [],
      resolvedFields: [],
      warnings: [],
    };
    const response = formatTableQueryResult({
      workspaceId: 'ws_1',
      command: 'sum sales',
      result,
      toolTrace: emptyTrace(),
    });

    expect(response.status).toBe('success');
    expect(response.sections.some((s) => s.kind === 'metric_list')).toBe(true);
    expect(response.sourceRefs).toHaveLength(0);
  });

  it('matched rows > 0 + empty aggregations + no source refs → no_matches (no evidence)', () => {
    const result: TableQueryResult = {
      status: 'success',
      matchedRowCount: 3,
      aggregations: [],
      matchedRows: [
        { fileName: 'a.csv', row: 1, values: { id: 'X' } },
      ],
      resolvedFields: [],
      warnings: [],
    };
    const response = formatTableQueryResult({
      workspaceId: 'ws_1',
      command: 'show all rows',
      result,
      toolTrace: emptyTrace(),
    });

    // Tool reported success but evidence guard downgrades. Computed metric is
    // missing, source refs are empty, and although there is a table section
    // it isn't a metric_list — the formatter must not claim success.
    expect(response.status).not.toBe('success');
    expect(['no_matches', 'needs_clarification']).toContain(response.status);
  });

  it('maps tool no_matches to status no_matches', () => {
    const result: TableQueryResult = {
      status: 'no_matches',
      matchedRowCount: 0,
      aggregations: [],
      matchedRows: [],
      resolvedFields: [],
      warnings: [],
    };
    const response = formatTableQueryResult({
      workspaceId: 'ws_1',
      command: 'sum x',
      result,
      toolTrace: emptyTrace(),
    });
    expect(response.status).toBe('no_matches');
  });

  it('maps tool needs_clarification to status needs_clarification', () => {
    const result: TableQueryResult = {
      status: 'needs_clarification',
      matchedRowCount: 0,
      aggregations: [],
      matchedRows: [],
      resolvedFields: [],
      warnings: ['Field "x" could not be resolved.'],
    };
    const response = formatTableQueryResult({
      workspaceId: 'ws_1',
      command: 'sum x',
      result,
      toolTrace: emptyTrace(),
    });
    expect(response.status).toBe('needs_clarification');
  });
});
