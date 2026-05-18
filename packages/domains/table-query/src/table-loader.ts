import { readdirSync, readFileSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import * as XLSX from 'xlsx';
import { parse as csvParse } from 'csv-parse/sync';
import type { LoadedTable, TableRow } from './types.js';

/**
 * Load all tabular data from workspace sources directory.
 * Supports .xlsx and .csv files.
 */
export function loadTablesFromSources(
  sourcesDir: string,
  fileScope?: string[],
): LoadedTable[] {
  const tables: LoadedTable[] = [];

  let files: string[];
  try {
    files = readdirSync(sourcesDir);
  } catch {
    return tables;
  }

  for (const fileName of files) {
    const ext = extname(fileName).toLowerCase();
    if (ext !== '.xlsx' && ext !== '.csv') continue;
    if (fileScope && !fileScope.includes(fileName)) continue;

    const filePath = resolve(sourcesDir, fileName);

    if (ext === '.xlsx') {
      tables.push(...loadXlsx(filePath, fileName));
    } else {
      const table = loadCsv(filePath, fileName);
      if (table) tables.push(table);
    }
  }

  return tables;
}

function loadXlsx(filePath: string, fileName: string): LoadedTable[] {
  const tables: LoadedTable[] = [];
  const buffer = readFileSync(filePath);
  const workbook = XLSX.read(buffer, { type: 'buffer' });

  for (const sheetName of workbook.SheetNames) {
    const ws = workbook.Sheets[sheetName];
    if (!ws || !ws['!ref']) continue;

    const rawRows = XLSX.utils.sheet_to_json<(string | number | null)[]>(ws, {
      header: 1,
      defval: null,
    });

    if (rawRows.length < 2) continue; // need header + at least one data row

    const headers = (rawRows[0] ?? []).map((h) =>
      h !== null && h !== undefined ? String(h).trim() : '',
    );

    if (headers.every((h) => h === '')) continue;

    const rows: TableRow[] = [];
    for (let i = 1; i < rawRows.length; i++) {
      const raw = rawRows[i]!;
      const values: Record<string, string | number | null> = {};
      let hasValue = false;

      for (let c = 0; c < headers.length; c++) {
        const col = headers[c]!;
        if (!col) continue;
        const cell = c < raw.length ? raw[c] ?? null : null;
        values[col] = cell;
        if (cell !== null) hasValue = true;
      }

      if (hasValue) {
        rows.push({ fileName, sheet: sheetName, rowIndex: i + 1, values });
      }
    }

    if (rows.length > 0) {
      tables.push({
        fileName,
        sheet: sheetName,
        columns: headers.filter((h) => h !== ''),
        rows,
      });
    }
  }

  return tables;
}

function loadCsv(filePath: string, fileName: string): LoadedTable | null {
  const content = readFileSync(filePath, 'utf-8');
  if (!content.trim()) return null;

  const records = csvParse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[];

  if (records.length === 0) return null;

  const columns = Object.keys(records[0]!);
  const rows: TableRow[] = records.map((rec, idx) => ({
    fileName,
    rowIndex: idx + 2, // 1-indexed + header row
    values: rec as Record<string, string | number | null>,
  }));

  return { fileName, columns, rows };
}
