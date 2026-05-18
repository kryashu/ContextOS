import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { extractDocumentKeys } from '../document-key-extractor.js';

const TEST_DIR = resolve(process.cwd(), '.test-doc-keys');
const SOURCES_DIR = resolve(TEST_DIR, 'sources');
const OUTPUT_DIR = resolve(TEST_DIR, 'output');
const EXTRACTED_DIR = resolve(OUTPUT_DIR, 'extracted-text');

describe('extractDocumentKeys', () => {
  beforeEach(() => {
    mkdirSync(SOURCES_DIR, { recursive: true });
    mkdirSync(EXTRACTED_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it('extracts emails from markdown files', () => {
    writeFileSync(resolve(SOURCES_DIR, 'notes.md'), 'Contact support at alice@example.com for help.');
    const matches = extractDocumentKeys(SOURCES_DIR, OUTPUT_DIR);
    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(matches.some(m => m.value === 'alice@example.com' && m.keyType === 'email')).toBe(true);
  });

  it('extracts keys from extracted-text directory with filename mapping', () => {
    writeFileSync(resolve(EXTRACTED_DIR, 'report.pdf.txt'), 'Invoice INV-12345 was sent to bob@test.com');
    const matches = extractDocumentKeys(SOURCES_DIR, OUTPUT_DIR);
    const emailMatch = matches.find(m => m.value === 'bob@test.com');
    expect(emailMatch).toBeDefined();
    expect(emailMatch!.fileName).toBe('report.pdf');
  });

  it('requires nearby label for generic_id in documents', () => {
    writeFileSync(resolve(SOURCES_DIR, 'doc.md'), 'Reference: ABC12345 is the identifier');
    const matches = extractDocumentKeys(SOURCES_DIR, OUTPUT_DIR);
    const genericMatch = matches.find(m => m.normalizedValue === 'ABC12345');
    expect(genericMatch).toBeDefined();
  });

  it('caps evidence snippet at 240 chars', () => {
    const longLine = 'ID: ABCDE12345 ' + 'x'.repeat(300);
    writeFileSync(resolve(SOURCES_DIR, 'long.md'), longLine);
    const matches = extractDocumentKeys(SOURCES_DIR, OUTPUT_DIR);
    for (const m of matches) {
      expect(m.evidence.length).toBeLessThanOrEqual(240);
    }
  });

  it('returns empty array for empty sources', () => {
    const matches = extractDocumentKeys(SOURCES_DIR, OUTPUT_DIR);
    expect(matches).toEqual([]);
  });
});
