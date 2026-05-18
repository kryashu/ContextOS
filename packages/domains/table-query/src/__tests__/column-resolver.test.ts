import { describe, it, expect } from 'vitest';
import { resolveColumn, resolveColumnsForTable } from '../column-resolver.js';
import type { LoadedTable } from '../types.js';

describe('resolveColumn', () => {
  const columns = ['Product Name', 'Product Launch Date', 'Sold Qty', 'Transit Units', 'Retailer Stock'];

  it('exact normalized match', () => {
    const r = resolveColumn('sold qty', columns);
    expect(r.resolvedColumn).toBe('Sold Qty');
    expect(r.confidence).toBe(1.0);
  });

  it('resolves "launch date" via synonym', () => {
    const r = resolveColumn('launch date', columns);
    expect(r.resolvedColumn).toBe('Product Launch Date');
    expect(r.confidence).toBe(0.85);
  });

  it('resolves "units sold" via synonym to "Sold Qty"', () => {
    const r = resolveColumn('units sold', columns);
    expect(r.resolvedColumn).toBe('Sold Qty');
    expect(r.confidence).toBe(0.85);
  });

  it('resolves "units in transit" via synonym to "Transit Units"', () => {
    const r = resolveColumn('units in transit', columns);
    expect(r.resolvedColumn).toBe('Transit Units');
    expect(r.confidence).toBe(0.85);
  });

  it('resolves "units with retailers" via synonym to "Retailer Stock"', () => {
    const r = resolveColumn('units with retailers', columns);
    expect(r.resolvedColumn).toBe('Retailer Stock');
    expect(r.confidence).toBe(0.85);
  });

  it('returns low confidence for unknown field', () => {
    const r = resolveColumn('foobar_xyz', columns);
    expect(r.resolvedColumn).toBeUndefined();
    expect(r.confidence).toBeLessThan(0.5);
  });

  it('returns needs_clarification for ambiguous columns', () => {
    const ambiguousCols = ['Quantity Sold', 'Quantity Shipped', 'Price'];
    const r = resolveColumn('quantity', ambiguousCols);
    // Both contain "quantity" → substring match → close scores → ambiguous
    expect(r.resolvedColumn).toBeUndefined();
    expect(r.alternatives.length).toBeGreaterThan(1);
  });
});

describe('resolveColumnsForTable', () => {
  const table: LoadedTable = {
    fileName: 'test.csv',
    columns: ['Product Launch Date', 'Sold Qty', 'Transit Units'],
    rows: [],
  };

  it('resolves all fields when possible', () => {
    const result = resolveColumnsForTable(['launch date', 'units sold'], table);
    expect(result.usable).toBe(true);
    expect(result.columnMap.get('launch date')).toBe('Product Launch Date');
    expect(result.columnMap.get('units sold')).toBe('Sold Qty');
  });

  it('marks table as not usable when no fields resolve', () => {
    const result = resolveColumnsForTable(['foobar', 'baz'], table);
    expect(result.usable).toBe(false);
  });

  it('different tables resolve differently', () => {
    const table2: LoadedTable = {
      fileName: 'other.csv',
      columns: ['Name', 'Category', 'Color'],
      rows: [],
    };
    const r1 = resolveColumnsForTable(['units sold'], table);
    const r2 = resolveColumnsForTable(['units sold'], table2);
    expect(r1.usable).toBe(true);
    expect(r2.usable).toBe(false); // no column remotely matches "units sold"
  });
});
