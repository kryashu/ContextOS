import { describe, it, expect } from 'vitest';
import { detectKeyType, detectKeyTypeFromColumn, detectKeyTypeFromValue } from '../key-type-detector.js';

describe('detectKeyTypeFromColumn', () => {
  it('detects email from column name', () => {
    const r = detectKeyTypeFromColumn('Email Address');
    expect(r?.keyType).toBe('email');
    expect(r?.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('detects phone from column name', () => {
    const r = detectKeyTypeFromColumn('Phone Number');
    expect(r?.keyType).toBe('phone');
  });

  it('detects product_id from column name', () => {
    const r = detectKeyTypeFromColumn('Product ID');
    expect(r?.keyType).toBe('product_id');
  });

  it('detects order_id from column name', () => {
    const r = detectKeyTypeFromColumn('Order_ID');
    expect(r?.keyType).toBe('order_id');
  });

  it('returns unknown for unrecognized column', () => {
    const r = detectKeyTypeFromColumn('Total Revenue');
    expect(r.keyType).toBe('unknown');
  });
});

describe('detectKeyTypeFromValue', () => {
  it('detects email from value', () => {
    const r = detectKeyTypeFromValue('alice@example.com');
    expect(r?.keyType).toBe('email');
    expect(r?.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it('detects phone from value', () => {
    const r = detectKeyTypeFromValue('+1-555-123-4567');
    expect(r?.keyType).toBe('phone');
  });

  it('detects generic_id with letters and digits and length>=5', () => {
    const r = detectKeyTypeFromValue('ABC123');
    expect(r?.keyType).toBe('generic_id');
    expect(r?.confidence).toBeLessThanOrEqual(0.6);
  });

  it('rejects date-like values for generic_id', () => {
    const r = detectKeyTypeFromValue('2025-01-15');
    // Date-like pattern matches phone regex first (digits+dashes), so not generic_id
    expect(r.keyType).not.toBe('generic_id');
  });

  it('rejects short values for generic_id', () => {
    const r = detectKeyTypeFromValue('A1');
    expect(r.keyType).not.toBe('generic_id');
  });

  it('returns unknown for plain text', () => {
    const r = detectKeyTypeFromValue('hello world');
    expect(r.keyType).toBe('unknown');
  });
});

describe('detectKeyType', () => {
  it('combines column and value detection with column taking priority', () => {
    const r = detectKeyType('user@test.com', 'User Email');
    expect(r.keyType).toBe('email');
    expect(r.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('uses column detection for Contact Info (phone pattern)', () => {
    const r = detectKeyType('user@test.com', 'Contact Info');
    // "Contact" matches the phone column pattern
    expect(r.keyType).toBe('phone');
  });

  it('falls back to value detection when column is truly unknown', () => {
    const r = detectKeyType('user@test.com', 'Notes');
    expect(r.keyType).toBe('email');
  });

  it('returns unknown for unrecognizable inputs', () => {
    const r = detectKeyType('hello world', 'Description');
    expect(r.keyType).toBe('unknown');
  });

  it('generic_id with label context gets higher confidence', () => {
    const r = detectKeyType('ABC12345', 'Reference ID');
    expect(r.keyType).toBe('generic_id');
    expect(r.confidence).toBeGreaterThanOrEqual(0.8);
  });
});
