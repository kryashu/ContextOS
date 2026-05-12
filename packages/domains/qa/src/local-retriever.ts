import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { WorkspaceContext, SourceProfile } from '@contextos/types';

const TEXT_EXTENSIONS = new Set(['.md', '.txt', '.json', '.yaml', '.yml', '.csv']);
const SNIPPET_RADIUS = 250; // chars around match
const MAX_FILE_SIZE = 512 * 1024; // skip files larger than 512KB for search

export interface RetrievedSnippet {
  fileName: string;
  snippet: string;
}

/**
 * LocalRetriever reads workspace artifacts and source files from disk.
 * No vector DB — uses naive keyword search.
 */
export class LocalRetriever {
  constructor(
    private readonly outputDir: string,
    private readonly sourcesDir: string,
  ) {}

  loadWorkspaceContext(): WorkspaceContext | null {
    return this.readJSON<WorkspaceContext>('workspace-context.json');
  }

  loadSourceProfiles(): SourceProfile[] | null {
    return this.readJSON<SourceProfile[]>('source-profiles.json');
  }

  loadWorkbookProfile(): Record<string, unknown> | null {
    return this.readJSON<Record<string, unknown>>('workbook-profile.json');
  }

  loadNormalizedObservations(): Array<Record<string, unknown>> | null {
    return this.readJSON<Array<Record<string, unknown>>>('normalized-observations.json');
  }

  /**
   * Search text-like source files for keyword matches.
   * Returns snippets (~500 chars) around each match.
   */
  searchSourceFiles(query: string, maxResults = 5): RetrievedSnippet[] {
    if (!existsSync(this.sourcesDir)) return [];

    const keywords = query
      .toLowerCase()
      .split(/\s+/)
      .filter(w => w.length >= 3);

    if (keywords.length === 0) return [];

    const results: Array<RetrievedSnippet & { score: number }> = [];

    let files: string[];
    try {
      files = readdirSync(this.sourcesDir).filter(f => !f.startsWith('.'));
    } catch {
      return [];
    }

    for (const fileName of files) {
      const ext = '.' + fileName.split('.').pop()?.toLowerCase();
      if (!TEXT_EXTENSIONS.has(ext)) continue;

      const filePath = resolve(this.sourcesDir, fileName);
      let content: string;
      try {
        const stat = require('node:fs').statSync(filePath);
        if (stat.size > MAX_FILE_SIZE) continue;
        content = readFileSync(filePath, 'utf-8');
      } catch {
        continue;
      }

      const lower = content.toLowerCase();
      let score = 0;
      let bestMatchIdx = -1;

      for (const kw of keywords) {
        const idx = lower.indexOf(kw);
        if (idx !== -1) {
          score++;
          if (bestMatchIdx === -1) bestMatchIdx = idx;
        }
      }

      if (score > 0 && bestMatchIdx !== -1) {
        const start = Math.max(0, bestMatchIdx - SNIPPET_RADIUS);
        const end = Math.min(content.length, bestMatchIdx + SNIPPET_RADIUS);
        let snippet = content.slice(start, end).trim();
        if (start > 0) snippet = '…' + snippet;
        if (end < content.length) snippet = snippet + '…';

        results.push({ fileName, snippet, score });
      }
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults)
      .map(({ fileName, snippet }) => ({ fileName, snippet }));
  }

  private readJSON<T>(fileName: string): T | null {
    const filePath = resolve(this.outputDir, fileName);
    if (!existsSync(filePath)) return null;
    try {
      return JSON.parse(readFileSync(filePath, 'utf-8')) as T;
    } catch {
      return null;
    }
  }
}
