import { describe, it, expect } from 'vitest';
import { mapKeyRelationships } from '../key-relationship-mapper.js';
import type { DetectedKey, DocumentKeyMatch } from '../types.js';

describe('mapKeyRelationships', () => {
  it('links table keys to document matches with same normalized value', () => {
    const tableKeys: DetectedKey[] = [
      {
        keyType: 'email',
        value: 'alice@example.com',
        normalizedValue: 'alice@example.com',
        confidence: 0.9,
        sourceRef: { fileName: 'contacts.csv', column: 'Email', row: 1 },
      },
    ];
    const docMatches: DocumentKeyMatch[] = [
      {
        fileName: 'notes.md',
        keyType: 'email',
        value: 'alice@example.com',
        normalizedValue: 'alice@example.com',
        evidence: 'Contact: alice@example.com',
        sourceRef: { fileName: 'notes.md' },
      },
    ];

    const relationships = mapKeyRelationships(tableKeys, docMatches);
    expect(relationships.length).toBe(1);
    expect(relationships[0]!.value).toBe('alice@example.com');
    expect(relationships[0]!.tableMatches.length).toBe(1);
    expect(relationships[0]!.documentMatches.length).toBe(1);
    expect(relationships[0]!.confidence).toBe(0.95);
  });

  it('reduces confidence when types differ', () => {
    const tableKeys: DetectedKey[] = [
      {
        keyType: 'generic_id',
        value: 'REF001',
        normalizedValue: 'REF001',
        confidence: 0.6,
        sourceRef: { fileName: 'data.csv', column: 'Ref', row: 1 },
      },
    ];
    const docMatches: DocumentKeyMatch[] = [
      {
        fileName: 'doc.md',
        keyType: 'order_id',
        value: 'REF001',
        normalizedValue: 'REF001',
        evidence: 'Order REF001',
        sourceRef: { fileName: 'doc.md' },
      },
    ];

    const relationships = mapKeyRelationships(tableKeys, docMatches);
    expect(relationships.length).toBe(1);
    expect(relationships[0]!.confidence).toBe(0.75);
  });

  it('returns empty when no shared values', () => {
    const tableKeys: DetectedKey[] = [
      {
        keyType: 'email',
        value: 'a@b.com',
        normalizedValue: 'a@b.com',
        confidence: 0.9,
        sourceRef: { fileName: 'f.csv', column: 'E', row: 1 },
      },
    ];
    const docMatches: DocumentKeyMatch[] = [
      {
        fileName: 'doc.md',
        keyType: 'email',
        value: 'x@y.com',
        normalizedValue: 'x@y.com',
        evidence: 'x@y.com',
        sourceRef: { fileName: 'doc.md' },
      },
    ];

    const relationships = mapKeyRelationships(tableKeys, docMatches);
    expect(relationships.length).toBe(0);
  });
});
