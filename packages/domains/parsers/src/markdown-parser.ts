import type { Source, SourceType } from '@contextos/types';
import type { SourceParser, ParserResult } from './types.js';

/**
 * MarkdownParser handles Markdown files
 */
export class MarkdownParser implements SourceParser {
  canParse(fileType: SourceType): boolean {
    return fileType === 'markdown';
  }

  async parse(source: Partial<Source>): Promise<Source> {
    if (!source.rawContent) {
      throw new Error('No raw content provided');
    }

    const result: ParserResult = {
      rawContent: source.rawContent,
      metadata: this.extractMetadata(source.rawContent),
    };

    return {
      id: source.id ?? this.generateId(),
      workspaceId: source.workspaceId ?? '',
      fileName: source.fileName ?? 'unknown.md',
      filePath: source.filePath ?? '',
      fileType: 'markdown',
      fileSize: source.rawContent.length,
      fileHash: this.computeHash(source.rawContent),
      rawContent: result.rawContent,
      structuredData: result.metadata,
      status: 'completed',
      parsedAt: new Date(),
      createdAt: source.createdAt ?? new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Extract metadata from Markdown (headings, sections, etc.)
   */
  private extractMetadata(content: string): Record<string, unknown> {
    const lines = content.split('\n');
    const headings: string[] = [];
    const sections: Record<string, string> = {};
    
    let currentHeading = '';
    let currentContent: string[] = [];

    for (const line of lines) {
      const headingMatch = /^(#{1,6})\s+(.+)$/.exec(line);
      if (headingMatch) {
        // Save previous section
        if (currentHeading && currentContent.length > 0) {
          sections[currentHeading] = currentContent.join('\n').trim();
        }
        
        currentHeading = headingMatch[2] ?? '';
        headings.push(currentHeading);
        currentContent = [];
      } else {
        currentContent.push(line);
      }
    }

    // Save last section
    if (currentHeading && currentContent.length > 0) {
      sections[currentHeading] = currentContent.join('\n').trim();
    }

    return {
      headings,
      sections,
      lineCount: lines.length,
    };
  }

  private generateId(): string {
    return `src_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  private computeHash(content: string): string {
    // Simple hash for demo - in production use crypto.createHash
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }
}
