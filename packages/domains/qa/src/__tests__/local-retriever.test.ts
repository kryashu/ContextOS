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

  // ── getRelatedSources (VS008) ────────────────────────────────────

  it('getRelatedSources returns related files for a given fileName', () => {
    writeFileSync(
      resolve(outputDir, 'workspace-relationships.json'),
      JSON.stringify({
        workspaceId: 'ws_test',
        generatedAt: new Date().toISOString(),
        relationships: [
          { sourceA: 'method_notes.md', sourceB: 'gaba_data.xlsx', type: 'table_document_support', confidence: 0.86, evidence: ['supports'] },
          { sourceA: 'column_dict.md', sourceB: 'gaba_data.xlsx', type: 'table_document_support', confidence: 0.78, evidence: ['columns'] },
          { sourceA: 'unrelated.md', sourceB: '', type: 'isolated_source', confidence: 1.0, evidence: ['No shared topics'] },
        ],
      }),
    );

    const retriever = new LocalRetriever(outputDir, sourcesDir);
    const rels = retriever.getRelatedSources('gaba_data.xlsx');

    expect(rels).toHaveLength(2);
    expect(rels[0]!.sourceA).toBe('method_notes.md');
    expect(rels[0]!.confidence).toBeGreaterThanOrEqual(rels[1]!.confidence);
  });

  it('getRelatedSources excludes isolated_source type', () => {
    writeFileSync(
      resolve(outputDir, 'workspace-relationships.json'),
      JSON.stringify({
        workspaceId: 'ws_test',
        generatedAt: new Date().toISOString(),
        relationships: [
          { sourceA: 'lonely.txt', sourceB: '', type: 'isolated_source', confidence: 1.0, evidence: ['No shared topics'] },
        ],
      }),
    );

    const retriever = new LocalRetriever(outputDir, sourcesDir);
    expect(retriever.getRelatedSources('lonely.txt')).toEqual([]);
  });

  it('getRelatedSources returns empty when no relationships file exists', () => {
    const retriever = new LocalRetriever(outputDir, sourcesDir);
    expect(retriever.getRelatedSources('anything.md')).toEqual([]);
  });

  it('getRelatedSources results are sorted by confidence desc', () => {
    writeFileSync(
      resolve(outputDir, 'workspace-relationships.json'),
      JSON.stringify({
        workspaceId: 'ws_test',
        generatedAt: new Date().toISOString(),
        relationships: [
          { sourceA: 'low.md', sourceB: 'data.csv', type: 'shared_topic', confidence: 0.4, evidence: ['weak'] },
          { sourceA: 'high.md', sourceB: 'data.csv', type: 'shared_entity', confidence: 0.95, evidence: ['strong'] },
          { sourceA: 'mid.md', sourceB: 'data.csv', type: 'shared_topic', confidence: 0.7, evidence: ['medium'] },
        ],
      }),
    );

    const retriever = new LocalRetriever(outputDir, sourcesDir);
    const rels = retriever.getRelatedSources('data.csv');
    expect(rels).toHaveLength(3);
    expect(rels[0]!.confidence).toBe(0.95);
    expect(rels[1]!.confidence).toBe(0.7);
    expect(rels[2]!.confidence).toBe(0.4);
  });

  // ── searchWithRelationships (VS008) ──────────────────────────────

  it('searchWithRelationships expands direct results with related files', () => {
    // Direct match file
    writeFileSync(resolve(sourcesDir, 'gaba_data.csv'), 'gaba,treatment,dose\n100,placebo,5mg\n');
    // Related file (no keyword overlap — included only via relationship, high confidence triggers header snippet)
    writeFileSync(resolve(sourcesDir, 'method_notes.md'), 'The assay protocol follows standard procedures for dose escalation studies.');

    writeFileSync(
      resolve(outputDir, 'workspace-relationships.json'),
      JSON.stringify({
        workspaceId: 'ws_test',
        generatedAt: new Date().toISOString(),
        relationships: [
          { sourceA: 'method_notes.md', sourceB: 'gaba_data.csv', type: 'table_document_support', confidence: 0.86, evidence: ['supports'] },
        ],
      }),
    );

    const retriever = new LocalRetriever(outputDir, sourcesDir);
    const results = retriever.searchWithRelationships('gaba treatment');

    expect(results.length).toBeGreaterThanOrEqual(2);
    // Direct snippet comes first
    expect(results[0]!.fileName).toBe('gaba_data.csv');
    expect(results[0]!.isRelated).toBeUndefined();
    // Related snippet comes second
    const related = results.find(r => r.isRelated);
    expect(related).toBeDefined();
    expect(related!.fileName).toBe('method_notes.md');
    expect(related!.relationshipType).toBe('table_document_support');
    expect(related!.relationshipReason).toContain('gaba_data.csv');
    expect(related!.relationshipConfidence).toBe(0.86);
    expect(related!.snippet).toContain('assay protocol');
  });

  it('searchWithRelationships does NOT include isolated files via expansion', () => {
    writeFileSync(resolve(sourcesDir, 'data.csv'), 'gaba,value\n100,200\n');
    writeFileSync(resolve(sourcesDir, 'isolated.txt'), 'This file has gaba mentions but is isolated.');

    writeFileSync(
      resolve(outputDir, 'workspace-relationships.json'),
      JSON.stringify({
        workspaceId: 'ws_test',
        generatedAt: new Date().toISOString(),
        relationships: [
          { sourceA: 'isolated.txt', sourceB: '', type: 'isolated_source', confidence: 1.0, evidence: ['No shared topics'] },
        ],
      }),
    );

    const retriever = new LocalRetriever(outputDir, sourcesDir);
    const results = retriever.searchWithRelationships('gaba');

    // isolated.txt may appear as direct match (keyword match), but not as related
    const relatedIsolated = results.find(r => r.isRelated && r.fileName === 'isolated.txt');
    expect(relatedIsolated).toBeUndefined();
  });

  it('searchWithRelationships direct match beats related match in ordering', () => {
    writeFileSync(resolve(sourcesDir, 'primary.md'), 'The clinical trial enrolled 350 patients.');
    writeFileSync(resolve(sourcesDir, 'supporting.md'), 'The clinical protocol was reviewed by the ethics board.');

    writeFileSync(
      resolve(outputDir, 'workspace-relationships.json'),
      JSON.stringify({
        workspaceId: 'ws_test',
        generatedAt: new Date().toISOString(),
        relationships: [
          { sourceA: 'supporting.md', sourceB: 'primary.md', type: 'shared_topic', confidence: 0.9, evidence: ['clinical'] },
        ],
      }),
    );

    const retriever = new LocalRetriever(outputDir, sourcesDir);
    const results = retriever.searchWithRelationships('clinical trial patients');

    // primary.md is direct (has "clinical", "trial", "patients" — 3 keywords)
    // supporting.md is direct too (has "clinical") but with lower score
    // Direct matches must all come before any related matches
    const firstRelatedIdx = results.findIndex(r => r.isRelated);
    if (firstRelatedIdx !== -1) {
      for (let i = 0; i < firstRelatedIdx; i++) {
        expect(results[i]!.isRelated).toBeUndefined();
      }
    }
  });

  it('searchWithRelationships includes header snippet for high-confidence related file without keyword match', () => {
    writeFileSync(resolve(sourcesDir, 'data.csv'), 'gaba,value\n100,200\n');
    // No keyword overlap, but high confidence relationship
    writeFileSync(resolve(sourcesDir, 'column_dict.md'), 'Column A: measurement unit in mg/dL. Column B: patient identifier code.');

    writeFileSync(
      resolve(outputDir, 'workspace-relationships.json'),
      JSON.stringify({
        workspaceId: 'ws_test',
        generatedAt: new Date().toISOString(),
        relationships: [
          { sourceA: 'column_dict.md', sourceB: 'data.csv', type: 'table_document_support', confidence: 0.85, evidence: ['column definitions'] },
        ],
      }),
    );

    const retriever = new LocalRetriever(outputDir, sourcesDir);
    const results = retriever.searchWithRelationships('gaba');

    const related = results.find(r => r.isRelated && r.fileName === 'column_dict.md');
    expect(related).toBeDefined();
    expect(related!.snippet).toContain('Column A');
  });

  it('searchWithRelationships excludes low-confidence related source without keyword match', () => {
    writeFileSync(resolve(sourcesDir, 'data.csv'), 'gaba,value\n100,200\n');
    // No keyword overlap AND low confidence
    writeFileSync(resolve(sourcesDir, 'weak_link.md'), 'Unrelated content about weather patterns.');

    writeFileSync(
      resolve(outputDir, 'workspace-relationships.json'),
      JSON.stringify({
        workspaceId: 'ws_test',
        generatedAt: new Date().toISOString(),
        relationships: [
          { sourceA: 'weak_link.md', sourceB: 'data.csv', type: 'shared_topic', confidence: 0.4, evidence: ['weak overlap'] },
        ],
      }),
    );

    const retriever = new LocalRetriever(outputDir, sourcesDir);
    const results = retriever.searchWithRelationships('gaba');

    const related = results.find(r => r.isRelated && r.fileName === 'weak_link.md');
    expect(related).toBeUndefined();
  });

  it('searchWithRelationships respects MAX_RELATED_FILES cap', () => {
    writeFileSync(resolve(sourcesDir, 'main.md'), 'gaba treatment analysis results');
    writeFileSync(resolve(sourcesDir, 'rel1.md'), 'gaba notes part 1');
    writeFileSync(resolve(sourcesDir, 'rel2.md'), 'gaba notes part 2');
    writeFileSync(resolve(sourcesDir, 'rel3.md'), 'gaba notes part 3');
    writeFileSync(resolve(sourcesDir, 'rel4.md'), 'gaba notes part 4');

    writeFileSync(
      resolve(outputDir, 'workspace-relationships.json'),
      JSON.stringify({
        workspaceId: 'ws_test',
        generatedAt: new Date().toISOString(),
        relationships: [
          { sourceA: 'rel1.md', sourceB: 'main.md', type: 'shared_topic', confidence: 0.9, evidence: ['gaba'] },
          { sourceA: 'rel2.md', sourceB: 'main.md', type: 'shared_topic', confidence: 0.85, evidence: ['gaba'] },
          { sourceA: 'rel3.md', sourceB: 'main.md', type: 'shared_topic', confidence: 0.8, evidence: ['gaba'] },
          { sourceA: 'rel4.md', sourceB: 'main.md', type: 'shared_topic', confidence: 0.75, evidence: ['gaba'] },
        ],
      }),
    );

    const retriever = new LocalRetriever(outputDir, sourcesDir);
    const results = retriever.searchWithRelationships('gaba treatment');

    // rel1-4 will show up as direct matches too (they contain "gaba")
    // But only up to 3 should appear as *related* entries
    const relatedOnly = results.filter(r => r.isRelated);
    expect(relatedOnly.length).toBeLessThanOrEqual(3);
  });

  it('searchSourceFiles includes score in returned snippets', () => {
    writeFileSync(resolve(sourcesDir, 'multi.md'), 'clinical trial patients enrolled in hospitals');
    const retriever = new LocalRetriever(outputDir, sourcesDir);
    const results = retriever.searchSourceFiles('clinical trial patients');

    expect(results.length).toBe(1);
    expect(results[0]!.score).toBeGreaterThan(0);
  });
});
