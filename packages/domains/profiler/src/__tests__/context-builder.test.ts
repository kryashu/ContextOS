import { describe, it, expect } from 'vitest';
import type { Source, SourceProfile } from '@contextos/types';
import { WorkspaceContextBuilder } from '../context-builder.js';

function makeProfile(overrides: Partial<SourceProfile>): SourceProfile {
  return {
    sourceId: 'src_1',
    fileName: 'test.md',
    fileType: 'markdown',
    sourceKind: 'document',
    summary: 'test',
    detectedTopics: [],
    detectedEntities: [],
    relevanceScore: 0.8,
    warnings: [],
    ...overrides,
  };
}

function makeSource(overrides: Partial<Source>): Source {
  return {
    id: 'src_1',
    workspaceId: 'ws_1',
    fileName: 'test.md',
    filePath: '/tmp/test.md',
    fileType: 'markdown',
    fileSize: 100,
    fileHash: 'abc',
    rawContent: '',
    status: 'completed',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('WorkspaceContextBuilder', () => {
  const builder = new WorkspaceContextBuilder();

  it('builds context for a docs-only workspace', () => {
    const profiles = [
      makeProfile({ sourceKind: 'document', detectedTopics: ['Architecture', 'API'] }),
      makeProfile({ sourceId: 'src_2', sourceKind: 'document', detectedTopics: ['Architecture', 'Deployment'] }),
    ];
    const sources = profiles.map(p => makeSource({ id: p.sourceId }));

    const ctx = builder.build('ws_1', profiles, sources);

    expect(ctx.workspaceId).toBe('ws_1');
    expect(ctx.sourceKindCounts.document).toBe(2);
    expect(ctx.sourceKindCounts.workbook).toBe(0);
    expect(ctx.detectedCapabilities.hasDocuments).toBe(true);
    expect(ctx.detectedCapabilities.hasTables).toBe(false);
    expect(ctx.detectedCapabilities.canGenerateDFD).toBe(true);
    expect(ctx.keyTopics[0]).toBe('architecture');
    expect(ctx.assumptions.some(a => a.includes('documentation-only'))).toBe(true);
  });

  it('builds context for a tables-only workspace', () => {
    const profiles = [
      makeProfile({ sourceKind: 'workbook', fileType: 'xlsx' }),
      makeProfile({ sourceId: 'src_2', sourceKind: 'data', fileType: 'csv' }),
    ];
    const sources = profiles.map(p => makeSource({ id: p.sourceId }));

    const ctx = builder.build('ws_1', profiles, sources);

    expect(ctx.detectedCapabilities.hasWorkbooks).toBe(true);
    expect(ctx.detectedCapabilities.hasTables).toBe(true);
    expect(ctx.detectedCapabilities.canCalculate).toBe(true);
    expect(ctx.detectedCapabilities.canChart).toBe(true);
    expect(ctx.detectedCapabilities.hasDocuments).toBe(false);
    expect(ctx.assumptions.some(a => a.includes('tabular data'))).toBe(true);
  });

  it('builds context for a mixed workspace', () => {
    const profiles = [
      makeProfile({ sourceKind: 'document' }),
      makeProfile({ sourceId: 'src_2', sourceKind: 'workbook' }),
      makeProfile({ sourceId: 'src_3', sourceKind: 'config' }),
    ];
    const sources = profiles.map(p => makeSource({ id: p.sourceId }));

    const ctx = builder.build('ws_1', profiles, sources);

    expect(ctx.detectedCapabilities.hasDocuments).toBe(true);
    expect(ctx.detectedCapabilities.hasTables).toBe(true);
    expect(ctx.assumptions.some(a => a.includes('full analysis'))).toBe(true);
  });

  it('detects irrelevant sources', () => {
    const profiles = [
      makeProfile({ sourceKind: 'document', relevanceScore: 0.8 }),
      makeProfile({
        sourceId: 'src_2',
        fileName: 'junk.txt',
        sourceKind: 'unknown',
        relevanceScore: 0.1,
        warnings: ['File is empty or has no extractable text content'],
      }),
    ];
    const sources = profiles.map(p => makeSource({ id: p.sourceId }));

    const ctx = builder.build('ws_1', profiles, sources);

    expect(ctx.detectedCapabilities.hasIrrelevantSources).toBe(true);
    expect(ctx.irrelevantSources).toHaveLength(1);
    expect(ctx.irrelevantSources[0]!.fileName).toBe('junk.txt');
  });

  it('generates recommended actions based on capabilities', () => {
    const profiles = [
      makeProfile({ sourceKind: 'document' }),
      makeProfile({ sourceId: 'src_2', sourceKind: 'data' }),
    ];
    const sources = profiles.map(p => makeSource({ id: p.sourceId }));

    const ctx = builder.build('ws_1', profiles, sources);

    const actionNames = ctx.recommendedActions.map(a => a.action);
    expect(actionNames).toContain('Generate Data Flow Diagram');
    expect(actionNames).toContain('Explore Table Calculations');
    expect(actionNames).toContain('Review Findings');
  });

  it('derives primary theme from most frequent topic', () => {
    const profiles = [
      makeProfile({ detectedTopics: ['payments', 'checkout'] }),
      makeProfile({ sourceId: 'src_2', detectedTopics: ['payments', 'orders'] }),
    ];
    const sources = profiles.map(p => makeSource({ id: p.sourceId }));

    const ctx = builder.build('ws_1', profiles, sources);
    expect(ctx.primaryTheme).toBe('payments');
  });

  it('handles empty workspace', () => {
    const ctx = builder.build('ws_1', [], []);

    expect(ctx.primaryTheme).toBe('Empty workspace');
    expect(ctx.sourceKindCounts.document).toBe(0);
    expect(ctx.detectedCapabilities.canAnswerQuestions).toBe(false);
    expect(ctx.assumptions.some(a => a.includes('No source files'))).toBe(true);
  });
});
