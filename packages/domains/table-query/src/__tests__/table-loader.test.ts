import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadTablesFromSources } from '../table-loader.js';

const TEST_DIR = resolve(process.cwd(), '__test_fixtures_loader__');

beforeAll(() => {
  mkdirSync(TEST_DIR, { recursive: true });

  // Create a test CSV
  const csv = `Product Name,Launch Date,Units Sold,Units In Transit
Widget A,2025-01-15,1200,300
Widget B,2025-06-01,800,150
Widget C,2025-04-20,950,200`;
  writeFileSync(resolve(TEST_DIR, 'products.csv'), csv);

  // Create a second CSV for multi-file testing
  const csv2 = `Product,Product Launch Date,Sold Qty,Transit Units
Alpha,2025-03-10,500,100
Beta,2025-07-01,300,50
Gamma,2025-02-14,700,120`;
  writeFileSync(resolve(TEST_DIR, 'inventory.csv'), csv2);

  // Create a non-table file that should be ignored
  writeFileSync(resolve(TEST_DIR, 'readme.md'), '# Not a table');
});

afterAll(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('loadTablesFromSources', () => {
  it('loads multiple CSV files with correct columns and row indices', () => {
    const tables = loadTablesFromSources(TEST_DIR);
    const csv = tables.find((t) => t.fileName === 'products.csv');
    expect(csv).toBeDefined();
    expect(csv!.columns).toEqual(['Product Name', 'Launch Date', 'Units Sold', 'Units In Transit']);
    expect(csv!.rows.length).toBe(3);
    expect(csv!.rows[0]!.rowIndex).toBe(2); // 1-indexed + header
    expect(csv!.rows[0]!.values['Product Name']).toBe('Widget A');

    const inv = tables.find((t) => t.fileName === 'inventory.csv');
    expect(inv).toBeDefined();
    expect(inv!.columns).toContain('Sold Qty');
    expect(inv!.rows.length).toBe(3);
  });

  it('ignores non-table files', () => {
    const tables = loadTablesFromSources(TEST_DIR);
    expect(tables.every((t) => t.fileName !== 'readme.md')).toBe(true);
  });

  it('respects fileScope filter', () => {
    const tables = loadTablesFromSources(TEST_DIR, ['products.csv']);
    expect(tables.length).toBe(1);
    expect(tables[0]!.fileName).toBe('products.csv');
  });

  it('returns empty for non-existent directory', () => {
    const tables = loadTablesFromSources('/tmp/__nonexistent_dir_12345__');
    expect(tables).toEqual([]);
  });
});
