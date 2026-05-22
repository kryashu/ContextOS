import type { CommandIntent } from '@contextos/orchestrator';
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

export interface ExplainSourceFileToolResult {
  status: 'success' | 'no_matches' | 'needs_clarification' | 'error';
  requestedFileName: string;
  resolvedFileName?: string;
  summary: string;
  snippets: ExplainSourceFileSnippet[];
  warnings: string[];
  alternatives?: string[];
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

function buildNeedsClarification(
  input: FormatSourceContentResultInput,
): WorkspaceAgentResponse {
  const { result, toolTrace, intent } = input;
  const alternatives = result.alternatives ?? [];
  const sections: AgentResponseSection[] = [
    {
      title: 'What I need',
      kind: 'text',
      content:
        `I found multiple workspace sources matching "${result.requestedFileName}". ` +
        'Please pick one.',
    },
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
    answer:
      `I need a single file. Choose one of: ${alternatives.join(', ') || 'workspace sources'}.`,
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
  const { result, toolTrace, intent } = input;
  const requested = result.requestedFileName;

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
