import type { Source, SourceKind, SourceProfile } from '@contextos/types';

const FILE_TYPE_TO_KIND: Record<string, SourceKind> = {
  markdown: 'document',
  xlsx: 'workbook',
  csv: 'data',
  json: 'config',
  yaml: 'config',
  text: 'notes',
  pdf: 'document',
  docx: 'document',
  confluence: 'document',
  figma: 'document',
};

const DEFAULT_RELEVANCE: Record<SourceKind, number> = {
  document: 0.8,
  workbook: 0.7,
  data: 0.6,
  config: 0.5,
  notes: 0.4,
  unknown: 0.3,
};

/**
 * SourceProfiler generates a per-file SourceProfile.
 * Pure / deterministic — no LLM calls.
 */
export class SourceProfiler {
  profileAll(sources: Source[]): SourceProfile[] {
    return sources.map(s => this.profileSource(s));
  }

  profileSource(source: Source): SourceProfile {
    const sourceKind = this.detectKind(source);
    const summary = this.generateSummary(source);
    const detectedTopics = this.extractTopics(source);
    const detectedEntities = this.extractEntities(source);
    const relevanceScore = this.computeRelevance(source, sourceKind);
    const warnings = this.detectWarnings(source);

    return {
      sourceId: source.id,
      fileName: source.fileName,
      fileType: source.fileType,
      sourceKind,
      summary,
      detectedTopics,
      detectedEntities,
      relevanceScore,
      warnings,
    };
  }

  private detectKind(source: Source): SourceKind {
    // JSON files: if content looks like data (array at root) → 'data'; otherwise 'config'
    if (source.fileType === 'json') {
      const trimmed = source.rawContent.trim();
      if (trimmed.startsWith('[')) return 'data';
      return 'config';
    }
    return FILE_TYPE_TO_KIND[source.fileType] ?? 'unknown';
  }

  private generateSummary(source: Source): string {
    const content = source.rawContent.trim();
    if (content.length === 0) return '';
    // First 200 chars, break at word boundary
    if (content.length <= 200) return content;
    const cut = content.slice(0, 200);
    const lastSpace = cut.lastIndexOf(' ');
    return (lastSpace > 100 ? cut.slice(0, lastSpace) : cut) + '…';
  }

  /**
   * Extract topics from headings (markdown), top-level keys (JSON/YAML),
   * CSV headers, or Excel sheet/table names embedded in the text summary.
   */
  extractTopics(source: Source): string[] {
    const topics = new Set<string>();
    const content = source.rawContent;

    if (source.fileType === 'markdown' || source.fileType === 'text') {
      // Markdown headings
      const headingRe = /^#{1,3}\s+(.+)$/gm;
      let m: RegExpExecArray | null;
      while ((m = headingRe.exec(content)) !== null) {
        const heading = m[1]!.trim();
        if (heading.length > 0 && heading.length < 80) {
          topics.add(heading);
        }
      }
    }

    if (source.fileType === 'json') {
      try {
        const parsed = JSON.parse(content);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          for (const key of Object.keys(parsed).slice(0, 15)) {
            topics.add(key);
          }
        }
      } catch { /* ignore parse errors */ }
    }

    if (source.fileType === 'csv') {
      const firstLine = content.split('\n')[0] ?? '';
      for (const header of firstLine.split(',').map(h => h.trim()).filter(Boolean)) {
        if (header.length < 60) topics.add(header);
      }
    }

    if (source.fileType === 'yaml') {
      // Top-level keys (lines starting with a word followed by :)
      const keyRe = /^([a-zA-Z_][\w-]*)\s*:/gm;
      let m: RegExpExecArray | null;
      while ((m = keyRe.exec(content)) !== null) {
        topics.add(m[1]!);
      }
    }

    if (source.fileType === 'xlsx') {
      // Excel text summary often contains "Sheet:" lines
      const sheetRe = /Sheet:\s*(.+)/gi;
      let m: RegExpExecArray | null;
      while ((m = sheetRe.exec(content)) !== null) {
        topics.add(m[1]!.trim());
      }
      // Also look for "Table:" patterns
      const tableRe = /Table(?:\s+Block)?:\s*(.+)/gi;
      while ((m = tableRe.exec(content)) !== null) {
        topics.add(m[1]!.trim());
      }
    }

    return [...topics].slice(0, 20);
  }

  /**
   * Extract entities: capitalized multi-word phrases that look like proper nouns.
   */
  extractEntities(source: Source): string[] {
    const content = source.rawContent;
    if (content.length === 0) return [];

    const entities = new Map<string, number>();

    // Match sequences of 2+ capitalized words (proper noun phrases)
    const properNounRe = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g;
    let m: RegExpExecArray | null;
    while ((m = properNounRe.exec(content)) !== null) {
      let entity = m[1]!;
      // Strip leading common articles
      entity = entity.replace(/^(The|A|An)\s+/i, '');
      if (entity.length === 0 || !entity.includes(' ')) continue;
      // Skip very common phrases
      if (['Data Flow', 'New York', 'United States'].includes(entity)) continue;
      entities.set(entity, (entities.get(entity) ?? 0) + 1);
    }

    // Also capture PascalCase or SCREAMING_CASE identifiers as entities
    const identRe = /\b([A-Z][a-zA-Z]{2,}(?:[A-Z][a-z]+)+)\b/g;
    while ((m = identRe.exec(content)) !== null) {
      const entity = m[1]!;
      entities.set(entity, (entities.get(entity) ?? 0) + 1);
    }

    // Sort by frequency, return top 15
    return [...entities.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name)
      .slice(0, 15);
  }

  private computeRelevance(source: Source, kind: SourceKind): number {
    // If already classified, prefer the existing score
    if (source.relevanceScore !== undefined && source.relevanceScore > 0) {
      return source.relevanceScore;
    }

    let score = DEFAULT_RELEVANCE[kind] ?? 0.3;

    // Boost for larger content (more information)
    const contentLen = source.rawContent.length;
    if (contentLen > 2000) score = Math.min(1, score + 0.1);
    if (contentLen === 0) score = 0.1;

    return Math.round(score * 100) / 100;
  }

  private detectWarnings(source: Source): string[] {
    const warnings: string[] = [];
    if (source.rawContent.trim().length === 0) {
      warnings.push('File is empty or has no extractable text content');
    }
    if (source.fileType === 'unknown') {
      warnings.push('Unrecognized file type');
    }
    if (source.errorMessage) {
      warnings.push(`Parse error: ${source.errorMessage}`);
    }
    return warnings;
  }
}
