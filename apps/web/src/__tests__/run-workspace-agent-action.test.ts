import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ───────────────────────────────────────────────────────────

const mockRun = vi.fn();

vi.mock('@contextos/tools', () => ({
  toolRegistry: {},
  setDataRoot: vi.fn(),
}));

vi.mock('@contextos/agents', () => ({
  WorkspaceAnalystAgent: vi.fn().mockImplementation(() => ({
    run: mockRun,
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

// Dynamic import so mocks are in place before the module loads
async function getAction() {
  const mod = await import('../app/workspaces/actions');
  return mod.runWorkspaceAgentAction;
}

// ── Tests ───────────────────────────────────────────────────────────

describe('runWorkspaceAgentAction', () => {
  beforeEach(() => {
    mockRun.mockReset();
  });

  it('returns success with AgentRunResult', async () => {
    const fakeResult = {
      goal: 'workspace_overview',
      answer: 'This workspace covers checkout flows.',
      toolTrace: [
        { toolId: 'checkAnalysisState', status: 'success', durationMs: 12 },
        { toolId: 'getWorkspaceContext', status: 'success', durationMs: 34 },
      ],
      warnings: [],
    };
    mockRun.mockResolvedValueOnce(fakeResult);

    const action = await getAction();
    const res = await action('ws_123', 'Give me an overview');

    expect(res.success).toBe(true);
    expect(res.result).toEqual(fakeResult);
    expect(res.error).toBeUndefined();
  });

  it('returns safe error message on thrown error (no stack traces)', async () => {
    mockRun.mockRejectedValueOnce(new Error('Internal: ENOENT /tmp/missing'));

    const action = await getAction();
    const res = await action('ws_123', 'Give me an overview');

    expect(res.success).toBe(false);
    expect(res.error).toBe('The workspace agent encountered an error. Please try again.');
    expect(res.result).toBeUndefined();
    // Verify no stack trace leaked
    expect(res.error).not.toContain('ENOENT');
    expect(res.error).not.toContain('/tmp');
  });

  it('passes allowWrites through to agent.run()', async () => {
    mockRun.mockResolvedValueOnce({
      goal: 'report_generation',
      answer: 'Report generated.',
      toolTrace: [],
      warnings: [],
    });

    const action = await getAction();
    await action('ws_123', 'Generate a workspace report', true);

    expect(mockRun).toHaveBeenCalledWith({
      workspaceId: 'ws_123',
      goal: 'Generate a workspace report',
      allowWrites: true,
    });
  });

  it('defaults allowWrites to false', async () => {
    mockRun.mockResolvedValueOnce({
      goal: 'workspace_overview',
      answer: 'Overview.',
      toolTrace: [],
      warnings: [],
    });

    const action = await getAction();
    await action('ws_123', 'Give me an overview');

    expect(mockRun).toHaveBeenCalledWith({
      workspaceId: 'ws_123',
      goal: 'Give me an overview',
      allowWrites: false,
    });
  });

  it('returns validation error for empty goal', async () => {
    const action = await getAction();
    const res = await action('ws_123', '   ');

    expect(res.success).toBe(false);
    expect(res.error).toBe('Goal cannot be empty.');
    expect(mockRun).not.toHaveBeenCalled();
  });

  it('returns validation error for goal over 500 characters', async () => {
    const action = await getAction();
    const longGoal = 'a'.repeat(501);
    const res = await action('ws_123', longGoal);

    expect(res.success).toBe(false);
    expect(res.error).toBe('Goal must be 500 characters or fewer.');
    expect(mockRun).not.toHaveBeenCalled();
  });

  it('returns error when workspace is not found', async () => {
    const action = await getAction();
    const res = await action('ws_missing', 'Give me an overview');

    expect(res.success).toBe(false);
    expect(res.error).toBe('Workspace not found.');
    expect(mockRun).not.toHaveBeenCalled();
  });
});
