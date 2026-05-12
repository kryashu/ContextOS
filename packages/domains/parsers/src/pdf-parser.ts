import { readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { PDFParse } from 'pdf-parse';
import type { Source, SourceType } from '@contextos/types';
import type { SourceParser } from './types.js';

/**
 * PdfParser extracts plain text from PDF files.
 * No OCR — image-only PDFs will produce empty text with a warning.
 */
export class PdfParser implements SourceParser {
  canParse(fileType: SourceType): boolean {
    return fileType === 'pdf';
  }

  async parse(source: Partial<Source>): Promise<Source> {
    if (!source.filePath) {
      throw new Error('PdfParser requires filePath (binary file — cannot use rawContent)');
    }

    try {
      const fileBuffer = readFileSync(source.filePath);
      const fileSize = statSync(source.filePath).size;

      const pdf = new PDFParse({ data: fileBuffer });
      const textResult = await pdf.getText();
      const rawContent = textResult.text.trim();
      const pageCount = textResult.total;
      const wordCount = rawContent.split(/\s+/).filter(Boolean).length;
      const extractionWarnings: string[] = [];

      if (rawContent.length === 0) {
        extractionWarnings.push('PDF appears image-based; OCR is not supported yet');
      }

      await pdf.destroy();

      return {
        id: source.id ?? this.generateId(),
        workspaceId: source.workspaceId ?? '',
        fileName: source.fileName ?? 'unknown.pdf',
        filePath: source.filePath,
        fileType: 'pdf',
        fileSize,
        fileHash: this.computeHash(rawContent || 'empty'),
        rawContent,
        structuredData: {
          pageCount,
          wordCount,
          extractionWarnings,
        },
        status: 'completed',
        parsedAt: new Date(),
        createdAt: source.createdAt ?? new Date(),
        updatedAt: new Date(),
      };
    } catch (error) {
      return {
        id: source.id ?? this.generateId(),
        workspaceId: source.workspaceId ?? '',
        fileName: source.fileName ?? 'unknown.pdf',
        filePath: source.filePath,
        fileType: 'pdf',
        fileSize: 0,
        fileHash: '',
        rawContent: '',
        structuredData: {
          pageCount: 0,
          wordCount: 0,
          extractionWarnings: ['PDF text extraction failed'],
        },
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'PDF parsing failed',
        createdAt: source.createdAt ?? new Date(),
        updatedAt: new Date(),
      };
    }
  }

  private generateId(): string {
    return `src_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  private computeHash(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }
}
