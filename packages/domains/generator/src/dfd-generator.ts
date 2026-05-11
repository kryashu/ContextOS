import type { Entity, Relationship, Artifact, SourceReference } from '@contextos/types';

/**
 * DFDGenerator creates Data Flow Diagrams in Mermaid format
 */
export class DFDGenerator {
  /**
   * Generate a Level 0 DFD (Context Diagram)
   * Shows the system as a single process with external entities
   */
  generateLevel0(
    entities: Entity[],
    relationships: Relationship[],
    workspaceId: string
  ): Artifact {
    const actors = entities.filter(e => e.type === 'actor');
    const systems = entities.filter(e => e.type === 'system');
    const externalIntegrations = entities.filter(e => e.type === 'external_integration');
    const dataStores = entities.filter(e => e.type === 'data_store');

    // Find the primary system (most connected)
    const primarySystem = this.findPrimarySystem(systems, relationships);

    let mermaid = 'flowchart TB\n';
    mermaid += '    %% Actors\n';
    
    // Add actors
    for (const actor of actors) {
      mermaid += `    ${this.sanitizeId(actor.id)}[["${actor.name}"]]\n`;
    }

    // Add primary system
    if (primarySystem) {
      mermaid += '\n    %% Primary System\n';
      mermaid += `    ${this.sanitizeId(primarySystem.id)}("${primarySystem.name}")\n`;
    }

    // Add external integrations
    if (externalIntegrations.length > 0) {
      mermaid += '\n    %% External Integrations\n';
      for (const ext of externalIntegrations) {
        mermaid += `    ${this.sanitizeId(ext.id)}[["${ext.name}"]]\n`;
      }
    }

    // Add data stores
    if (dataStores.length > 0) {
      mermaid += '\n    %% Data Stores\n';
      for (const ds of dataStores) {
        mermaid += `    ${this.sanitizeId(ds.id)}[("${ds.name}")]\n`;
      }
    }

    // Add relationships
    mermaid += '\n    %% Relationships\n';
    for (const rel of relationships) {
      const source = entities.find(e => e.id === rel.sourceEntityId);
      const target = entities.find(e => e.id === rel.targetEntityId);
      
      if (source && target) {
        const label = rel.description ?? rel.type;
        mermaid += `    ${this.sanitizeId(rel.sourceEntityId)} --> |"${label}"| ${this.sanitizeId(rel.targetEntityId)}\n`;
      }
    }

    // Add styling
    mermaid += '\n    %% Styling\n';
    mermaid += '    classDef actorStyle fill:#e1f5ff,stroke:#0288d1,stroke-width:2px\n';
    mermaid += '    classDef systemStyle fill:#fff3e0,stroke:#f57c00,stroke-width:3px\n';
    mermaid += '    classDef externalStyle fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px\n';
    mermaid += '    classDef datastoreStyle fill:#e8f5e9,stroke:#388e3c,stroke-width:2px\n';

    // Collect source references
    const sources: SourceReference[] = [];
    const sourceSet = new Set<string>();
    
    for (const entity of entities) {
      for (const source of entity.sources) {
        if (!sourceSet.has(source.sourceId)) {
          sources.push(source);
          sourceSet.add(source.sourceId);
        }
      }
    }

    return {
      id: `artifact_dfd_level_0_${Date.now()}`,
      workspaceId,
      type: 'dfd_level_0',
      format: 'mermaid',
      title: 'Data Flow Diagram - Level 0 (Context)',
      description: 'System context showing external entities and primary interactions',
      content: mermaid,
      status: 'completed',
      sources,
      generatedAt: new Date(),
    };
  }

  /**
   * Find the system with the most connections
   */
  private findPrimarySystem(systems: Entity[], relationships: Relationship[]): Entity | null {
    if (systems.length === 0) return null;

    const connectionCounts = new Map<string, number>();
    
    for (const system of systems) {
      const count = relationships.filter(
        r => r.sourceEntityId === system.id || r.targetEntityId === system.id
      ).length;
      connectionCounts.set(system.id, count);
    }

    let maxCount = 0;
    let primarySystem = systems[0]!;
    
    for (const system of systems) {
      const count = connectionCounts.get(system.id) ?? 0;
      if (count > maxCount) {
        maxCount = count;
        primarySystem = system;
      }
    }

    return primarySystem;
  }

  /**
   * Sanitize entity ID for use in Mermaid
   */
  private sanitizeId(id: string): string {
    return id.replace(/[^a-zA-Z0-9_]/g, '_');
  }
}
