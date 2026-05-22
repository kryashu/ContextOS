import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  levenshtein,
  resolveWorkspaceSourceFile,
} from '../resolve-workspace-source.js';

describe('levenshtein', () => {
  it('returns 0 for identical strings', () => {
    expect(levenshtein('abc', 'abc')).toBe(0);
  });
  it('returns length for one empty string', () => {
    expect(levenshtein('', 'abc')).toBe(3);
    expect(levenshtein('abc', '')).toBe(3);
  });
  it('counts single insertions/deletions', () => {
    expect(levenshtein('irrelevant', 'irrelevan')).toBe(1);
  });
  it('counts substitutions', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3);
  });
});

describe('resolveWorkspaceSourceFile', () => {
  let tmpDir: string;
  let sourcesDir: string;
  let outputDir: string;

  beforeAll(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'rws-'));
    sourcesDir = join(tmpDir, 'sources');
    outputDir = join(tmpDir, 'output');
    mkdirSync(sourcesDir, { recursive: true });
    mkdirSync(outputDir, { recursive: true });
    writeFileSync(join(sourcesDir, 'irrelevant_hr_policy.txt'), 'x');
    writeFileSync(join(sourcesDir, 'release_notes_ABC-123.pdf'), 'x');
    writeFileSync(join(sourcesDir, 'deployment_checklist_APP-404.docx'), 'x');
    writeFileSync(join(sourcesDir, 'product_contacts.csv'), 'x');
    writeFileSync(
      join(outputDir, 'source-profiles.json'),
      JSON.stringify([
        {
          sourceId: 's1',
          fileName: 'deployment_checklist_APP-404.docx',
          fileType: 'docx',
          sourceKind: 'document',
          summary: 'Deployment checklist for the APP-404 release.',
          detectedTopics: ['deployment'],
          detectedEntities: ['APP-404'],
          relevanceScore: 0.8,
          warnings: [],
        },
        {
          sourceId: 's2',
          fileName: 'irrelevant_hr_policy.txt',
          fileType: 'txt',
          sourceKind: 'document',
          summary: 'HR vacation policy unrelated to product workspace.',
          detectedTopics: ['hr'],
          detectedEntities: [],
          relevanceScore: 0.1,
          warnings: [],
        },
      ]),
    );
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('resolves exact filename match', () => {
    const r = resolveWorkspaceSourceFile(
      { fileName: 'irrelevant_hr_policy.txt' },
      sourcesDir,
      outputDir,
    );
    expect(r.status).toBe('exact');
    expect(r.resolvedFileName).toBe('irrelevant_hr_policy.txt');
  });

  it('resolves case-insensitive match', () => {
    const r = resolveWorkspaceSourceFile(
      { fileName: 'IRRELEVANT_HR_POLICY.TXT' },
      sourcesDir,
      outputDir,
    );
    expect(r.status).toBe('resolved');
    expect(r.resolvedFileName).toBe('irrelevant_hr_policy.txt');
  });

  it('resolves fuzzy typo via Levenshtein (same extension)', () => {
    const r = resolveWorkspaceSourceFile(
      { fileName: 'irrelevan_hr_policy.txt' },
      sourcesDir,
      outputDir,
    );
    expect(['resolved', 'exact']).toContain(r.status);
    expect(r.resolvedFileName).toBe('irrelevant_hr_policy.txt');
  });

  it('returns no_matches for completely unknown file', () => {
    const r = resolveWorkspaceSourceFile(
      { fileName: 'totally_unknown_xyz.txt' },
      sourcesDir,
      outputDir,
    );
    expect(['no_matches', 'needs_clarification']).toContain(r.status);
  });

  it('resolves sourceHint by filename tokens (Tier 5)', () => {
    const r = resolveWorkspaceSourceFile(
      { sourceHint: 'deployment checklist' },
      sourcesDir,
      outputDir,
    );
    expect(['resolved', 'exact']).toContain(r.status);
    expect(r.resolvedFileName).toBe('deployment_checklist_APP-404.docx');
  });

  it('resolves sourceHint by profile summary (Tier 6)', () => {
    const r = resolveWorkspaceSourceFile(
      { sourceHint: 'vacation policy' },
      sourcesDir,
      outputDir,
    );
    expect(['resolved', 'exact']).toContain(r.status);
    expect(r.resolvedFileName).toBe('irrelevant_hr_policy.txt');
  });

  it('returns no_matches when sourceHint matches nothing', () => {
    const r = resolveWorkspaceSourceFile(
      { sourceHint: 'quantum reactor manual' },
      sourcesDir,
      outputDir,
    );
    expect(['no_matches', 'needs_clarification']).toContain(r.status);
  });
});
