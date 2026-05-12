import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import type { WorkspaceContext, SourceProfile, SourceRelationship, SourceRelationshipMap } from '@contextos/types';

const TEXT_EXTENSIONS = new Set(['.md', '.txt', '.json', '.yaml', '.yml', '.csv']);
const SNIPPET_RADIUS = 250; // chars around match
const MAX_FILE_SIZE = 512 * 1024; // skip files larger than 512KB for search
const MAX_TOTAL_SNIPPET_CHARS = 3000; // cap total snippet bytes sent to LLM
const MAX_RELATED_FILES = 3; // cap on relationship-expanded files
const MAX_TOTAL_EXPANDED_CHARS = 4500; // total snippet cap including expansions
const HEADER_SNIPPET_CHARS = 300; // first N chars for high-confidence related files
const MIN_RELATED_CONFIDENCE = 0.7; // minimum confidence for header snippet inclusion

export interface RetrievedSnippet {
  fileName: string;
  snippet: string;
  score: number;
  isRelated?: boolean;
  relationshipType?: string;
  relationshipReason?: string;
  relationshipConfidence?: number;
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

  loadWorkspaceRelationships(): SourceRelationshipMap | null {
    return this.readJSON<SourceRelationshipMap>('workspace-relationships.json');
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
        const stat = statSync(filePath);
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

    const sorted = results
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults);

    // Cap total snippet chars to avoid oversized LLM context
    let totalChars = 0;
    const capped: RetrievedSnippet[] = [];
    for (const s of sorted) {
      if (totalChars + s.snippet.length > MAX_TOTAL_SNIPPET_CHARS) break;
      totalChars += s.snippet.length;
      capped.push({ fileName: s.fileName, snippet: s.snippet, score: s.score });
    }
    return capped;
  }

  /**
   * Get non-isolated relationships involving a given source file.
   * Sorted by confidence descending.
   */
  getRelatedSources(fileName: string): SourceRelationship[] {
    const relMap = this.loadWorkspaceRelationships();
    if (!relMap) return [];

    return relMap.relationships
      .filter(r =>
        r.type !== 'isolated_source' &&
        (r.sourceA === fileName || r.sourceB === fileName),
      )
      .sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Search source files with relationship expansion.
   * Direct matches come first; related files are appended up to caps.
   * Related snippets ≤ direct snippets + 2 (dominance guard).
   */
  searchWithRelationships(query: string, maxDirectResults = 5): RetrievedSnippet[] {
    const direct = this.searchSourceFiles(query, maxDirectResults);
    if (direct.length === 0) return [];

    const directFileNames = new Set(direct.map(s => s.fileName));
    const relatedCandidates = new Map<string, { rel: SourceRelationship; via: string }>();

    // Gather related files from all direct matches
    for (const d of direct) {
      const rels = this.getRelatedSources(d.fileName);
      for (const rel of rels) {
        const other = rel.sourceA === d.fileName ? rel.sourceB : rel.sourceA;
        if (!other || directFileNames.has(other)) continue;
        // Keep highest-confidence relationship per file
        const existing = relatedCandidates.get(other);
        if (!existing || rel.confidence > existing.rel.confidence) {
          relatedCandidates.set(other, { rel, via: d.fileName });
        }
      }
    }

    // Sort candidates by confidence desc, cap at MAX_RELATED_FILES
    const sortedCandidates = [...relatedCandidates.entries()]
      .sort((a, b) => b[1].rel.confidence - a[1].rel.confidence)
      .slice(0, MAX_RELATED_FILES);

    // Dominance guard: related ≤ direct + 2
    const maxRelated = Math.min(sortedCandidates.length, direct.length + 2);
    const keywords = query
      .toLowerCase()
      .split(/\s+/)
      .filter(w => w.length >= 3);

    const relatedSnippets: RetrievedSnippet[] = [];
    for (let i = 0; i < maxRelated; i++) {
      const [relFileName, { rel, via }] = sortedCandidates[i]!;
      const snippet = this.extractRelatedSnippet(relFileName, keywords, rel.confidence);
      if (!snippet) continue;

      relatedSnippets.push({
        fileName: relFileName,
        snippet,
        score: 0,
        isRelated: true,
        relationshipType: rel.type,
        relationshipReason: `Related to ${via} by ${rel.type}`,
        relationshipConfidence: rel.confidence,
      });
    }

    // Cap total chars (direct + related combined)
    let totalChars = 0;
    const result: RetrievedSnippet[] = [];

    for (const s of direct) {
      if (totalChars + s.snippet.length > MAX_TOTAL_EXPANDED_CHARS) break;
      totalChars += s.snippet.length;
      result.push(s);
    }
    for (const s of relatedSnippets) {
      if (totalChars + s.snippet.length > MAX_TOTAL_EXPANDED_CHARS) break;
      totalChars += s.snippet.length;
      result.push(s);
    }

    return result;
  }

  /**
   * Extract a snippet from a related file.
   * If keywords match, returns a keyword snippet. Otherwise, returns a header
   * snippet (first N chars) only if confidence ≥ MIN_RELATED_CONFIDENCE.
   */
  private extractRelatedSnippet(
    fileName: string,
    keywords: string[],
    confidence: number,
  ): string | null {
    const ext = '.' + fileName.split('.').pop()?.toLowerCase();
    if (!TEXT_EXTENSIONS.has(ext)) return null;

    const filePath = resolve(this.sourcesDir, fileName);
    let content: string;
    try {
      if (!existsSync(filePath)) return null;
      const stat = statSync(filePath);
      if (stat.size > MAX_FILE_SIZE) return null;
      content = readFileSync(filePath, 'utf-8');
    } catch {
      return null;
    }

    // Try keyword match first
    const lower = content.toLowerCase();
    let bestMatchIdx = -1;
    for (const kw of keywords) {
      const idx = lower.indexOf(kw);
      if (idx !== -1 && bestMatchIdx === -1) {
        bestMatchIdx = idx;
      }
    }

    if (bestMatchIdx !== -1) {
      const start = Math.max(0, bestMatchIdx - SNIPPET_RADIUS);
      const end = Math.min(content.length, bestMatchIdx + SNIPPET_RADIUS);
      let snippet = content.slice(start, end).trim();
      if (start > 0) snippet = '…' + snippet;
      if (end < content.length) snippet = snippet + '…';
      return snippet;
    }

    // No keyword match: include header snippet only for high-confidence
    if (confidence >= MIN_RELATED_CONFIDENCE) {
      let header = content.slice(0, HEADER_SNIPPET_CHARS).trim();
      if (content.length > HEADER_SNIPPET_CHARS) header += '…';
      return header;
    }

    return null;
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
