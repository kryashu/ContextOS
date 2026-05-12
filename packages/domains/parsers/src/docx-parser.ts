import { readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import mammoth from 'mammoth';
import type { Source, SourceType } from '@contextos/types';
import type { SourceParser } from './types.js';

/**
 * DocxParser extracts plain text from DOCX files using mammoth.
 */
export class DocxParser implements SourceParser {
  canParse(fileType: SourceType): boolean {
    return fileType === 'docx';
  }

  async parse(source: Partial<Source>): Promise<Source> {
    if (!source.filePath) {
      throw new Error('DocxParser requires filePath (binary file — cannot use rawContent)');
    }

    try {
      const fileBuffer = readFileSync(source.filePath);
      const fileSize = statSync(source.filePath).size;
      const result = await mammoth.extractRawText({ buffer: fileBuffer });

      const rawContent = result.value.trim();
      const wordCount = rawContent.split(/\s+/).filter(Boolean).length;
      const extractionWarnings: string[] = [];

      if (rawContent.length === 0) {
        extractionWarnings.push('DOCX extraction returned empty text');
      }

      // Collect mammoth conversion warnings
      if (result.messages && result.messages.length > 0) {
        for (const msg of result.messages) {
          extractionWarnings.push(msg.message);
        }
      }

      return {
        id: source.id ?? this.generateId(),
        workspaceId: source.workspaceId ?? '',
        fileName: source.fileName ?? 'unknown.docx',
        filePath: source.filePath,
        fileType: 'docx',
        fileSize,
        fileHash: this.computeHash(rawContent || 'empty'),
        rawContent,
        structuredData: {
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
        fileName: source.fileName ?? 'unknown.docx',
        filePath: source.filePath,
        fileType: 'docx',
        fileSize: 0,
        fileHash: '',
        rawContent: '',
        structuredData: {
          wordCount: 0,
          extractionWarnings: ['DOCX text extraction failed'],
        },
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'DOCX parsing failed',
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
