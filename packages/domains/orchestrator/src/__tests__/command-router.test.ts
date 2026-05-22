import { describe, it, expect } from 'vitest';
import { routeCommand } from '../command-router.js';

describe('routeCommand', () => {
  it('routes workspace overview command', () => {
    const r = routeCommand('Give me a complete understanding of this workspace');
    expect(r.intent).toBe('workspace_overview');
    expect(r.status).toBe('executable');
    expect(r.confidence).toBe('high');
  });

  it('routes next-actions command', () => {
    const r = routeCommand('What should I look at first?');
    expect(r.intent).toBe('next_actions');
    expect(r.status).toBe('executable');
  });

  it('routes report command', () => {
    const r = routeCommand('Generate a report');
    expect(r.intent).toBe('report_generation');
    expect(r.status).toBe('executable');
  });

  it('routes related files command', () => {
    const r = routeCommand('Which files are related to this workbook?');
    expect(r.intent).toBe('source_relationship_lookup');
    expect(r.status).toBe('executable');
  });

  it('routes document lookup with product reference', () => {
    const r = routeCommand('Find document for product ABC-123');
    expect(r.intent).toBe('document_lookup');
    expect(r.status).toBe('executable');
  });

  it('routes table aggregate query', () => {
    const r = routeCommand('Find all products launched before 5 May 2025 and calculate total units sold');
    expect(r.intent).toBe('table_aggregate_query');
    expect(r.status).toBe('executable');
    expect(r.requiredCapabilities).toContain('smart_table_query_engine');
  });

  it('routes duplicate key query', () => {
    const r = routeCommand('Find duplicate emails across all Excel files');
    expect(r.intent).toBe('duplicate_key_query');
    expect(r.status).toBe('executable');
    expect(r.requiredCapabilities).toEqual([]);
  });

  it('routes unknown command to needs_clarification', () => {
    const r = routeCommand('xyzzy foobar baz');
    expect(r.intent).toBe('unknown');
    expect(r.status).toBe('needs_clarification');
    expect(r.confidence).toBe('low');
  });

  it('routes empty command to needs_clarification', () => {
    const r = routeCommand('');
    expect(r.intent).toBe('unknown');
    expect(r.status).toBe('needs_clarification');
  });

  it('routes evidence lookup', () => {
    const r = routeCommand('Show me where it mentions the deployment process');
    expect(r.intent).toBe('evidence_lookup');
    expect(r.status).toBe('executable');
  });

  it('routes source_content_query when file extension present', () => {
    const r = routeCommand('Explain the content in irrelevant_hr_policy.txt');
    expect(r.intent).toBe('source_content_query');
    expect(r.status).toBe('executable');
    expect(r.confidence).toBe('high');
  });

  it('does not route generic "show related documents" to source_content_query', () => {
    const r = routeCommand('show related documents');
    expect(r.intent).not.toBe('source_content_query');
  });
});
