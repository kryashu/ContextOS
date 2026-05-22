import { existsSync, readFileSync, statSync, openSync, readSync, closeSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import type { ContextOSTool, ToolExecutionContext } from '../types.js';
import {
  resolveWorkspaceSourceFile,
  type ResolveResult,
} from '../resolve-workspace-source.js';

// ── I/O schemas ─────────────────────────────────────────────────────

const inputSchema = z
  .object({
    workspaceId: z.string().min(1),
    fileName: z.string().min(1).optional(),
    sourceHint: z.string().min(1).optional(),
  })
  .refine((v) => Boolean(v.fileName) || Boolean(v.sourceHint), {
    message: 'Either fileName or sourceHint must be provided.',
  });

interface SourceRef {
  fileName: string;
  page?: number;
  sheet?: string;
  row?: number;
  sourceRange?: string;
}

interface Snippet {
  text: string;
  sourceRef: SourceRef;
}

interface ExplainSourceFileResult {
  status: 'success' | 'no_matches' | 'needs_clarification' | 'error';
  requestedFileName: string;
  resolvedFileName?: string;
  summary: string;
  snippets: Snippet[];
  warnings: string[];
  alternatives?: string[];
}

const outputSchema = z.custom<ExplainSourceFileResult>();

// ── File-type config ────────────────────────────────────────────────

const TEXT_EXTENSIONS = new Set(['txt', 'md', 'json', 'yaml', 'yml']);
const EXTRACTED_EXTENSIONS = new Set(['pdf', 'docx']);
const TABLE_EXTENSIONS = new Set(['xlsx', 'csv']);

const MAX_SNIPPETS = 3;
const SNIPPET_CHAR_LIMIT = 500;
const MAX_READ_BYTES = 256 * 1024;

function extensionOf(fileName: string): string {
  const idx = fileName.lastIndexOf('.');
  return idx >= 0 ? fileName.slice(idx + 1).toLowerCase() : '';
}

function fileTypeLabel(ext: string): string {
  switch (ext) {
    case 'pdf': return 'PDF document';
    case 'docx': return 'Word document';
    case 'xlsx': return 'Excel workbook';
    case 'csv': return 'CSV table';
    case 'txt': return 'plain-text file';
    case 'md': return 'Markdown document';
    case 'json': return 'JSON document';
    case 'yaml':
    case 'yml': return 'YAML document';
    default: return `${ext.toUpperCase()} file`;
  }
}

// ── Source profile (for relevance hint) ─────────────────────────────

interface SourceProfileEntry {
  fileName?: string;
  summary?: string;
  relevanceScore?: number;
}

function loadProfile(
  outputDir: string,
  fileName: string,
): SourceProfileEntry | undefined {
  const path = resolve(outputDir, 'source-profiles.json');
  if (!existsSync(path)) return undefined;
  try {
    const raw = readFileSync(path, 'utf-8');
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return undefined;
    return (parsed as SourceProfileEntry[]).find((p) => p.fileName === fileName);
  } catch {
    return undefined;
  }
}

function relevanceLabel(score: number | undefined): string {
  if (typeof score !== 'number') return '';
  if (score >= 0.7) return ' Profile marks this source as highly relevant.';
  if (score >= 0.4) return ' Profile marks this source as moderately relevant.';
  return ' Profile marks this source as likely irrelevant to the main analysis.';
}

// ── File reading ────────────────────────────────────────────────────

function readBounded(filePath: string): string {
  const stat = statSync(filePath);
  if (stat.size <= MAX_READ_BYTES) {
    return readFileSync(filePath, 'utf-8');
  }
  const buf = Buffer.alloc(MAX_READ_BYTES);
  const fd = openSync(filePath, 'r');
  try {
    readSync(fd, buf, 0, MAX_READ_BYTES, 0);
  } finally {
    closeSync(fd);
  }
  return buf.toString('utf-8');
}

function readSourceText(
  resolvedFileName: string,
  ext: string,
  context: ToolExecutionContext,
): { text: string; readFrom: 'source' | 'extracted'; readPath: string } | undefined {
  if (TEXT_EXTENSIONS.has(ext)) {
    const path = resolve(context.sourcesDir, resolvedFileName);
    if (!existsSync(path)) return undefined;
    return { text: readBounded(path), readFrom: 'source', readPath: path };
  }
  if (EXTRACTED_EXTENSIONS.has(ext)) {
    const extractedPath = resolve(
      context.outputDir,
      'extracted-text',
      `${resolvedFileName}.txt`,
    );
    if (!existsSync(extractedPath)) return undefined;
    return { text: readBounded(extractedPath), readFrom: 'extracted', readPath: extractedPath };
  }
  return undefined;
}

// ── Snippet selection ───────────────────────────────────────────────

function pickSnippets(text: string): string[] {
  // Split on paragraph boundaries; keep non-empty trimmed blocks.
  const paragraphs = text
    .split(/\n\s*\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const chosen: string[] = [];
  for (const p of paragraphs) {
    if (chosen.length >= MAX_SNIPPETS) break;
    const snippet = p.length > SNIPPET_CHAR_LIMIT
      ? `${p.slice(0, SNIPPET_CHAR_LIMIT).trimEnd()}\u2026`
      : p;
    chosen.push(snippet);
  }

  // Fall back to a single leading chunk if no paragraph breaks were found.
  if (chosen.length === 0 && text.trim().length > 0) {
    const head = text.trim().slice(0, SNIPPET_CHAR_LIMIT);
    chosen.push(text.trim().length > SNIPPET_CHAR_LIMIT ? `${head}\u2026` : head);
  }

  return chosen;
}

// ── Table summary (deterministic, no full dump) ─────────────────────

function summarizeCsv(text: string): { headers: string[]; rowCount: number } {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return { headers: [], rowCount: 0 };
  const headerLine = lines[0] ?? '';
  const headers = headerLine.split(',').map((h) => h.trim()).slice(0, 20);
  return { headers, rowCount: Math.max(0, lines.length - 1) };
}

function buildTableResult(
  resolvedFileName: string,
  ext: string,
  context: ToolExecutionContext,
  requestedFileName: string,
  warnings: string[],
): ExplainSourceFileResult {
  if (ext === 'csv') {
    const path = resolve(context.sourcesDir, resolvedFileName);
    if (!existsSync(path)) {
      return errorResult(requestedFileName, resolvedFileName,
        `CSV file not found at ${resolvedFileName}.`, warnings);
    }
    const text = readBounded(path);
    const { headers, rowCount } = summarizeCsv(text);
    const summary =
      `CSV table with ${headers.length} column(s) and ${rowCount} row(s). ` +
      (headers.length > 0 ? `Columns: ${headers.join(', ')}.` : '');
    const snippetText = headers.length > 0
      ? `Columns: ${headers.join(', ')}\nRow count: ${rowCount}`
      : `Row count: ${rowCount}`;
    return {
      status: 'success',
      requestedFileName,
      resolvedFileName,
      summary,
      snippets: [{ text: snippetText, sourceRef: { fileName: resolvedFileName, row: 1 } }],
      warnings,
    };
  }

  // .xlsx — deterministic placeholder without external parser. We report
  // workbook profile presence if available.
  const summary = `Excel workbook (${resolvedFileName}). Detailed per-sheet ` +
    `inspection requires the workbook profile tool; this view reports file ` +
    `presence only.`;
  warnings.push('XLSX content is not parsed inline; use getWorkbookProfile for per-sheet details.');
  return {
    status: 'success',
    requestedFileName,
    resolvedFileName,
    summary,
    snippets: [{
      text: `Excel workbook present in workspace sources: ${resolvedFileName}.`,
      sourceRef: { fileName: resolvedFileName, sheet: 'workbook' },
    }],
    warnings,
  };
}

function errorResult(
  requestedFileName: string,
  resolvedFileName: string | undefined,
  message: string,
  warnings: string[],
): ExplainSourceFileResult {
  return {
    status: 'error',
    requestedFileName,
    resolvedFileName,
    summary: message,
    snippets: [],
    warnings,
  };
}

// ── Tool ────────────────────────────────────────────────────────────

export const explainSourceFile: ContextOSTool<
  z.infer<typeof inputSchema>,
  ExplainSourceFileResult
> = {
  id: 'explainSourceFile',
  name: 'Explain Source File',
  description:
    'Explain the contents of a specific workspace source file using only ' +
    'extracted text and source-profile metadata. Supports fuzzy filename ' +
    'and natural-language source hints.',
  category: 'qa',
  safetyLevel: 'compute',
  requiresCurrentAnalysis: true,
  requiresModel: false,
  inputSchema,
  outputSchema,
  async execute(input, context: ToolExecutionContext): Promise<ExplainSourceFileResult> {
    const requestedFileName = input.fileName ?? input.sourceHint ?? '';
    const warnings: string[] = [];

    const resolution: ResolveResult = resolveWorkspaceSourceFile(
      { fileName: input.fileName, sourceHint: input.sourceHint },
      context.sourcesDir,
      context.outputDir,
    );

    if (resolution.status === 'no_matches') {
      return {
        status: 'no_matches',
        requestedFileName,
        summary:
          `No workspace source matched "${requestedFileName}". ` +
          'Provide an exact file name or pick one of the workspace sources.',
        snippets: [],
        warnings,
      };
    }

    if (resolution.status === 'needs_clarification') {
      return {
        status: 'needs_clarification',
        requestedFileName,
        summary:
          `Multiple workspace sources match "${requestedFileName}". ` +
          'Please choose one.',
        snippets: [],
        warnings,
        alternatives: resolution.alternatives ?? [],
      };
    }

    const resolvedFileName = resolution.resolvedFileName as string;
    const ext = extensionOf(resolvedFileName);

    if (input.fileName && resolvedFileName !== input.fileName) {
      warnings.push(`Interpreted "${input.fileName}" as "${resolvedFileName}".`);
    }

    if (TABLE_EXTENSIONS.has(ext)) {
      return buildTableResult(resolvedFileName, ext, context, requestedFileName, warnings);
    }

    const read = readSourceText(resolvedFileName, ext, context);
    if (!read) {
      if (EXTRACTED_EXTENSIONS.has(ext)) {
        return {
          status: 'no_matches',
          requestedFileName,
          resolvedFileName,
          summary:
            `Found ${resolvedFileName} but no extracted text is available. ` +
            'Re-run the workspace analysis to generate extracted text.',
          snippets: [],
          warnings,
        };
      }
      return errorResult(
        requestedFileName,
        resolvedFileName,
        `Unable to read ${resolvedFileName}.`,
        warnings,
      );
    }

    const profile = loadProfile(context.outputDir, resolvedFileName);
    const snippetTexts = pickSnippets(read.text);
    const snippets: Snippet[] = snippetTexts.map((t) => ({
      text: t,
      sourceRef: { fileName: resolvedFileName },
    }));

    const baseSummary =
      `${fileTypeLabel(ext)} (${resolvedFileName}).` +
      relevanceLabel(profile?.relevanceScore);
    const profileSummary = profile?.summary
      ? ` ${(profile.summary.split('\n')[0] ?? '').slice(0, 200)}`
      : '';
    const summary = `${baseSummary}${profileSummary}`.trim();

    if (snippets.length === 0) {
      return {
        status: 'no_matches',
        requestedFileName,
        resolvedFileName,
        summary: `${resolvedFileName} is empty or unreadable.`,
        snippets: [],
        warnings,
      };
    }

    return {
      status: 'success',
      requestedFileName,
      resolvedFileName,
      summary,
      snippets,
      warnings,
    };
  },
};
