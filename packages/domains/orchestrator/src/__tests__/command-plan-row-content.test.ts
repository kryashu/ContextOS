import { describe, it, expect } from 'vitest';
import { createWorkspaceCommandPlan } from '../command-plan.js';

describe('createWorkspaceCommandPlan — row content queries (VS018.3.1)', () => {
  it('routes "Give me contents of first row of product_contacts" to source_content_query with rowRequest', () => {
    const plan = createWorkspaceCommandPlan(
      'Give me contents of first row of product_contacts',
    );
    expect(plan.intent).toBe('source_content_query');
    expect(plan.extracted.sourceHint).toBe('product_contacts');
    expect(plan.extracted.rowRequest).toEqual({ type: 'first' });
  });

  it('routes "Show first row of product_contacts.csv" to source_content_query with fileName and rowRequest', () => {
    const plan = createWorkspaceCommandPlan('Show first row of product_contacts.csv');
    expect(plan.intent).toBe('source_content_query');
    expect(plan.extracted.fileName).toBe('product_contacts.csv');
    expect(plan.extracted.rowRequest).toEqual({ type: 'first' });
  });

  it('does NOT upgrade "Show documents related to ABC-123" to source_content_query', () => {
    const plan = createWorkspaceCommandPlan('Show documents related to ABC-123');
    expect(plan.intent).not.toBe('source_content_query');
    expect(plan.extracted.rowRequest).toBeUndefined();
  });

  it('extracts numeric row request', () => {
    const plan = createWorkspaceCommandPlan('Show row 3 of product_contacts');
    expect(plan.intent).toBe('source_content_query');
    expect(plan.extracted.rowRequest).toEqual({ type: 'number', rowNumber: 3 });
  });

  it('extracts headers request', () => {
    const plan = createWorkspaceCommandPlan('What are the headers of product_contacts?');
    expect(plan.intent).toBe('source_content_query');
    expect(plan.extracted.rowRequest).toEqual({ type: 'headers' });
  });
});
