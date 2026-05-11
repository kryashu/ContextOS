import type {
  Source,
  SourceKind,
  SourceProfile,
  WorkspaceContext,
  DetectedCapabilities,
  RecommendedAction,
  IrrelevantSource,
} from '@contextos/types';

const LOW_RELEVANCE_THRESHOLD = 0.35;

/**
 * Builds a WorkspaceContext from a set of SourceProfiles.
 * Pure / deterministic — no LLM calls.
 */
export class WorkspaceContextBuilder {
  build(
    workspaceId: string,
    profiles: SourceProfile[],
    _sources: Source[],
  ): WorkspaceContext {
    const kindCounts = this.countKinds(profiles);
    const keyTopics = this.aggregateTopics(profiles);
    const keyEntities = this.aggregateEntities(profiles);
    const capabilities = this.detectCapabilities(profiles, kindCounts);
    const actions = this.recommendActions(capabilities, kindCounts);
    const irrelevant = this.findIrrelevant(profiles);
    const primaryTheme = this.derivePrimaryTheme(keyTopics, profiles);
    const assumptions = this.deriveAssumptions(profiles, capabilities);

    return {
      workspaceId,
      generatedAt: new Date().toISOString(),
      primaryTheme,
      sourceKindCounts: kindCounts,
      keyTopics,
      keyEntities,
      detectedCapabilities: capabilities,
      recommendedActions: actions,
      irrelevantSources: irrelevant,
      assumptions,
    };
  }

  private countKinds(profiles: SourceProfile[]): Record<SourceKind, number> {
    const counts: Record<SourceKind, number> = {
      document: 0,
      workbook: 0,
      config: 0,
      data: 0,
      notes: 0,
      unknown: 0,
    };
    for (const p of profiles) {
      counts[p.sourceKind]++;
    }
    return counts;
  }

  private aggregateTopics(profiles: SourceProfile[]): string[] {
    const freq = new Map<string, number>();
    for (const p of profiles) {
      for (const t of p.detectedTopics) {
        const key = t.toLowerCase();
        freq.set(key, (freq.get(key) ?? 0) + 1);
      }
    }
    return [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([topic]) => topic)
      .slice(0, 15);
  }

  private aggregateEntities(profiles: SourceProfile[]): string[] {
    const freq = new Map<string, number>();
    for (const p of profiles) {
      for (const e of p.detectedEntities) {
        freq.set(e, (freq.get(e) ?? 0) + 1);
      }
    }
    return [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([entity]) => entity)
      .slice(0, 15);
  }

  private detectCapabilities(
    profiles: SourceProfile[],
    kinds: Record<SourceKind, number>,
  ): DetectedCapabilities {
    const hasDocuments = kinds.document > 0 || kinds.notes > 0;
    const hasWorkbooks = kinds.workbook > 0;
    const hasTables = kinds.data > 0 || kinds.workbook > 0;

    return {
      hasDocuments,
      hasWorkbooks,
      hasTables,
      canCalculate: hasTables,
      canChart: hasTables,
      canGenerateDFD: hasDocuments && profiles.length > 1,
      canAnswerQuestions: profiles.length > 0,
      hasIrrelevantSources: profiles.some(
        p => p.relevanceScore < LOW_RELEVANCE_THRESHOLD,
      ),
    };
  }

  private recommendActions(
    cap: DetectedCapabilities,
    kinds: Record<SourceKind, number>,
  ): RecommendedAction[] {
    const actions: RecommendedAction[] = [];

    if (cap.canGenerateDFD) {
      actions.push({
        action: 'Generate Data Flow Diagram',
        reason: `${kinds.document} document(s) detected — entity and relationship extraction can produce a DFD.`,
        capability: 'canGenerateDFD',
      });
    }

    if (cap.canCalculate) {
      actions.push({
        action: 'Explore Table Calculations',
        reason: 'Tabular data detected — aggregations, filters, and pivots are available.',
        capability: 'canCalculate',
      });
    }

    if (cap.canChart) {
      actions.push({
        action: 'Visualise Data',
        reason: 'Numeric or tabular data can be charted.',
        capability: 'canChart',
      });
    }

    if (cap.hasDocuments) {
      actions.push({
        action: 'Review Findings',
        reason: 'Documents were analysed — review detected findings and quality checks.',
        capability: 'hasDocuments',
      });
    }

    if (cap.hasIrrelevantSources) {
      actions.push({
        action: 'Review Irrelevant Sources',
        reason: 'Some files scored below the relevance threshold and may be noise.',
        capability: 'hasIrrelevantSources',
      });
    }

    return actions;
  }

  private findIrrelevant(profiles: SourceProfile[]): IrrelevantSource[] {
    return profiles
      .filter(p => p.relevanceScore < LOW_RELEVANCE_THRESHOLD)
      .map(p => ({
        fileName: p.fileName,
        reason:
          p.warnings.length > 0
            ? p.warnings[0]!
            : `Low relevance score (${p.relevanceScore})`,
      }));
  }

  private derivePrimaryTheme(
    topics: string[],
    profiles: SourceProfile[],
  ): string {
    if (topics.length > 0) return topics[0]!;
    // Fallback: derive from file names
    if (profiles.length > 0) {
      return `Workspace with ${profiles.length} source(s)`;
    }
    return 'Empty workspace';
  }

  private deriveAssumptions(
    profiles: SourceProfile[],
    cap: DetectedCapabilities,
  ): string[] {
    const assumptions: string[] = [];

    if (profiles.length === 0) {
      assumptions.push('No source files were found in the workspace.');
      return assumptions;
    }

    if (cap.hasDocuments && !cap.hasTables) {
      assumptions.push(
        'This workspace appears to be documentation-only; no tabular data was detected.',
      );
    }
    if (cap.hasTables && !cap.hasDocuments) {
      assumptions.push(
        'This workspace appears to contain only structured/tabular data; no prose documents were detected.',
      );
    }
    if (cap.hasDocuments && cap.hasTables) {
      assumptions.push(
        'This workspace contains both documents and tabular data — full analysis capabilities are available.',
      );
    }

    return assumptions;
  }
}
