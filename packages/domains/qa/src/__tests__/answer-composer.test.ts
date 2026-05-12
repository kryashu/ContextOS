import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { FakeListChatModel } from '@langchain/core/utils/testing';
import { WorkspaceAnswerComposer } from '../answer-composer.js';
import { LocalRetriever } from '../local-retriever.js';

function setupDirs() {
  const base = resolve(tmpdir(), `contextos-qa-compose-${Date.now()}`);
  const outputDir = resolve(base, 'output');
  const sourcesDir = resolve(base, 'sources');
  mkdirSync(outputDir, { recursive: true });
  mkdirSync(sourcesDir, { recursive: true });
  return { base, outputDir, sourcesDir };
}

describe('WorkspaceAnswerComposer', () => {
  let base: string;
  let outputDir: string;
  let sourcesDir: string;

  beforeEach(() => {
    ({ base, outputDir, sourcesDir } = setupDirs());
  });

  afterEach(() => {
    rmSync(base, { recursive: true, force: true });
  });

  it('answers "about" from workspace-context.json (no LLM)', async () => {
    writeFileSync(
      resolve(outputDir, 'workspace-context.json'),
      JSON.stringify({
        workspaceId: 'test',
        generatedAt: new Date().toISOString(),
        primaryTheme: 'A clinical trial dataset.',
        sourceKindCounts: {},
        keyTopics: ['clinical trial'],
        keyEntities: [],
        detectedCapabilities: { hasDocuments: true, hasWorkbooks: true, hasTables: false, canCalculate: false, canChart: false, canGenerateDFD: false, canAnswerQuestions: false, hasIrrelevantSources: false },
        recommendedActions: [],
        irrelevantSources: [],
        assumptions: [],
      }),
    );

    const retriever = new LocalRetriever(outputDir, sourcesDir);
    const composer = new WorkspaceAnswerComposer(retriever);
    const result = await composer.answer('What is this workspace about?');

    expect(result.intent).toBe('about');
    expect(result.answer).toContain('clinical trial');
    expect(result.sourceRefs.length).toBeGreaterThanOrEqual(1);
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('answers "irrelevant_files" listing flagged files', async () => {
    writeFileSync(
      resolve(outputDir, 'workspace-context.json'),
      JSON.stringify({
        workspaceId: 'test',
        generatedAt: new Date().toISOString(),
        primaryTheme: 'Test',
        sourceKindCounts: {},
        keyTopics: [],
        keyEntities: [],
        detectedCapabilities: { hasDocuments: false, hasWorkbooks: false, hasTables: false, canCalculate: false, canChart: false, canGenerateDFD: false, canAnswerQuestions: false, hasIrrelevantSources: true },
        recommendedActions: [],
        irrelevantSources: [{ fileName: 'junk.txt', reason: 'Not relevant' }],
        assumptions: [],
      }),
    );

    const retriever = new LocalRetriever(outputDir, sourcesDir);
    const composer = new WorkspaceAnswerComposer(retriever);
    const result = await composer.answer('Which files are irrelevant?');

    expect(result.intent).toBe('irrelevant_files');
    expect(result.answer).toContain('junk.txt');
    expect(result.sourceRefs.length).toBeGreaterThanOrEqual(1);
  });

  it('answers "capabilities" from context + observations', async () => {
    writeFileSync(
      resolve(outputDir, 'workspace-context.json'),
      JSON.stringify({
        workspaceId: 'test',
        generatedAt: new Date().toISOString(),
        primaryTheme: 'Test',
        sourceKindCounts: {},
        keyTopics: [],
        keyEntities: [],
        detectedCapabilities: { hasDocuments: false, hasWorkbooks: true, hasTables: true, canCalculate: true, canChart: false, canGenerateDFD: false, canAnswerQuestions: false, hasIrrelevantSources: false },
        recommendedActions: [{ action: 'Run table calculation', reason: 'Data available', capability: 'calculate' }],
        irrelevantSources: [],
        assumptions: [],
      }),
    );
    writeFileSync(
      resolve(outputDir, 'normalized-observations.json'),
      JSON.stringify([{ id: 1, value: 42 }]),
    );

    const retriever = new LocalRetriever(outputDir, sourcesDir);
    const composer = new WorkspaceAnswerComposer(retriever);
    const result = await composer.answer('What calculations are possible?');

    expect(result.intent).toBe('capabilities');
    expect(result.sourceRefs.length).toBeGreaterThanOrEqual(1);
    expect(result.answer).toContain('observation');
  });

  it('answers "sheet_query" from workbook profile', async () => {
    writeFileSync(
      resolve(outputDir, 'workbook-profile.json'),
      JSON.stringify({
        sheets: [
          { name: 'Revenue', rowCount: 100 },
          { name: 'Costs', rowCount: 50 },
        ],
      }),
    );

    const retriever = new LocalRetriever(outputDir, sourcesDir);
    const composer = new WorkspaceAnswerComposer(retriever);
    const result = await composer.answer('Which sheets are available?');

    expect(result.intent).toBe('sheet_query');
    expect(result.answer).toContain('Revenue');
    expect(result.answer).toContain('Costs');
    expect(result.sourceRefs.length).toBeGreaterThanOrEqual(1);
  });

  it('answers "document_fact" with LLM when snippets found', async () => {
    writeFileSync(
      resolve(sourcesDir, 'protocol.md'),
      'The study enrolled 350 patients in a double-blind randomized controlled trial.',
    );

    const model = new FakeListChatModel({
      responses: ['The study enrolled 350 patients.'],
    });

    const retriever = new LocalRetriever(outputDir, sourcesDir);
    const composer = new WorkspaceAnswerComposer(retriever, model);
    const result = await composer.answer('How many patients were enrolled?');

    expect(result.intent).toBe('document_fact');
    expect(result.answer).toContain('350');
    expect(result.sourceRefs.length).toBeGreaterThanOrEqual(1);
    expect(result.sourceRefs[0]!.fileName).toBe('protocol.md');
  });

  it('returns insufficient-context when no snippets match document_fact', async () => {
    const retriever = new LocalRetriever(outputDir, sourcesDir);
    const composer = new WorkspaceAnswerComposer(retriever);
    const result = await composer.answer('What color is the sky on Mars?');

    expect(result.answer).toContain('could not find enough information');
    expect(result.sourceRefs).toEqual([]);
    expect(result.confidence).toBe(0);
  });

  it('enforces grounding: rejects answer with no sourceRefs', async () => {
    // No artifacts at all
    const retriever = new LocalRetriever(outputDir, sourcesDir);
    const composer = new WorkspaceAnswerComposer(retriever);
    const result = await composer.answer('What is this workspace about?');

    expect(result.answer).toContain('could not find enough information');
    expect(result.sourceRefs).toEqual([]);
    expect(result.confidence).toBe(0);
  });

  it('deterministic "about" answer does NOT call LLM', async () => {
    writeFileSync(
      resolve(outputDir, 'workspace-context.json'),
      JSON.stringify({
        workspaceId: 'test',
        generatedAt: new Date().toISOString(),
        primaryTheme: 'A workspace for testing.',
        sourceKindCounts: {},
        keyTopics: ['testing'],
        keyEntities: [],
        detectedCapabilities: { hasDocuments: false, hasWorkbooks: false, hasTables: false, canCalculate: false, canChart: false, canGenerateDFD: false, canAnswerQuestions: false, hasIrrelevantSources: false },
        recommendedActions: [],
        irrelevantSources: [],
        assumptions: [],
      }),
    );

    // Model that throws if invoked
    const throwingModel = new FakeListChatModel({ responses: [] });
    throwingModel.invoke = () => {
      throw new Error('LLM should not be called for deterministic intents');
    };

    const retriever = new LocalRetriever(outputDir, sourcesDir);
    const composer = new WorkspaceAnswerComposer(retriever, throwingModel);
    // Should NOT throw
    const result = await composer.answer('Describe this workspace');

    expect(result.intent).toBe('about');
    expect(result.answer).toContain('testing');
  });
});
