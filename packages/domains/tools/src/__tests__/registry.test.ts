import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

// We need to control cwd so workspace-paths resolves correctly
const TEST_DATA_ROOT = resolve(process.cwd(), 'data', 'workspaces');
const WS_ID = 'ws_900000000001';
const OUTPUT_DIR = resolve(TEST_DATA_ROOT, WS_ID, 'output');
const SOURCES_DIR = resolve(TEST_DATA_ROOT, WS_ID, 'sources');

function hash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

const SOURCE_CONTENT = 'hello world';
const SOURCE_HASH = hash(SOURCE_CONTENT);

function setupWorkspace(opts: { stale?: boolean; noManifest?: boolean } = {}): void {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  mkdirSync(SOURCES_DIR, { recursive: true });
  writeFileSync(resolve(SOURCES_DIR, 'test.md'), SOURCE_CONTENT);

  if (!opts.noManifest) {
    const manifest = {
      workspaceId: WS_ID,
      runId: 'run_1',
      generatedAt: new Date().toISOString(),
      sourceFiles: [
        { fileName: 'test.md', fileType: 'markdown', hash: opts.stale ? 'oldhash' : SOURCE_HASH, size: SOURCE_CONTENT.length },
      ],
      artifacts: ['workspace-context.json'],
      capabilities: {
        hasExcel: false, hasWorkbookProfile: false, hasNormalizedObservations: false,
        hasDfd: false, hasGraph: false, hasFindings: false, hasEval: false,
        hasSourceProfiles: true, hasWorkspaceContext: true, hasSourceRelationships: true,
        hasReport: false, hasPdf: false,
      },
    };
    writeFileSync(resolve(OUTPUT_DIR, 'analysis-manifest.json'), JSON.stringify(manifest));
  }

  // Write workspace-context.json for read tests
  writeFileSync(resolve(OUTPUT_DIR, 'workspace-context.json'), JSON.stringify({
    workspaceId: WS_ID,
    generatedAt: new Date().toISOString(),
    primaryTheme: 'Test workspace',
    sourceKindCounts: {},
    keyTopics: ['testing'],
    keyEntities: [],
    detectedCapabilities: {
      hasDocuments: true, hasWorkbooks: false, hasTables: false,
      canCalculate: false, canChart: false, canGenerateDFD: false,
      canAnswerQuestions: true, hasIrrelevantSources: false,
    },
    recommendedActions: [{ action: 'What is this about?', reason: 'overview', capability: 'qa' }],
    irrelevantSources: [],
    assumptions: [],
  }));
}

function cleanup(): void {
  try {
    rmSync(resolve(TEST_DATA_ROOT, WS_ID), { recursive: true, force: true });
  } catch {
    // ignore
  }
}

describe('ToolRegistry', () => {
  // We import dynamically so tools register against test environment
  let toolRegistry: Awaited<typeof import('../registry.js')>['toolRegistry'];
  let ToolNotFoundError: Awaited<typeof import('../errors.js')>['ToolNotFoundError'];
  let ToolInputValidationError: Awaited<typeof import('../errors.js')>['ToolInputValidationError'];
  let StaleAnalysisError: Awaited<typeof import('../errors.js')>['StaleAnalysisError'];

  beforeEach(async () => {
    const reg = await import('../registry.js');
    const errs = await import('../errors.js');
    const { registerAllTools } = await import('../register-all.js');
    toolRegistry = reg.toolRegistry;
    ToolNotFoundError = errs.ToolNotFoundError;
    ToolInputValidationError = errs.ToolInputValidationError;
    StaleAnalysisError = errs.StaleAnalysisError;
    registerAllTools();
  });

  afterEach(() => {
    cleanup();
  });

  it('lists all 11 expected tools', () => {
    const tools = toolRegistry.listTools();
    expect(tools).toHaveLength(11);
    const ids = tools.map((t) => t.id).sort();
    expect(ids).toEqual([
      'askWorkspaceQuestion',
      'checkAnalysisState',
      'generateMarkdownReport',
      'generatePdfReport',
      'getNormalizedObservations',
      'getSourceProfiles',
      'getSourceRelationshipMap',
      'getSuggestedQuestions',
      'getWorkbookProfile',
      'getWorkspaceContext',
      'runCalculation',
    ]);
  });

  it('getTool returns undefined for unknown tool', () => {
    expect(toolRegistry.getTool('unknown')).toBeUndefined();
  });

  it('executeTool throws ToolNotFoundError for unknown tool', async () => {
    await expect(toolRegistry.executeTool('unknown', {})).rejects.toThrow(ToolNotFoundError);
  });

  it('executeTool throws ToolInputValidationError for missing workspaceId', async () => {
    await expect(toolRegistry.executeTool('getWorkspaceContext', {})).rejects.toThrow(ToolInputValidationError);
  });

  it('executeTool throws StaleAnalysisError for stale analysis on tools requiring current analysis', async () => {
    setupWorkspace({ stale: true });
    await expect(
      toolRegistry.executeTool('getWorkspaceContext', { workspaceId: WS_ID }),
    ).rejects.toThrow(StaleAnalysisError);
  });

  it('checkAnalysisState works with no analysis (returns state: none)', async () => {
    setupWorkspace({ noManifest: true });
    const result = await toolRegistry.executeTool('checkAnalysisState', { workspaceId: WS_ID }) as { state: string };
    expect(result.state).toBe('none');
  });

  it('stale analysis blocks getWorkspaceContext but NOT checkAnalysisState', async () => {
    setupWorkspace({ stale: true });

    // checkAnalysisState should work (requiresCurrentAnalysis: false)
    const state = await toolRegistry.executeTool('checkAnalysisState', { workspaceId: WS_ID }) as { state: string };
    expect(state.state).toBe('stale');

    // getWorkspaceContext should fail (requiresCurrentAnalysis: true)
    await expect(
      toolRegistry.executeTool('getWorkspaceContext', { workspaceId: WS_ID }),
    ).rejects.toThrow(StaleAnalysisError);
  });

  it('read-only tools return data without writing new files', async () => {
    setupWorkspace();
    const { readdirSync } = await import('node:fs');
    const filesBefore = readdirSync(OUTPUT_DIR).sort();
    const result = await toolRegistry.executeTool('getWorkspaceContext', { workspaceId: WS_ID });
    const filesAfter = readdirSync(OUTPUT_DIR).sort();
    expect(result).toBeDefined();
    expect((result as { primaryTheme: string }).primaryTheme).toBe('Test workspace');
    expect(filesAfter).toEqual(filesBefore);
  });

  it('listTools returns descriptors without execute function or schemas', () => {
    const tools = toolRegistry.listTools();
    for (const t of tools) {
      expect(t).not.toHaveProperty('execute');
      expect(t).not.toHaveProperty('inputSchema');
      expect(t).not.toHaveProperty('outputSchema');
      expect(t).toHaveProperty('id');
      expect(t).toHaveProperty('safetyLevel');
    }
  });
});
