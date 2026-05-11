import { parse } from 'csv-parse/sync';
import type { Source, SourceType } from '@contextos/types';
import type { SourceParser, ParserResult } from './types.js';

/**
 * CSVParser handles CSV files
 */
export class CSVParser implements SourceParser {
  canParse(fileType: SourceType): boolean {
    return fileType === 'csv';
  }

  async parse(source: Partial<Source>): Promise<Source> {
    if (!source.rawContent) {
      throw new Error('No raw content provided');
    }

    try {
      const records = parse(source.rawContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      }) as Record<string, string>[];

      const result: ParserResult = {
        rawContent: source.rawContent,
        structuredData: {
          rows: records,
          rowCount: records.length,
          columns: records.length > 0 ? Object.keys(records[0] ?? {}) : [],
        },
      };

      return {
        id: source.id ?? this.generateId(),
        workspaceId: source.workspaceId ?? '',
        fileName: source.fileName ?? 'unknown.csv',
        filePath: source.filePath ?? '',
        fileType: 'csv',
        fileSize: source.rawContent.length,
        fileHash: this.computeHash(source.rawContent),
        rawContent: result.rawContent,
        structuredData: result.structuredData,
        status: 'completed',
        parsedAt: new Date(),
        createdAt: source.createdAt ?? new Date(),
        updatedAt: new Date(),
      };
    } catch (error) {
      return {
        id: source.id ?? this.generateId(),
        workspaceId: source.workspaceId ?? '',
        fileName: source.fileName ?? 'unknown.csv',
        filePath: source.filePath ?? '',
        fileType: 'csv',
        fileSize: source.rawContent.length,
        fileHash: this.computeHash(source.rawContent),
        rawContent: source.rawContent,
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'CSV parsing failed',
        createdAt: source.createdAt ?? new Date(),
        updatedAt: new Date(),
      };
    }
  }

  private generateId(): string {
    return `src_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  private computeHash(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }
}
