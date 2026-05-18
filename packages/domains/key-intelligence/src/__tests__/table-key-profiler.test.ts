import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { profileTableKeys } from '../table-key-profiler.js';

const TEST_DIR = resolve(process.cwd(), '.test-table-keys');
const SOURCES_DIR = resolve(TEST_DIR, 'sources');

describe('profileTableKeys', () => {
  beforeEach(() => {
    mkdirSync(SOURCES_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it('profiles key columns from CSV', () => {
    const csv = [
      'Email,Name,Product ID',
      'alice@test.com,Alice,PRD-001',
      'bob@test.com,Bob,PRD-002',
      'alice@test.com,Alice Dup,PRD-003',
    ].join('\n');
    writeFileSync(resolve(SOURCES_DIR, 'data.csv'), csv);

    const { keyProfiles, detectedKeys } = profileTableKeys(SOURCES_DIR);
    expect(keyProfiles.length).toBeGreaterThanOrEqual(1);

    const emailProfile = keyProfiles.find(p => p.keyType === 'email');
    expect(emailProfile).toBeDefined();
    expect(emailProfile!.duplicateCount).toBe(1); // alice@test.com appears twice

    expect(detectedKeys.length).toBeGreaterThan(0);
    expect(detectedKeys.some(k => k.keyType === 'email')).toBe(true);
  });

  it('returns empty for directory with no tables', () => {
    writeFileSync(resolve(SOURCES_DIR, 'readme.md'), '# Hello');
    const { keyProfiles, detectedKeys } = profileTableKeys(SOURCES_DIR);
    expect(keyProfiles).toEqual([]);
    expect(detectedKeys).toEqual([]);
  });

  it('respects fileScope filter', () => {
    writeFileSync(resolve(SOURCES_DIR, 'a.csv'), 'Email\nalice@test.com');
    writeFileSync(resolve(SOURCES_DIR, 'b.csv'), 'Phone\n+15551234567');

    const { keyProfiles } = profileTableKeys(SOURCES_DIR, ['a.csv']);
    expect(keyProfiles.every(p => p.fileName === 'a.csv')).toBe(true);
  });
});
