import type { SourceReference } from './source.js';

/**
 * Artifact represents a generated output document.
 * Examples: DFD, C4 diagram, architecture decision record, etc.
 */

export type ArtifactType =
  | 'dfd_level_0'     // Data Flow Diagram Level 0
  | 'dfd_level_1'     // Data Flow Diagram Level 1
  | 'c4_context'      // C4 Context Diagram
  | 'c4_container'    // C4 Container Diagram
  | 'c4_component'    // C4 Component Diagram
  | 'sequence_diagram' // Sequence Diagram
  | 'erd'             // Entity Relationship Diagram
  | 'architecture_doc' // Prose architecture document
  | 'api_summary'     // API endpoint summary
  | 'data_dictionary'; // Data dictionary

export type ArtifactFormat =
  | 'mermaid'   // Mermaid diagram syntax
  | 'markdown'  // Markdown document
  | 'json';     // Structured JSON

export type ArtifactStatus =
  | 'generating'  // Currently being generated
  | 'completed'   // Successfully generated
  | 'failed';     // Generation failed

export interface Artifact {
  id: string;
  workspaceId: string;
  
  // Artifact metadata
  type: ArtifactType;
  format: ArtifactFormat;
  title: string;
  description?: string;
  
  // Content
  content: string; // The actual artifact content
  
  // Status
  status: ArtifactStatus;
  errorMessage?: string;
  
  // Attribution: which sources contributed to this artifact?
  sources: SourceReference[];
  
  // Timestamps
  generatedAt: Date;
  updatedAt?: Date;
}

/**
 * ArtifactRequest represents a user's request to generate an artifact.
 */
export interface ArtifactRequest {
  workspaceId: string;
  type: ArtifactType;
  
  // Optional constraints
  focusOn?: string[]; // Specific entities or systems to focus on
  excludeIrrelevant?: boolean; // Exclude low-relevance sources
  
  requestedAt: Date;
}
