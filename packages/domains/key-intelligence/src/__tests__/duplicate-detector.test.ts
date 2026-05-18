import { describe, it, expect } from 'vitest';
import { detectDuplicates } from '../duplicate-detector.js';
import type { DetectedKey } from '../types.js';

function makeKey(value: string, keyType: string, fileName: string, column?: string, row?: number): DetectedKey {
  return {
    keyType: keyType as DetectedKey['keyType'],
    value,
    normalizedValue: value.toUpperCase(),
    confidence: 0.9,
    sourceRef: { fileName, column, row },
  };
}

describe('detectDuplicates', () => {
  it('finds duplicates when same normalized value appears in multiple locations', () => {
    const keys: DetectedKey[] = [
      makeKey('abc123', 'product_id', 'file1.csv', 'ID', 1),
      makeKey('ABC123', 'product_id', 'file2.csv', 'ID', 2),
      makeKey('xyz789', 'product_id', 'file1.csv', 'ID', 3),
    ];
    const { duplicateGroups } = detectDuplicates(keys);
    expect(duplicateGroups.length).toBe(1);
    expect(duplicateGroups[0]!.normalizedValue).toBe('ABC123');
    expect(duplicateGroups[0]!.count).toBe(2);
  });

  it('returns empty when no duplicates', () => {
    const keys: DetectedKey[] = [
      makeKey('abc123', 'product_id', 'file1.csv', 'ID', 1),
      makeKey('xyz789', 'product_id', 'file1.csv', 'ID', 2),
    ];
    const { duplicateGroups } = detectDuplicates(keys);
    expect(duplicateGroups.length).toBe(0);
  });

  it('caps at MAX_DUPLICATE_GROUPS and emits warning', () => {
    const keys: DetectedKey[] = [];
    for (let i = 0; i < 60; i++) {
      keys.push(makeKey(`val${i}`, 'generic_id', 'file1.csv', 'col', i));
      keys.push(makeKey(`VAL${i}`, 'generic_id', 'file2.csv', 'col', i));
    }
    const { duplicateGroups, warnings } = detectDuplicates(keys);
    expect(duplicateGroups.length).toBeLessThanOrEqual(50);
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('caps locations per group at 25', () => {
    const keys: DetectedKey[] = [];
    for (let i = 0; i < 30; i++) {
      keys.push(makeKey('same', 'email', `file${i}.csv`, 'Email', i));
    }
    const { duplicateGroups } = detectDuplicates(keys);
    expect(duplicateGroups[0]!.locations.length).toBeLessThanOrEqual(25);
  });
});
