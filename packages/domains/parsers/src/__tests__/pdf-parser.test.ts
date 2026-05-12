import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Source } from '@contextos/types';

// Mock pdf-parse before importing the parser
const mockGetText = vi.fn();
const mockDestroy = vi.fn();

vi.mock('pdf-parse', () => ({
  PDFParse: vi.fn().mockImplementation(() => ({
    getText: mockGetText,
    destroy: mockDestroy,
  })),
}));

import { PdfParser } from '../pdf-parser.js';

describe('PdfParser', () => {
  const parser = new PdfParser();

  beforeEach(() => {
    vi.clearAllMocks();
    mockDestroy.mockResolvedValue(undefined);
  });

  it('canParse returns true for pdf', () => {
    expect(parser.canParse('pdf')).toBe(true);
  });

  it('canParse returns false for other types', () => {
    expect(parser.canParse('markdown')).toBe(false);
    expect(parser.canParse('docx')).toBe(false);
    expect(parser.canParse('xlsx')).toBe(false);
  });

  it('throws when filePath is missing', async () => {
    await expect(parser.parse({})).rejects.toThrow('PdfParser requires filePath');
  });

  it('parses a PDF with text content', async () => {
    mockGetText.mockResolvedValue({
      text: 'Hello world from PDF',
      total: 3,
      pages: [],
    });

    // Create a minimal buffer in a temp file
    const { writeFileSync, mkdirSync, rmSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const { tmpdir } = await import('node:os');
    const dir = resolve(tmpdir(), `pdf-test-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    const filePath = resolve(dir, 'test.pdf');
    writeFileSync(filePath, Buffer.from('fake-pdf-bytes'));

    try {
      const result = await parser.parse({
        fileName: 'report.pdf',
        filePath,
      });

      expect(result.status).toBe('completed');
      expect(result.fileType).toBe('pdf');
      expect(result.rawContent).toBe('Hello world from PDF');
      expect(result.structuredData).toMatchObject({
        pageCount: 3,
        wordCount: 4,
        extractionWarnings: [],
      });
      expect(result.fileHash).toBeTruthy();
      expect(result.fileName).toBe('report.pdf');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('warns when PDF has no extractable text (image-based)', async () => {
    mockGetText.mockResolvedValue({
      text: '',
      total: 1,
      pages: [],
    });

    const { writeFileSync, mkdirSync, rmSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const { tmpdir } = await import('node:os');
    const dir = resolve(tmpdir(), `pdf-test-empty-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    const filePath = resolve(dir, 'scan.pdf');
    writeFileSync(filePath, Buffer.from('fake-pdf'));

    try {
      const result = await parser.parse({ fileName: 'scan.pdf', filePath });

      expect(result.status).toBe('completed');
      expect(result.rawContent).toBe('');
      expect((result.structuredData as any).extractionWarnings).toContain(
        'PDF appears image-based; OCR is not supported yet',
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('returns failed status when pdf-parse throws', async () => {
    mockGetText.mockRejectedValue(new Error('corrupted PDF'));

    const { writeFileSync, mkdirSync, rmSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const { tmpdir } = await import('node:os');
    const dir = resolve(tmpdir(), `pdf-test-fail-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    const filePath = resolve(dir, 'bad.pdf');
    writeFileSync(filePath, Buffer.from('bad'));

    try {
      const result = await parser.parse({ fileName: 'bad.pdf', filePath });

      expect(result.status).toBe('failed');
      expect(result.errorMessage).toBe('corrupted PDF');
      expect(result.rawContent).toBe('');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
