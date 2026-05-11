/**
 * Workspace represents a collection of sources that form a cohesive system.
 * A workspace is the unit of analysis for ContextOS.
 */

export interface Workspace {
  id: string;
  name: string;
  description?: string;
  
  // Processing status
  status: WorkspaceStatus;
  processedSourcesCount: number;
  totalSourcesCount: number;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  lastProcessedAt?: Date;
}

export type WorkspaceStatus =
  | 'empty'        // No sources yet
  | 'ingesting'    // Sources being added
  | 'processing'   // Analyzing sources
  | 'ready'        // Ready for queries and artifact generation
  | 'failed';      // Processing failed

/**
 * WorkspaceSummary provides high-level statistics about a workspace.
 * Generated after processing all sources.
 */
export interface WorkspaceSummary {
  workspaceId: string;
  workspaceName: string;
  
  // Source statistics
  totalSources: number;
  sourcesByType: Record<string, number>;
  sourcesByCategory: Record<string, number>;
  
  // Entity statistics
  totalEntities: number;
  entitiesByType: Record<string, number>;
  
  // Relationship statistics
  totalRelationships: number;
  relationshipsByType: Record<string, number>;
  
  // Quality indicators
  duplicateSources: number;
  outdatedSources: number;
  conflictingSources: number;
  
  // Key insights
  primaryActors: string[];      // Top 5 actors
  primarySystems: string[];     // Top 5 systems
  externalIntegrations: string[]; // External services/APIs
  
  generatedAt: Date;
}
