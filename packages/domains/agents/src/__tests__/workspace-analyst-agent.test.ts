import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

// ── Test data setup ─────────────────────────────────────────────────

const TEST_DATA_ROOT = resolve(process.cwd(), 'data', 'workspaces');
const WS_ID = 'ws_900000000099';
const OUTPUT_DIR = resolve(TEST_DATA_ROOT, WS_ID, 'output');
const SOURCES_DIR = resolve(TEST_DATA_ROOT, WS_ID, 'sources');

function hash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

const SOURCE_CONTENT = 'agent test source';
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
      artifacts: ['workspace-context.json', 'source-profiles.json', 'suggested-questions.json'],
      capabilities: {
        hasExcel: false, hasWorkbookProfile: false, hasNormalizedObservations: false,
        hasDfd: false, hasGraph: false, hasFindings: false, hasEval: false,
        hasSourceProfiles: true, hasWorkspaceContext: true, hasSourceRelationships: true,
        hasReport: false, hasPdf: false,
      },
    };
    writeFileSync(resolve(OUTPUT_DIR, 'analysis-manifest.json'), JSON.stringify(manifest));
  }

  writeFileSync(resolve(OUTPUT_DIR, 'workspace-context.json'), JSON.stringify({
    workspaceId: WS_ID,
    generatedAt: new Date().toISOString(),
    primaryTheme: 'Checkout system architecture',
    sourceKindCounts: { document: 3 },
    keyTopics: ['payments', 'orders', 'users'],
    keyEntities: ['PaymentService', 'OrderManager'],
    detectedCapabilities: {
      hasDocuments: true, hasWorkbooks: false, hasTables: false,
      canCalculate: false, canChart: false, canGenerateDFD: false,
      canAnswerQuestions: true, hasIrrelevantSources: false,
    },
    recommendedActions: [
      { action: 'How does the payment flow work?', reason: 'core topic', capability: 'qa' },
    ],
    irrelevantSources: [],
    assumptions: [],
  }));

  writeFileSync(resolve(OUTPUT_DIR, 'source-profiles.json'), JSON.stringify([
    {
      sourceId: 'src_1',
      fileName: 'api-spec.md',
      fileType: 'markdown',
      sourceKind: 'document',
      summary: 'API specification',
      detectedTopics: ['payments', 'REST'],
      detectedEntities: ['PaymentService'],
      relevanceScore: 0.9,
      warnings: [],
    },
    {
      sourceId: 'src_2',
      fileName: 'readme.md',
      fileType: 'markdown',
      sourceKind: 'document',
      summary: 'Project README',
      detectedTopics: ['overview'],
      detectedEntities: [],
      relevanceScore: 0.6,
      warnings: [],
    },
  ]));

  writeFileSync(resolve(OUTPUT_DIR, 'suggested-questions.json'), JSON.stringify([
    'How does the payment flow work?',
    'What are the external integrations?',
    'Are there any conflicting requirements?',
  ]));
}

function cleanup(): void {
  try {
    rmSync(resolve(TEST_DATA_ROOT, WS_ID), { recursive: true, force: true });
  } catch {
    // ignore
  }
}

// ── Tests ───────────────────────────────────────────────────────────

describe('WorkspaceAnalystAgent', () => {
  let WorkspaceAnalystAgent: Awaited<typeof import('../workspace-analyst-agent.js')>['WorkspaceAnalystAgent'];
  let routeGoal: Awaited<typeof import('../goal-router.js')>['routeGoal'];
  let toolRegistry: Awaited<typeof import('@contextos/tools')>['toolRegistry'];

  beforeEach(async () => {
    const agentMod = await import('../workspace-analyst-agent.js');
    const routerMod = await import('../goal-router.js');
    const toolsMod = await import('@contextos/tools');
    WorkspaceAnalystAgent = agentMod.WorkspaceAnalystAgent;
    routeGoal = routerMod.routeGoal;
    toolRegistry = toolsMod.toolRegistry;
    setupWorkspace();
  });

  afterEach(() => {
    cleanup();
  });

  // ── Goal routing tests ──────────────────────────────────────────

  describe('Goal Router', () => {
    it('routes workspace overview goal', () => {
      expect(routeGoal('Give me an overview of this workspace')).toBe('workspace_overview');
      expect(routeGoal('summarize the workspace')).toBe('workspace_overview');
    });

    it('routes next-actions goal', () => {
      expect(routeGoal('What should I do next?')).toBe('next_actions');
      expect(routeGoal('suggest next steps')).toBe('next_actions');
    });

    it('routes report-generation goal', () => {
      expect(routeGoal('Generate a report')).toBe('report_generation');
      expect(routeGoal('create a markdown report')).toBe('report_generation');
    });

    it('routes readiness-check goal', () => {
      expect(routeGoal('Is the analysis ready?')).toBe('readiness_check');
      expect(routeGoal('check analysis state')).toBe('readiness_check');
    });

    it('routes source-importance goal', () => {
      expect(routeGoal('Which sources are most important?')).toBe('source_importance');
      expect(routeGoal('rank source relevance')).toBe('source_importance');
    });

    it('returns unknown for unrecognized goals', () => {
      expect(routeGoal('play me a song')).toBe('unknown');
      expect(routeGoal('')).toBe('unknown');
    });
  });

  // ── Agent workflow tests ────────────────────────────────────────

  describe('Workflows', () => {
    it('workspace overview returns theme, topics, and source count', async () => {
      const agent = new WorkspaceAnalystAgent(toolRegistry);
      const result = await agent.run({ workspaceId: WS_ID, goal: 'Give me an overview' });

      expect(result.goal).toBe('workspace_overview');
      expect(result.answer).toContain('Checkout system architecture');
      expect(result.answer).toContain('payments');
      expect(result.answer).toContain('2 total');
      expect(result.warnings).toHaveLength(0);
    });

    it('next actions returns suggested questions', async () => {
      const agent = new WorkspaceAnalystAgent(toolRegistry);
      const result = await agent.run({ workspaceId: WS_ID, goal: 'What should I do next?' });

      expect(result.goal).toBe('next_actions');
      expect(result.answer).toContain('payment flow');
      expect(result.answer).toContain('external integrations');
    });

    it('stale analysis stops early', async () => {
      cleanup();
      setupWorkspace({ stale: true });

      const agent = new WorkspaceAnalystAgent(toolRegistry);
      const result = await agent.run({ workspaceId: WS_ID, goal: 'Give me an overview' });

      expect(result.goal).toBe('workspace_overview');
      expect(result.answer).toContain('stale');
      expect(result.warnings).toContain('Analysis state: stale');
      // Only checkAnalysisState should have been called
      expect(result.toolTrace).toHaveLength(1);
      expect(result.toolTrace[0]!.toolId).toBe('checkAnalysisState');
    });

    it('report generation blocked when allowWrites=false', async () => {
      const agent = new WorkspaceAnalystAgent(toolRegistry);
      const result = await agent.run({ workspaceId: WS_ID, goal: 'Generate a report', allowWrites: false });

      expect(result.goal).toBe('report_generation');
      expect(result.answer).toContain('write permission');
      expect(result.warnings).toContain('Report generation was blocked because allowWrites=false.');
      // Should have a skipped trace entry
      const skipped = result.toolTrace.find((t) => t.toolId === 'generateMarkdownReport');
      expect(skipped).toBeDefined();
      expect(skipped!.status).toBe('skipped');
    });

    it('report generation allowed when allowWrites=true', async () => {
      const agent = new WorkspaceAnalystAgent(toolRegistry);
      const result = await agent.run({ workspaceId: WS_ID, goal: 'Generate a report', allowWrites: true });

      expect(result.goal).toBe('report_generation');
      expect(result.answer).toContain('workspace-report.md');
      const reportTrace = result.toolTrace.find((t) => t.toolId === 'generateMarkdownReport');
      expect(reportTrace).toBeDefined();
      expect(reportTrace!.status).toBe('success');
    });

    it('tool trace records success/failure/skipped', async () => {
      const agent = new WorkspaceAnalystAgent(toolRegistry);

      // Success case — workspace overview
      const successResult = await agent.run({ workspaceId: WS_ID, goal: 'overview' });
      expect(successResult.toolTrace.length).toBeGreaterThan(0);
      expect(successResult.toolTrace.every((t) => t.status === 'success')).toBe(true);
      expect(successResult.toolTrace.every((t) => t.durationMs >= 0)).toBe(true);

      // Skipped case — report without writes
      const skipResult = await agent.run({ workspaceId: WS_ID, goal: 'generate report', allowWrites: false });
      const skipped = skipResult.toolTrace.find((t) => t.status === 'skipped');
      expect(skipped).toBeDefined();
      expect(skipped!.skippedReason).toBeDefined();

      // Failure case — nonexistent workspace
      cleanup();
      setupWorkspace({ noManifest: true });
      const failResult = await agent.run({ workspaceId: WS_ID, goal: 'overview' });
      // checkAnalysisState returns { state: 'none' } when no manifest, triggering early stop
      expect(failResult.answer).toContain('No analysis');
    });

    it('unknown goal returns useful fallback', async () => {
      const agent = new WorkspaceAnalystAgent(toolRegistry);
      const result = await agent.run({ workspaceId: WS_ID, goal: 'play me a song' });

      expect(result.goal).toBe('unknown');
      expect(result.answer).toContain("couldn't determine");
      expect(result.answer).toContain('overview');
      expect(result.answer).toContain('report');
    });

    it('agent only calls registered tools', async () => {
      const agent = new WorkspaceAnalystAgent(toolRegistry);
      const registeredToolIds = new Set(toolRegistry.listTools().map((t) => t.id));

      // Run all workflow types and verify traced tools are registered
      const goals = ['overview', 'next steps', 'generate report', 'readiness check', 'most important source'];
      for (const goal of goals) {
        const result = await agent.run({ workspaceId: WS_ID, goal, allowWrites: true });
        for (const trace of result.toolTrace) {
          expect(registeredToolIds.has(trace.toolId)).toBe(true);
        }
      }
    });
  });
});
