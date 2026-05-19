import type {
  KeyIntelligenceResult,
  DuplicateKeyGroup,
  KeySourceRef,
} from '@contextos/key-intelligence';
import type {
  WorkspaceAgentResponse,
  AgentResponseSection,
  AgentSourceRef,
  AgentToolTrace,
  MetricListSectionContent,
  TableSectionContent,
} from '../workspace-agent-response.js';
import { buildResponse } from './assert-evidence.js';

const MAX_GROUPS_IN_SECTION = 25;
const MAX_LOCATIONS_PER_GROUP = 10;
const MAX_SOURCE_REFS = 100;

export interface FormatKeyIntelligenceResultInput {
  workspaceId: string;
  command: string;
  result: KeyIntelligenceResult;
  toolTrace: AgentToolTrace[];
  keyType?: string;
}

export function formatKeyIntelligenceResult(
  input: FormatKeyIntelligenceResultInput,
): WorkspaceAgentResponse {
  const { result, toolTrace, workspaceId, keyType } = input;

  if (result.status === 'needs_clarification') {
    return buildResponse({
      status: 'needs_clarification',
      intent: 'duplicate_key_query',
      resultType: 'key_intelligence',
      summary: 'Need more information to detect duplicates.',
      answer: result.warnings.join('\n') || 'Please clarify which key type to scan (e.g. emails, product ids).',
      sections: [],
      sourceRefs: [],
      warnings: result.warnings,
      nextActions: [
        { label: 'Find duplicate emails', command: 'Find duplicate emails.' },
      ],
      toolTrace,
    });
  }

  if (result.status === 'error') {
    return buildResponse({
      status: 'error',
      intent: 'duplicate_key_query',
      resultType: 'key_intelligence',
      summary: 'Duplicate key detection failed.',
      answer: result.warnings[0] ?? 'Duplicate key detection failed.',
      sections: [],
      sourceRefs: [],
      warnings: result.warnings,
      nextActions: [],
      toolTrace,
    });
  }

  if (result.status === 'no_matches' || result.duplicateGroups.length === 0) {
    return buildResponse({
      status: 'no_matches',
      intent: 'duplicate_key_query',
      resultType: 'key_intelligence',
      summary: keyType
        ? `No duplicate ${keyType} values found across workspace tables.`
        : 'No duplicate keys found across workspace tables.',
      answer: 'No duplicate key values were detected.',
      sections: [],
      sourceRefs: [],
      warnings: result.warnings,
      nextActions: [],
      toolTrace,
    });
  }

  // ── success ────────────────────────────────────────────────────────
  const groups = result.duplicateGroups.slice(0, MAX_GROUPS_IN_SECTION);
  const sections: AgentResponseSection[] = [];

  const metricContent: MetricListSectionContent = {
    entries: [
      { label: 'Duplicate groups', value: result.duplicateGroups.length },
      {
        label: 'Total duplicate occurrences',
        value: result.duplicateGroups.reduce((sum, g) => sum + g.count, 0),
      },
    ],
  };
  sections.push({ title: 'Summary', kind: 'metric_list', content: metricContent });

  const tableContent: TableSectionContent = {
    columns: ['keyType', 'value', 'count', 'locations'],
    rows: groups.map((g: DuplicateKeyGroup) => [
      g.keyType,
      g.value,
      g.count,
      formatLocations(g.locations),
    ]),
    truncated: result.duplicateGroups.length > MAX_GROUPS_IN_SECTION,
    totalRowCount: result.duplicateGroups.length,
  };
  sections.push({
    title: 'Duplicate groups',
    kind: 'table',
    content: tableContent,
  });

  if (result.warnings.length > 0) {
    sections.push({
      title: 'Warnings',
      kind: 'warning',
      content: { messages: result.warnings },
    });
  }

  const sourceRefs = collectDuplicateSourceRefs(groups, workspaceId);

  return buildResponse({
    status: 'success',
    intent: 'duplicate_key_query',
    resultType: 'key_intelligence',
    summary: `Found ${result.duplicateGroups.length} duplicate group(s).`,
    answer: buildAnswer(result.duplicateGroups, keyType),
    sections,
    sourceRefs,
    warnings: result.warnings,
    nextActions: [
      {
        label: 'Show documents referencing a specific value',
        command: `Show documents related to ${groups[0]?.value ?? '<key>'}.`,
      },
    ],
    toolTrace,
  });
}

function formatLocations(locations: KeySourceRef[]): string {
  const slice = locations.slice(0, MAX_LOCATIONS_PER_GROUP);
  const formatted = slice.map((l) => {
    const parts = [l.fileName];
    if (l.sheet) parts.push(`sheet=${l.sheet}`);
    if (l.row !== undefined) parts.push(`row=${l.row}`);
    if (l.column) parts.push(`col=${l.column}`);
    return parts.join(' / ');
  });
  if (locations.length > MAX_LOCATIONS_PER_GROUP) {
    formatted.push(`…and ${locations.length - MAX_LOCATIONS_PER_GROUP} more`);
  }
  return formatted.join('; ');
}

function collectDuplicateSourceRefs(
  groups: DuplicateKeyGroup[],
  workspaceId: string,
): AgentSourceRef[] {
  const refs: AgentSourceRef[] = [];
  for (const g of groups) {
    for (const l of g.locations) {
      refs.push({
        workspaceId,
        fileName: l.fileName,
        sheet: l.sheet,
        row: l.row,
        column: l.column,
        sourceRange: l.sourceRange,
        snippet: l.snippet,
      });
      if (refs.length >= MAX_SOURCE_REFS) return refs;
    }
  }
  return refs;
}

function buildAnswer(groups: DuplicateKeyGroup[], keyType?: string): string {
  const heading = keyType
    ? `Found ${groups.length} duplicate group(s) of type "${keyType}".`
    : `Found ${groups.length} duplicate group(s).`;
  const preview = groups
    .slice(0, 5)
    .map((g) => `- **${g.value}** (${g.keyType}) — ${g.count} occurrences`);
  return [heading, ...preview].join('\n');
}
