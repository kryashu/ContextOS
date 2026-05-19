import { describe, it, expect } from 'vitest';
import type { KeyIntelligenceResult } from '@contextos/key-intelligence';
import { formatKeyIntelligenceResult } from '../response-formatters/format-key-intelligence-result.js';
import { formatDocumentLookupResult } from '../response-formatters/format-document-lookup-result.js';

const TRACE = [{ toolId: 'findDuplicateKeys', status: 'success' as const, summary: 'ok' }];

describe('formatKeyIntelligenceResult (duplicates)', () => {
  it('formats duplicate groups with locations 1:1 from tool result', () => {
    const result: KeyIntelligenceResult = {
      status: 'success',
      keyProfiles: [],
      duplicateGroups: [
        {
          keyType: 'email',
          value: 'foo@bar.com',
          normalizedValue: 'foo@bar.com',
          count: 3,
          locations: [
            { fileName: 'users.csv', row: 2, column: 'email' },
            { fileName: 'users.csv', row: 5, column: 'email' },
            { fileName: 'leads.csv', row: 9, column: 'email_address' },
          ],
        },
      ],
      documentMatches: [],
      relationships: [],
      warnings: [],
    };

    const response = formatKeyIntelligenceResult({
      workspaceId: 'ws_1',
      command: 'find duplicate emails',
      result,
      toolTrace: TRACE,
      keyType: 'email',
    });

    expect(response.status).toBe('success');
    expect(response.resultType).toBe('key_intelligence');
    expect(response.sourceRefs).toHaveLength(3);
    expect(response.sourceRefs[0]).toMatchObject({
      workspaceId: 'ws_1',
      fileName: 'users.csv',
      row: 2,
      column: 'email',
    });

    const summary = response.sections.find((s) => s.kind === 'metric_list');
    expect((summary!.content as { entries: Array<{ value: number }> }).entries[0]?.value).toBe(1);
  });

  it('returns no_matches when duplicateGroups is empty even if status=success', () => {
    const result: KeyIntelligenceResult = {
      status: 'success',
      keyProfiles: [],
      duplicateGroups: [],
      documentMatches: [],
      relationships: [],
      warnings: [],
    };
    const response = formatKeyIntelligenceResult({
      workspaceId: 'ws_1',
      command: 'find duplicate emails',
      result,
      toolTrace: TRACE,
      keyType: 'email',
    });
    expect(response.status).toBe('no_matches');
  });
});

describe('formatDocumentLookupResult', () => {
  it('formats evidence entries and copies sourceRefs 1:1', () => {
    const result: KeyIntelligenceResult = {
      status: 'success',
      keyProfiles: [],
      duplicateGroups: [],
      documentMatches: [
        {
          fileName: 'spec.md',
          keyType: 'product_id',
          value: 'ABC-123',
          normalizedValue: 'abc-123',
          evidence: 'Product ABC-123 is described in section 4.',
          sourceRef: { fileName: 'spec.md', sourceRange: 'line 42', snippet: 'Product ABC-123…' },
        },
      ],
      relationships: [],
      warnings: [],
    };
    const response = formatDocumentLookupResult({
      workspaceId: 'ws_1',
      command: 'show documents related to ABC-123',
      intent: 'document_lookup',
      keyValue: 'ABC-123',
      result,
      toolTrace: [{ toolId: 'findDocumentsForKey', status: 'success', summary: 'ok' }],
    });

    expect(response.status).toBe('success');
    expect(response.resultType).toBe('document_lookup');
    expect(response.sourceRefs).toHaveLength(1);
    expect(response.sourceRefs[0]?.fileName).toBe('spec.md');
    expect(response.sourceRefs[0]?.sourceRange).toBe('line 42');

    const evidence = response.sections.find((s) => s.kind === 'evidence');
    expect((evidence!.content as { entries: Array<unknown> }).entries).toHaveLength(1);
  });

  it('does not invent sourceRefs', () => {
    const result: KeyIntelligenceResult = {
      status: 'success',
      keyProfiles: [],
      duplicateGroups: [],
      documentMatches: [],
      relationships: [],
      warnings: [],
    };
    const response = formatDocumentLookupResult({
      workspaceId: 'ws_1',
      command: 'show documents related to XYZ',
      intent: 'document_lookup',
      keyValue: 'XYZ',
      result,
      toolTrace: [{ toolId: 'findDocumentsForKey', status: 'success', summary: 'ok' }],
    });
    expect(response.status).toBe('no_matches');
    expect(response.sourceRefs).toHaveLength(0);
  });
});
