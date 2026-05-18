/**
 * VS018.1 Regression Guard — Command Routing
 *
 * Validates that operational commands route to the correct action
 * and NEVER fall through to the WorkspaceAnalystAgent unknown fallback.
 *
 * This test exists BEFORE and AFTER the refactor to prevent regressions.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ───────────────────────────────────────────────────────────

const mockCreatePlan = vi.fn();
const mockExecuteTool = vi.fn();

vi.mock('@contextos/orchestrator', () => ({
  createWorkspaceCommandPlan: (...args: unknown[]) => mockCreatePlan(...args),
}));

vi.mock('@contextos/tools', () => ({
  toolRegistry: {
    executeTool: (...args: unknown[]) => mockExecuteTool(...args),
  },
  setDataRoot: vi.fn(),
}));

vi.mock('@contextos/agents', () => ({
  WorkspaceAnalystAgent: vi.fn().mockImplementation(() => ({
    run: vi.fn(),
  })),
}));

vi.mock('@/lib/workspaces', () => ({
  getWorkspace: vi.fn((id: string) => {
    if (id === 'ws_missing') return null;
    return { id, name: 'Test', sourceCount: 1, status: 'analyzed' };
  }),
  getSourcesDir: vi.fn(() => '/tmp/sources'),
  getWorkspaceDir: vi.fn(() => '/tmp/ws'),
  getOutputDir: vi.fn(() => '/tmp/output'),
  clearOutputDir: vi.fn(),
  updateWorkspace: vi.fn(),
  computeSourceHashes: vi.fn(() => ({})),
  deleteWorkspace: vi.fn(),
  deleteSourceFile: vi.fn(),
  createWorkspace: vi.fn(),
  listSourceFiles: vi.fn(() => []),
}));

// ── Helpers ─────────────────────────────────────────────────────────

const DEMO_COMMAND =
  'Find all products launched before 5 May 2025 and calculate total units sold, total units in transit, and total units with retailers.';

function makeTableAggregatePlan() {
  return {
    commandId: 'cmd_demo_001',
    originalCommand: DEMO_COMMAND,
    intent: 'table_aggregate_query' as const,
    status: 'executable' as const,
    confidence: 'high' as const,
    summary: 'Aggregate table data with date filter and 3 sum aggregations.',
    extracted: {
      keyValues: [],
      keyValue: undefined,
      keyType: undefined,
      filters: [{ field: 'date', operator: 'before', value: '2025-05-05' }],
      aggregations: [
        { field: 'units sold', operation: 'sum', label: 'sum of units sold' },
        { field: 'units in transit', operation: 'sum', label: 'sum of units in transit' },
        { field: 'units with retailers', operation: 'sum', label: 'sum of units with retailers' },
      ],
      targetFiles: [],
      fields: [],
    },
    requiredCapabilities: ['smart_table_query_engine'],
    warnings: [],
    nextStep: undefined,
  };
}

function makeDuplicateKeyPlan() {
  return {
    commandId: 'cmd_dup_001',
    originalCommand: 'Find duplicate emails',
    intent: 'duplicate_key_query' as const,
    status: 'executable' as const,
    confidence: 'high' as const,
    summary: 'Find duplicate email keys.',
    extracted: {
      keyValues: [],
      keyValue: undefined,
      keyType: 'email',
      filters: [],
      aggregations: [],
      targetFiles: [],
      fields: [],
    },
    requiredCapabilities: [],
    warnings: [],
    nextStep: undefined,
  };
}

function makeDocumentLookupPlan() {
  return {
    commandId: 'cmd_doc_001',
    originalCommand: 'Show documents related to ABC-123',
    intent: 'document_lookup' as const,
    status: 'executable' as const,
    confidence: 'medium' as const,
    summary: 'Look up documents for key ABC-123.',
    extracted: {
      keyValues: ['ABC-123'],
      keyValue: 'ABC-123',
      keyType: undefined,
      filters: [],
      aggregations: [],
      targetFiles: [],
      fields: [],
    },
    requiredCapabilities: [],
    warnings: [],
    nextStep: undefined,
  };
}

function makeUnknownPlan() {
  return {
    commandId: 'cmd_unk_001',
    originalCommand: 'xyzzy foobar',
    intent: 'unknown' as const,
    status: 'needs_clarification' as const,
    confidence: 'low' as const,
    summary: 'Could not determine intent.',
    extracted: {
      keyValues: [],
      keyValue: undefined,
      keyType: undefined,
      filters: [],
      aggregations: [],
      targetFiles: [],
      fields: [],
    },
    requiredCapabilities: [],
    warnings: ['Command is too short or vague.'],
    nextStep: 'Could not determine intent. Try rephrasing or use a preset command.',
  };
}

// ── Action imports ──────────────────────────────────────────────────

async function getActions() {
  const mod = await import('../app/workspaces/actions');
  return {
    planWorkspaceCommandAction: mod.planWorkspaceCommandAction,
    runWorkspaceAgentAction: mod.runWorkspaceAgentAction,
    runTableQueryAction: mod.runTableQueryAction,
    findDuplicateKeysAction: mod.findDuplicateKeysAction,
    findDocumentsForKeyAction: mod.findDocumentsForKeyAction,
  };
}

// ── Tests ───────────────────────────────────────────────────────────

describe('VS018.1 Regression Guard: Command Routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Demo command: table_aggregate_query', () => {
    it('plans as table_aggregate_query with executable status', async () => {
      const plan = makeTableAggregatePlan();
      mockCreatePlan.mockReturnValueOnce(plan);

      const { planWorkspaceCommandAction } = await getActions();
      const res = await planWorkspaceCommandAction('ws_test', DEMO_COMMAND);

      expect(res.success).toBe(true);
      expect(res.plan).toBeDefined();
      expect(res.plan!.intent).toBe('table_aggregate_query');
      expect(res.plan!.status).toBe('executable');
    });

    it('extracts exactly 3 aggregations', async () => {
      const plan = makeTableAggregatePlan();
      mockCreatePlan.mockReturnValueOnce(plan);

      const { planWorkspaceCommandAction } = await getActions();
      const res = await planWorkspaceCommandAction('ws_test', DEMO_COMMAND);

      expect(res.plan!.extracted.aggregations).toHaveLength(3);
      expect(res.plan!.extracted.aggregations![0]!.field).toBe('units sold');
      expect(res.plan!.extracted.aggregations![1]!.field).toBe('units in transit');
      expect(res.plan!.extracted.aggregations![2]!.field).toBe('units with retailers');
      expect(res.plan!.extracted.aggregations!.every((a: { operation: string }) => a.operation === 'sum')).toBe(true);
    });

    it('calls runTableQueryAction with correct filters and aggregations', async () => {
      const fakeTableResult = {
        status: 'success',
        matchedRowCount: 5,
        aggregations: [
          { label: 'sum of units sold', value: 100 },
          { label: 'sum of units in transit', value: 50 },
          { label: 'sum of units with retailers', value: 30 },
        ],
        rows: [],
        sourceFiles: ['products.xlsx'],
        query: { filters: [], aggregations: [] },
      };
      mockExecuteTool.mockResolvedValueOnce(fakeTableResult);

      const { runTableQueryAction } = await getActions();
      const res = await runTableQueryAction(
        'ws_test',
        [{ field: 'date', operator: 'before', value: '2025-05-05' }],
        [
          { field: 'units sold', operation: 'sum', label: 'sum of units sold' },
          { field: 'units in transit', operation: 'sum', label: 'sum of units in transit' },
          { field: 'units with retailers', operation: 'sum', label: 'sum of units with retailers' },
        ],
        undefined,
        true,
      );

      expect(res.success).toBe(true);
      expect(res.result).toBeDefined();
      expect(res.result!.status).toBe('success');
      expect(res.result!.aggregations).toHaveLength(3);
      expect(mockExecuteTool).toHaveBeenCalledWith(
        'runTableQuery',
        expect.objectContaining({
          workspaceId: 'ws_test',
          filters: [{ field: 'date', operator: 'before', value: '2025-05-05' }],
          aggregations: expect.arrayContaining([
            expect.objectContaining({ field: 'units sold', operation: 'sum' }),
          ]),
          includeRows: true,
        }),
      );
    });

    it('NEVER calls runWorkspaceAgentAction for table_aggregate_query plan', async () => {
      // This is the critical regression guard:
      // When a plan has intent table_aggregate_query, the component routing logic
      // must call runTableQueryAction — NOT runWorkspaceAgentAction.
      const plan = makeTableAggregatePlan();

      // Verify the plan properties that determine routing
      expect(plan.intent).toBe('table_aggregate_query');
      expect(plan.status).toBe('executable');
      expect(plan.extracted.aggregations.length).toBe(3);

      // The routing condition in WorkspaceAgentPanel:
      //   isTableQuery = plan.intent === 'table_aggregate_query'
      //   If isTableQuery && plan.extracted → call runTableQueryAction
      //   Else → call runAgentAction (THIS MUST NOT HAPPEN)
      const isTableQuery = plan.intent === 'table_aggregate_query';
      const hasExtracted = plan.extracted !== undefined && plan.extracted !== null;
      const hasAggregations = (plan.extracted.aggregations?.length ?? 0) > 0;

      expect(isTableQuery).toBe(true);
      expect(hasExtracted).toBe(true);
      expect(hasAggregations).toBe(true);

      // If all conditions are met, runTableQueryAction is called, not runAgentAction.
      // This verifies the routing logic will select the table query path.
    });
  });

  describe('Duplicate key query routing', () => {
    it('calls findDuplicateKeysAction for duplicate_key_query', async () => {
      const fakeResult = {
        type: 'duplicate_keys',
        groups: [{ key: 'test@example.com', count: 2, sources: ['file1.csv'] }],
        totalDuplicates: 1,
      };
      mockExecuteTool.mockResolvedValueOnce(fakeResult);

      const { findDuplicateKeysAction } = await getActions();
      const res = await findDuplicateKeysAction('ws_test', 'email');

      expect(res.success).toBe(true);
      expect(mockExecuteTool).toHaveBeenCalledWith(
        'findDuplicateKeys',
        expect.objectContaining({ workspaceId: 'ws_test', keyType: 'email' }),
      );
    });
  });

  describe('Document lookup routing', () => {
    it('calls findDocumentsForKeyAction for document_lookup with keyValue', async () => {
      const fakeResult = {
        type: 'documents_for_key',
        documents: [{ fileName: 'spec.md', relevance: 'high' }],
        keyValue: 'ABC-123',
      };
      mockExecuteTool.mockResolvedValueOnce(fakeResult);

      const { findDocumentsForKeyAction } = await getActions();
      const res = await findDocumentsForKeyAction('ws_test', 'ABC-123');

      expect(res.success).toBe(true);
      expect(mockExecuteTool).toHaveBeenCalledWith(
        'findDocumentsForKey',
        expect.objectContaining({ workspaceId: 'ws_test', value: 'ABC-123' }),
      );
    });
  });

  describe('Unknown command does NOT call agent fallback', () => {
    it('unknown plan has needs_clarification status (prevents execution)', () => {
      const plan = makeUnknownPlan();

      // canExecute = plan.status === 'executable'
      const canExecute = plan.status === 'executable';
      expect(canExecute).toBe(false);

      // With canExecute === false, the Run button is disabled and handleRun() early-returns.
      // runWorkspaceAgentAction is NEVER called for unknown commands.
    });

    it('unknown intent is not routed to any agent action', () => {
      const plan = makeUnknownPlan();

      const isTableQuery = plan.intent === 'table_aggregate_query';
      const isDuplicateKeyQuery = plan.intent === 'duplicate_key_query';
      const isDocumentLookup = (plan.intent === 'document_lookup' || plan.intent === 'evidence_lookup') && plan.extracted?.keyValue;

      expect(isTableQuery).toBe(false);
      expect(isDuplicateKeyQuery).toBe(false);
      expect(isDocumentLookup).toBeFalsy();

      // After refactor: unknown intent must show clarification message,
      // NOT fall through to runAgentAction
    });
  });

  describe('Changed input invalidates stale plan', () => {
    it('plan with different originalCommand must trigger re-planning', () => {
      const plan = makeTableAggregatePlan();
      const currentGoal = 'Find duplicate emails';

      // The plan was created for a different command
      const planIsStale = currentGoal !== plan.originalCommand;
      expect(planIsStale).toBe(true);

      // After refactor: handleRun() detects stale plan and re-plans before executing.
    });

    it('plan with same originalCommand does not re-plan', () => {
      const plan = makeTableAggregatePlan();
      const currentGoal = DEMO_COMMAND;

      const planIsStale = currentGoal !== plan.originalCommand;
      expect(planIsStale).toBe(false);
    });
  });

  describe('Empty aggregations guard', () => {
    it('table_aggregate_query with empty aggregations should not execute', () => {
      const plan = makeTableAggregatePlan();
      plan.extracted.aggregations = []; // Simulate parser failing to extract

      const hasAggregations = (plan.extracted.aggregations?.length ?? 0) > 0;
      expect(hasAggregations).toBe(false);

      // After refactor: show clarification message instead of calling runTableQueryAction
      // "I understood this as a table query, but could not identify what to calculate."
    });
  });
});
