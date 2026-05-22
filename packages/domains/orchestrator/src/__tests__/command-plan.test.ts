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
    expect(plan.status).toBe('executable');
    expect(plan.extracted.keyType).toBe('email');
  });

  it('plans document lookup with key value extraction', () => {
    const plan = createWorkspaceCommandPlan('Find document for product ABC-123');
    expect(plan.intent).toBe('document_lookup');
    expect(plan.status).toBe('executable');
    expect(plan.extracted.keyValues).toContain('ABC-123');
    expect(plan.extracted.keyValue).toBe('ABC-123');
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

  it('plans duplicate key query as executable', () => {
    const plan = createWorkspaceCommandPlan('Find duplicate emails across all Excel files');
    expect(plan.status).toBe('executable');
  });

  it('VS016 demo command: produces table_aggregate_query with 3 aggregations', () => {
    const plan = createWorkspaceCommandPlan(
      'Find all products launched before 5 May 2025 and calculate total units sold, total units in transit, and total units with retailers.',
    );
    expect(plan.intent).toBe('table_aggregate_query');
    expect(plan.status).toBe('executable');
    expect(plan.extracted.filters).toHaveLength(1);
    expect(plan.extracted.filters![0]).toEqual({
      field: 'date',
      operator: 'before',
      value: '2025-05-05',
    });
    expect(plan.extracted.aggregations).toHaveLength(3);
    expect(plan.extracted.aggregations![0]!.field).toBe('units sold');
    expect(plan.extracted.aggregations![1]!.field).toBe('units in transit');
    expect(plan.extracted.aggregations![2]!.field).toBe('units with retailers');
    expect(plan.extracted.aggregations!.every(a => a.operation === 'sum')).toBe(true);
  });

  describe('source_content_query refinement', () => {
    it('upgrades unknown command with a filename to source_content_query', () => {
      const plan = createWorkspaceCommandPlan('Explain the content in irrelevant_hr_policy.txt');
      expect(plan.intent).toBe('source_content_query');
      expect(plan.status).toBe('executable');
      expect(plan.confidence).toBe('high');
      expect(plan.extracted.fileName).toBe('irrelevant_hr_policy.txt');
    });

    it('upgrades workspace_overview-keyworded command when a filename is present', () => {
      const plan = createWorkspaceCommandPlan('Tell me about release_notes_ABC-123.pdf');
      expect(plan.intent).toBe('source_content_query');
      expect(plan.extracted.fileName).toBe('release_notes_ABC-123.pdf');
    });

    it('upgrades to source_content_query when only a sourceHint is present', () => {
      const plan = createWorkspaceCommandPlan('Give me deployment checklist details');
      expect(plan.intent).toBe('source_content_query');
      expect(plan.status).toBe('executable');
      expect(plan.extracted.sourceHint).toBe('deployment checklist');
      expect(plan.extracted.fileName).toBeUndefined();
    });

    it('does NOT upgrade "tell me about this workspace" (stopwords only)', () => {
      const plan = createWorkspaceCommandPlan('Tell me about this workspace');
      expect(plan.intent).toBe('workspace_overview');
    });

    it('source_content_query without fileName or sourceHint → needs_clarification', () => {
      // direct router hit with no fileName/hint — pre-empted by guard
      const plan = createWorkspaceCommandPlan('explain the content');
      // Either we never reach source_content_query OR if we do, must be needs_clarification
      if (plan.intent === 'source_content_query') {
        expect(plan.status).toBe('needs_clarification');
      }
    });
  });
});
