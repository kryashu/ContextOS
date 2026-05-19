import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCommandRun = vi.fn();
const mockAnalystRun = vi.fn();

vi.mock('@contextos/tools', () => ({
  toolRegistry: {},
  setDataRoot: vi.fn(),
}));

vi.mock('@contextos/agents', () => ({
  WorkspaceAnalystAgent: vi.fn().mockImplementation(() => ({ run: mockAnalystRun })),
  WorkspaceCommandAgent: vi.fn().mockImplementation(() => ({ run: mockCommandRun })),
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
  return mod.runWorkspaceCommandAction;
}

const baseResponse = {
  intent: 'workspace_overview' as const,
  resultType: 'workspace_overview' as const,
  status: 'success' as const,
  summary: 'ok',
  answer: 'Workspace looks healthy.',
  sections: [],
  sourceRefs: [],
  toolTrace: [{ toolId: 'getWorkspaceContext', status: 'success' as const, summary: 'ok' }],
  warnings: [],
};

describe('runWorkspaceCommandAction', () => {
  beforeEach(() => {
    mockCommandRun.mockReset();
    mockAnalystRun.mockReset();
  });

  it('returns success with WorkspaceAgentResponse', async () => {
    mockCommandRun.mockResolvedValueOnce(baseResponse);
    const action = await getAction();
    const res = await action('ws_1', 'give me an overview');
    expect(res.success).toBe(true);
    expect(res.result).toEqual(baseResponse);
    expect(res.error).toBeUndefined();
  });

  it('rejects missing workspace', async () => {
    const action = await getAction();
    const res = await action('ws_missing', 'overview');
    expect(res.success).toBe(false);
    expect(res.error).toBe('Workspace not found.');
    expect(mockCommandRun).not.toHaveBeenCalled();
  });

  it('rejects empty command', async () => {
    const action = await getAction();
    const res = await action('ws_1', '   ');
    expect(res.success).toBe(false);
    expect(res.error).toBe('Command cannot be empty.');
    expect(mockCommandRun).not.toHaveBeenCalled();
  });

  it('rejects command longer than 500 chars', async () => {
    const action = await getAction();
    const tooLong = 'x'.repeat(501);
    const res = await action('ws_1', tooLong);
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/500 characters/);
    expect(mockCommandRun).not.toHaveBeenCalled();
  });

  it('returns safe error message on thrown error (no stack trace leak)', async () => {
    mockCommandRun.mockRejectedValueOnce(new Error('Internal: ENOENT /tmp/missing'));
    const action = await getAction();
    const res = await action('ws_1', 'do something');
    expect(res.success).toBe(false);
    expect(res.error).toBe('The workspace command agent encountered an error. Please try again.');
    expect(res.error).not.toContain('ENOENT');
    expect(res.error).not.toContain('/tmp');
  });

  it('passes allowWrites through to agent.run()', async () => {
    mockCommandRun.mockResolvedValueOnce(baseResponse);
    const action = await getAction();
    await action('ws_1', 'generate report', true);
    expect(mockCommandRun).toHaveBeenCalledWith({
      workspaceId: 'ws_1',
      command: 'generate report',
      allowWrites: true,
    });
  });
});
