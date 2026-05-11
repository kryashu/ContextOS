import type { Entity, Relationship, RelationshipGraph, GraphNode, GraphEdge } from '@contextos/types';

/**
 * RelationshipMapper builds an in-memory graph of entities and relationships
 */
export class RelationshipMapper {
  /**
   * Build a relationship graph from entities and relationships
   */
  buildGraph(
    entities: Entity[],
    relationships: Relationship[],
    workspaceId: string
  ): RelationshipGraph {
    const nodes: GraphNode[] = entities.map(entity => ({
      id: entity.id,
      type: entity.type,
      label: entity.name,
      metadata: entity.metadata,
      sources: entity.sources,
    }));

    const edges: GraphEdge[] = relationships.map(rel => ({
      id: rel.id,
      source: rel.sourceEntityId,
      target: rel.targetEntityId,
      type: rel.type,
      label: rel.description ?? rel.type,
      sources: rel.sources,
    }));

    return {
      workspaceId,
      nodes,
      edges,
      generatedAt: new Date(),
    };
  }

  /**
   * Find all paths between two entities (up to maxDepth)
   */
  findPaths(
    graph: RelationshipGraph,
    startEntityId: string,
    endEntityId: string,
    maxDepth: number = 5
  ): string[][] {
    const paths: string[][] = [];
    const visited = new Set<string>();

    const dfs = (currentId: string, path: string[], depth: number) => {
      if (depth > maxDepth) return;
      if (currentId === endEntityId) {
        paths.push([...path, currentId]);
        return;
      }
      if (visited.has(currentId)) return;

      visited.add(currentId);
      path.push(currentId);

      // Find outgoing edges
      const outgoingEdges = graph.edges.filter(e => e.source === currentId);
      for (const edge of outgoingEdges) {
        dfs(edge.target, path, depth + 1);
      }

      path.pop();
      visited.delete(currentId);
    };

    dfs(startEntityId, [], 0);
    return paths;
  }

  /**
   * Get neighbors of an entity
   */
  getNeighbors(graph: RelationshipGraph, entityId: string): {
    incoming: GraphNode[];
    outgoing: GraphNode[];
  } {
    const incomingIds = graph.edges
      .filter(e => e.target === entityId)
      .map(e => e.source);
    
    const outgoingIds = graph.edges
      .filter(e => e.source === entityId)
      .map(e => e.target);

    return {
      incoming: graph.nodes.filter(n => incomingIds.includes(n.id)),
      outgoing: graph.nodes.filter(n => outgoingIds.includes(n.id)),
    };
  }

  /**
   * Merge entities with the same name (consolidate from multiple sources)
   */
  mergeEntities(entities: Entity[]): Entity[] {
    const entityMap = new Map<string, Entity>();

    for (const entity of entities) {
      const existing = entityMap.get(entity.name);
      if (existing) {
        // Merge sources and take higher confidence
        existing.sources.push(...entity.sources);
        existing.confidence = Math.max(existing.confidence, entity.confidence);
        
        // Merge metadata
        existing.metadata = {
          ...existing.metadata,
          ...entity.metadata,
        };
      } else {
        entityMap.set(entity.name, { ...entity });
      }
    }

    return Array.from(entityMap.values());
  }

  /**
   * Merge relationships with the same source/target/type
   */
  mergeRelationships(relationships: Relationship[]): Relationship[] {
    const relMap = new Map<string, Relationship>();

    for (const rel of relationships) {
      const key = `${rel.sourceEntityId}__${rel.type}__${rel.targetEntityId}`;
      const existing = relMap.get(key);
      
      if (existing) {
        // Merge sources and take higher confidence
        existing.sources.push(...rel.sources);
        existing.confidence = Math.max(existing.confidence, rel.confidence);
        
        // Merge metadata
        existing.metadata = {
          ...existing.metadata,
          ...rel.metadata,
        };
      } else {
        relMap.set(key, { ...rel });
      }
    }

    return Array.from(relMap.values());
  }
}
