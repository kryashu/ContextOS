import { describe, it, expect } from 'vitest';
import {
  normalizeDateToIsoLikeString,
  extractDates,
  extractPossibleKeyValues,
  extractAggregateFields,
  detectAggregationOperation,
  extractFilterExpressions,
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
