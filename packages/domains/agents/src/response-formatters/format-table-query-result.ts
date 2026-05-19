import type { TableQueryResult, AggregationResult, MatchedRow, SourceRef } from '@contextos/table-query';
import type {
  WorkspaceAgentResponse,
  AgentResponseSection,
  AgentSourceRef,
  AgentNextAction,
  AgentToolTrace,
  MetricListSectionContent,
  TableSectionContent,
} from '../workspace-agent-response.js';
import { buildResponse } from './assert-evidence.js';

const MAX_ROWS_IN_TABLE_SECTION = 25;
const MAX_SOURCE_REFS = 100;

export interface FormatTableQueryResultInput {
  workspaceId: string;
  command: string;
  result: TableQueryResult;
  toolTrace: AgentToolTrace[];
}

export function formatTableQueryResult(
  input: FormatTableQueryResultInput,
): WorkspaceAgentResponse {
  const { result, toolTrace, workspaceId, command } = input;

  // ── Map tool status → response status ──────────────────────────────
  if (result.status === 'needs_clarification') {
    return buildResponse({
      status: 'needs_clarification',
      intent: 'table_aggregate_query',
      resultType: 'table_query',
      summary: 'Need more information to run this table query.',
      answer: result.warnings.join('\n') || 'Please clarify the fields or aggregations to compute.',
      sections: buildResolvedFieldWarningsSection(result),
      sourceRefs: [],
      warnings: result.warnings,
      nextActions: suggestedNextActions(command),
      toolTrace,
    });
  }

  if (result.status === 'error') {
    return buildResponse({
      status: 'error',
      intent: 'table_aggregate_query',
      resultType: 'table_query',
      summary: 'The table query failed.',
      answer: result.warnings[0] ?? 'Table query failed.',
      sections: [],
      sourceRefs: [],
      warnings: result.warnings,
      nextActions: [],
      toolTrace,
    });
  }

  if (result.status === 'no_matches' || result.matchedRowCount === 0) {
    return buildResponse({
      status: 'no_matches',
      intent: 'table_aggregate_query',
      resultType: 'table_query',
      summary: 'No rows matched the filters.',
      answer: 'No rows matched the supplied filters across the workspace tables.',
      sections: buildResolvedFieldWarningsSection(result),
      sourceRefs: [],
      warnings: result.warnings,
      nextActions: suggestedNextActions(command),
      toolTrace,
    });
  }

  // ── status === 'success' from tool ─────────────────────────────────
  const sections: AgentResponseSection[] = [];

  const metricEntries = result.aggregations
    .filter((a) => Number.isFinite(a.value))
    .map((a) => ({
      label: a.label || `${a.operation}(${a.field})`,
      value: a.value,
      hint: a.resolvedColumn ? `column: ${a.resolvedColumn}` : undefined,
    }));

  if (metricEntries.length > 0) {
    const metricContent: MetricListSectionContent = { entries: metricEntries };
    sections.push({
      title: 'Computed metrics',
      kind: 'metric_list',
      content: metricContent,
    });
  }

  if (result.matchedRows && result.matchedRows.length > 0) {
    sections.push({
      title: `Matched rows (${result.matchedRowCount})`,
      kind: 'table',
      content: buildTableSection(result.matchedRows, result.matchedRowCount),
    });
  }

  if (result.warnings.length > 0) {
    sections.push({
      title: 'Warnings',
      kind: 'warning',
      content: { messages: result.warnings },
    });
  }

  const sourceRefs = collectSourceRefs(result.aggregations, workspaceId);
  const answer = buildAnswer(metricEntries, result.matchedRowCount);

  return buildResponse({
    status: 'success',
    intent: 'table_aggregate_query',
    resultType: 'table_query',
    summary: `Computed ${metricEntries.length} metric(s) over ${result.matchedRowCount} matched row(s).`,
    answer,
    sections,
    sourceRefs,
    warnings: result.warnings,
    nextActions: suggestedNextActions(command),
    toolTrace,
  });
}

function buildResolvedFieldWarningsSection(
  result: TableQueryResult,
): AgentResponseSection[] {
  const unresolved = result.resolvedFields.filter((f) => !f.resolvedColumn);
  if (unresolved.length === 0) return [];
  return [
    {
      title: 'Unresolved fields',
      kind: 'warning',
      content: {
        messages: unresolved.map(
          (f) =>
            `Could not resolve field "${f.requestedField}". Alternatives: ${
              f.alternatives.join(', ') || 'none'
            }`,
        ),
      },
    },
  ];
}

function buildTableSection(rows: MatchedRow[], totalRowCount: number): TableSectionContent {
  const sample = rows.slice(0, MAX_ROWS_IN_TABLE_SECTION);
  const columnSet = new Set<string>();
  for (const r of sample) {
    for (const k of Object.keys(r.values)) columnSet.add(k);
  }
  const baseColumns = ['fileName', 'row'];
  const columns = [...baseColumns, ...columnSet];
  const tableRows = sample.map((r) => {
    const out: Array<string | number | null> = [r.fileName, r.row];
    for (const col of columnSet) {
      const v = r.values[col];
      out.push(v ?? null);
    }
    return out;
  });
  return {
    columns,
    rows: tableRows,
    truncated: rows.length > MAX_ROWS_IN_TABLE_SECTION,
    totalRowCount,
  };
}

function collectSourceRefs(
  aggregations: AggregationResult[],
  workspaceId: string,
): AgentSourceRef[] {
  const refs: AgentSourceRef[] = [];
  for (const a of aggregations) {
    for (const r of a.sourceRefs) {
      refs.push(mapSourceRef(r, workspaceId));
      if (refs.length >= MAX_SOURCE_REFS) return refs;
    }
  }
  return refs;
}

function mapSourceRef(r: SourceRef, workspaceId: string): AgentSourceRef {
  return {
    workspaceId,
    fileName: r.fileName,
    sheet: r.sheet,
    row: r.row,
    sourceRange: r.sourceRange,
  };
}

function buildAnswer(
  metrics: Array<{ label: string; value: number }>,
  matchedRowCount: number,
): string {
  if (metrics.length === 0) {
    return `Matched ${matchedRowCount} row(s) but produced no computed metric.`;
  }
  const lines = [
    `Matched ${matchedRowCount} row(s).`,
    ...metrics.map((m) => `- **${m.label}**: ${formatMetric(m.value)}`),
  ];
  return lines.join('\n');
}

function formatMetric(v: number): string {
  if (!Number.isFinite(v)) return String(v);
  if (Number.isInteger(v)) return v.toLocaleString();
  return v.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function suggestedNextActions(_command: string): AgentNextAction[] {
  return [
    {
      label: 'Generate a Markdown report',
      command: 'Generate a report for this workspace.',
      requiresWrite: true,
    },
  ];
}
