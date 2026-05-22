import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { explainSourceFile } from '../tools/explain-source-file.js';
import type { ToolExecutionContext } from '../types.js';

describe('explainSourceFile', () => {
  let tmpDir: string;
  let sourcesDir: string;
  let outputDir: string;
  let ctx: ToolExecutionContext;

  beforeAll(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'esf-'));
    sourcesDir = join(tmpDir, 'sources');
    outputDir = join(tmpDir, 'output');
    mkdirSync(sourcesDir, { recursive: true });
    mkdirSync(outputDir, { recursive: true });
    mkdirSync(join(outputDir, 'extracted-text'), { recursive: true });

    writeFileSync(
      join(sourcesDir, 'irrelevant_hr_policy.txt'),
      'HR vacation policy.\n\nEmployees may take up to 20 days of annual leave.\n\nFor questions contact HR.',
    );
    writeFileSync(join(sourcesDir, 'release_notes_ABC-123.pdf'), 'binary');
    writeFileSync(
      join(outputDir, 'extracted-text', 'release_notes_ABC-123.pdf.txt'),
      'Release notes for ABC-123.\n\nThis release ships feature X and bugfix Y.',
    );
    writeFileSync(
      join(sourcesDir, 'product_contacts.csv'),
      'name,email\nAlice,a@b.com\nBob,b@c.com\n',
    );
    writeFileSync(
      join(outputDir, 'source-profiles.json'),
      JSON.stringify([
        {
          sourceId: 's1',
          fileName: 'irrelevant_hr_policy.txt',
          fileType: 'txt',
          sourceKind: 'document',
          summary: 'HR policy',
          detectedTopics: ['hr'],
          detectedEntities: [],
          relevanceScore: 0.1,
          warnings: [],
        },
      ]),
    );

    ctx = {
      workspaceId: 'ws_test',
      outputDir,
      sourcesDir,
      manifestPath: join(outputDir, 'analysis-manifest.json'),
    };
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('reads plain-text file and returns snippets with sourceRef', async () => {
    const res = await explainSourceFile.execute(
      { workspaceId: 'ws_test', fileName: 'irrelevant_hr_policy.txt' },
      ctx,
    );
    expect(res.status).toBe('success');
    expect(res.resolvedFileName).toBe('irrelevant_hr_policy.txt');
    expect(res.snippets.length).toBeGreaterThan(0);
    expect(res.snippets[0]!.sourceRef.fileName).toBe('irrelevant_hr_policy.txt');
    expect(res.summary).toBeTruthy();
  });

  it('reads PDF via extracted-text fallback; sourceRef keeps original .pdf name', async () => {
    const res = await explainSourceFile.execute(
      { workspaceId: 'ws_test', fileName: 'release_notes_ABC-123.pdf' },
      ctx,
    );
    expect(res.status).toBe('success');
    expect(res.snippets[0]!.sourceRef.fileName).toBe('release_notes_ABC-123.pdf');
    expect(res.snippets[0]!.text).toMatch(/Release notes|ABC-123|feature X|bugfix Y/);
  });

  it('summarizes CSV with header + rowCount', async () => {
    const res = await explainSourceFile.execute(
      { workspaceId: 'ws_test', fileName: 'product_contacts.csv' },
      ctx,
    );
    expect(res.status).toBe('success');
    expect(res.summary).toMatch(/CSV|csv|row/i);
  });

  it('fuzzy-resolves typo and adds a warning that name was corrected', async () => {
    const res = await explainSourceFile.execute(
      { workspaceId: 'ws_test', fileName: 'irrelevan_hr_policy.txt' },
      ctx,
    );
    expect(res.status).toBe('success');
    expect(res.resolvedFileName).toBe('irrelevant_hr_policy.txt');
    expect(res.warnings.some((w) => /irrelevan_hr_policy/.test(w) || /resolved|fuzz|interpreted|corrected/i.test(w))).toBe(true);
  });

  it('returns no_matches for unknown filename', async () => {
    const res = await explainSourceFile.execute(
      { workspaceId: 'ws_test', fileName: 'totally_unknown_xyz.txt' },
      ctx,
    );
    expect(['no_matches', 'needs_clarification']).toContain(res.status);
  });

  it('resolves by sourceHint when filename omitted', async () => {
    const res = await explainSourceFile.execute(
      { workspaceId: 'ws_test', sourceHint: 'hr policy' },
      ctx,
    );
    expect(res.status).toBe('success');
    expect(res.resolvedFileName).toBe('irrelevant_hr_policy.txt');
  });

  // ── VS018.3.1: row content queries ─────────────────────────────────

  it('returns first row as Field/Value pairs (rowRequest first)', async () => {
    const res = await explainSourceFile.execute(
      {
        workspaceId: 'ws_test',
        fileName: 'product_contacts.csv',
        rowRequest: { type: 'first' },
      },
      ctx,
    );
    expect(res.status).toBe('success');
    expect(res.dataRow).toBe(1);
    expect(res.rowContent).toEqual([
      { field: 'name', value: 'Alice' },
      { field: 'email', value: 'a@b.com' },
    ]);
    expect(res.snippets[0]!.sourceRef.sourceRange).toBe('data row 1');
    expect(res.snippets[0]!.sourceRef.row).toBe(1);
  });

  it('returns last row when rowRequest type is last', async () => {
    const res = await explainSourceFile.execute(
      {
        workspaceId: 'ws_test',
        fileName: 'product_contacts.csv',
        rowRequest: { type: 'last' },
      },
      ctx,
    );
    expect(res.status).toBe('success');
    expect(res.dataRow).toBe(2);
    expect(res.rowContent).toEqual([
      { field: 'name', value: 'Bob' },
      { field: 'email', value: 'b@c.com' },
    ]);
  });

  it('returns headers when rowRequest type is headers', async () => {
    const res = await explainSourceFile.execute(
      {
        workspaceId: 'ws_test',
        fileName: 'product_contacts.csv',
        rowRequest: { type: 'headers' },
      },
      ctx,
    );
    expect(res.status).toBe('success');
    expect(res.headers).toEqual(['name', 'email']);
  });

  it('returns no_matches with helpful range when row out of bounds', async () => {
    const res = await explainSourceFile.execute(
      {
        workspaceId: 'ws_test',
        fileName: 'product_contacts.csv',
        rowRequest: { type: 'number', rowNumber: 99 },
      },
      ctx,
    );
    expect(res.status).toBe('no_matches');
    expect(res.summary).toBe(
      'I found product_contacts.csv, but it has only 2 data row(s). Please choose a row between 1 and 2.',
    );
    expect(res.warnings).toContain(
      'I found product_contacts.csv, but it has only 2 data row(s). Please choose a row between 1 and 2.',
    );
  });

  it('resolves by sourceHint "product_contacts" → product_contacts.csv with rowRequest', async () => {
    const res = await explainSourceFile.execute(
      {
        workspaceId: 'ws_test',
        sourceHint: 'product_contacts',
        rowRequest: { type: 'first' },
      },
      ctx,
    );
    expect(res.status).toBe('success');
    expect(res.resolvedFileName).toBe('product_contacts.csv');
    expect(res.rowContent?.[0]).toEqual({ field: 'name', value: 'Alice' });
  });
});
