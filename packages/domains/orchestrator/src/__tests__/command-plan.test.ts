import { describe, it, expect } from 'vitest';
import { createWorkspaceCommandPlan } from '../command-plan.js';

describe('createWorkspaceCommandPlan', () => {
  it('plans workspace overview as executable', () => {
    const plan = createWorkspaceCommandPlan('Give me a complete understanding of this workspace');
    expect(plan.intent).toBe('workspace_overview');
    expect(plan.status).toBe('executable');
    expect(plan.confidence).toBe('high');
    expect(plan.commandId).toMatch(/^cmd_/);
    expect(plan.originalCommand).toBe('Give me a complete understanding of this workspace');
    expect(plan.warnings).toBeDefined();
  });

  it('plans report generation as executable', () => {
    const plan = createWorkspaceCommandPlan('Generate a workspace report');
    expect(plan.intent).toBe('report_generation');
    expect(plan.status).toBe('executable');
  });

  it('plans table aggregate with filters and aggregations', () => {
    const plan = createWorkspaceCommandPlan(
      'Calculate total units sold before 5 May 2025 for all products',
    );
    expect(plan.intent).toBe('table_aggregate_query');
    expect(plan.status).toBe('executable');
    expect(plan.requiredCapabilities).toContain('smart_table_query_engine');
    expect(plan.extracted.filters).toBeDefined();
    expect(plan.extracted.filters!.length).toBeGreaterThanOrEqual(1);
    expect(plan.extracted.filters![0]!.operator).toBe('before');
    expect(plan.extracted.filters![0]!.value).toBe('2025-05-05');
    expect(plan.extracted.aggregations).toBeDefined();
    expect(plan.extracted.aggregations!.length).toBeGreaterThanOrEqual(1);
  });

  it('plans duplicate key query', () => {
    const plan = createWorkspaceCommandPlan('Find duplicate emails across all Excel files');
    expect(plan.intent).toBe('duplicate_key_query');
    expect(plan.status).toBe('planned_only');
    expect(plan.requiredCapabilities).toContain('generic_key_intelligence_engine');
  });

  it('plans document lookup with key value extraction', () => {
    const plan = createWorkspaceCommandPlan('Find document for product ABC-123');
    expect(plan.intent).toBe('document_lookup');
    expect(plan.status).toBe('executable');
    expect(plan.extracted.keyValues).toContain('ABC-123');
  });

  it('returns needs_clarification for unknown command', () => {
    const plan = createWorkspaceCommandPlan('xyzzy foobar');
    expect(plan.intent).toBe('unknown');
    expect(plan.status).toBe('needs_clarification');
    expect(plan.confidence).toBe('low');
    expect(plan.warnings.length).toBeGreaterThan(0);
  });

  it('adds warning for vague/short command', () => {
    const plan = createWorkspaceCommandPlan('show report');
    expect(plan.warnings.some(w => w.includes('short'))).toBe(true);
  });

  it('includes planned_only warning for unimplemented engines', () => {
    const plan = createWorkspaceCommandPlan('Find duplicate emails across all Excel files');
    expect(plan.status).toBe('planned_only');
    expect(plan.warnings.some(w => w.includes('not yet implemented'))).toBe(true);
  });
});
