import type { ColumnResolution, LoadedTable, PerTableResolution } from './types.js';

// ── Synonym map ─────────────────────────────────────────────────────

const SYNONYM_MAP: Record<string, string[]> = {
  'units sold': ['sold qty', 'quantity sold', 'sales', 'sold units', 'units_sold'],
  'launch date': ['product launch date', 'release date', 'released', 'launched', 'date launched'],
  'units in transit': ['transit units', 'in transit', 'shipping', 'in_transit', 'transit qty'],
  'units with retailers': ['retailer stock', 'retail inventory', 'retail units', 'retailer qty'],
  'product name': ['product', 'name', 'item', 'item name', 'product_name'],
  'price': ['unit price', 'cost', 'amount', 'price per unit'],
  'quantity': ['qty', 'count', 'units', 'total units'],
};

// ── Normalization ───────────────────────────────────────────────────

function normalize(s: string): string {
  return s.toLowerCase().replace(/[_\-]/g, ' ').replace(/\s+/g, ' ').trim();
}

function tokenize(s: string): string[] {
  return normalize(s).split(' ').filter(Boolean);
}

// ── Scoring functions ───────────────────────────────────────────────

function scoreExactNormalized(requested: string, column: string): number {
  return normalize(requested) === normalize(column) ? 1.0 : 0;
}

function scoreTokenOverlap(requested: string, column: string): number {
  const reqTokens = tokenize(requested);
  const colTokens = tokenize(column);
  if (reqTokens.length === 0 || colTokens.length === 0) return 0;

  const shared = reqTokens.filter((t) => colTokens.includes(t)).length;
  return shared / Math.max(reqTokens.length, colTokens.length);
}

function scoreSynonym(requested: string, column: string): number {
  const normReq = normalize(requested);
  const normCol = normalize(column);

  for (const [canonical, synonyms] of Object.entries(SYNONYM_MAP)) {
    const allForms = [canonical, ...synonyms];
    const reqMatches = allForms.some((f) => f === normReq);
    const colMatches = allForms.some((f) => f === normCol);
    if (reqMatches && colMatches) return 0.85;
  }
  return 0;
}

function scoreSubstring(requested: string, column: string): number {
  const normReq = normalize(requested);
  const normCol = normalize(column);
  if (normReq.length < 2 || normCol.length < 2) return 0;
  if (normCol.includes(normReq) || normReq.includes(normCol)) return 0.6;
  return 0;
}

// ── Public API ──────────────────────────────────────────────────────

const MIN_CONFIDENCE = 0.5;
const AMBIGUITY_THRESHOLD = 0.1;

export function resolveColumn(
  requestedField: string,
  availableColumns: string[],
): ColumnResolution {
  if (availableColumns.length === 0) {
    return { requestedField, confidence: 0, alternatives: [] };
  }

  const scored = availableColumns.map((col) => {
    const exact = scoreExactNormalized(requestedField, col);
    if (exact === 1.0) return { col, score: 1.0 };

    const synonym = scoreSynonym(requestedField, col);
    if (synonym > 0) return { col, score: synonym };

    const tokenOvlp = scoreTokenOverlap(requestedField, col);
    const substring = scoreSubstring(requestedField, col);
    return { col, score: Math.max(tokenOvlp, substring) };
  });

  scored.sort((a, b) => b.score - a.score);

  const best = scored[0]!;
  const secondBest = scored.length > 1 ? scored[1]! : { col: '', score: 0 };

  // Low confidence — unresolved
  if (best.score < MIN_CONFIDENCE) {
    return {
      requestedField,
      confidence: best.score,
      alternatives: scored.slice(0, 3).map((s) => s.col),
    };
  }

  // Ambiguous — top two too close
  if (best.score - secondBest.score < AMBIGUITY_THRESHOLD && best.score < 1.0) {
    return {
      requestedField,
      confidence: best.score,
      alternatives: scored
        .filter((s) => best.score - s.score < AMBIGUITY_THRESHOLD)
        .map((s) => s.col),
    };
  }

  return {
    requestedField,
    resolvedColumn: best.col,
    confidence: best.score,
    alternatives: [],
  };
}

/**
 * Resolve all requested fields against a single table's columns.
 * Returns per-table resolution indicating whether the table is usable.
 */
export function resolveColumnsForTable(
  requestedFields: string[],
  table: LoadedTable,
): PerTableResolution {
  const columnMap = new Map<string, string>();
  const resolutions: ColumnResolution[] = [];
  let usable = true;

  for (const field of requestedFields) {
    const resolution = resolveColumn(field, table.columns);
    resolutions.push(resolution);

    if (resolution.resolvedColumn) {
      columnMap.set(field, resolution.resolvedColumn);
    } else if (resolution.confidence >= MIN_CONFIDENCE) {
      // Ambiguous — table has matching columns but can't pick one
      usable = false;
    }
    // Low confidence: this table simply doesn't have the field — skip it
  }

  // If no fields resolved at all, table is not usable (but not ambiguous)
  if (columnMap.size === 0) {
    usable = false;
  }

  return { table, columnMap, resolutions, usable };
}
