import type { SourceReference } from './source.js';

/**
 * Relationship represents a connection between two entities.
 * Relationships are the edges in our knowledge graph.
 */

export type RelationshipType =
  | 'uses'           // Actor uses System
  | 'calls'          // System calls System (API call)
  | 'stores_in'      // System stores_in DataStore
  | 'reads_from'     // System reads_from DataStore
  | 'writes_to'      // System writes_to DataStore
  | 'integrates_with' // System integrates_with External
  | 'triggers'       // Event triggers Process
  | 'publishes'      // System publishes Event
  | 'subscribes_to'  // System subscribes_to Event
  | 'contains'       // Process contains step
  | 'depends_on'     // System depends_on System
  | 'manages'        // System manages BusinessEntity
  | 'implements';    // System implements Endpoint

export interface Relationship {
  id: string;
  workspaceId: string;
  
  // Core relationship
  type: RelationshipType;
  sourceEntityId: string;
  targetEntityId: string;
  
  // Optional description
  description?: string;
  
  // Additional metadata
  metadata: Record<string, unknown>;
  
  // Attribution: where was this relationship identified?
  sources: SourceReference[];
  
  // Confidence score (0-1)
  confidence: number;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

/**
 * RelationshipGraph represents the full network of entities and relationships.
 * Used for graph analysis and visualization.
 */
export interface RelationshipGraph {
  workspaceId: string;
  
  nodes: GraphNode[];
  edges: GraphEdge[];
  
  generatedAt: Date;
}

export interface GraphNode {
  id: string; // Entity ID
  type: string; // Entity type
  label: string; // Entity name
  metadata: Record<string, unknown>;
  sources?: SourceReference[]; // Attribution traceability
}

export interface GraphEdge {
  id: string; // Relationship ID
  source: string; // Source entity ID
  target: string; // Target entity ID
  type: string; // Relationship type
  label: string; // Relationship description
  sources?: SourceReference[]; // Attribution traceability
}
