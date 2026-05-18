import type {
  TableQueryRequest,
  TableQueryResult,
  AggregationResult,
  ResolvedField,
  MatchedRow,
  PerTableResolution,
} from './types.js';
import { loadTablesFromSources } from './table-loader.js';
import { resolveColumnsForTable } from './column-resolver.js';
import { applyFilters } from './filter-engine.js';
import { computeAggregations } from './aggregation-engine.js';

/**
 * Execute a table query against workspace source files.
 * Receives sourcesDir separately — no workspaceId at this layer.
 */
export function executeTableQuery(
  request: TableQueryRequest,
  sourcesDir: string,
): TableQueryResult {
  const warnings: string[] = [];

  // 1. Load tables
  const tables = loadTablesFromSources(sourcesDir, request.fileScope);
  if (tables.length === 0) {
    return {
      status: 'no_matches',
      matchedRowCount: 0,
      aggregations: [],
      resolvedFields: [],
      warnings: ['No tabular files (.xlsx, .csv) found in workspace sources.'],
    };
  }

  // 2. Collect all requested fields (from filters + aggregations)
  const requestedFields = collectRequestedFields(request);

  // 3. Resolve columns per table
  const tableResolutions: PerTableResolution[] = tables.map((table) =>
    resolveColumnsForTable(requestedFields, table),
  );

  // 4. Check for ambiguous resolutions (needs_clarification)
  const ambiguous = tableResolutions.find(
    (tr) => !tr.usable && tr.resolutions.some((r) => r.confidence >= 0.5 && !r.resolvedColumn),
  );
  if (ambiguous) {
    return {
      status: 'needs_clarification',
      matchedRowCount: 0,
      aggregations: [],
      resolvedFields: ambiguous.resolutions.map(toResolvedField),
      warnings: [
        `Ambiguous columns in "${ambiguous.table.fileName}"${ambiguous.table.sheet ? ` (sheet: ${ambiguous.table.sheet})` : ''}. Please clarify which column to use.`,
      ],
    };
  }

  // 5. Filter to usable tables only
  const usableTables = tableResolutions.filter((tr) => tr.usable);
  if (usableTables.length === 0) {
    const allResolutions = tableResolutions.flatMap((tr) => tr.resolutions);
    return {
      status: 'needs_clarification',
      matchedRowCount: 0,
      aggregations: [],
      resolvedFields: dedupeResolutions(allResolutions).map(toResolvedField),
      warnings: ['No tables could resolve the requested fields. Check column names.'],
    };
  }

  // Log skipped tables
  const skipped = tableResolutions.filter((tr) => !tr.usable);
  for (const s of skipped) {
    warnings.push(
      `Skipped "${s.table.fileName}"${s.table.sheet ? ` (${s.table.sheet})` : ''}: could not resolve requested fields.`,
    );
  }

  // 6. Apply filters and compute aggregations per table, then merge
  let totalMatchedRows: MatchedRow[] = [];
  const mergedAggregations: Map<string, AggregationResult> = new Map();
  const allResolvedFields: ResolvedField[] = [];

  for (const tr of usableTables) {
    const { matched, warnings: filterWarnings } = applyFilters(
      tr.table.rows,
      request.filters,
      tr.columnMap,
    );
    warnings.push(...filterWarnings);

    if (matched.length === 0) continue;

    // Collect matched rows if requested
    if (request.includeRows) {
      for (const row of matched) {
        totalMatchedRows.push({
          fileName: row.fileName,
          sheet: row.sheet,
          row: row.rowIndex,
          values: row.values,
        });
      }
    }

    // Compute aggregations
    const { results: aggResults, warnings: aggWarnings } = computeAggregations(
      matched,
      request.aggregations,
      tr.columnMap,
    );
    warnings.push(...aggWarnings);

    // Merge aggregation results across tables
    for (const agg of aggResults) {
      const key = `${agg.field}:${agg.operation}`;
      const existing = mergedAggregations.get(key);
      if (existing) {
        mergedAggregations.set(key, mergeAggregation(existing, agg));
      } else {
        mergedAggregations.set(key, agg);
      }
    }

    // Collect resolved fields
    for (const r of tr.resolutions) {
      if (r.resolvedColumn) {
        allResolvedFields.push(toResolvedField(r));
      }
    }
  }

  const totalMatchedCount = request.includeRows
    ? totalMatchedRows.length
    : usableTables.reduce((sum, tr) => {
        const { matched } = applyFilters(tr.table.rows, request.filters, tr.columnMap);
        return sum + matched.length;
      }, 0);

  const aggregations = [...mergedAggregations.values()];

  if (totalMatchedCount === 0 && aggregations.length === 0) {
    return {
      status: 'no_matches',
      matchedRowCount: 0,
      aggregations: [],
      resolvedFields: dedupeResolutions(usableTables.flatMap((t) => t.resolutions)).map(toResolvedField),
      warnings: [...warnings, 'No rows matched the filter criteria.'],
    };
  }

  return {
    status: 'success',
    matchedRowCount: totalMatchedCount,
    aggregations,
    matchedRows: request.includeRows ? totalMatchedRows : undefined,
    resolvedFields: dedupeResolved(allResolvedFields),
    warnings,
  };
}

// ── Helpers ─────────────────────────────────────────────────────────

function collectRequestedFields(request: TableQueryRequest): string[] {
  const fields = new Set<string>();
  for (const f of request.filters) fields.add(f.field);
  for (const a of request.aggregations) fields.add(a.field);
  return [...fields];
}

function toResolvedField(r: { requestedField: string; resolvedColumn?: string; confidence: number; alternatives: string[] }): ResolvedField {
  return {
    requestedField: r.requestedField,
    resolvedColumn: r.resolvedColumn,
    confidence: r.confidence,
    alternatives: r.alternatives,
  };
}

function dedupeResolutions(resolutions: { requestedField: string; resolvedColumn?: string; confidence: number; alternatives: string[] }[]) {
  const seen = new Set<string>();
  return resolutions.filter((r) => {
    if (seen.has(r.requestedField)) return false;
    seen.add(r.requestedField);
    return true;
  });
}

function dedupeResolved(fields: ResolvedField[]): ResolvedField[] {
  const seen = new Set<string>();
  return fields.filter((f) => {
    const key = `${f.requestedField}:${f.resolvedColumn}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mergeAggregation(a: AggregationResult, b: AggregationResult): AggregationResult {
  switch (a.operation) {
    case 'sum':
    case 'count':
      return { ...a, value: a.value + b.value, sourceRefs: [...a.sourceRefs, ...b.sourceRefs] };
    case 'average': {
      const totalRefs = a.sourceRefs.length + b.sourceRefs.length;
      const weightedSum = a.value * a.sourceRefs.length + b.value * b.sourceRefs.length;
      return { ...a, value: totalRefs > 0 ? weightedSum / totalRefs : 0, sourceRefs: [...a.sourceRefs, ...b.sourceRefs] };
    }
    case 'min':
      return { ...a, value: Math.min(a.value, b.value), sourceRefs: [...a.sourceRefs, ...b.sourceRefs] };
    case 'max':
      return { ...a, value: Math.max(a.value, b.value), sourceRefs: [...a.sourceRefs, ...b.sourceRefs] };
    default:
      return a;
  }
}
