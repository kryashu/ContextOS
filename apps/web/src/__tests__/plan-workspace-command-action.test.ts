import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ───────────────────────────────────────────────────────────

const mockCreatePlan = vi.fn();

vi.mock('@contextos/orchestrator', () => ({
  createWorkspaceCommandPlan: (...args: unknown[]) => mockCreatePlan(...args),
}));

vi.mock('@contextos/tools', () => ({
  toolRegistry: {},
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

async function getAction() {
  const mod = await import('../app/workspaces/actions');
  return mod.planWorkspaceCommandAction;
}

// ── Tests ───────────────────────────────────────────────────────────

describe('planWorkspaceCommandAction', () => {
  beforeEach(() => {
    mockCreatePlan.mockReset();
  });

  it('returns a plan for a valid command', async () => {
    const fakePlan = {
      commandId: 'cmd_1',
      originalCommand: 'Give me an overview',
      intent: 'workspace_overview',
      status: 'executable',
      confidence: 'high',
      summary: 'Provide a high-level overview of the workspace.',
      extracted: { keyValues: [], filters: [], aggregations: [], targetFiles: [], fields: [] },
      requiredCapabilities: ['workspace_analyst_agent'],
      warnings: [],
      nextStep: undefined,
    };
    mockCreatePlan.mockReturnValueOnce(fakePlan);

    const action = await getAction();
    const res = await action('ws_123', 'Give me an overview');

    expect(res.success).toBe(true);
    expect(res.plan).toEqual(fakePlan);
    expect(res.error).toBeUndefined();
    expect(mockCreatePlan).toHaveBeenCalledWith('Give me an overview');
  });

  it('returns error for empty command', async () => {
    const action = await getAction();
    const res = await action('ws_123', '   ');

    expect(res.success).toBe(false);
    expect(res.error).toBe('Command cannot be empty.');
    expect(res.plan).toBeUndefined();
  });

  it('returns error for command exceeding max length', async () => {
    const action = await getAction();
    const res = await action('ws_123', 'x'.repeat(501));

    expect(res.success).toBe(false);
    expect(res.error).toBe('Command must be 500 characters or fewer.');
    expect(res.plan).toBeUndefined();
  });

  it('returns error for missing workspace', async () => {
    const action = await getAction();
    const res = await action('ws_missing', 'Give me an overview');

    expect(res.success).toBe(false);
    expect(res.error).toBe('Workspace not found.');
  });

  it('returns safe error on thrown exception', async () => {
    mockCreatePlan.mockImplementationOnce(() => {
      throw new Error('Internal crash');
    });

    const action = await getAction();
    const res = await action('ws_123', 'Give me an overview');

    expect(res.success).toBe(false);
    expect(res.error).toBe('Failed to plan command. Please try again.');
    expect(res.error).not.toContain('Internal');
  });
});
