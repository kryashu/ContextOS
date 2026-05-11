import { createHash } from 'crypto';
import type { Source, SourceType } from '@contextos/types';
import type { SourceParser, ParserResult } from './types.js';

const TEXT_TYPES = new Set<SourceType>(['text', 'yaml', 'unknown']);

/**
 * GenericTextParser handles plain text, YAML, and unknown file types.
 * Passes through raw content with minimal metadata extraction.
 */
export class GenericTextParser implements SourceParser {
  canParse(fileType: SourceType): boolean {
    return TEXT_TYPES.has(fileType);
  }

  async parse(source: Partial<Source>): Promise<Source> {
    const raw = source.rawContent ?? '';

    const result: ParserResult = {
      rawContent: raw,
      metadata: this.extractMetadata(raw, source.fileType ?? 'unknown'),
    };

    return {
      id: source.id ?? `src_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      workspaceId: source.workspaceId ?? '',
      fileName: source.fileName ?? 'unknown.txt',
      filePath: source.filePath ?? '',
      fileType: source.fileType ?? 'unknown',
      fileSize: raw.length,
      fileHash: createHash('sha256').update(raw).digest('hex'),
      rawContent: result.rawContent,
      structuredData: result.metadata,
      status: 'completed',
      parsedAt: new Date(),
      createdAt: source.createdAt ?? new Date(),
      updatedAt: new Date(),
    };
  }

  private extractMetadata(
    content: string,
    fileType: SourceType,
  ): Record<string, unknown> {
    const lines = content.split('\n');
    const meta: Record<string, unknown> = {
      lineCount: lines.length,
      fileType,
    };

    if (fileType === 'yaml') {
      // Capture top-level YAML keys
      const topKeys: string[] = [];
      for (const line of lines) {
        const m = /^([a-zA-Z_][\w-]*)\s*:/.exec(line);
        if (m) topKeys.push(m[1]!);
      }
      meta.topLevelKeys = topKeys;
    }

    return meta;
  }
}
