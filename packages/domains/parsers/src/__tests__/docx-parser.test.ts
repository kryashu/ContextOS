import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock mammoth before importing the parser
vi.mock('mammoth', () => ({
  default: {
    extractRawText: vi.fn(),
  },
}));

import { DocxParser } from '../docx-parser.js';
import mammoth from 'mammoth';

const mockedExtract = vi.mocked(mammoth.extractRawText);

describe('DocxParser', () => {
  const parser = new DocxParser();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('canParse returns true for docx', () => {
    expect(parser.canParse('docx')).toBe(true);
  });

  it('canParse returns false for other types', () => {
    expect(parser.canParse('markdown')).toBe(false);
    expect(parser.canParse('pdf')).toBe(false);
    expect(parser.canParse('xlsx')).toBe(false);
  });

  it('throws when filePath is missing', async () => {
    await expect(parser.parse({})).rejects.toThrow('DocxParser requires filePath');
  });

  it('parses a DOCX with text content', async () => {
    mockedExtract.mockResolvedValue({
      value: 'Hello world from DOCX document',
      messages: [],
    });

    const { writeFileSync, mkdirSync, rmSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const { tmpdir } = await import('node:os');
    const dir = resolve(tmpdir(), `docx-test-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    const filePath = resolve(dir, 'test.docx');
    writeFileSync(filePath, Buffer.from('fake-docx-bytes'));

    try {
      const result = await parser.parse({
        fileName: 'spec.docx',
        filePath,
      });

      expect(result.status).toBe('completed');
      expect(result.fileType).toBe('docx');
      expect(result.rawContent).toBe('Hello world from DOCX document');
      expect(result.structuredData).toMatchObject({
        wordCount: 5,
        extractionWarnings: [],
      });
      expect(result.fileHash).toBeTruthy();
      expect(result.fileName).toBe('spec.docx');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('records mammoth conversion warnings', async () => {
    mockedExtract.mockResolvedValue({
      value: 'Some text',
      messages: [
        { type: 'warning', message: 'Unrecognized style' } as any,
      ],
    });

    const { writeFileSync, mkdirSync, rmSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const { tmpdir } = await import('node:os');
    const dir = resolve(tmpdir(), `docx-test-warn-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    const filePath = resolve(dir, 'warn.docx');
    writeFileSync(filePath, Buffer.from('fake'));

    try {
      const result = await parser.parse({ fileName: 'warn.docx', filePath });

      expect(result.status).toBe('completed');
      expect((result.structuredData as any).extractionWarnings).toContain(
        'Unrecognized style',
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('warns when DOCX extraction returns empty text', async () => {
    mockedExtract.mockResolvedValue({
      value: '',
      messages: [],
    });

    const { writeFileSync, mkdirSync, rmSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const { tmpdir } = await import('node:os');
    const dir = resolve(tmpdir(), `docx-test-empty-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    const filePath = resolve(dir, 'empty.docx');
    writeFileSync(filePath, Buffer.from('fake'));

    try {
      const result = await parser.parse({ fileName: 'empty.docx', filePath });

      expect(result.status).toBe('completed');
      expect(result.rawContent).toBe('');
      expect((result.structuredData as any).extractionWarnings).toContain(
        'DOCX extraction returned empty text',
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('returns failed status when mammoth throws', async () => {
    mockedExtract.mockRejectedValue(new Error('invalid zip'));

    const { writeFileSync, mkdirSync, rmSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const { tmpdir } = await import('node:os');
    const dir = resolve(tmpdir(), `docx-test-fail-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    const filePath = resolve(dir, 'bad.docx');
    writeFileSync(filePath, Buffer.from('bad'));

    try {
      const result = await parser.parse({ fileName: 'bad.docx', filePath });

      expect(result.status).toBe('failed');
      expect(result.errorMessage).toBe('invalid zip');
      expect(result.rawContent).toBe('');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
