import { describe, it, expect } from 'vitest';
import { extractRowRequest } from '../command-parser.js';

describe('extractRowRequest', () => {
  it('returns first for "first row"', () => {
    expect(extractRowRequest('Show first row of product_contacts')).toEqual({ type: 'first' });
  });

  it('returns first for "row 1"', () => {
    expect(extractRowRequest('Give me row 1 of contacts.csv')).toEqual({ type: 'first' });
  });

  it('returns last for "last row"', () => {
    expect(extractRowRequest('Show last row of orders')).toEqual({ type: 'last' });
  });

  it('returns numbered row for "row 3"', () => {
    expect(extractRowRequest('Show row 3 of contacts')).toEqual({
      type: 'number',
      rowNumber: 3,
    });
  });

  it('returns numbered row for "row #7"', () => {
    expect(extractRowRequest('Read row #7')).toEqual({
      type: 'number',
      rowNumber: 7,
    });
  });

  it('returns numbered row for ordinal "third row"', () => {
    expect(extractRowRequest('Show the third row of products')).toEqual({
      type: 'number',
      rowNumber: 3,
    });
  });

  it('returns headers for "headers" mention', () => {
    expect(extractRowRequest('What are the headers of product_contacts?')).toEqual({
      type: 'headers',
    });
  });

  it('returns headers for "column names"', () => {
    expect(extractRowRequest('Show column names of contacts')).toEqual({ type: 'headers' });
  });

  it('returns sample for "few rows"', () => {
    expect(extractRowRequest('Give me a few rows of contacts')).toEqual({ type: 'sample' });
  });

  it('returns sample for "sample rows"', () => {
    expect(extractRowRequest('Show sample rows from contacts.csv')).toEqual({ type: 'sample' });
  });

  it('returns undefined when no row reference', () => {
    expect(extractRowRequest('Tell me about ABC-123')).toBeUndefined();
  });

  it('returns undefined for unrelated "row" word in other contexts', () => {
    expect(extractRowRequest('Tell me about the product roadmap')).toBeUndefined();
  });
});
