import type {
  SourceProfile,
  SourceRelationship,
  SourceRelationshipMap,
} from '@contextos/types';

interface WorkbookSheet {
  name: string;
}

interface WorkbookProfileInput {
  sheets: WorkbookSheet[];
}

/**
 * Deterministic cross-source relationship mapper.
 * No LLM calls — all relationships computed from source profiles.
 */
export class SourceRelationshipMapper {
  compute(
    workspaceId: string,
    profiles: SourceProfile[],
    _workbookProfile?: WorkbookProfileInput,
  ): SourceRelationshipMap {
    const relationships: SourceRelationship[] = [];

    // Pairwise comparisons
    for (let i = 0; i < profiles.length; i++) {
      for (let j = i + 1; j < profiles.length; j++) {
        const a = profiles[i]!;
        const b = profiles[j]!;
        relationships.push(...this.detectPair(a, b));
      }
    }

    // Isolated source detection
    const connected = new Set<string>();
    for (const r of relationships) {
      connected.add(r.sourceA);
      connected.add(r.sourceB);
    }
    for (const p of profiles) {
      if (!connected.has(p.fileName)) {
        relationships.push({
          sourceA: p.fileName,
          sourceB: '',
          type: 'isolated_source',
          confidence: 1.0,
          evidence: ['No shared topics or entities with other sources'],
        });
      }
    }

    return {
      workspaceId,
      generatedAt: new Date().toISOString(),
      relationships,
    };
  }

  private detectPair(a: SourceProfile, b: SourceProfile): SourceRelationship[] {
    const results: SourceRelationship[] = [];

    // 1. Possible duplicate (check first — higher priority)
    const dupResult = this.detectDuplicate(a, b);
    if (dupResult) {
      results.push(dupResult);
      return results; // Skip lower-priority checks if duplicate
    }

    // 2. Shared topics
    const topicResult = this.detectSharedTopics(a, b);
    if (topicResult) results.push(topicResult);

    // 3. Shared entities
    const entityResult = this.detectSharedEntities(a, b);
    if (entityResult) results.push(entityResult);

    // 4. Table ↔ document support
    const tableDocResult = this.detectTableDocumentSupport(a, b);
    if (tableDocResult) results.push(tableDocResult);

    // 5. Config ↔ document support
    const configDocResult = this.detectConfigDocumentSupport(a, b);
    if (configDocResult) results.push(configDocResult);

    return results;
  }

  private detectSharedTopics(a: SourceProfile, b: SourceProfile): SourceRelationship | null {
    const topicsA = this.normalize(a.detectedTopics);
    const topicsB = this.normalize(b.detectedTopics);
    if (topicsA.length === 0 || topicsB.length === 0) return null;

    const overlap = this.intersection(topicsA, topicsB);
    const jaccard = this.jaccard(topicsA, topicsB);

    if (overlap.length >= 2 || jaccard >= 0.3) {
      return {
        sourceA: a.fileName,
        sourceB: b.fileName,
        type: 'shared_topic',
        confidence: Math.min(1.0, jaccard + overlap.length * 0.1),
        evidence: overlap.length > 0
          ? [`Shared topics: ${overlap.join(', ')}`]
          : [`Topic similarity: ${(jaccard * 100).toFixed(0)}%`],
      };
    }
    return null;
  }

  private detectSharedEntities(a: SourceProfile, b: SourceProfile): SourceRelationship | null {
    const entA = this.normalize(a.detectedEntities);
    const entB = this.normalize(b.detectedEntities);
    if (entA.length === 0 || entB.length === 0) return null;

    const overlap = this.intersection(entA, entB);
    if (overlap.length >= 1) {
      return {
        sourceA: a.fileName,
        sourceB: b.fileName,
        type: 'shared_entity',
        confidence: Math.min(1.0, 0.5 + overlap.length * 0.15),
        evidence: [`Shared entities: ${overlap.join(', ')}`],
      };
    }
    return null;
  }

  private detectTableDocumentSupport(a: SourceProfile, b: SourceProfile): SourceRelationship | null {
    const tableKinds = new Set(['data', 'workbook']);
    const docKinds = new Set(['document', 'notes']);

    let table: SourceProfile | null = null;
    let doc: SourceProfile | null = null;

    if (tableKinds.has(a.sourceKind) && docKinds.has(b.sourceKind)) {
      table = a; doc = b;
    } else if (tableKinds.has(b.sourceKind) && docKinds.has(a.sourceKind)) {
      table = b; doc = a;
    }
    if (!table || !doc) return null;

    // Check if the doc references any topic or entity from the table
    const tableTokens = this.normalize([
      ...table.detectedTopics,
      ...table.detectedEntities,
    ]);
    const docTokens = this.normalize([
      ...doc.detectedTopics,
      ...doc.detectedEntities,
    ]);
    const overlap = this.intersection(tableTokens, docTokens);
    if (overlap.length >= 1) {
      return {
        sourceA: table.fileName,
        sourceB: doc.fileName,
        type: 'table_document_support',
        confidence: Math.min(1.0, 0.6 + overlap.length * 0.1),
        evidence: [`Table/data supports document via: ${overlap.join(', ')}`],
      };
    }
    return null;
  }

  private detectConfigDocumentSupport(a: SourceProfile, b: SourceProfile): SourceRelationship | null {
    let config: SourceProfile | null = null;
    let doc: SourceProfile | null = null;

    const docKinds = new Set(['document', 'notes', 'data']);

    if (a.sourceKind === 'config' && docKinds.has(b.sourceKind)) {
      config = a; doc = b;
    } else if (b.sourceKind === 'config' && docKinds.has(a.sourceKind)) {
      config = b; doc = a;
    }
    if (!config || !doc) return null;

    const configTokens = this.normalize([
      ...config.detectedTopics,
      ...config.detectedEntities,
    ]);
    const docTokens = this.normalize([
      ...doc.detectedTopics,
      ...doc.detectedEntities,
    ]);
    const overlap = this.intersection(configTokens, docTokens);
    if (overlap.length >= 1) {
      return {
        sourceA: config.fileName,
        sourceB: doc.fileName,
        type: 'config_document_support',
        confidence: Math.min(1.0, 0.6 + overlap.length * 0.1),
        evidence: [`Config supports document via: ${overlap.join(', ')}`],
      };
    }
    return null;
  }

  private detectDuplicate(a: SourceProfile, b: SourceProfile): SourceRelationship | null {
    const topicsA = this.normalize(a.detectedTopics);
    const topicsB = this.normalize(b.detectedTopics);
    const entA = this.normalize(a.detectedEntities);
    const entB = this.normalize(b.detectedEntities);

    if (topicsA.length === 0 && topicsB.length === 0) return null;

    const topicJaccard = this.jaccard(topicsA, topicsB);
    const entityJaccard = this.jaccard(entA, entB);

    if (topicJaccard >= 0.7 && entityJaccard >= 0.5) {
      return {
        sourceA: a.fileName,
        sourceB: b.fileName,
        type: 'possible_duplicate',
        confidence: (topicJaccard + entityJaccard) / 2,
        evidence: [
          `Topic similarity: ${(topicJaccard * 100).toFixed(0)}%`,
          `Entity similarity: ${(entityJaccard * 100).toFixed(0)}%`,
        ],
      };
    }
    return null;
  }

  // --- Utility helpers ---

  private normalize(items: string[]): string[] {
    return items
      .flatMap(s => s.split(/[\n,;|]+/))
      .map(s => s.trim().toLowerCase())
      .filter(s => s.length > 0);
  }

  private intersection(a: string[], b: string[]): string[] {
    const setB = new Set(b);
    return [...new Set(a.filter(item => setB.has(item)))];
  }

  private jaccard(a: string[], b: string[]): number {
    if (a.length === 0 && b.length === 0) return 0;
    const setA = new Set(a);
    const setB = new Set(b);
    const inter = [...setA].filter(x => setB.has(x)).length;
    const union = new Set([...setA, ...setB]).size;
    return union === 0 ? 0 : inter / union;
  }
}
