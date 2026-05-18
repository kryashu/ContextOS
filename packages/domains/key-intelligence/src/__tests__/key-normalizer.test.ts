import { describe, it, expect } from 'vitest';
import { normalizeKeyValue } from '../key-normalizer.js';

describe('normalizeKeyValue', () => {
  it('normalizes email to lowercase trimmed', () => {
    expect(normalizeKeyValue(' Alice@Example.COM ', 'email')).toBe('alice@example.com');
  });

  it('normalizes phone by stripping spaces/dashes/parens', () => {
    expect(normalizeKeyValue('+1 (555) 123-4567', 'phone')).toBe('+15551234567');
  });

  it('normalizes generic_id to uppercase trimmed collapsed', () => {
    expect(normalizeKeyValue('  abc  123  ', 'generic_id')).toBe('ABC 123');
  });

  it('normalizes product_id via generic_id path', () => {
    expect(normalizeKeyValue(' prod-001 ', 'product_id')).toBe('PROD-001');
  });

  it('handles unknown type with trim only', () => {
    expect(normalizeKeyValue('  hello  ', 'unknown')).toBe('hello');
  });

  it('handles empty string', () => {
    expect(normalizeKeyValue('', 'email')).toBe('');
  });
});
