import { describe, it, expect } from 'vitest';
import { applyFilters } from '../filter-engine.js';
import type { TableRow } from '../types.js';

const ROWS: TableRow[] = [
  { fileName: 'test.csv', rowIndex: 2, values: { 'Launch Date': '2025-01-15', 'Units': '1200', 'Name': 'Widget A' } },
  { fileName: 'test.csv', rowIndex: 3, values: { 'Launch Date': '2025-06-01', 'Units': '800', 'Name': 'Widget B' } },
  { fileName: 'test.csv', rowIndex: 4, values: { 'Launch Date': '2025-04-20', 'Units': '950', 'Name': 'Widget C' } },
];

const COLUMN_MAP = new Map([
  ['date', 'Launch Date'],
  ['units', 'Units'],
  ['name', 'Name'],
]);

describe('applyFilters', () => {
  it('filters by date "before"', () => {
    const { matched } = applyFilters(ROWS, [{ field: 'date', operator: 'before', value: '2025-05-05' }], COLUMN_MAP);
    expect(matched.length).toBe(2); // Jan 15 and Apr 20
    expect(matched.every((r) => r.values['Name'] !== 'Widget B')).toBe(true);
  });

  it('filters by date "after"', () => {
    const { matched } = applyFilters(ROWS, [{ field: 'date', operator: 'after', value: '2025-05-01' }], COLUMN_MAP);
    expect(matched.length).toBe(1);
    expect(matched[0]!.values['Name']).toBe('Widget B');
  });

  it('filters by "equals"', () => {
    const { matched } = applyFilters(ROWS, [{ field: 'name', operator: 'equals', value: 'Widget A' }], COLUMN_MAP);
    expect(matched.length).toBe(1);
    expect(matched[0]!.rowIndex).toBe(2);
  });

  it('filters by "contains"', () => {
    const { matched } = applyFilters(ROWS, [{ field: 'name', operator: 'contains', value: 'widget' }], COLUMN_MAP);
    expect(matched.length).toBe(3); // case-insensitive
  });

  it('filters by "greater_than"', () => {
    const { matched } = applyFilters(ROWS, [{ field: 'units', operator: 'greater_than', value: 900 }], COLUMN_MAP);
    expect(matched.length).toBe(2); // 1200 and 950
  });

  it('filters by "less_than"', () => {
    const { matched } = applyFilters(ROWS, [{ field: 'units', operator: 'less_than', value: 900 }], COLUMN_MAP);
    expect(matched.length).toBe(1);
    expect(matched[0]!.values['Name']).toBe('Widget B');
  });

  it('returns all rows when no filters', () => {
    const { matched } = applyFilters(ROWS, [], COLUMN_MAP);
    expect(matched.length).toBe(3);
  });

  it('warns about unresolved filter field', () => {
    const { warnings } = applyFilters(ROWS, [{ field: 'unknown', operator: 'equals', value: 'x' }], new Map());
    expect(warnings.length).toBeGreaterThan(0);
  });
});
