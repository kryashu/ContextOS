import type { KeyIntelligenceResult, DocumentKeyMatch } from '@contextos/key-intelligence';
import type { CommandIntent } from '@contextos/orchestrator';
import type {
  WorkspaceAgentResponse,
  AgentResponseSection,
  AgentSourceRef,
  AgentToolTrace,
  EvidenceSectionContent,
  MetricListSectionContent,
} from '../workspace-agent-response.js';
import { buildResponse } from './assert-evidence.js';

const MAX_EVIDENCE = 25;
const MAX_SOURCE_REFS = 100;

export interface FormatDocumentLookupResultInput {
  workspaceId: string;
  command: string;
  intent: CommandIntent; // 'document_lookup' | 'evidence_lookup'
  keyValue: string;
  result: KeyIntelligenceResult;
  toolTrace: AgentToolTrace[];
}

export function formatDocumentLookupResult(
  input: FormatDocumentLookupResultInput,
): WorkspaceAgentResponse {
  const { result, toolTrace, workspaceId, keyValue, intent } = input;

  if (result.status === 'needs_clarification') {
    return buildResponse({
      status: 'needs_clarification',
      intent,
      resultType: 'document_lookup',
      summary: 'Need more information to look up documents.',
      answer: result.warnings.join('\n') ||
        'Please specify which key or identifier to search for (e.g. product ABC-123).',
      sections: [],
      sourceRefs: [],
      warnings: result.warnings,
      nextActions: [],
      toolTrace,
    });
  }

  if (result.status === 'error') {
    return buildResponse({
      status: 'error',
      intent,
      resultType: 'document_lookup',
      summary: 'Document lookup failed.',
      answer: result.warnings[0] ?? 'Document lookup failed.',
      sections: [],
      sourceRefs: [],
      warnings: result.warnings,
      nextActions: [],
      toolTrace,
    });
  }

  if (result.status === 'no_matches' || result.documentMatches.length === 0) {
    return buildResponse({
      status: 'no_matches',
      intent,
      resultType: 'document_lookup',
      summary: `No documents reference "${keyValue}".`,
      answer: `No documents in this workspace reference "${keyValue}".`,
      sections: [],
      sourceRefs: [],
      warnings: result.warnings,
      nextActions: [],
      toolTrace,
    });
  }

  // ── success ────────────────────────────────────────────────────────
  const matches = result.documentMatches.slice(0, MAX_EVIDENCE);
  const sections: AgentResponseSection[] = [];

  const metricContent: MetricListSectionContent = {
    entries: [
      { label: 'Matching documents', value: result.documentMatches.length },
    ],
  };
  sections.push({ title: 'Summary', kind: 'metric_list', content: metricContent });

  const evidenceContent: EvidenceSectionContent = {
    entries: matches.map((m) => ({
      fileName: m.fileName,
      snippet: m.evidence,
      sourceRange: m.sourceRef.sourceRange,
    })),
  };
  const evidenceTitle =
    result.documentMatches.length > MAX_EVIDENCE
      ? `Evidence (${matches.length} of ${result.documentMatches.length})`
      : `Evidence (${matches.length})`;
  sections.push({
    title: evidenceTitle,
    kind: 'evidence',
    content: evidenceContent,
  });

  if (result.warnings.length > 0) {
    sections.push({
      title: 'Warnings',
      kind: 'warning',
      content: { messages: result.warnings },
    });
  }

  const sourceRefs = collectDocumentSourceRefs(matches, workspaceId);

  return buildResponse({
    status: 'success',
    intent,
    resultType: 'document_lookup',
    summary: `Found ${result.documentMatches.length} document(s) referencing "${keyValue}".`,
    answer: buildAnswer(matches, keyValue, result.documentMatches.length),
    sections,
    sourceRefs,
    warnings: result.warnings,
    nextActions: [],
    toolTrace,
  });
}

function collectDocumentSourceRefs(
  matches: DocumentKeyMatch[],
  workspaceId: string,
): AgentSourceRef[] {
  const refs: AgentSourceRef[] = [];
  for (const m of matches) {
    refs.push({
      workspaceId,
      fileName: m.sourceRef.fileName,
      sheet: m.sourceRef.sheet,
      row: m.sourceRef.row,
      column: m.sourceRef.column,
      sourceRange: m.sourceRef.sourceRange,
      snippet: m.sourceRef.snippet ?? m.evidence,
    });
    if (refs.length >= MAX_SOURCE_REFS) return refs;
  }
  return refs;
}

function buildAnswer(matches: DocumentKeyMatch[], keyValue: string, total: number): string {
  const heading = `Found ${total} document(s) referencing "${keyValue}":`;
  const preview = matches
    .slice(0, 5)
    .map((m) => `- **${m.fileName}** — ${truncate(m.evidence, 160)}`);
  return [heading, ...preview].join('\n');
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '…';
}
