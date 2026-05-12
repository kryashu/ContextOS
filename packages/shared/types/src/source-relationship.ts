/**
 * Source relationship types — cross-source relationships
 * computed deterministically from source profiles.
 */

export type SourceRelationshipType =
  | 'shared_topic'
  | 'shared_entity'
  | 'table_document_support'
  | 'config_document_support'
  | 'possible_duplicate'
  | 'isolated_source';

export interface SourceRelationship {
  sourceA: string;        // fileName
  sourceB: string;        // fileName (empty for isolated_source)
  type: SourceRelationshipType;
  confidence: number;     // 0–1
  evidence: string[];     // human-readable reasons
}

export interface SourceRelationshipMap {
  workspaceId: string;
  generatedAt: string;
  relationships: SourceRelationship[];
}
