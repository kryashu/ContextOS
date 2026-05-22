import { describe, it, expect } from 'vitest';
import {
  normalizeDateToIsoLikeString,
  extractDates,
  extractPossibleKeyValues,
  extractAggregateFields,
  detectAggregationOperation,
  extractFilterExpressions,
  extractFileName,
  extractSourceHint,
} from '../command-parser.js';

describe('normalizeDateToIsoLikeString', () => {
  it('parses "5 May 2025"', () => {
    expect(normalizeDateToIsoLikeString('5 May 2025')).toBe('2025-05-05');
  });

  it('parses "5th May 2025"', () => {
    expect(normalizeDateToIsoLikeString('5th May 2025')).toBe('2025-05-05');
  });

  it('parses "May 5, 2025"', () => {
    expect(normalizeDateToIsoLikeString('May 5, 2025')).toBe('2025-05-05');
  });

  it('passes through ISO date', () => {
    expect(normalizeDateToIsoLikeString('2025-05-05')).toBe('2025-05-05');
  });

  it('returns null for unparseable date', () => {
    expect(normalizeDateToIsoLikeString('not a date')).toBeNull();
  });
});

describe('extractDates', () => {
  it('extracts "before 5th May 2025"', () => {
    const filters = extractDates('Find products launched before 5th May 2025');
    expect(filters).toHaveLength(1);
    expect(filters[0]).toEqual({ field: 'date', operator: 'before', value: '2025-05-05' });
  });

  it('extracts "after" dates', () => {
    const filters = extractDates('Show items added after 1 January 2024');
    expect(filters).toHaveLength(1);
    expect(filters[0]!.operator).toBe('after');
    expect(filters[0]!.value).toBe('2024-01-01');
  });
});

describe('extractPossibleKeyValues', () => {
  it('extracts product code ABC-123', () => {
    const values = extractPossibleKeyValues('Show all documents related to product ABC-123');
    expect(values).toContain('ABC-123');
  });

  it('returns empty for no key values', () => {
    const values = extractPossibleKeyValues('Give me an overview');
    expect(values).toHaveLength(0);
  });
});

describe('detectAggregationOperation', () => {
  it('detects "total" as sum', () => {
    expect(detectAggregationOperation('calculate total units')).toBe('sum');
  });

  it('detects "average" as average', () => {
    expect(detectAggregationOperation('average score per student')).toBe('average');
  });

  it('detects "how many" as count', () => {
    expect(detectAggregationOperation('how many products')).toBe('count');
  });

  it('returns null for no aggregation', () => {
    expect(detectAggregationOperation('show me the workspace')).toBeNull();
  });
});

describe('extractAggregateFields', () => {
  it('extracts "total units sold"', () => {
    const aggs = extractAggregateFields('calculate total units sold');
    expect(aggs.length).toBeGreaterThanOrEqual(1);
    expect(aggs[0]!.field).toContain('units sold');
    expect(aggs[0]!.operation).toBe('sum');
  });

  it('extracts comma-separated multi-field aggregation (VS016 demo command)', () => {
    const aggs = extractAggregateFields(
      'Find all products launched before 5 May 2025 and calculate total units sold, total units in transit, and total units with retailers.',
    );
    expect(aggs).toHaveLength(3);
    expect(aggs[0]!.field).toBe('units sold');
    expect(aggs[0]!.operation).toBe('sum');
    expect(aggs[1]!.field).toBe('units in transit');
    expect(aggs[1]!.operation).toBe('sum');
    expect(aggs[2]!.field).toBe('units with retailers');
    expect(aggs[2]!.operation).toBe('sum');
  });

  it('extracts single aggregation ending at period', () => {
    const aggs = extractAggregateFields('Calculate total revenue.');
    expect(aggs).toHaveLength(1);
    expect(aggs[0]!.field).toBe('revenue');
    expect(aggs[0]!.operation).toBe('sum');
  });

  it('extracts aggregation with "before" delimiter', () => {
    const aggs = extractAggregateFields('calculate total units sold before 2025');
    expect(aggs.length).toBeGreaterThanOrEqual(1);
    expect(aggs[0]!.field).toBe('units sold');
  });
});

describe('extractFilterExpressions', () => {
  it('extracts date-based filter', () => {
    const filters = extractFilterExpressions('before 5 May 2025');
    expect(filters).toHaveLength(1);
    expect(filters[0]!.operator).toBe('before');
  });

  it('extracts "greater than" filter', () => {
    const filters = extractFilterExpressions('units greater than 100');
    expect(filters).toHaveLength(1);
    expect(filters[0]).toEqual({ field: 'value', operator: 'greater_than', value: '100' });
  });
});

describe('extractFileName', () => {
  it('extracts a .txt file with underscores', () => {
    expect(extractFileName('Explain the content in irrelevant_hr_policy.txt'))
      .toBe('irrelevant_hr_policy.txt');
  });

  it('extracts a .pdf file with hyphens and uppercase ids', () => {
    expect(extractFileName('Explain release_notes_ABC-123.pdf'))
      .toBe('release_notes_ABC-123.pdf');
  });

  it('preserves a typo in the requested filename (resolution is separate)', () => {
    expect(extractFileName('Explain irrelevan_hr_policy.txt'))
      .toBe('irrelevan_hr_policy.txt');
  });

  it('extracts an .xlsx file', () => {
    expect(extractFileName('Tell me about license_tracker.xlsx'))
      .toBe('license_tracker.xlsx');
  });

  it('returns undefined when no supported extension is present', () => {
    expect(extractFileName('show me the overview')).toBeUndefined();
  });

  it('does not pick a fragment with an unsupported extension', () => {
    expect(extractFileName('open file.exe please')).toBeUndefined();
  });
});

describe('extractSourceHint', () => {
  it('strips "give me X details" preamble + filler', () => {
    expect(extractSourceHint('Give me deployment checklist details'))
      .toBe('deployment checklist');
  });

  it('strips "explain" preamble', () => {
    expect(extractSourceHint('Explain HR policy')).toBe('HR policy');
  });

  it('strips "tell me about" preamble', () => {
    expect(extractSourceHint('Tell me about release notes')).toBe('release notes');
  });

  it('strips "summarize" preamble', () => {
    expect(extractSourceHint('Summarize approval letter')).toBe('approval letter');
  });

  it('returns undefined for stopword-only phrases like "this workspace"', () => {
    expect(extractSourceHint('Tell me about this workspace')).toBeUndefined();
  });

  it('returns undefined for unrelated table queries', () => {
    expect(extractSourceHint('Calculate total units sold')).toBeUndefined();
  });

  it('returns undefined when a concrete filename is present (file path wins)', () => {
    expect(extractSourceHint('Explain release_notes_ABC-123.pdf')).toBeUndefined();
  });
});

