import type { SourceRelationshipMap, SourceRelationship } from '@contextos/types';
import type {
  WorkspaceAgentResponse,
  AgentResponseSection,
  AgentSourceRef,
  AgentToolTrace,
  MetricListSectionContent,
  TableSectionContent,
} from '../workspace-agent-response.js';
import { buildResponse } from './assert-evidence.js';

const MAX_ROWS = 50;
const MAX_SOURCE_REFS = 100;

export interface FormatSourceRelationshipResultInput {
  workspaceId: string;
  command: string;
  result: SourceRelationshipMap;
  toolTrace: AgentToolTrace[];
}

export function formatSourceRelationshipResult(
  input: FormatSourceRelationshipResultInput,
): WorkspaceAgentResponse {
  const { result, toolTrace, workspaceId } = input;
  const rels = result.relationships ?? [];

  if (rels.length === 0) {
    return buildResponse({
      status: 'no_matches',
      intent: 'source_relationship_lookup',
      resultType: 'workspace_overview',
      summary: 'No cross-source relationships were computed for this workspace.',
      answer: 'No relationships were found between sources in this workspace.',
      sections: [],
      sourceRefs: [],
      warnings: [],
      nextActions: [],
      toolTrace,
    });
  }

  const sections: AgentResponseSection[] = [];

  const byType = new Map<string, number>();
  for (const r of rels) byType.set(r.type, (byType.get(r.type) ?? 0) + 1);
  const metricContent: MetricListSectionContent = {
    entries: [
      { label: 'Total relationships', value: rels.length },
      ...[...byType.entries()].map(([k, v]) => ({ label: k, value: v })),
    ],
  };
  sections.push({ title: 'Summary', kind: 'metric_list', content: metricContent });

  const rows = rels.slice(0, MAX_ROWS);
  const tableContent: TableSectionContent = {
    columns: ['sourceA', 'sourceB', 'type', 'confidence', 'evidence'],
    rows: rows.map((r) => [
      r.sourceA,
      r.sourceB || '(isolated)',
      r.type,
      Number(r.confidence.toFixed(2)),
      r.evidence.join('; '),
    ]),
    truncated: rels.length > MAX_ROWS,
    totalRowCount: rels.length,
  };
  const tableTitle =
    rels.length > MAX_ROWS
      ? `Relationships (${rows.length} of ${rels.length})`
      : `Relationships (${rows.length})`;
  sections.push({
    title: tableTitle,
    kind: 'table',
    content: tableContent,
  });

  const sourceRefs = collectSourceRefs(rels, workspaceId);

  return buildResponse({
    status: 'success',
    intent: 'source_relationship_lookup',
    resultType: 'workspace_overview',
    summary: `Computed ${rels.length} cross-source relationship(s).`,
    answer: buildAnswer(rels, byType),
    sections,
    sourceRefs,
    warnings: [],
    nextActions: [],
    toolTrace,
  });
}

function collectSourceRefs(rels: SourceRelationship[], workspaceId: string): AgentSourceRef[] {
  const seen = new Set<string>();
  const refs: AgentSourceRef[] = [];
  for (const r of rels) {
    for (const name of [r.sourceA, r.sourceB]) {
      if (!name || seen.has(name)) continue;
      seen.add(name);
      refs.push({ workspaceId, fileName: name });
      if (refs.length >= MAX_SOURCE_REFS) return refs;
    }
  }
  return refs;
}

function buildAnswer(rels: SourceRelationship[], byType: Map<string, number>): string {
  const lines = [`Found ${rels.length} cross-source relationship(s):`];
  for (const [t, c] of byType.entries()) lines.push(`- **${t}**: ${c}`);
  return lines.join('\n');
}
