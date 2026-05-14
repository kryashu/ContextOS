import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import type { ToolExecutionContext } from '../types.js';

const TEST_DATA_ROOT = resolve(process.cwd(), 'data', 'workspaces');
const WS_ID = 'ws_900000000003';
const OUTPUT_DIR = resolve(TEST_DATA_ROOT, WS_ID, 'output');
const SOURCES_DIR = resolve(TEST_DATA_ROOT, WS_ID, 'sources');

function hash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

const SOURCE_CONTENT = 'test source';
const SOURCE_HASH = hash(SOURCE_CONTENT);

function makeContext(): ToolExecutionContext {
  return {
    workspaceId: WS_ID,
    outputDir: OUTPUT_DIR,
    sourcesDir: SOURCES_DIR,
    manifestPath: resolve(OUTPUT_DIR, 'analysis-manifest.json'),
  };
}

function setupWorkspace(): void {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  mkdirSync(SOURCES_DIR, { recursive: true });
  writeFileSync(resolve(SOURCES_DIR, 'test.md'), SOURCE_CONTENT);
  writeFileSync(resolve(OUTPUT_DIR, 'analysis-manifest.json'), JSON.stringify({
    workspaceId: WS_ID,
    runId: 'run_1',
    generatedAt: new Date().toISOString(),
    sourceFiles: [
      { fileName: 'test.md', fileType: 'markdown', hash: SOURCE_HASH, size: SOURCE_CONTENT.length },
    ],
    artifacts: ['workspace-context.json', 'source-profiles.json', 'workspace-relationships.json', 'suggested-questions.json'],
    capabilities: {
      hasExcel: false, hasWorkbookProfile: false, hasNormalizedObservations: false,
      hasDfd: false, hasGraph: false, hasFindings: false, hasEval: false,
      hasSourceProfiles: true, hasWorkspaceContext: true, hasSourceRelationships: true,
      hasReport: false, hasPdf: false,
    },
  }));
}

function cleanup(): void {
  try {
    rmSync(resolve(TEST_DATA_ROOT, WS_ID), { recursive: true, force: true });
  } catch {
    // ignore
  }
}

describe('getSourceRelationshipMap', () => {
  beforeEach(setupWorkspace);
  afterEach(cleanup);

  it('reads workspace-relationships.json, NOT relationship-graph.json', async () => {
    const { getSourceRelationshipMap } = await import('../tools/get-source-relationship-map.js');
    const relationships = {
      workspaceId: WS_ID,
      generatedAt: new Date().toISOString(),
      relationships: [{ sourceA: 'a.md', sourceB: 'b.md', type: 'shared_topic', confidence: 0.8, evidence: ['test'] }],
    };
    writeFileSync(resolve(OUTPUT_DIR, 'workspace-relationships.json'), JSON.stringify(relationships));

    // Should NOT read relationship-graph.json
    writeFileSync(resolve(OUTPUT_DIR, 'relationship-graph.json'), JSON.stringify({ nodes: [], edges: [] }));

    const result = await getSourceRelationshipMap.execute({ workspaceId: WS_ID }, makeContext());
    expect(result.relationships).toHaveLength(1);
    expect(result.relationships[0]!.type).toBe('shared_topic');
  });
});

describe('getSuggestedQuestions', () => {
  beforeEach(setupWorkspace);
  afterEach(cleanup);

  it('reads suggested-questions.json when present', async () => {
    const { getSuggestedQuestions } = await import('../tools/get-suggested-questions.js');
    const questions = ['What is this about?', 'What are the key entities?'];
    writeFileSync(resolve(OUTPUT_DIR, 'suggested-questions.json'), JSON.stringify(questions));

    const result = await getSuggestedQuestions.execute({ workspaceId: WS_ID }, makeContext());
    expect(result).toEqual(questions);
  });

  it('falls back to workspace-context.json when suggested-questions.json is absent', async () => {
    const { getSuggestedQuestions } = await import('../tools/get-suggested-questions.js');
    // workspace-context.json already written by setupWorkspace
    writeFileSync(resolve(OUTPUT_DIR, 'workspace-context.json'), JSON.stringify({
      workspaceId: WS_ID,
      generatedAt: new Date().toISOString(),
      primaryTheme: 'Test',
      sourceKindCounts: {},
      keyTopics: [],
      keyEntities: [],
      detectedCapabilities: {},
      recommendedActions: [
        { action: 'Explore the architecture', reason: 'has docs', capability: 'qa' },
        { action: 'Check relationships', reason: 'multiple sources', capability: 'context' },
      ],
      irrelevantSources: [],
      assumptions: [],
    }));

    const result = await getSuggestedQuestions.execute({ workspaceId: WS_ID }, makeContext());
    expect(result).toEqual(['Explore the architecture', 'Check relationships']);
  });

  it('returns empty array when no artifacts exist', async () => {
    const { getSuggestedQuestions } = await import('../tools/get-suggested-questions.js');
    // Remove workspace-context.json
    try { rmSync(resolve(OUTPUT_DIR, 'workspace-context.json')); } catch { /* ignore */ }
    const result = await getSuggestedQuestions.execute({ workspaceId: WS_ID }, makeContext());
    expect(result).toEqual([]);
  });
});

describe('askWorkspaceQuestion', () => {
  beforeEach(() => {
    setupWorkspace();
    writeFileSync(resolve(OUTPUT_DIR, 'workspace-context.json'), JSON.stringify({
      workspaceId: WS_ID,
      generatedAt: new Date().toISOString(),
      primaryTheme: 'Test workspace',
      sourceKindCounts: { document: 1 },
      keyTopics: ['testing'],
      keyEntities: ['Test Entity'],
      detectedCapabilities: {
        hasDocuments: true, hasWorkbooks: false, hasTables: false,
        canCalculate: false, canChart: false, canGenerateDFD: false,
        canAnswerQuestions: true, hasIrrelevantSources: false,
      },
      recommendedActions: [],
      irrelevantSources: [],
      assumptions: [],
    }));
  });
  afterEach(cleanup);

  it('deterministic "about" question does NOT require a model', async () => {
    const { askWorkspaceQuestion } = await import('../tools/ask-workspace-question.js');

    // No modelFactory provided — should still work for deterministic intents
    const result = await askWorkspaceQuestion.execute(
      { workspaceId: WS_ID, question: 'What is this workspace about?' },
      makeContext(),
    );
    expect(result).toBeDefined();
    expect(result.intent).toBe('about');
    expect(result.answer).toBeTruthy();
    // No model was invoked — if it tried, it would throw since no factory provided
  });

  it('validates question length via schema', async () => {
    const { askWorkspaceQuestion } = await import('../tools/ask-workspace-question.js');
    const longQuestion = 'a'.repeat(501);
    const parsed = askWorkspaceQuestion.inputSchema.safeParse({
      workspaceId: WS_ID,
      question: longQuestion,
    });
    expect(parsed.success).toBe(false);
  });
});

describe('artifact-write tools', () => {
  beforeEach(setupWorkspace);
  afterEach(cleanup);

  it('generateMarkdownReport writes only workspace-report.md', async () => {
    const { generateMarkdownReport } = await import('../tools/generate-markdown-report.js');

    // Write source-profiles.json so the report generator can work
    writeFileSync(resolve(OUTPUT_DIR, 'source-profiles.json'), JSON.stringify([]));

    const result = await generateMarkdownReport.execute({ workspaceId: WS_ID }, makeContext());
    expect(result.path).toBe('workspace-report.md');
    expect(existsSync(resolve(OUTPUT_DIR, 'workspace-report.md'))).toBe(true);
  });

  it('generateMarkdownReport has allowedWrites: ["workspace-report.md"]', async () => {
    const { generateMarkdownReport } = await import('../tools/generate-markdown-report.js');
    expect(generateMarkdownReport.allowedWrites).toEqual(['workspace-report.md']);
  });

  it('generatePdfReport has allowedWrites: ["workspace-report.pdf"]', async () => {
    const { generatePdfReport } = await import('../tools/generate-pdf-report.js');
    expect(generatePdfReport.allowedWrites).toEqual(['workspace-report.pdf']);
  });

  it('runCalculation has allowedWrites: ["calculation-results.json"]', async () => {
    const { runCalculation } = await import('../tools/run-calculation.js');
    expect(runCalculation.allowedWrites).toEqual(['calculation-results.json']);
  });

  it('generatePdfReport requires existing markdown report', async () => {
    const { generatePdfReport } = await import('../tools/generate-pdf-report.js');
    // No markdown report exists
    await expect(
      generatePdfReport.execute({ workspaceId: WS_ID }, makeContext()),
    ).rejects.toThrow('Generate the Markdown report first');
  });
});
