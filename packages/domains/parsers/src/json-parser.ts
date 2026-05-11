import type { Source, SourceType } from '@contextos/types';
import type { SourceParser, ParserResult } from './types.js';

/**
 * JSONParser handles JSON files (including Figma and Confluence JSON)
 */
export class JSONParser implements SourceParser {
  canParse(fileType: SourceType): boolean {
    return fileType === 'json' || fileType === 'figma' || fileType === 'confluence';
  }

  async parse(source: Partial<Source>): Promise<Source> {
    if (!source.rawContent) {
      throw new Error('No raw content provided');
    }

    try {
      const parsed = JSON.parse(source.rawContent) as Record<string, unknown>;
      
      // Detect special JSON types
      const detectedType = this.detectJSONType(parsed, source.fileName);

      const result: ParserResult = {
        rawContent: source.rawContent,
        structuredData: {
          type: detectedType,
          data: parsed,
          keyCount: Object.keys(parsed).length,
        },
      };

      return {
        id: source.id ?? this.generateId(),
        workspaceId: source.workspaceId ?? '',
        fileName: source.fileName ?? 'unknown.json',
        filePath: source.filePath ?? '',
        fileType: detectedType,
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
        fileName: source.fileName ?? 'unknown.json',
        filePath: source.filePath ?? '',
        fileType: 'json',
        fileSize: source.rawContent.length,
        fileHash: this.computeHash(source.rawContent),
        rawContent: source.rawContent,
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'JSON parsing failed',
        createdAt: source.createdAt ?? new Date(),
        updatedAt: new Date(),
      };
    }
  }

  /**
   * Detect if this is a special type of JSON (Figma, Confluence, etc.)
   */
  private detectJSONType(data: Record<string, unknown>, fileName?: string): SourceType {
    // Check filename first
    if (fileName?.includes('.figma.')) {
      return 'figma';
    }
    if (fileName?.includes('.confluence.')) {
      return 'confluence';
    }

    // Check content structure
    if (this.isFigmaJSON(data)) {
      return 'figma';
    }
    if (this.isConfluenceJSON(data)) {
      return 'confluence';
    }

    return 'json';
  }

  private isFigmaJSON(data: Record<string, unknown>): boolean {
    return (
      data['type'] === 'figma_flow' ||
      (typeof data['frames'] === 'object' && Array.isArray(data['frames']))
    );
  }

  private isConfluenceJSON(data: Record<string, unknown>): boolean {
    return (
      data['type'] === 'confluence_page' ||
      (typeof data['space'] === 'string' && typeof data['content'] === 'object')
    );
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
