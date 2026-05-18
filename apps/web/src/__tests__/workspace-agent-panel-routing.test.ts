import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WorkspaceCommandPlan } from '@contextos/orchestrator';

// ── Helpers ─────────────────────────────────────────────────────────

function makePlan(overrides: Partial<WorkspaceCommandPlan> = {}): WorkspaceCommandPlan {
  return {
    commandId: 'cmd_test_1',
    originalCommand: 'test command',
    intent: 'workspace_overview',
    status: 'executable',
    confidence: 'high',
    summary: 'Test plan',
    extracted: {},
    requiredCapabilities: [],
    warnings: [],
    ...overrides,
  };
}

/**
 * Simulate the routing logic extracted from WorkspaceAgentPanel.
 * This mirrors the `executePlan` + `ensurePlan` flow without React rendering.
 */
async function simulateHandleRun(
  goal: string,
  actions: {
    planCommandAction: ReturnType<typeof vi.fn>;
    runAgentAction: ReturnType<typeof vi.fn>;
    runTableQueryAction: ReturnType<typeof vi.fn>;
    findDuplicateKeysAction: ReturnType<typeof vi.fn>;
    findDocumentsForKeyAction: ReturnType<typeof vi.fn>;
  },
  existingPlan: WorkspaceCommandPlan | null = null,
): Promise<{ error?: string; routed?: string }> {
  const AGENT_ALLOWED_INTENTS = new Set([
    'workspace_overview',
    'next_actions',
    'report_generation',
    'source_relationship_lookup',
  ]);

  // ensurePlan phase
  let currentPlan = existingPlan;
  if (!currentPlan || currentPlan.originalCommand !== goal) {
    const response = await actions.planCommandAction(goal);
    if (!response.success || !response.plan) {
      return { error: response.error ?? 'Failed to plan command.' };
    }
    currentPlan = response.plan;
  }

  const { intent, extracted } = currentPlan;

  // executePlan phase
  if (intent === 'table_aggregate_query') {
    const aggregations = (extracted.aggregations ?? []).map((a: { field: string; operation: string; label?: string }) => ({
      field: a.field,
      operation: a.operation,
      label: a.label,
    }));
    if (aggregations.length === 0) {
      return { error: 'I understood this as a table query, but could not identify what to calculate.' };
    }
    const filters = (extracted.filters ?? []).map((f: { field: string; operator: string; value: string }) => ({
      field: f.field,
      operator: f.operator,
      value: f.value,
    }));
    await actions.runTableQueryAction(filters, aggregations, extracted.targetFiles, true);
    return { routed: 'runTableQueryAction' };
  }

  if (intent === 'duplicate_key_query') {
    await actions.findDuplicateKeysAction(extracted.keyType);
    return { routed: 'findDuplicateKeysAction' };
  }

  if (intent === 'document_lookup' || intent === 'evidence_lookup') {
    if (!extracted.keyValue) {
      return { error: 'Please specify which key or identifier to look up (e.g. product ABC-123).' };
    }
    await actions.findDocumentsForKeyAction(extracted.keyValue, extracted.keyType);
    return { routed: 'findDocumentsForKeyAction' };
  }

  if (AGENT_ALLOWED_INTENTS.has(intent)) {
    await actions.runAgentAction(goal, false);
    return { routed: 'runAgentAction' };
  }

  // Blocked intents
  if (currentPlan.status === 'needs_clarification' && currentPlan.nextStep) {
    return { error: currentPlan.nextStep };
  }
  return { error: "I couldn't determine a specific workflow for this command." };
}

// ── Tests ───────────────────────────────────────────────────────────

describe('WorkspaceAgentPanel routing', () => {
  let actions: {
    planCommandAction: ReturnType<typeof vi.fn>;
    runAgentAction: ReturnType<typeof vi.fn>;
    runTableQueryAction: ReturnType<typeof vi.fn>;
    findDuplicateKeysAction: ReturnType<typeof vi.fn>;
    findDocumentsForKeyAction: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    actions = {
      planCommandAction: vi.fn(),
      runAgentAction: vi.fn().mockResolvedValue({ success: true, result: {} }),
      runTableQueryAction: vi.fn().mockResolvedValue({ success: true, result: {} }),
      findDuplicateKeysAction: vi.fn().mockResolvedValue({ success: true, result: {} }),
      findDocumentsForKeyAction: vi.fn().mockResolvedValue({ success: true, result: {} }),
    };
  });

  // ── Planning ────────────────────────────────────────────────────────

  it('calls planCommandAction before executing any command', async () => {
    actions.planCommandAction.mockResolvedValue({
      success: true,
      plan: makePlan({ intent: 'workspace_overview', originalCommand: 'overview' }),
    });

    await simulateHandleRun('overview', actions);

    expect(actions.planCommandAction).toHaveBeenCalledWith('overview');
  });

  it('reuses existing plan if command matches', async () => {
    const existingPlan = makePlan({ intent: 'workspace_overview', originalCommand: 'overview' });

    await simulateHandleRun('overview', actions, existingPlan);

    expect(actions.planCommandAction).not.toHaveBeenCalled();
    expect(actions.runAgentAction).toHaveBeenCalled();
  });

  it('re-plans when input changes (stale plan detection)', async () => {
    const stalePlan = makePlan({ intent: 'workspace_overview', originalCommand: 'old command' });
    actions.planCommandAction.mockResolvedValue({
      success: true,
      plan: makePlan({ intent: 'next_actions', originalCommand: 'new command' }),
    });

    await simulateHandleRun('new command', actions, stalePlan);

    expect(actions.planCommandAction).toHaveBeenCalledWith('new command');
  });

  // ── table_aggregate_query routing ───────────────────────────────────

  it('table_aggregate_query routes to runTableQueryAction', async () => {
    actions.planCommandAction.mockResolvedValue({
      success: true,
      plan: makePlan({
        intent: 'table_aggregate_query',
        originalCommand: 'calculate total units sold',
        extracted: {
          filters: [{ field: 'date', operator: 'before', value: '2025-05-05' }],
          aggregations: [{ field: 'units sold', operation: 'sum', label: 'sum of units sold' }],
        },
      }),
    });

    const result = await simulateHandleRun('calculate total units sold', actions);

    expect(result.routed).toBe('runTableQueryAction');
    expect(actions.runTableQueryAction).toHaveBeenCalledWith(
      [{ field: 'date', operator: 'before', value: '2025-05-05' }],
      [{ field: 'units sold', operation: 'sum', label: 'sum of units sold' }],
      undefined,
      true,
    );
    expect(actions.runAgentAction).not.toHaveBeenCalled();
  });

  it('table_aggregate_query does NOT call runAgentAction', async () => {
    actions.planCommandAction.mockResolvedValue({
      success: true,
      plan: makePlan({
        intent: 'table_aggregate_query',
        originalCommand: 'calculate total revenue',
        extracted: {
          aggregations: [{ field: 'revenue', operation: 'sum', label: 'sum of revenue' }],
        },
      }),
    });

    await simulateHandleRun('calculate total revenue', actions);

    expect(actions.runAgentAction).not.toHaveBeenCalled();
  });

  it('table_aggregate_query with empty aggregations shows error, never calls agent', async () => {
    actions.planCommandAction.mockResolvedValue({
      success: true,
      plan: makePlan({
        intent: 'table_aggregate_query',
        originalCommand: 'aggregate something',
        extracted: { aggregations: [] },
      }),
    });

    const result = await simulateHandleRun('aggregate something', actions);

    expect(result.error).toContain('could not identify what to calculate');
    expect(actions.runTableQueryAction).not.toHaveBeenCalled();
    expect(actions.runAgentAction).not.toHaveBeenCalled();
  });

  // ── VS016 demo command ──────────────────────────────────────────────

  it('VS016 demo command routes to runTableQueryAction (not agent)', async () => {
    const demoCommand =
      'Find all products launched before 5 May 2025 and calculate total units sold, total units in transit, and total units with retailers.';

    actions.planCommandAction.mockResolvedValue({
      success: true,
      plan: makePlan({
        intent: 'table_aggregate_query',
        originalCommand: demoCommand,
        extracted: {
          filters: [{ field: 'date', operator: 'before', value: '2025-05-05' }],
          aggregations: [
            { field: 'units sold', operation: 'sum', label: 'sum of units sold' },
            { field: 'units in transit', operation: 'sum', label: 'sum of units in transit' },
            { field: 'units with retailers', operation: 'sum', label: 'sum of units with retailers' },
          ],
        },
      }),
    });

    const result = await simulateHandleRun(demoCommand, actions);

    expect(result.routed).toBe('runTableQueryAction');
    expect(actions.runAgentAction).not.toHaveBeenCalled();
  });

  // ── duplicate_key_query routing ─────────────────────────────────────

  it('duplicate_key_query routes to findDuplicateKeysAction', async () => {
    actions.planCommandAction.mockResolvedValue({
      success: true,
      plan: makePlan({
        intent: 'duplicate_key_query',
        originalCommand: 'find duplicate emails',
        extracted: { keyType: 'email' },
      }),
    });

    const result = await simulateHandleRun('find duplicate emails', actions);

    expect(result.routed).toBe('findDuplicateKeysAction');
    expect(actions.findDuplicateKeysAction).toHaveBeenCalledWith('email');
    expect(actions.runAgentAction).not.toHaveBeenCalled();
  });

  // ── document_lookup routing ─────────────────────────────────────────

  it('document_lookup with keyValue routes to findDocumentsForKeyAction', async () => {
    actions.planCommandAction.mockResolvedValue({
      success: true,
      plan: makePlan({
        intent: 'document_lookup',
        originalCommand: 'find document for product ABC-123',
        extracted: { keyValue: 'ABC-123', keyType: 'product_id' },
      }),
    });

    const result = await simulateHandleRun('find document for product ABC-123', actions);

    expect(result.routed).toBe('findDocumentsForKeyAction');
    expect(actions.findDocumentsForKeyAction).toHaveBeenCalledWith('ABC-123', 'product_id');
    expect(actions.runAgentAction).not.toHaveBeenCalled();
  });

  it('document_lookup without keyValue shows error, never calls agent', async () => {
    actions.planCommandAction.mockResolvedValue({
      success: true,
      plan: makePlan({
        intent: 'document_lookup',
        originalCommand: 'find document',
        extracted: {},
      }),
    });

    const result = await simulateHandleRun('find document', actions);

    expect(result.error).toContain('specify which key or identifier');
    expect(actions.findDocumentsForKeyAction).not.toHaveBeenCalled();
    expect(actions.runAgentAction).not.toHaveBeenCalled();
  });

  // ── evidence_lookup routing ─────────────────────────────────────────

  it('evidence_lookup without keyValue shows error, never calls agent', async () => {
    actions.planCommandAction.mockResolvedValue({
      success: true,
      plan: makePlan({
        intent: 'evidence_lookup',
        originalCommand: 'show evidence',
        extracted: {},
      }),
    });

    const result = await simulateHandleRun('show evidence', actions);

    expect(result.error).toContain('specify which key or identifier');
    expect(actions.runAgentAction).not.toHaveBeenCalled();
  });

  // ── Agent-allowed intents ───────────────────────────────────────────

  it('workspace_overview routes to runAgentAction', async () => {
    actions.planCommandAction.mockResolvedValue({
      success: true,
      plan: makePlan({ intent: 'workspace_overview', originalCommand: 'give me an overview' }),
    });

    const result = await simulateHandleRun('give me an overview', actions);

    expect(result.routed).toBe('runAgentAction');
    expect(actions.runAgentAction).toHaveBeenCalled();
  });

  it('report_generation routes to runAgentAction', async () => {
    actions.planCommandAction.mockResolvedValue({
      success: true,
      plan: makePlan({ intent: 'report_generation', originalCommand: 'generate report' }),
    });

    const result = await simulateHandleRun('generate report', actions);

    expect(result.routed).toBe('runAgentAction');
  });

  // ── Blocked intents ─────────────────────────────────────────────────

  it('unknown intent shows error, never calls agent', async () => {
    actions.planCommandAction.mockResolvedValue({
      success: true,
      plan: makePlan({
        intent: 'unknown',
        status: 'needs_clarification',
        originalCommand: 'xyzzy',
        nextStep: 'Could not determine intent. Try rephrasing or use a preset command.',
      }),
    });

    const result = await simulateHandleRun('xyzzy', actions);

    expect(result.error).toContain('Could not determine intent');
    expect(actions.runAgentAction).not.toHaveBeenCalled();
    expect(actions.runTableQueryAction).not.toHaveBeenCalled();
    expect(actions.findDuplicateKeysAction).not.toHaveBeenCalled();
    expect(actions.findDocumentsForKeyAction).not.toHaveBeenCalled();
  });

  it('needs_clarification shows plan.nextStep message, never calls agent', async () => {
    actions.planCommandAction.mockResolvedValue({
      success: true,
      plan: makePlan({
        intent: 'unknown',
        status: 'needs_clarification',
        originalCommand: 'hmm',
        nextStep: 'Please enter a more specific command.',
      }),
    });

    const result = await simulateHandleRun('hmm', actions);

    expect(result.error).toBe('Please enter a more specific command.');
    expect(actions.runAgentAction).not.toHaveBeenCalled();
  });
});
