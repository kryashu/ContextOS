import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { analyzeKeys, findDuplicateKeys, findDocumentsForKey } from '../key-intelligence-engine.js';

const TEST_DIR = resolve(process.cwd(), '.test-engine');
const SOURCES_DIR = resolve(TEST_DIR, 'sources');
const OUTPUT_DIR = resolve(TEST_DIR, 'output');

describe('key-intelligence-engine', () => {
  beforeEach(() => {
    mkdirSync(SOURCES_DIR, { recursive: true });
    mkdirSync(resolve(OUTPUT_DIR, 'extracted-text'), { recursive: true });
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  describe('analyzeKeys', () => {
    it('returns full analysis for workspace with table and document data', () => {
      writeFileSync(resolve(SOURCES_DIR, 'data.csv'), 'Email,Name\nalice@test.com,Alice\nbob@test.com,Bob');
      writeFileSync(resolve(SOURCES_DIR, 'notes.md'), 'Contact alice@test.com for details');

      const result = analyzeKeys({ sourcesDir: SOURCES_DIR, outputDir: OUTPUT_DIR });
      expect(result.status).toBe('success');
      expect(result.keyProfiles.length).toBeGreaterThan(0);
      expect(result.documentMatches.length).toBeGreaterThan(0);
    });

    it('returns no_matches for empty workspace', () => {
      const result = analyzeKeys({ sourcesDir: SOURCES_DIR, outputDir: OUTPUT_DIR });
      expect(result.status).toBe('no_matches');
    });
  });

  describe('findDuplicateKeys', () => {
    it('finds duplicate emails across rows', () => {
      writeFileSync(
        resolve(SOURCES_DIR, 'contacts.csv'),
        'Email,Name\nalice@test.com,Alice\nbob@test.com,Bob\nalice@test.com,Alice2',
      );
      const result = findDuplicateKeys({ sourcesDir: SOURCES_DIR, outputDir: OUTPUT_DIR });
      expect(result.status).toBe('success');
      expect(result.duplicateGroups.length).toBeGreaterThanOrEqual(1);
      expect(result.duplicateGroups[0]!.normalizedValue).toBe('alice@test.com');
    });

    it('returns no_matches when no duplicates', () => {
      writeFileSync(resolve(SOURCES_DIR, 'data.csv'), 'Email\na@b.com\nc@d.com');
      const result = findDuplicateKeys({ sourcesDir: SOURCES_DIR, outputDir: OUTPUT_DIR });
      expect(result.status).toBe('no_matches');
    });

    it('filters by keyType when specified', () => {
      writeFileSync(
        resolve(SOURCES_DIR, 'mixed.csv'),
        'Email,Phone\nalice@test.com,+15551234567\nalice@test.com,+15559876543',
      );
      const result = findDuplicateKeys({ sourcesDir: SOURCES_DIR, outputDir: OUTPUT_DIR, keyType: 'email' });
      expect(result.duplicateGroups.every(g => g.keyType === 'email')).toBe(true);
    });
  });

  describe('findDocumentsForKey', () => {
    it('finds documents containing a specific key value', () => {
      writeFileSync(resolve(SOURCES_DIR, 'notes.md'), 'Contact: alice@test.com is the lead');
      const result = findDocumentsForKey({
        sourcesDir: SOURCES_DIR,
        outputDir: OUTPUT_DIR,
        value: 'alice@test.com',
      });
      expect(result.status).toBe('success');
      expect(result.documentMatches.length).toBeGreaterThanOrEqual(1);
    });

    it('returns no_matches for non-existent value', () => {
      writeFileSync(resolve(SOURCES_DIR, 'notes.md'), 'No emails here');
      const result = findDocumentsForKey({
        sourcesDir: SOURCES_DIR,
        outputDir: OUTPUT_DIR,
        value: 'nobody@nowhere.com',
      });
      expect(result.status).toBe('no_matches');
    });
  });
});
