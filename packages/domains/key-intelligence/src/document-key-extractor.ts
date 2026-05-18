import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import type { DocumentKeyMatch, KeyType } from './types.js';
import { RESULT_CAPS } from './types.js';
import { normalizeKeyValue } from './key-normalizer.js';

// ── Extraction patterns ──────────────────────────────────────────────

const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
const PHONE_REGEX = /(?:\+?\d[\d\s\-().]{6,18}\d)/g;

/**
 * Conservative generic ID pattern:
 * - At least 1 letter AND at least 1 digit
 * - Length >= 5
 * - Allows letters, digits, hyphens, underscores, dots, slashes
 * - Word-boundary anchored
 */
const GENERIC_ID_REGEX = /\b(?=[A-Za-z0-9\-_./]*[A-Za-z])(?=[A-Za-z0-9\-_./]*\d)[A-Za-z0-9\-_./]{5,}\b/g;

/**
 * Date patterns to reject from generic ID matches.
 */
const DATE_REJECT_REGEX = /^\d{4}[-/]\d{2}[-/]\d{2}$/;

/**
 * Label keywords that indicate a nearby value is likely an ID.
 */
const ID_LABEL_KEYWORDS = [
  'product', 'user', 'customer', 'license', 'licence',
  'registration', 'invoice', 'order', 'asset', 'serial',
  'batch', 'id', 'code', 'number', 'ref',
];

const SEARCHABLE_EXTENSIONS = new Set(['.txt', '.md', '.json', '.yaml', '.yml']);
const EXTRACTED_TEXT_SUBDIR = 'extracted-text';

// ── Helpers ──────────────────────────────────────────────────────────

function truncateSnippet(text: string, matchStart: number, _matchEnd: number): string {
  const contextBefore = 40;
  const maxLen = RESULT_CAPS.MAX_EVIDENCE_SNIPPET_LENGTH;
  const start = Math.max(0, matchStart - contextBefore);
  const needsPrefix = start > 0;
  const sliceLen = maxLen - (needsPrefix ? 1 : 0) - 1; // reserve for possible suffix ellipsis
  let snippet = text.slice(start, start + sliceLen);
  if (needsPrefix) snippet = '…' + snippet;
  if (start + sliceLen < text.length) snippet = snippet + '…';
  return snippet;
}

/**
 * Check if a generic ID match is near a label keyword in the surrounding text.
 */
function hasNearbyLabel(text: string, matchStart: number): boolean {
  const lookback = Math.max(0, matchStart - 60);
  const context = text.slice(lookback, matchStart).toLowerCase();
  return ID_LABEL_KEYWORDS.some((kw) => context.includes(kw));
}

/**
 * Map extracted-text filename back to original.
 * e.g. "license.pdf.txt" → "license.pdf"
 *      "policy.docx.txt" → "policy.docx"
 */
function mapExtractedTextFilename(txtFileName: string): string {
  if (txtFileName.endsWith('.txt')) {
    const withoutTxt = txtFileName.slice(0, -4);
    // Check if it looks like it had a prior extension (.pdf, .docx, etc.)
    if (/\.\w+$/.test(withoutTxt)) {
      return withoutTxt;
    }
  }
  return txtFileName;
}

// ── Main extraction ──────────────────────────────────────────────────

/**
 * Extract keys from document/text files in a workspace.
 */
export function extractDocumentKeys(
  sourcesDir: string,
  outputDir: string,
): DocumentKeyMatch[] {
  const matches: DocumentKeyMatch[] = [];

  // 1. Scan source files
  if (existsSync(sourcesDir)) {
    const files = readdirSync(sourcesDir).filter((f) => {
      const ext = extname(f).toLowerCase();
      return SEARCHABLE_EXTENSIONS.has(ext) && !f.startsWith('.');
    });

    for (const fileName of files) {
      const content = readFileSync(resolve(sourcesDir, fileName), 'utf-8');
      extractFromContent(content, fileName, matches);
    }
  }

  // 2. Scan extracted-text directory (PDF/DOCX extracted content)
  const extractedDir = resolve(outputDir, EXTRACTED_TEXT_SUBDIR);
  if (existsSync(extractedDir)) {
    const files = readdirSync(extractedDir).filter((f) => f.endsWith('.txt') && !f.startsWith('.'));

    for (const txtFile of files) {
      const content = readFileSync(resolve(extractedDir, txtFile), 'utf-8');
      const originalFileName = mapExtractedTextFilename(txtFile);
      extractFromContent(content, originalFileName, matches);
    }
  }

  return matches;
}

function extractFromContent(
  content: string,
  fileName: string,
  matches: DocumentKeyMatch[],
): void {
  // Extract emails
  extractPattern(content, EMAIL_REGEX, 'email', fileName, matches);

  // Extract phone numbers
  extractPattern(content, PHONE_REGEX, 'phone', fileName, matches);

  // Extract generic IDs (conservative)
  extractGenericIds(content, fileName, matches);
}

function extractPattern(
  content: string,
  regex: RegExp,
  keyType: KeyType,
  fileName: string,
  matches: DocumentKeyMatch[],
): void {
  // Reset regex state
  regex.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    const value = match[0].trim();
    if (!value) continue;

    // For phone: require at least 7 digits
    if (keyType === 'phone') {
      const digitCount = value.replace(/\D/g, '').length;
      if (digitCount < 7 || digitCount > 15) continue;
    }

    const evidence = truncateSnippet(content, match.index, match.index + value.length);
    const normalizedValue = normalizeKeyValue(value, keyType);

    matches.push({
      fileName,
      keyType,
      value,
      normalizedValue,
      evidence,
      sourceRef: {
        fileName,
        snippet: evidence,
      },
    });
  }
}

function extractGenericIds(
  content: string,
  fileName: string,
  matches: DocumentKeyMatch[],
): void {
  GENERIC_ID_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = GENERIC_ID_REGEX.exec(content)) !== null) {
    const value = match[0].trim();
    if (!value) continue;

    // Reject date-like values
    if (DATE_REJECT_REGEX.test(value)) continue;

    // Require nearby label keyword for generic IDs in documents
    if (!hasNearbyLabel(content, match.index)) continue;

    const evidence = truncateSnippet(content, match.index, match.index + value.length);
    const normalizedValue = normalizeKeyValue(value, 'generic_id');

    matches.push({
      fileName,
      keyType: 'generic_id',
      value,
      normalizedValue,
      evidence,
      sourceRef: {
        fileName,
        snippet: evidence,
      },
    });
  }
}
