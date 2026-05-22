import { existsSync, readFileSync, statSync, openSync, readSync, closeSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import type { ContextOSTool, ToolExecutionContext } from '../types.js';
import {
  resolveWorkspaceSourceFile,
  type ResolveResult,
} from '../resolve-workspace-source.js';

// ── I/O schemas ─────────────────────────────────────────────────────

const rowRequestSchema = z.object({
  type: z.enum(['first', 'last', 'number', 'headers', 'sample']),
  rowNumber: z.number().int().positive().optional(),
});

const inputSchema = z
  .object({
    workspaceId: z.string().min(1),
    fileName: z.string().min(1).optional(),
    sourceHint: z.string().min(1).optional(),
    rowRequest: rowRequestSchema.optional(),
  })
  .refine((v) => Boolean(v.fileName) || Boolean(v.sourceHint), {
    message: 'Either fileName or sourceHint must be provided.',
  });

type RowRequestInput = z.infer<typeof rowRequestSchema>;

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

export interface RowFieldValue {
  field: string;
  value: string;
}

interface ExplainSourceFileResult {
  status: 'success' | 'no_matches' | 'needs_clarification' | 'error';
  requestedFileName: string;
  resolvedFileName?: string;
  summary: string;
  snippets: Snippet[];
  warnings: string[];
  alternatives?: string[];
  /** Field/Value pairs when rowRequest is first/last/number on a CSV. */
  rowContent?: RowFieldValue[];
  /** Headers list when rowRequest is `headers` on a CSV. */
  headers?: string[];
  /** Sample rows (header-aligned) when rowRequest is `sample` on a CSV. */
  sampleRows?: Array<Record<string, string>>;
  /** 1-based data-row index of the row returned (when applicable). */
  dataRow?: number;
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

// ── CSV parsing (RFC-4180-lite, no external dep) ───────────────────

/**
 * Parse a CSV text into headers + rows. Handles quoted fields with embedded
 * commas, CRLF, and the `""` escape for a literal quote inside a quoted
 * field. Trims leading/trailing whitespace on unquoted values. Skips
 * fully-empty lines.
 */
function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const records: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  let i = 0;

  const pushField = (): void => {
    row.push(inQuotes ? field : field.trim());
    field = '';
  };
  const pushRow = (): void => {
    pushField();
    // Drop pure-empty rows (e.g. trailing newline).
    if (!(row.length === 1 && row[0] === '')) records.push(row);
    row = [];
  };

  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"' && field.length === 0) {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ',') {
      pushField();
      i++;
      continue;
    }
    if (ch === '\n') {
      pushRow();
      i++;
      continue;
    }
    if (ch === '\r') {
      // Swallow lone CR or CRLF as a row terminator.
      pushRow();
      if (text[i + 1] === '\n') i += 2; else i++;
      continue;
    }
    field += ch;
    i++;
  }
  if (field.length > 0 || row.length > 0) pushRow();

  if (records.length === 0) return { headers: [], rows: [] };
  const headers = (records[0] ?? []).map((h) => h.trim());
  const rows = records.slice(1);
  return { headers, rows };
}

// ── Table summary (deterministic, no full dump) ─────────────────────

function buildTableResult(
  resolvedFileName: string,
  ext: string,
  context: ToolExecutionContext,
  requestedFileName: string,
  warnings: string[],
  rowRequest: RowRequestInput | undefined,
): ExplainSourceFileResult {
  if (ext === 'csv') {
    return buildCsvResult(
      resolvedFileName,
      context,
      requestedFileName,
      warnings,
      rowRequest,
    );
  }

  // .xlsx — deterministic placeholder without external parser. We report
  // workbook profile presence if available.
  const baseSummary = `Excel workbook (${resolvedFileName}). Detailed per-sheet ` +
    `inspection requires the workbook profile tool; this view reports file ` +
    `presence only.`;

  if (rowRequest) {
    warnings.push(
      'I found the workbook, but row-level XLSX reading is not available in this command yet.',
    );
  } else {
    warnings.push('XLSX content is not parsed inline; use getWorkbookProfile for per-sheet details.');
  }

  return {
    status: 'success',
    requestedFileName,
    resolvedFileName,
    summary: baseSummary,
    snippets: [{
      text: `Excel workbook present in workspace sources: ${resolvedFileName}.`,
      sourceRef: { fileName: resolvedFileName, sheet: 'workbook' },
    }],
    warnings,
  };
}

function buildCsvResult(
  resolvedFileName: string,
  context: ToolExecutionContext,
  requestedFileName: string,
  warnings: string[],
  rowRequest: RowRequestInput | undefined,
): ExplainSourceFileResult {
  const path = resolve(context.sourcesDir, resolvedFileName);
  if (!existsSync(path)) {
    return errorResult(requestedFileName, resolvedFileName,
      `CSV file not found at ${resolvedFileName}.`, warnings);
  }
  const text = readBounded(path);
  const { headers, rows } = parseCsv(text);
  const rowCount = rows.length;

  if (!rowRequest) {
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
      snippets: [{ text: snippetText, sourceRef: { fileName: resolvedFileName } }],
      warnings,
    };
  }

  // headers-only
  if (rowRequest.type === 'headers') {
    const summary = headers.length > 0
      ? `${headers.length} column(s) in ${resolvedFileName}: ${headers.join(', ')}.`
      : `No header row detected in ${resolvedFileName}.`;
    return {
      status: 'success',
      requestedFileName,
      resolvedFileName,
      summary,
      snippets: [{
        text: headers.length > 0 ? `Columns: ${headers.join(', ')}` : 'No columns detected.',
        sourceRef: { fileName: resolvedFileName, sourceRange: 'headers' },
      }],
      warnings,
      headers,
    };
  }

  // sample
  if (rowRequest.type === 'sample') {
    const SAMPLE_LIMIT = 5;
    const sample = rows.slice(0, SAMPLE_LIMIT);
    const sampleRows = sample.map((r) => zipRow(headers, r));
    const summary = sample.length === 0
      ? `${resolvedFileName} has no data rows to sample.`
      : `First ${sample.length} of ${rowCount} data row(s) from ${resolvedFileName}.`;
    const snippets: Snippet[] = sample.map((r, idx) => ({
      text: formatRowInline(headers, r),
      sourceRef: {
        fileName: resolvedFileName,
        row: idx + 1,
        sourceRange: `data row ${idx + 1}`,
      },
    }));
    return {
      status: 'success',
      requestedFileName,
      resolvedFileName,
      summary,
      snippets,
      warnings,
      headers,
      sampleRows,
    };
  }

  // first / last / number
  let targetIndex: number; // zero-based into `rows`
  if (rowRequest.type === 'first') targetIndex = 0;
  else if (rowRequest.type === 'last') targetIndex = rowCount - 1;
  else targetIndex = (rowRequest.rowNumber ?? 0) - 1;

  if (rowCount === 0) {
    const message = `I found ${resolvedFileName}, but it has no data rows.`;
    warnings.push(message);
    return {
      status: 'no_matches',
      requestedFileName,
      resolvedFileName,
      summary: message,
      snippets: [],
      warnings,
      headers,
    };
  }
  if (targetIndex < 0 || targetIndex >= rowCount) {
    const message =
      `I found ${resolvedFileName}, but it has only ${rowCount} data row(s). ` +
      `Please choose a row between 1 and ${rowCount}.`;
    warnings.push(message);
    return {
      status: 'no_matches',
      requestedFileName,
      resolvedFileName,
      summary: message,
      snippets: [],
      warnings,
      headers,
    };
  }

  const dataRow = targetIndex + 1;
  const rowValues = rows[targetIndex] ?? [];
  const rowContent: RowFieldValue[] = headers.length > 0
    ? headers.map((field, i) => ({ field, value: rowValues[i] ?? '' }))
    : rowValues.map((value, i) => ({ field: `Column ${i + 1}`, value }));

  const label =
    rowRequest.type === 'first' ? 'first' :
    rowRequest.type === 'last' ? 'last' :
    `#${dataRow}`;
  const summary =
    `${label === 'first' || label === 'last' ? label.charAt(0).toUpperCase() + label.slice(1) : 'Row ' + label} ` +
    `data row of ${resolvedFileName} (data row ${dataRow} of ${rowCount}).`;

  return {
    status: 'success',
    requestedFileName,
    resolvedFileName,
    summary,
    snippets: [{
      text: formatRowInline(headers, rowValues),
      sourceRef: {
        fileName: resolvedFileName,
        row: dataRow,
        sourceRange: `data row ${dataRow}`,
      },
    }],
    warnings,
    headers,
    rowContent,
    dataRow,
  };
}

function zipRow(headers: string[], row: string[]): Record<string, string> {
  const obj: Record<string, string> = {};
  const columns = headers.length > 0 ? headers : row.map((_, i) => `Column ${i + 1}`);
  for (let i = 0; i < columns.length; i++) {
    obj[columns[i] ?? `Column ${i + 1}`] = row[i] ?? '';
  }
  return obj;
}

function formatRowInline(headers: string[], row: string[]): string {
  if (headers.length === 0) return row.join(' | ');
  const parts: string[] = [];
  for (let i = 0; i < headers.length; i++) {
    parts.push(`${headers[i]}: ${row[i] ?? ''}`);
  }
  return parts.join(' | ');
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
      return buildTableResult(
        resolvedFileName,
        ext,
        context,
        requestedFileName,
        warnings,
        input.rowRequest,
      );
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
