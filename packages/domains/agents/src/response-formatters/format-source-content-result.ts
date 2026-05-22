import type { CommandIntent, RowRequest } from '@contextos/orchestrator';
import type {
  WorkspaceAgentResponse,
  AgentResponseSection,
  AgentSourceRef,
  AgentToolTrace,
  EvidenceSectionContent,
} from '../workspace-agent-response.js';
import { buildResponse } from './assert-evidence.js';

interface ExplainSourceFileSnippet {
  text: string;
  sourceRef: {
    fileName: string;
    page?: number;
    sheet?: string;
    row?: number;
    sourceRange?: string;
  };
}

interface ExplainSourceFileRowFieldValue {
  field: string;
  value: string;
}

export interface ExplainSourceFileToolResult {
  status: 'success' | 'no_matches' | 'needs_clarification' | 'error';
  requestedFileName: string;
  resolvedFileName?: string;
  summary: string;
  snippets: ExplainSourceFileSnippet[];
  warnings: string[];
  alternatives?: string[];
  rowContent?: ExplainSourceFileRowFieldValue[];
  headers?: string[];
  sampleRows?: Array<Record<string, string>>;
  dataRow?: number;
}

export interface FormatSourceContentResultInput {
  workspaceId: string;
  command: string;
  intent: CommandIntent;
  result: ExplainSourceFileToolResult;
  toolTrace: AgentToolTrace[];
  /**
   * Optional natural-language hint the user originally provided. When
   * present and the tool returns no_matches, the formatter produces a
   * friendlier clarification message that acknowledges the hint.
   */
  sourceHint?: string;
  /** Original row request, used for friendlier clarification copy. */
  rowRequest?: RowRequest;
}

const MAX_SOURCE_REFS = 25;

export function formatSourceContentResult(
  input: FormatSourceContentResultInput,
): WorkspaceAgentResponse {
  const { result, toolTrace, intent, workspaceId, sourceHint } = input;

  if (result.status === 'needs_clarification') {
    return buildNeedsClarification(input);
  }

  if (result.status === 'no_matches') {
    return buildNoMatches(input, sourceHint);
  }

  if (result.status === 'error') {
    return buildResponse({
      status: 'error',
      intent,
      resultType: 'source_content',
      summary: 'Could not explain this source.',
      answer: result.summary || 'The source content tool reported an error.',
      sections: [],
      sourceRefs: [],
      warnings: result.warnings,
      nextActions: [],
      toolTrace,
    });
  }

  // ── success ────────────────────────────────────────────────────────
  const sections: AgentResponseSection[] = [];

  sections.push({
    title: 'File summary',
    kind: 'text',
    content: result.summary,
  });

  // Row-content table (first/last/number on a CSV)
  if (result.rowContent && result.rowContent.length > 0) {
    const dataRow = result.dataRow ?? 1;
    sections.push({
      title: `Row contents (data row ${dataRow})`,
      kind: 'table',
      content: {
        columns: ['Field', 'Value'],
        rows: result.rowContent.map((rc) => ({ Field: rc.field, Value: rc.value })),
      },
    });
  } else if (result.headers && result.headers.length > 0 && !result.sampleRows) {
    // headers-only request
    sections.push({
      title: `Headers (${result.headers.length} column${result.headers.length === 1 ? '' : 's'})`,
      kind: 'table',
      content: {
        columns: ['#', 'Column'],
        rows: result.headers.map((h, i) => ({ '#': String(i + 1), Column: h })),
      },
    });
  } else if (result.sampleRows && result.sampleRows.length > 0 && result.headers) {
    sections.push({
      title: `Sample rows (${result.sampleRows.length})`,
      kind: 'table',
      content: {
        columns: result.headers,
        rows: result.sampleRows,
      },
    });
  }

  if (result.snippets.length > 0) {
    const evidenceContent: EvidenceSectionContent = {
      entries: result.snippets.map((s) => ({
        fileName: s.sourceRef.fileName,
        snippet: s.text,
        sourceRange: s.sourceRef.sourceRange,
      })),
    };
    sections.push({
      title: `Evidence (${result.snippets.length})`,
      kind: 'evidence',
      content: evidenceContent,
    });
  }

  const sourceRefs: AgentSourceRef[] = result.snippets
    .slice(0, MAX_SOURCE_REFS)
    .map((s) => ({
      workspaceId,
      fileName: s.sourceRef.fileName,
      sheet: s.sourceRef.sheet,
      row: s.sourceRef.row,
      sourceRange: s.sourceRef.sourceRange,
      snippet: s.text,
    }));

  const displayName = result.resolvedFileName ?? result.requestedFileName;
  return buildResponse({
    status: 'success',
    intent,
    resultType: 'source_content',
    summary: `Explanation of ${displayName}.`,
    answer: result.summary,
    sections,
    sourceRefs,
    warnings: result.warnings,
    nextActions: [],
    toolTrace,
  });
}

function rowRequestLabel(rowRequest: RowRequest | undefined): string {
  if (!rowRequest) return 'details';
  switch (rowRequest.type) {
    case 'first': return 'the first row';
    case 'last': return 'the last row';
    case 'number': return `row ${rowRequest.rowNumber ?? '?'}`;
    case 'headers': return 'the headers';
    case 'sample': return 'sample rows';
    default: return 'details';
  }
}

function buildNeedsClarification(
  input: FormatSourceContentResultInput,
): WorkspaceAgentResponse {
  const { result, toolTrace, intent, sourceHint, rowRequest } = input;
  const alternatives = result.alternatives ?? [];
  const target = sourceHint ?? result.requestedFileName;
  const lead = rowRequest
    ? `I understood that you want ${rowRequestLabel(rowRequest)} from "${target}", ` +
      'but I found multiple matching sources. Which one should I use?'
    : `I found multiple workspace sources matching "${result.requestedFileName}". ` +
      'Please pick one.';

  const sections: AgentResponseSection[] = [
    { title: 'What I need', kind: 'text', content: lead },
  ];
  if (alternatives.length > 0) {
    sections.push({
      title: 'Possible matches',
      kind: 'text',
      content: alternatives.map((a) => `- ${a}`).join('\n'),
    });
  }
  return buildResponse({
    status: 'needs_clarification',
    intent,
    resultType: 'source_content',
    summary: 'Multiple sources match your request.',
    answer: lead,
    sections,
    sourceRefs: [],
    warnings: result.warnings,
    nextActions: alternatives.map((a) => ({
      label: `Explain ${a}`,
      command: `Explain ${a}`,
    })),
    toolTrace,
  });
}

function buildNoMatches(
  input: FormatSourceContentResultInput,
  sourceHint: string | undefined,
): WorkspaceAgentResponse {
  const { result, toolTrace, intent, rowRequest } = input;
  const requested = result.requestedFileName;

  // If the tool resolved a file but the row was out of range, surface the
  // tool's helpful summary verbatim (it already includes the valid range).
  if (result.resolvedFileName && rowRequest) {
    return buildResponse({
      status: 'needs_clarification',
      intent,
      resultType: 'source_content',
      summary: 'Requested row is out of range.',
      answer: result.summary,
      sections: [{ title: 'What I need', kind: 'text', content: result.summary }],
      sourceRefs: [],
      warnings: result.warnings,
      nextActions: [],
      toolTrace,
    });
  }

  const friendlyMessage = sourceHint
    ? `I understood that you want details about "${sourceHint}", but I couldn't ` +
      `confidently find a matching source in this workspace. Please provide the ` +
      `exact file name or choose from available sources.`
    : `No workspace source matched "${requested}". Provide an exact file name ` +
      `or choose from available sources.`;

  return buildResponse({
    status: 'needs_clarification',
    intent,
    resultType: 'source_content',
    summary: 'No matching source found.',
    answer: friendlyMessage,
    sections: [
      { title: 'What I need', kind: 'text', content: friendlyMessage },
    ],
    sourceRefs: [],
    warnings: result.warnings,
    nextActions: [],
    toolTrace,
  });
}
