import { describe, it, expect } from 'vitest';
import { RelationshipMapper } from '../relationship-mapper.js';
import type { Entity, Relationship, SourceReference } from '@contextos/types';

function makeEntity(overrides: Partial<Entity> & { name: string }): Entity {
  return {
    id: `ent_${overrides.name.toLowerCase().replace(/\s+/g, '_')}`,
    workspaceId: 'ws_test',
    type: 'system',
    description: undefined,
    metadata: {},
    sources: [],
    confidence: 0.9,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeRef(fileName: string): SourceReference {
  return { sourceId: `src_${fileName}`, fileName, sourceType: 'markdown' };
}

function makeRelationship(
  source: Entity,
  target: Entity,
  overrides: Partial<Relationship> = {}
): Relationship {
  return {
    id: `rel_${source.id}_${target.id}`,
    workspaceId: 'ws_test',
    type: 'calls',
    sourceEntityId: source.id,
    targetEntityId: target.id,
    description: `${source.name} calls ${target.name}`,
    metadata: {},
    sources: [],
    confidence: 0.9,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('RelationshipMapper', () => {
  const mapper = new RelationshipMapper();

  describe('buildGraph', () => {
    it('preserves sources on nodes', () => {
      const ref = makeRef('api-spec.md');
      const entity = makeEntity({ name: 'Checkout', sources: [ref] });

      const graph = mapper.buildGraph([entity], [], 'ws_test');

      expect(graph.nodes).toHaveLength(1);
      expect(graph.nodes[0]!.sources).toEqual([ref]);
    });

    it('preserves sources on edges', () => {
      const ref = makeRef('requirements.md');
      const a = makeEntity({ name: 'UserService' });
      const b = makeEntity({ name: 'Database' });
      const rel = makeRelationship(a, b, { sources: [ref] });

      const graph = mapper.buildGraph([a, b], [rel], 'ws_test');

      expect(graph.edges).toHaveLength(1);
      expect(graph.edges[0]!.sources).toEqual([ref]);
    });

    it('includes empty sources array when entity has none', () => {
      const entity = makeEntity({ name: 'Orphan', sources: [] });

      const graph = mapper.buildGraph([entity], [], 'ws_test');

      expect(graph.nodes[0]!.sources).toEqual([]);
    });
  });

  describe('mergeEntities', () => {
    it('consolidates sources from multiple files', () => {
      const ref1 = makeRef('api-spec.md');
      const ref2 = makeRef('deployment.md');
      const e1 = makeEntity({ name: 'Payment Service', sources: [ref1], confidence: 0.7 });
      const e2 = makeEntity({ name: 'Payment Service', sources: [ref2], confidence: 0.95 });

      const merged = mapper.mergeEntities([e1, e2]);

      expect(merged).toHaveLength(1);
      expect(merged[0]!.sources).toHaveLength(2);
      expect(merged[0]!.sources).toContainEqual(ref1);
      expect(merged[0]!.sources).toContainEqual(ref2);
      expect(merged[0]!.confidence).toBe(0.95);
    });
  });
});
