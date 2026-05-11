import { describe, it, expect } from 'vitest';
import type { Source } from '@contextos/types';
import { SourceProfiler } from '../source-profiler.js';

function makeSource(overrides: Partial<Source>): Source {
  return {
    id: 'src_1',
    workspaceId: 'ws_1',
    fileName: 'test.md',
    filePath: '/tmp/test.md',
    fileType: 'markdown',
    fileSize: 100,
    fileHash: 'abc',
    rawContent: '',
    status: 'completed',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('SourceProfiler', () => {
  const profiler = new SourceProfiler();

  it('profiles a markdown file as document', () => {
    const src = makeSource({
      fileName: 'readme.md',
      fileType: 'markdown',
      rawContent: '# Architecture\n\nThis describes the system.\n\n## Components\n\nDetails here.',
    });

    const profile = profiler.profileSource(src);
    expect(profile.sourceKind).toBe('document');
    expect(profile.detectedTopics).toContain('Architecture');
    expect(profile.detectedTopics).toContain('Components');
    expect(profile.relevanceScore).toBeGreaterThanOrEqual(0.7);
    expect(profile.warnings).toHaveLength(0);
  });

  it('profiles a csv file as data', () => {
    const src = makeSource({
      fileName: 'sales.csv',
      fileType: 'csv',
      rawContent: 'product,revenue,quantity\nWidget,100,10\nGadget,200,5',
    });

    const profile = profiler.profileSource(src);
    expect(profile.sourceKind).toBe('data');
    expect(profile.detectedTopics).toEqual(['product', 'revenue', 'quantity']);
    expect(profile.relevanceScore).toBeGreaterThanOrEqual(0.5);
  });

  it('profiles an xlsx file as workbook', () => {
    const src = makeSource({
      fileName: 'report.xlsx',
      fileType: 'xlsx',
      rawContent: 'Sheet: Revenue\nTable Block: Q1\nvalues...',
    });

    const profile = profiler.profileSource(src);
    expect(profile.sourceKind).toBe('workbook');
    expect(profile.detectedTopics).toContain('Revenue');
  });

  it('profiles a json object as config', () => {
    const src = makeSource({
      fileName: 'config.json',
      fileType: 'json',
      rawContent: JSON.stringify({ name: 'app', version: '1.0', port: 3000 }),
    });

    const profile = profiler.profileSource(src);
    expect(profile.sourceKind).toBe('config');
    expect(profile.detectedTopics).toContain('name');
    expect(profile.detectedTopics).toContain('version');
  });

  it('profiles a json array as data', () => {
    const src = makeSource({
      fileName: 'records.json',
      fileType: 'json',
      rawContent: JSON.stringify([{ a: 1 }, { a: 2 }]),
    });

    const profile = profiler.profileSource(src);
    expect(profile.sourceKind).toBe('data');
  });

  it('profiles a yaml file as config', () => {
    const src = makeSource({
      fileName: 'deploy.yaml',
      fileType: 'yaml',
      rawContent: 'apiVersion: v1\nkind: Deployment\nmetadata:\n  name: app',
    });

    const profile = profiler.profileSource(src);
    expect(profile.sourceKind).toBe('config');
    expect(profile.detectedTopics).toContain('apiVersion');
    expect(profile.detectedTopics).toContain('kind');
  });

  it('profiles a text file as notes', () => {
    const src = makeSource({
      fileName: 'notes.txt',
      fileType: 'text',
      rawContent: 'Meeting notes from Friday.\nDiscuss budget for Q2.',
    });

    const profile = profiler.profileSource(src);
    expect(profile.sourceKind).toBe('notes');
  });

  it('warns on empty files', () => {
    const src = makeSource({
      fileName: 'empty.md',
      fileType: 'markdown',
      rawContent: '',
    });

    const profile = profiler.profileSource(src);
    expect(profile.warnings.length).toBeGreaterThan(0);
    expect(profile.warnings[0]).toMatch(/empty/i);
    expect(profile.relevanceScore).toBeLessThanOrEqual(0.2);
  });

  it('warns on unknown file types', () => {
    const src = makeSource({
      fileName: 'something.xyz',
      fileType: 'unknown',
      rawContent: 'some content',
    });

    const profile = profiler.profileSource(src);
    expect(profile.sourceKind).toBe('unknown');
    expect(profile.warnings).toContain('Unrecognized file type');
  });

  it('truncates long summaries to ~200 chars', () => {
    const longContent = 'A '.repeat(200);
    const src = makeSource({ rawContent: longContent });
    const profile = profiler.profileSource(src);
    expect(profile.summary.length).toBeLessThanOrEqual(210);
    expect(profile.summary).toMatch(/…$/);
  });

  it('profileAll returns profiles for all sources', () => {
    const sources = [
      makeSource({ id: '1', fileName: 'a.md', rawContent: '# A' }),
      makeSource({ id: '2', fileName: 'b.csv', fileType: 'csv', rawContent: 'h1,h2\n1,2' }),
    ];
    const profiles = profiler.profileAll(sources);
    expect(profiles).toHaveLength(2);
    expect(profiles[0]!.sourceId).toBe('1');
    expect(profiles[1]!.sourceId).toBe('2');
  });

  it('extracts capitalized multi-word entities', () => {
    const src = makeSource({
      rawContent: 'The Payment Gateway connects to Stripe Service and handles Order Processing for each Customer Account.',
    });
    const profile = profiler.profileSource(src);
    expect(profile.detectedEntities).toContain('Payment Gateway');
    expect(profile.detectedEntities).toContain('Stripe Service');
    expect(profile.detectedEntities).toContain('Order Processing');
    expect(profile.detectedEntities).toContain('Customer Account');
  });
});
