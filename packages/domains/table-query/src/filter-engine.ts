import type { TableRow, QueryFilter } from './types.js';

/**
 * Apply filters to rows using resolved column names.
 * columnMap: requestedField → resolvedColumn for this table.
 */
export function applyFilters(
  rows: TableRow[],
  filters: QueryFilter[],
  columnMap: Map<string, string>,
): { matched: TableRow[]; warnings: string[] } {
  const warnings: string[] = [];

  if (filters.length === 0) return { matched: rows, warnings };

  let matched = rows;

  for (const filter of filters) {
    const resolvedCol = columnMap.get(filter.field) ?? columnMap.get('date');
    if (!resolvedCol) {
      // Try to find a date-like column for before/after operators
      if (filter.operator === 'before' || filter.operator === 'after') {
        const dateCol = findDateColumn(rows, columnMap);
        if (dateCol) {
          matched = matched.filter((row) =>
            evaluateFilter(row.values[dateCol], filter, warnings),
          );
          continue;
        }
      }
      warnings.push(`Filter field "${filter.field}" could not be resolved.`);
      continue;
    }

    matched = matched.filter((row) =>
      evaluateFilter(row.values[resolvedCol], filter, warnings),
    );
  }

  return { matched, warnings };
}

function findDateColumn(
  _rows: TableRow[],
  columnMap: Map<string, string>,
): string | null {
  // Return any already-resolved column that looks like a date
  for (const col of columnMap.values()) {
    const lower = col.toLowerCase();
    if (lower.includes('date') || lower.includes('launch') || lower.includes('release')) {
      return col;
    }
  }
  return null;
}

function evaluateFilter(
  cellValue: string | number | null | undefined,
  filter: QueryFilter,
  warnings: string[],
): boolean {
  if (cellValue === null || cellValue === undefined) return false;

  switch (filter.operator) {
    case 'before':
    case 'after':
      return evaluateDateFilter(cellValue, filter);

    case 'equals':
      return String(cellValue).toLowerCase() === String(filter.value).toLowerCase();

    case 'contains':
      return String(cellValue).toLowerCase().includes(String(filter.value).toLowerCase());

    case 'greater_than':
    case 'less_than':
      return evaluateNumericFilter(cellValue, filter, warnings);
  }
}

// ── Date comparison ─────────────────────────────────────────────────

function evaluateDateFilter(
  cellValue: string | number | null,
  filter: QueryFilter,
): boolean {
  const cellDate = parseDate(cellValue);
  const filterDate = parseDate(filter.value);
  if (!cellDate || !filterDate) return false;

  if (filter.operator === 'before') return cellDate < filterDate;
  return cellDate > filterDate;
}

function parseDate(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;

  // Excel serial number (number of days since 1900-01-01 with Excel's bug)
  if (typeof value === 'number' && value > 10000 && value < 100000) {
    const excelEpoch = new Date(1899, 11, 30).getTime();
    return excelEpoch + value * 86400000;
  }

  const str = String(value).trim();
  if (!str) return null;

  // ISO: YYYY-MM-DD
  const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])).getTime();

  // US: MM/DD/YYYY
  const us = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (us) return new Date(Number(us[3]), Number(us[1]) - 1, Number(us[2])).getTime();

  // Human: "5 May 2025" or "May 5, 2025"
  const ts = Date.parse(str);
  if (!isNaN(ts)) return ts;

  return null;
}

// ── Numeric comparison ──────────────────────────────────────────────

function evaluateNumericFilter(
  cellValue: string | number | null,
  filter: QueryFilter,
  _warnings: string[],
): boolean {
  const num = coerceNumber(cellValue);
  const filterNum = coerceNumber(filter.value);

  if (num === null || filterNum === null) {
    // Don't spam warnings for every row
    return false;
  }

  if (filter.operator === 'greater_than') return num > filterNum;
  return num < filterNum;
}

function coerceNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  const cleaned = String(value).replace(/[,$\s]/g, '');
  const n = Number(cleaned);
  return isNaN(n) ? null : n;
}
