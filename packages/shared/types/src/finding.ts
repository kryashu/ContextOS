import type { SourceReference } from './source.js';

/**
 * Finding represents a quality issue or insight discovered during analysis.
 * Examples: duplicates, conflicts, outdated information, missing data.
 */

export type FindingType =
  | 'duplicate_source'      // Two sources with identical/similar content
  | 'conflicting_info'      // Sources contain contradictory information
  | 'outdated_source'       // Source marked as deprecated or old
  | 'missing_attribution'   // Entity/relationship without source
  | 'low_confidence'        // Low confidence in extracted entity/relationship
  | 'security_concern'      // Potential security issue identified
  | 'performance_concern'   // Potential performance issue
  | 'incomplete_spec'       // API/system spec missing key information
  | 'broken_reference';     // Reference to non-existent entity

export type FindingSeverity =
  | 'critical'  // Must be addressed
  | 'high'      // Should be addressed soon
  | 'medium'    // Should be reviewed
  | 'low'       // Nice to know
  | 'info';     // Informational only

export interface Finding {
  id: string;
  workspaceId: string;
  
  // Finding metadata
  type: FindingType;
  severity: FindingSeverity;
  title: string;
  description: string;
  
  // What is affected?
  affectedSources: SourceReference[];
  affectedEntityIds?: string[];
  affectedRelationshipIds?: string[];
  
  // Recommended action
  recommendation?: string;
  
  // Auto-fixable?
  autoFixAvailable: boolean;
  
  // Status
  status: FindingStatus;
  resolvedAt?: Date;
  resolution?: string;
  
  // Timestamps
  detectedAt: Date;
  updatedAt: Date;
}

export type FindingStatus =
  | 'open'      // Newly detected
  | 'acknowledged' // User has seen it
  | 'resolved'  // Issue resolved
  | 'ignored';  // User chose to ignore

/**
 * FindingSummary aggregates findings by type and severity.
 */
export interface FindingSummary {
  workspaceId: string;
  
  totalFindings: number;
  findingsBySeverity: Record<FindingSeverity, number>;
  findingsByType: Record<FindingType, number>;
  
  criticalFindings: Finding[]; // Top 5 critical findings
  
  generatedAt: Date;
}
