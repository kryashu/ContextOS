import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { LocalRetriever } from '../local-retriever.js';

describe('LocalRetriever', () => {
  const base = resolve(tmpdir(), `contextos-qa-test-${Date.now()}`);
  const outputDir = resolve(base, 'output');
  const sourcesDir = resolve(base, 'sources');

  beforeEach(() => {
    mkdirSync(outputDir, { recursive: true });
    mkdirSync(sourcesDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(base, { recursive: true, force: true });
  });

  it('returns null when workspace-context.json is missing', () => {
    const retriever = new LocalRetriever(outputDir, sourcesDir);
    expect(retriever.loadWorkspaceContext()).toBeNull();
  });

  it('loads workspace-context.json when present', () => {
    writeFileSync(
      resolve(outputDir, 'workspace-context.json'),
      JSON.stringify({ summary: 'test workspace', detectedCapabilities: {} }),
    );
    const retriever = new LocalRetriever(outputDir, sourcesDir);
    const ctx = retriever.loadWorkspaceContext();
    expect(ctx).not.toBeNull();
    expect(ctx!.summary).toBe('test workspace');
  });

  it('returns null when source-profiles.json is missing', () => {
    const retriever = new LocalRetriever(outputDir, sourcesDir);
    expect(retriever.loadSourceProfiles()).toBeNull();
  });

  it('searches source files by keyword', () => {
    writeFileSync(
      resolve(sourcesDir, 'notes.md'),
      'The clinical trial enrolled 200 patients across three hospitals.',
    );
    writeFileSync(
      resolve(sourcesDir, 'readme.txt'),
      'This project has no relation to the query.',
    );

    const retriever = new LocalRetriever(outputDir, sourcesDir);
    const results = retriever.searchSourceFiles('clinical trial patients');

    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0]!.fileName).toBe('notes.md');
    expect(results[0]!.snippet).toContain('clinical trial');
  });

  it('returns empty array when no keywords match', () => {
    writeFileSync(resolve(sourcesDir, 'data.csv'), 'a,b,c\n1,2,3\n');
    const retriever = new LocalRetriever(outputDir, sourcesDir);
    expect(retriever.searchSourceFiles('xylophone')).toEqual([]);
  });

  it('skips non-text extensions', () => {
    writeFileSync(resolve(sourcesDir, 'image.png'), 'clinical trial data');
    const retriever = new LocalRetriever(outputDir, sourcesDir);
    expect(retriever.searchSourceFiles('clinical')).toEqual([]);
  });

  it('returns null when workspace-relationships.json is missing', () => {
    const retriever = new LocalRetriever(outputDir, sourcesDir);
    expect(retriever.loadWorkspaceRelationships()).toBeNull();
  });

  it('loads workspace-relationships.json when present', () => {
    writeFileSync(
      resolve(outputDir, 'workspace-relationships.json'),
      JSON.stringify({
        workspaceId: 'ws_test',
        generatedAt: new Date().toISOString(),
        relationships: [
          { sourceA: 'a.md', sourceB: 'b.md', type: 'shared_topic', confidence: 0.8, evidence: ['Shared topics: pumps'] },
        ],
      }),
    );
    const retriever = new LocalRetriever(outputDir, sourcesDir);
    const relMap = retriever.loadWorkspaceRelationships();
    expect(relMap).not.toBeNull();
    expect(relMap!.relationships).toHaveLength(1);
    expect(relMap!.relationships[0]!.type).toBe('shared_topic');
  });
});
