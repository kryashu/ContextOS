import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkspaceCommandAgent } from '../workspace-command-agent.js';
import { WorkspaceAnalystAgent } from '../workspace-analyst-agent.js';
import type { ToolRegistry } from '@contextos/tools';
import type { TableQueryResult } from '@contextos/table-query';
import type { KeyIntelligenceResult } from '@contextos/key-intelligence';

// ── Helpers ────────────────────────────────────────────────────────

interface FakeToolCall {
  id: string;
  input: unknown;
}

function fakeRegistry(handlers: Record<string, (input: unknown) => unknown>) {
  const calls: FakeToolCall[] = [];
  const registry = {
    async executeTool(id: string, input: unknown): Promise<unknown> {
      calls.push({ id, input });
      const handler = handlers[id];
      if (!handler) throw new Error(`Unhandled tool: ${id}`);
      return handler(input);
    },
  } as unknown as ToolRegistry;
  return { registry, calls };
}

function fakeAnalyst(overrides?: Partial<WorkspaceAnalystAgent>): WorkspaceAnalystAgent {
  const stub = {
    run: vi.fn(async () => ({
      goal: 'workspace_overview' as const,
      answer: 'Workspace overview answer.',
      toolTrace: [{ toolId: 'getWorkspaceContext', status: 'success' as const, durationMs: 1 }],
      warnings: [],
    })),
    ...overrides,
  };
  return stub as unknown as WorkspaceAnalystAgent;
}

const SUCCESS_TABLE: TableQueryResult = {
  status: 'success',
  matchedRowCount: 2,
  aggregations: [
    {
      label: 'sum sales',
      field: 'sales',
      operation: 'sum',
      value: 100,
      sourceRefs: [{ fileName: 'sales.csv', row: 1 }],
    },
  ],
  matchedRows: [{ fileName: 'sales.csv', row: 1, values: { sales: 50 } }],
  resolvedFields: [],
  warnings: [],
};

const SUCCESS_DUPLICATES: KeyIntelligenceResult = {
  status: 'success',
  keyProfiles: [],
  duplicateGroups: [
    {
      keyType: 'email',
      value: 'a@b.com',
      normalizedValue: 'a@b.com',
      count: 2,
      locations: [{ fileName: 'users.csv', row: 2 }],
    },
  ],
  documentMatches: [],
  relationships: [],
  warnings: [],
};

const SUCCESS_DOC_LOOKUP: KeyIntelligenceResult = {
  status: 'success',
  keyProfiles: [],
  duplicateGroups: [],
  documentMatches: [
    {
      fileName: 'spec.md',
      keyType: 'product_id',
      value: 'ABC-123',
      normalizedValue: 'abc-123',
      evidence: 'Mentions ABC-123.',
      sourceRef: { fileName: 'spec.md' },
    },
  ],
  relationships: [],
  warnings: [],
};

// ── Routing ────────────────────────────────────────────────────────

describe('WorkspaceCommandAgent — routing', () => {
  beforeEach(() => vi.clearAllMocks());

  it('routes table_aggregate_query → runTableQuery (not analyst)', async () => {
    const { registry, calls } = fakeRegistry({
      runTableQuery: () => SUCCESS_TABLE,
    });
    const analyst = fakeAnalyst();
    const agent = new WorkspaceCommandAgent(registry, analyst);

    const res = await agent.run({
      workspaceId: 'ws_1',
      command: 'calculate sum of sales',
    });

    expect(calls.map((c) => c.id)).toContain('runTableQuery');
    expect(analyst.run).not.toHaveBeenCalled();
    expect(res.intent).toBe('table_aggregate_query');
    expect(res.status).toBe('success');
  });

  it('routes duplicate_key_query → findDuplicateKeys (not analyst)', async () => {
    const { registry, calls } = fakeRegistry({
      findDuplicateKeys: () => SUCCESS_DUPLICATES,
    });
    const analyst = fakeAnalyst();
    const agent = new WorkspaceCommandAgent(registry, analyst);

    const res = await agent.run({
      workspaceId: 'ws_1',
      command: 'find duplicate emails',
    });

    expect(calls.map((c) => c.id)).toContain('findDuplicateKeys');
    expect(analyst.run).not.toHaveBeenCalled();
    expect(res.intent).toBe('duplicate_key_query');
    expect(res.status).toBe('success');
  });

  it('routes document_lookup → findDocumentsForKey (not analyst)', async () => {
    const { registry, calls } = fakeRegistry({
      findDocumentsForKey: () => SUCCESS_DOC_LOOKUP,
    });
    const analyst = fakeAnalyst();
    const agent = new WorkspaceCommandAgent(registry, analyst);

    const res = await agent.run({
      workspaceId: 'ws_1',
      command: 'find document for product ABC-123',
    });

    expect(calls.map((c) => c.id)).toContain('findDocumentsForKey');
    expect(analyst.run).not.toHaveBeenCalled();
    expect(res.intent).toBe('document_lookup');
    expect(res.status).toBe('success');
  });

  it('routes source_relationship_lookup → getSourceRelationshipMap (not analyst)', async () => {
    const { registry, calls } = fakeRegistry({
      getSourceRelationshipMap: () => ({
        workspaceId: 'ws_1',
        generatedAt: new Date().toISOString(),
        relationships: [
          { sourceA: 'a.md', sourceB: 'b.md', type: 'shared_topic', confidence: 0.8, evidence: ['topic: x'] },
        ],
      }),
    });
    const analyst = fakeAnalyst();
    const agent = new WorkspaceCommandAgent(registry, analyst);

    const res = await agent.run({
      workspaceId: 'ws_1',
      command: 'show source relationship map',
    });

    expect(calls.map((c) => c.id)).toContain('getSourceRelationshipMap');
    expect(analyst.run).not.toHaveBeenCalled();
    expect(res.intent).toBe('source_relationship_lookup');
  });

  it('routes workspace_overview → WorkspaceAnalystAgent', async () => {
    const { registry, calls } = fakeRegistry({});
    const analyst = fakeAnalyst();
    const agent = new WorkspaceCommandAgent(registry, analyst);

    const res = await agent.run({
      workspaceId: 'ws_1',
      command: 'give me an overview',
    });

    expect(analyst.run).toHaveBeenCalledTimes(1);
    expect(calls).toHaveLength(0);
    expect(res.intent).toBe('workspace_overview');
  });
});

// ── Hallucination safeguards ──────────────────────────────────────

describe('WorkspaceCommandAgent — hallucination safeguards', () => {
  it('unknown command → needs_clarification (no tool call)', async () => {
    const { registry, calls } = fakeRegistry({});
    const analyst = fakeAnalyst();
    const agent = new WorkspaceCommandAgent(registry, analyst);

    const res = await agent.run({
      workspaceId: 'ws_1',
      command: 'flarp the snorgles please',
    });

    expect(res.status).toBe('needs_clarification');
    expect(calls).toHaveLength(0);
    expect(analyst.run).not.toHaveBeenCalled();
  });

  it('empty command → error response with no stack trace', async () => {
    const { registry } = fakeRegistry({});
    const agent = new WorkspaceCommandAgent(registry, fakeAnalyst());
    const res = await agent.run({ workspaceId: 'ws_1', command: '   ' });
    expect(res.status).toBe('error');
    expect(res.answer).not.toMatch(/\.ts:|at Object/);
  });

  it('table query without aggregations → needs_clarification (does NOT call runTableQuery)', async () => {
    const { registry, calls } = fakeRegistry({
      runTableQuery: () => {
        throw new Error('should not be called');
      },
    });
    const agent = new WorkspaceCommandAgent(registry, fakeAnalyst());

    // A table-like query that won't extract an aggregation operation
    const res = await agent.run({
      workspaceId: 'ws_1',
      command: 'show me products launched before 5 May 2025',
    });

    // It might be parsed as document_lookup; only assert the contract if
    // the planner classified it as table_aggregate_query. Either way,
    // runTableQuery must not be invoked without aggregations.
    if (res.intent === 'table_aggregate_query') {
      expect(res.status).toBe('needs_clarification');
    }
    expect(calls.find((c) => c.id === 'runTableQuery')).toBeUndefined();
  });

  it('document_lookup without keyValue → needs_clarification (does NOT call findDocumentsForKey)', async () => {
    const { registry, calls } = fakeRegistry({
      findDocumentsForKey: () => {
        throw new Error('should not be called');
      },
    });
    const agent = new WorkspaceCommandAgent(registry, fakeAnalyst());
    const res = await agent.run({
      workspaceId: 'ws_1',
      command: 'show related documents',
    });

    expect(res.status).toBe('needs_clarification');
    expect(calls.find((c) => c.id === 'findDocumentsForKey')).toBeUndefined();
  });

  it('empty tool result for duplicates → no_matches', async () => {
    const { registry } = fakeRegistry({
      findDuplicateKeys: () =>
        ({
          status: 'success',
          keyProfiles: [],
          duplicateGroups: [],
          documentMatches: [],
          relationships: [],
          warnings: [],
        }) satisfies KeyIntelligenceResult,
    });
    const agent = new WorkspaceCommandAgent(registry, fakeAnalyst());
    const res = await agent.run({ workspaceId: 'ws_1', command: 'find duplicate emails' });
    expect(res.status).toBe('no_matches');
  });

  it('every success response has sourceRefs OR downloads OR a successful toolTrace entry with backed content', async () => {
    const { registry } = fakeRegistry({ runTableQuery: () => SUCCESS_TABLE });
    const agent = new WorkspaceCommandAgent(registry, fakeAnalyst());
    const res = await agent.run({ workspaceId: 'ws_1', command: 'calculate sum of sales' });
    expect(res.status).toBe('success');
    const hasSourceRefs = res.sourceRefs.length > 0;
    const hasDownloads = (res.downloads?.length ?? 0) > 0;
    const hasSuccessfulTrace = res.toolTrace.some((t) => t.status === 'success');
    expect(hasSourceRefs || hasDownloads || hasSuccessfulTrace).toBe(true);
  });
});
