/**
 * Central export file for all ContextOS domain types.
 * Import from here to access all type definitions.
 */

// Source types
export type {
  Source,
  SourceType,
  SourceStatus,
  SourceCategory,
  SourceReference,
} from './source.js';

// Workspace types
export type {
  Workspace,
  WorkspaceStatus,
  WorkspaceSummary,
} from './workspace.js';

// Entity types
export type {
  Entity,
  EntityType,
  ActorEntity,
  SystemEntity,
  ProcessEntity,
  DataStoreEntity,
  ExternalIntegrationEntity,
  BusinessEntity,
  EndpointEntity,
  EventEntity,
} from './entity.js';

// Relationship types
export type {
  Relationship,
  RelationshipType,
  RelationshipGraph,
  GraphNode,
  GraphEdge,
} from './relationship.js';

// Artifact types
export type {
  Artifact,
  ArtifactType,
  ArtifactFormat,
  ArtifactStatus,
  ArtifactRequest,
} from './artifact.js';

// Finding types
export type {
  Finding,
  FindingType,
  FindingSeverity,
  FindingStatus,
  FindingSummary,
} from './finding.js';

// Manifest types
export type {
  AnalysisManifest,
  ManifestSourceEntry,
  ManifestCapabilities,
} from './manifest.js';

// Calculation types
export type {
  NormalizedObservation,
  CalculationOperation,
  CalculationFilter,
  CalculationSort,
  CalculationRequest,
  CalculationSourceRef,
  CalculationResultRow,
  CalculationResult,
} from './calculation.js';
