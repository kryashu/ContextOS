import { describe, it, expect } from 'vitest';
import { SourceRelationshipMapper } from '../source-relationship-mapper.js';
import type { SourceProfile } from '@contextos/types';

function profile(overrides: Partial<SourceProfile> & { fileName: string }): SourceProfile {
  return {
    sourceId: overrides.fileName,
    fileType: 'text',
    sourceKind: 'document',
    summary: '',
    detectedTopics: [],
    detectedEntities: [],
    relevanceScore: 0.8,
    warnings: [],
    ...overrides,
  };
}

describe('SourceRelationshipMapper', () => {
  const mapper = new SourceRelationshipMapper();

  it('detects shared topics between two documents', () => {
    const profiles = [
      profile({ fileName: 'api-spec.md', detectedTopics: ['authentication', 'users', 'endpoints'] }),
      profile({ fileName: 'auth-guide.md', detectedTopics: ['authentication', 'oauth', 'users'] }),
    ];
    const result = mapper.compute('ws_test', profiles);
    const sharedTopics = result.relationships.filter(r => r.type === 'shared_topic');
    expect(sharedTopics).toHaveLength(1);
    expect(sharedTopics[0]!.sourceA).toBe('api-spec.md');
    expect(sharedTopics[0]!.sourceB).toBe('auth-guide.md');
    expect(sharedTopics[0]!.evidence[0]).toContain('authentication');
  });

  it('detects shared entities between two documents', () => {
    const profiles = [
      profile({ fileName: 'device_config.json', sourceKind: 'config', detectedEntities: ['Cooling Tower', 'Water Plant'] }),
      profile({ fileName: 'manual.md', detectedEntities: ['Cooling Tower', 'Pump System'] }),
    ];
    const result = mapper.compute('ws_test', profiles);
    const sharedEntities = result.relationships.filter(r => r.type === 'shared_entity');
    expect(sharedEntities).toHaveLength(1);
    expect(sharedEntities[0]!.evidence[0]).toContain('cooling tower');
  });

  it('detects table ↔ document support', () => {
    const profiles = [
      profile({ fileName: 'sensor_logs.csv', sourceKind: 'data', detectedTopics: ['temperature', 'pressure'] }),
      profile({ fileName: 'calibration.md', detectedTopics: ['temperature', 'calibration procedures'] }),
    ];
    const result = mapper.compute('ws_test', profiles);
    const tableDoc = result.relationships.filter(r => r.type === 'table_document_support');
    expect(tableDoc).toHaveLength(1);
    expect(tableDoc[0]!.sourceA).toBe('sensor_logs.csv');
    expect(tableDoc[0]!.sourceB).toBe('calibration.md');
  });

  it('detects config ↔ document support', () => {
    const profiles = [
      profile({ fileName: 'device_config.json', sourceKind: 'config', detectedTopics: ['devices', 'alerts'], detectedEntities: ['Cooling Tower'] }),
      profile({ fileName: 'maintenance.md', sourceKind: 'document', detectedTopics: ['maintenance'], detectedEntities: ['Cooling Tower'] }),
    ];
    const result = mapper.compute('ws_test', profiles);
    const configDoc = result.relationships.filter(r => r.type === 'config_document_support');
    expect(configDoc).toHaveLength(1);
    expect(configDoc[0]!.sourceA).toBe('device_config.json');
    expect(configDoc[0]!.sourceB).toBe('maintenance.md');
  });

  it('detects possible duplicates with high topic/entity overlap', () => {
    const profiles = [
      profile({ fileName: 'readme.md', detectedTopics: ['setup', 'install', 'deploy'], detectedEntities: ['Docker', 'Kubernetes'] }),
      profile({ fileName: 'getting-started.md', detectedTopics: ['setup', 'install', 'deploy'], detectedEntities: ['Docker', 'Kubernetes'] }),
    ];
    const result = mapper.compute('ws_test', profiles);
    const dupes = result.relationships.filter(r => r.type === 'possible_duplicate');
    expect(dupes).toHaveLength(1);
    expect(dupes[0]!.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it('marks unconnected sources as isolated', () => {
    const profiles = [
      profile({ fileName: 'birthday_invite.txt', sourceKind: 'notes', detectedTopics: [], detectedEntities: [] }),
      profile({ fileName: 'device_config.json', sourceKind: 'config', detectedTopics: ['devices'], detectedEntities: ['Cooling Tower'] }),
      profile({ fileName: 'maintenance.md', detectedTopics: ['pumps'], detectedEntities: ['Cooling Tower'] }),
    ];
    const result = mapper.compute('ws_test', profiles);
    const isolated = result.relationships.filter(r => r.type === 'isolated_source');
    expect(isolated).toHaveLength(1);
    expect(isolated[0]!.sourceA).toBe('birthday_invite.txt');
  });

  it('handles GABA-like workspace: method notes linked to workbook via shared topics/entities', () => {
    const profiles = [
      profile({ fileName: 'gaba_results.xlsx', sourceKind: 'workbook', detectedTopics: ['gaba', 'concentration', 'treatment'], detectedEntities: ['GABA'] }),
      profile({ fileName: 'method_notes.md', sourceKind: 'document', detectedTopics: ['gaba', 'extraction method'], detectedEntities: ['GABA'] }),
      profile({ fileName: 'column_dictionary.md', sourceKind: 'document', detectedTopics: ['gaba', 'columns', 'treatment'], detectedEntities: ['GABA'] }),
    ];
    const result = mapper.compute('ws_test', profiles);
    // method_notes and column_dictionary should both link to gaba_results
    const tableDocRelationships = result.relationships.filter(r => r.type === 'table_document_support');
    const linkedToWorkbook = tableDocRelationships.filter(r => r.sourceA === 'gaba_results.xlsx');
    expect(linkedToWorkbook.length).toBeGreaterThanOrEqual(2);
  });

  it('handles legal lease workspace: agreement linked to addendum', () => {
    const profiles = [
      profile({ fileName: 'lease_agreement.md', detectedTopics: ['lease', 'tenant', 'property', 'rent'], detectedEntities: ['Property Owner LLC', 'John Tenant'] }),
      profile({ fileName: 'maintenance_addendum.md', detectedTopics: ['lease', 'maintenance', 'property'], detectedEntities: ['Property Owner LLC'] }),
    ];
    const result = mapper.compute('ws_test', profiles);
    const connected = result.relationships.filter(r => r.type !== 'isolated_source');
    expect(connected.length).toBeGreaterThanOrEqual(1);
    // Both should be connected, neither isolated
    const isolated = result.relationships.filter(r => r.type === 'isolated_source');
    expect(isolated).toHaveLength(0);
  });

  it('does not leak checkout/payment entities across unrelated workspaces', () => {
    // Diverse workspace with no checkout-related content
    const profiles = [
      profile({ fileName: 'sensor_logs.csv', sourceKind: 'data', detectedTopics: ['device_id', 'temperature'], detectedEntities: [] }),
      profile({ fileName: 'maintenance.md', detectedTopics: ['pump maintenance'], detectedEntities: ['Water Plant'] }),
    ];
    const result = mapper.compute('ws_test', profiles);
    // No relationship should contain checkout/payment language
    for (const r of result.relationships) {
      for (const e of r.evidence) {
        expect(e.toLowerCase()).not.toContain('checkout');
        expect(e.toLowerCase()).not.toContain('payment');
        expect(e.toLowerCase()).not.toContain('cart');
      }
    }
  });

  it('returns empty relationships for single-source workspace', () => {
    const profiles = [
      profile({ fileName: 'only_file.md', detectedTopics: ['topic'] }),
    ];
    const result = mapper.compute('ws_test', profiles);
    // Single source with topics should be isolated
    const isolated = result.relationships.filter(r => r.type === 'isolated_source');
    expect(isolated).toHaveLength(1);
    expect(result.relationships.filter(r => r.type !== 'isolated_source')).toHaveLength(0);
  });

  it('returns no relationships for empty workspace', () => {
    const result = mapper.compute('ws_test', []);
    expect(result.relationships).toHaveLength(0);
    expect(result.workspaceId).toBe('ws_test');
  });
});
