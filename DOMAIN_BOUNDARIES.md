# ContextOS - Domain Boundaries & Specifications

**Version:** 1.0  
**Date:** May 6, 2026  
**Status:** Initial Design

## Overview

This document defines the bounded contexts, responsibilities, interfaces, and interactions for each domain in ContextOS. Each domain represents a cohesive business capability with clear boundaries and minimal coupling to other domains.

## Domain Communication Patterns

### Primary Patterns

1. **Direct Function Calls** - Within the monolith, for synchronous operations
2. **Domain Events** - For asynchronous, decoupled communication
3. **Orchestration Layer** - For complex multi-domain workflows

### Event-Driven Communication

```typescript
// Event bus interface
interface EventBus {
  publish<T extends DomainEvent>(event: T): Promise<void>;
  subscribe<T extends DomainEvent>(
    eventType: string,
    handler: (event: T) => Promise<void>
  ): void;
}

// Base domain event
interface DomainEvent {
  id: string;
  type: string;
  timestamp: Date;
  aggregateId: string;
  payload: unknown;
  metadata?: Record<string, unknown>;
}
```

---

## Domain 1: Ingestion Domain

### Bounded Context
**Name:** Document Ingestion & Processing  
**Ubiquitous Language:** Document, Connector, Extraction, Chunking, Embedding, Source

### Responsibilities
- Connect to external document sources (PDF, DOCX, Excel, Confluence, Figma, MCP)
- Extract content while preserving structure and metadata
- Chunk documents semantically for retrieval
- Generate embeddings for vector search
- Extract and preserve tabular data structure
- Build initial entity and relationship graph
- Emit events for downstream processing

### What This Domain Does NOT Do
- ❌ Query or search documents (Retrieval domain)
- ❌ Analyze architecture (Reasoning domain)
- ❌ Manage workflows (Orchestration domain)
- ❌ Detect duplicates or conflicts (Quality domain)

### Core Entities
```typescript
// Source connection configuration
interface Source {
  id: string;
  workspaceId: string;
  type: SourceType;
  name: string;
  config: SourceConfig;
  status: SourceStatus;
  lastSyncAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Raw document before processing
interface RawDocument {
  id: string;
  sourceId: string;
  externalId: string;
  url?: string;
  mimeType: string;
  size: number;
  metadata: Record<string, unknown>;
  content: Buffer | string;
  fetchedAt: Date;
}

// Extracted structured content
interface ExtractedContent {
  documentId: string;
  text: string;
  structure: DocumentStructure;
  tables: Table[];
  images: Image[];
  metadata: DocumentMetadata;
  entities: Entity[];
  relationships: Relationship[];
}

// Chunk for embedding and retrieval
interface Chunk {
  id: string;
  documentId: string;
  content: string;
  embedding?: number[];
  position: number;
  metadata: ChunkMetadata;
  tokens: number;
  createdAt: Date;
}

// Structured table data
interface Table {
  id: string;
  documentId: string;
  name?: string;
  headers: string[];
  rows: Array<Record<string, unknown>>;
  position: number;
  schema?: TableSchema;
}
```

### Public API
```typescript
// Connector management
interface ConnectorRegistry {
  register(connector: DocumentConnector): void;
  get(type: SourceType): DocumentConnector | undefined;
  listSupported(): SourceType[];
}

// Ingestion operations
interface IngestionService {
  // Add a document source
  addSource(workspace: string, config: SourceConfig): Promise<Source>;
  
  // Trigger manual sync
  syncSource(sourceId: string): Promise<SyncResult>;
  
  // Ingest a single document
  ingestDocument(sourceId: string, documentId: string): Promise<Document>;
  
  // Batch ingestion
  ingestBatch(sourceId: string, documentIds: string[]): Promise<BatchResult>;
  
  // Get ingestion status
  getIngestionStatus(jobId: string): Promise<IngestionStatus>;
  
  // Pause/resume source
  pauseSource(sourceId: string): Promise<void>;
  resumeSource(sourceId: string): Promise<void>;
}

// Content extraction
interface ExtractionService {
  extract(raw: RawDocument): Promise<ExtractedContent>;
  extractTables(raw: RawDocument): Promise<Table[]>;
  extractEntities(content: ExtractedContent): Promise<Entity[]>;
}

// Chunking strategies
interface ChunkingService {
  chunk(
    content: ExtractedContent,
    strategy: ChunkingStrategy
  ): Promise<Chunk[]>;
}

// Embedding generation
interface EmbeddingService {
  generateEmbedding(text: string): Promise<number[]>;
  generateEmbeddingsBatch(texts: string[]): Promise<number[][]>;
}
```

### Domain Events
```typescript
// Document added to workspace
interface DocumentIngestedEvent extends DomainEvent {
  type: 'document.ingested';
  payload: {
    documentId: string;
    workspaceId: string;
    sourceId: string;
    sourceType: SourceType;
    metadata: DocumentMetadata;
  };
}

// Chunks created and embedded
interface ChunksCreatedEvent extends DomainEvent {
  type: 'chunks.created';
  payload: {
    documentId: string;
    chunkIds: string[];
    chunkCount: number;
  };
}

// Tables extracted
interface TablesExtractedEvent extends DomainEvent {
  type: 'tables.extracted';
  payload: {
    documentId: string;
    tables: Table[];
  };
}

// Ingestion failed
interface IngestionFailedEvent extends DomainEvent {
  type: 'ingestion.failed';
  payload: {
    documentId: string;
    sourceId: string;
    error: string;
    retryable: boolean;
  };
}
```

### Dependencies
- `@contextos/database` - Persist documents, chunks, tables
- `@contextos/types` - Shared type definitions
- `@contextos/events` - Event publishing
- `@contextos/observability` - Logging and tracing
- External: `langchain`, `pdf-parse`, `mammoth`, `xlsx`

---

## Domain 2: Retrieval Domain

### Bounded Context
**Name:** Information Retrieval & Search  
**Ubiquitous Language:** Query, Search, Retrieval, Reranking, Relevance, Context

### Responsibilities
- Execute semantic vector searches
- Perform hybrid retrieval (vector + keyword)
- Rerank results for relevance
- Multi-hop retrieval following relationships
- Query structured tables
- Cache frequent queries
- Assemble context for LLM consumption

### What This Domain Does NOT Do
- ❌ Ingest documents (Ingestion domain)
- ❌ Generate artifacts (Reasoning domain)
- ❌ Orchestrate workflows (Orchestration domain)

### Core Entities
```typescript
// User query
interface Query {
  id: string;
  workspaceId: string;
  text: string;
  filters?: QueryFilters;
  options?: QueryOptions;
  createdAt: Date;
}

// Search result
interface SearchResult {
  chunkId: string;
  documentId: string;
  content: string;
  score: number;
  metadata: ResultMetadata;
  highlights?: string[];
}

// Ranked result after reranking
interface RankedResult extends SearchResult {
  originalRank: number;
  rerankedScore: number;
  relevanceExplanation?: string;
}

// Assembled context for LLM
interface RetrievalContext {
  queryId: string;
  results: RankedResult[];
  totalResults: number;
  retrievalStrategy: string;
  latency: number;
  sources: Source[];
}
```

### Public API
```typescript
// Main retrieval interface
interface RetrievalService {
  // Semantic search
  semanticSearch(
    query: string,
    workspace: string,
    options?: SearchOptions
  ): Promise<SearchResult[]>;
  
  // Hybrid search (semantic + keyword)
  hybridSearch(
    query: string,
    workspace: string,
    options?: HybridOptions
  ): Promise<SearchResult[]>;
  
  // Multi-hop retrieval
  multiHopSearch(
    query: string,
    workspace: string,
    maxHops: number
  ): Promise<SearchResult[]>;
  
  // Table-aware search
  queryTables(
    query: string,
    workspace: string
  ): Promise<TableQueryResult[]>;
  
  // Get full retrieval context
  retrieveContext(
    query: Query,
    strategy: RetrievalStrategy
  ): Promise<RetrievalContext>;
}

// Reranking
interface RerankingService {
  rerank(
    query: string,
    results: SearchResult[],
    topK: number
  ): Promise<RankedResult[]>;
}

// Caching
interface QueryCache {
  get(queryHash: string): Promise<RetrievalContext | null>;
  set(queryHash: string, context: RetrievalContext, ttl: number): Promise<void>;
  invalidate(pattern: string): Promise<void>;
}
```

### Domain Events
```typescript
// Query executed
interface QueryExecutedEvent extends DomainEvent {
  type: 'query.executed';
  payload: {
    queryId: string;
    workspaceId: string;
    strategy: string;
    resultCount: number;
    latency: number;
  };
}

// Cache hit/miss
interface CacheEvent extends DomainEvent {
  type: 'cache.hit' | 'cache.miss';
  payload: {
    queryHash: string;
    workspaceId: string;
  };
}
```

### Dependencies
- `@contextos/database` - Query vector store
- `@contextos/types` - Shared types
- `@contextos/events` - Event publishing
- `@contextos/observability` - Tracing
- External: `langchain`, `redis`

---

## Domain 3: Reasoning Domain

### Bounded Context
**Name:** Analysis & Artifact Generation  
**Ubiquitous Language:** Architecture, Component, Dependency, Artifact, Analysis, Insight

### Responsibilities
- Analyze system architecture from documents
- Identify components, services, boundaries
- Infer dependencies and data flows
- Detect contradictions across sources
- Generate architecture diagrams (DFD, C4)
- Create ADRs and summaries
- Perform risk analysis
- Resolve entities across documents

### What This Domain Does NOT Do
- ❌ Store documents (Ingestion domain)
- ❌ Retrieve documents (Retrieval domain)
- ❌ Orchestrate workflows (Orchestration domain)

### Core Entities
```typescript
// Analyzed system architecture
interface SystemArchitecture {
  id: string;
  workspaceId: string;
  components: Component[];
  dependencies: Dependency[];
  trustBoundaries: TrustBoundary[];
  dataFlows: DataFlow[];
  insights: Insight[];
  analyzedAt: Date;
}

// System component
interface Component {
  id: string;
  name: string;
  type: ComponentType;
  description: string;
  sources: DocumentReference[];
  technologies: string[];
  responsibilities: string[];
}

// Dependency between components
interface Dependency {
  id: string;
  from: string; // component id
  to: string;   // component id
  type: DependencyType;
  protocol?: string;
  description: string;
  sources: DocumentReference[];
}

// Generated artifact
interface Artifact {
  id: string;
  workspaceId: string;
  type: ArtifactType;
  name: string;
  content: string;
  format: ArtifactFormat;
  metadata: ArtifactMetadata;
  approvalStatus: ApprovalStatus;
  createdAt: Date;
  approvedAt?: Date;
}

// Detected contradiction
interface Contradiction {
  id: string;
  workspaceId: string;
  type: ContradictionType;
  sources: DocumentReference[];
  description: string;
  severity: Severity;
  suggestion?: string;
}
```

### Public API
```typescript
// Architecture analysis
interface ArchitectureAnalyzer {
  // Analyze entire workspace
  analyzeWorkspace(workspaceId: string): Promise<SystemArchitecture>;
  
  // Identify components
  identifyComponents(
    documents: Document[],
    context: AnalysisContext
  ): Promise<Component[]>;
  
  // Infer dependencies
  inferDependencies(
    components: Component[],
    documents: Document[]
  ): Promise<Dependency[]>;
  
  // Detect trust boundaries
  detectTrustBoundaries(
    architecture: SystemArchitecture
  ): Promise<TrustBoundary[]>;
}

// Artifact generation
interface ArtifactGenerator {
  // Generate DFD
  generateDFD(
    architecture: SystemArchitecture,
    level: number
  ): Promise<Artifact>;
  
  // Generate C4 diagram
  generateC4(
    architecture: SystemArchitecture,
    level: C4Level,
    scope?: string
  ): Promise<Artifact>;
  
  // Generate ADR
  generateADR(
    decision: DecisionContext,
    sources: Document[]
  ): Promise<Artifact>;
  
  // Generate architecture summary
  generateSummary(
    architecture: SystemArchitecture
  ): Promise<Artifact>;
  
  // Risk analysis
  analyzeRisks(
    architecture: SystemArchitecture
  ): Promise<RiskReport>;
}

// Contradiction detection
interface ContradictionDetector {
  detectContradictions(
    workspaceId: string
  ): Promise<Contradiction[]>;
  
  findInconsistencies(
    documents: Document[],
    topic: string
  ): Promise<Inconsistency[]>;
}

// Entity resolution
interface EntityResolver {
  resolveEntities(
    entities: Entity[],
    workspaceId: string
  ): Promise<ResolvedEntity[]>;
  
  linkAcrossDocuments(
    entity: Entity,
    workspaceId: string
  ): Promise<EntityLink[]>;
}
```

### Domain Events
```typescript
// Architecture analyzed
interface ArchitectureAnalyzedEvent extends DomainEvent {
  type: 'architecture.analyzed';
  payload: {
    architectureId: string;
    workspaceId: string;
    componentCount: number;
    dependencyCount: number;
  };
}

// Artifact generated
interface ArtifactGeneratedEvent extends DomainEvent {
  type: 'artifact.generated';
  payload: {
    artifactId: string;
    type: ArtifactType;
    workspaceId: string;
    requiresApproval: boolean;
  };
}

// Contradiction detected
interface ContradictionDetectedEvent extends DomainEvent {
  type: 'contradiction.detected';
  payload: {
    contradictionId: string;
    workspaceId: string;
    severity: Severity;
    documentIds: string[];
  };
}
```

### Dependencies
- `@contextos/retrieval` - Get relevant documents
- `@contextos/database` - Persist artifacts
- `@contextos/types` - Shared types
- `@contextos/events` - Event publishing
- External: `langchain`, `mermaid`

---

## Domain 4: Orchestration Domain

### Bounded Context
**Name:** Agent Workflow Orchestration  
**Ubiquitous Language:** Agent, Workflow, Task, State, Tool, Approval

### Responsibilities
- Route queries to appropriate agents
- Execute multi-step LangGraph workflows
- Manage workflow state persistence
- Coordinate cross-domain operations
- Handle human-in-the-loop approvals
- Manage tool registry
- Track workflow execution

### What This Domain Does NOT Do
- ❌ Implement business logic (delegated to other domains)
- ❌ Store domain data (only workflow state)

### Core Entities
```typescript
// Agent definition
interface Agent {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  tools: Tool[];
  systemPrompt: string;
  config: AgentConfig;
}

// Workflow definition
interface Workflow {
  id: string;
  name: string;
  description: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  initialState: Record<string, unknown>;
  version: string;
}

// Workflow execution
interface WorkflowExecution {
  id: string;
  workflowId: string;
  workspaceId: string;
  status: ExecutionStatus;
  currentNode: string;
  state: Record<string, unknown>;
  history: ExecutionStep[];
  startedAt: Date;
  completedAt?: Date;
}

// Tool definition
interface Tool {
  id: string;
  name: string;
  description: string;
  parameters: ToolParameter[];
  execute: (params: Record<string, unknown>) => Promise<unknown>;
}

// Approval request
interface ApprovalRequest {
  id: string;
  executionId: string;
  type: ApprovalType;
  content: unknown;
  requester: string;
  status: ApprovalStatus;
  requestedAt: Date;
  resolvedAt?: Date;
  resolvedBy?: string;
}
```

### Public API
```typescript
// Agent routing
interface AgentRouter {
  // Route query to appropriate agent
  route(query: Query, context: Context): Promise<Agent>;
  
  // Get agent by capability
  getAgentForCapability(capability: string): Promise<Agent>;
  
  // List available agents
  listAgents(): Promise<Agent[]>;
}

// Workflow engine
interface WorkflowEngine {
  // Start workflow execution
  start(
    workflowId: string,
    input: WorkflowInput,
    context: Context
  ): Promise<WorkflowExecution>;
  
  // Resume paused workflow
  resume(executionId: string, approvalResult: ApprovalResult): Promise<void>;
  
  // Cancel execution
  cancel(executionId: string): Promise<void>;
  
  // Get execution status
  getStatus(executionId: string): Promise<WorkflowExecution>;
  
  // Stream execution updates
  streamExecution(executionId: string): AsyncIterable<ExecutionUpdate>;
}

// Tool registry
interface ToolRegistry {
  register(tool: Tool): void;
  get(toolId: string): Tool | undefined;
  listTools(): Tool[];
  getToolsForAgent(agentId: string): Tool[];
}

// Approval gateway
interface ApprovalGateway {
  // Request approval
  requestApproval(
    executionId: string,
    type: ApprovalType,
    content: unknown
  ): Promise<ApprovalRequest>;
  
  // Approve/reject
  resolve(
    requestId: string,
    approved: boolean,
    feedback?: string
  ): Promise<void>;
  
  // Get pending approvals
  getPendingApprovals(userId: string): Promise<ApprovalRequest[]>;
}

// State management
interface StateManager {
  save(executionId: string, state: Record<string, unknown>): Promise<void>;
  load(executionId: string): Promise<Record<string, unknown>>;
  clear(executionId: string): Promise<void>;
}
```

### Domain Events
```typescript
// Workflow started
interface WorkflowStartedEvent extends DomainEvent {
  type: 'workflow.started';
  payload: {
    executionId: string;
    workflowId: string;
    workspaceId: string;
  };
}

// Workflow completed
interface WorkflowCompletedEvent extends DomainEvent {
  type: 'workflow.completed';
  payload: {
    executionId: string;
    status: 'success' | 'failed';
    duration: number;
    result?: unknown;
  };
}

// Approval requested
interface ApprovalRequestedEvent extends DomainEvent {
  type: 'approval.requested';
  payload: {
    requestId: string;
    executionId: string;
    type: ApprovalType;
    userId: string;
  };
}

// Approval resolved
interface ApprovalResolvedEvent extends DomainEvent {
  type: 'approval.resolved';
  payload: {
    requestId: string;
    approved: boolean;
    resolvedBy: string;
  };
}
```

### Dependencies
- `@contextos/ingestion` - Trigger ingestion operations
- `@contextos/retrieval` - Execute searches
- `@contextos/reasoning` - Generate artifacts
- `@contextos/database` - Persist workflow state
- `@contextos/events` - Event publishing
- External: `@langchain/langgraph`

---

## Domain 5: Knowledge Graph Domain

### Bounded Context
**Name:** Semantic Relationship Management  
**Ubiquitous Language:** Entity, Relationship, Graph, Node, Edge, Path, Trust Boundary

### Responsibilities
- Extract entities from documents
- Resolve entities across sources
- Map relationships between entities
- Store and query knowledge graph
- Detect trust boundaries
- Track temporal changes
- Provide graph traversal APIs

### What This Domain Does NOT Do
- ❌ Generate embeddings (Ingestion domain)
- ❌ Generate artifacts (Reasoning domain)

### Core Entities
```typescript
// Entity in knowledge graph
interface Entity {
  id: string;
  type: EntityType;
  name: string;
  properties: Record<string, unknown>;
  sources: DocumentReference[];
  confidence: number;
  createdAt: Date;
  updatedAt: Date;
}

// Relationship between entities
interface Relationship {
  id: string;
  from: string; // entity id
  to: string;   // entity id
  type: RelationshipType;
  properties: Record<string, unknown>;
  sources: DocumentReference[];
  confidence: number;
  createdAt: Date;
}

// Trust boundary
interface TrustBoundary {
  id: string;
  name: string;
  entityIds: string[];
  description: string;
  crossBoundaryRelationships: Relationship[];
}

// Graph query result
interface GraphQueryResult {
  nodes: Entity[];
  edges: Relationship[];
  paths?: Path[];
}
```

### Public API
```typescript
// Knowledge graph interface
interface KnowledgeGraph {
  // Add entity
  addEntity(entity: Entity): Promise<string>;
  
  // Add relationship
  addRelationship(relationship: Relationship): Promise<string>;
  
  // Query graph
  query(pattern: GraphPattern): Promise<GraphQueryResult>;
  
  // Find paths between entities
  findPaths(
    from: string,
    to: string,
    maxDepth: number
  ): Promise<Path[]>;
  
  // Get entity neighborhood
  getNeighborhood(
    entityId: string,
    radius: number
  ): Promise<GraphQueryResult>;
  
  // Bulk operations
  bulkAddEntities(entities: Entity[]): Promise<string[]>;
  bulkAddRelationships(relationships: Relationship[]): Promise<string[]>;
}

// Entity extraction and resolution
interface EntityManager {
  // Extract entities from text
  extractEntities(
    text: string,
    context: EntityContext
  ): Promise<Entity[]>;
  
  // Resolve entity identity
  resolveEntity(
    entity: Entity,
    candidates: Entity[]
  ): Promise<Entity>;
  
  // Link entities across documents
  linkEntities(workspaceId: string): Promise<EntityLink[]>;
}

// Relationship inference
interface RelationshipMapper {
  // Infer relationships
  inferRelationships(
    entities: Entity[],
    context: Document[]
  ): Promise<Relationship[]>;
  
  // Validate relationship
  validateRelationship(
    relationship: Relationship
  ): Promise<ValidationResult>;
}

// Trust boundary detection
interface TrustBoundaryDetector {
  detectBoundaries(
    workspaceId: string
  ): Promise<TrustBoundary[]>;
  
  getCrossBoundaryFlows(
    boundaryId: string
  ): Promise<DataFlow[]>;
}
```

### Domain Events
```typescript
// Entity added
interface EntityAddedEvent extends DomainEvent {
  type: 'entity.added';
  payload: {
    entityId: string;
    type: EntityType;
    workspaceId: string;
  };
}

// Relationship discovered
interface RelationshipDiscoveredEvent extends DomainEvent {
  type: 'relationship.discovered';
  payload: {
    relationshipId: string;
    from: string;
    to: string;
    type: RelationshipType;
  };
}

// Trust boundary detected
interface TrustBoundaryDetectedEvent extends DomainEvent {
  type: 'trust_boundary.detected';
  payload: {
    boundaryId: string;
    entityCount: number;
  };
}
```

### Dependencies
- `@contextos/database` - Persist graph (PostgreSQL or Neo4j)
- `@contextos/types` - Shared types
- `@contextos/events` - Event publishing
- External: `langchain`, potentially `neo4j-driver`

---

## Domain 6: Quality Domain

### Bounded Context
**Name:** Workspace Data Quality  
**Ubiquitous Language:** Duplicate, Stale, Conflict, Quality Score, Hygiene

### Responsibilities
- Detect duplicate documents
- Identify stale/outdated information
- Find conflicting information
- Score document relevance
- Analyze workspace coverage
- Suggest cleanup actions

### What This Domain Does NOT Do
- ❌ Delete documents (user action required)
- ❌ Resolve conflicts (only detect)

### Core Entities
```typescript
// Duplicate detection result
interface DuplicateGroup {
  id: string;
  documentIds: string[];
  similarity: number;
  type: DuplicateType;
  suggestedAction: string;
  detectedAt: Date;
}

// Staleness report
interface StalenessReport {
  documentId: string;
  lastUpdated: Date;
  ageInDays: number;
  staleness Score: number;
  relatedDocuments: string[];
  suggestion: string;
}

// Conflict detection
interface Conflict {
  id: string;
  type: ConflictType;
  documentIds: string[];
  topic: string;
  description: string;
  severity: Severity;
  snippets: ConflictSnippet[];
}

// Quality score
interface QualityScore {
  documentId: string;
  overall: number;
  dimensions: {
    completeness: number;
    accuracy: number;
    relevance: number;
    freshness: number;
  };
  issues: QualityIssue[];
}
```

### Public API
```typescript
// Duplicate detection
interface DuplicateDetector {
  detectDuplicates(
    workspaceId: string,
    threshold: number
  ): Promise<DuplicateGroup[]>;
  
  compareDocs(
    docId1: string,
    docId2: string
  ): Promise<SimilarityResult>;
}

// Staleness analysis
interface StalenessAnalyzer {
  analyzeWorkspace(workspaceId: string): Promise<StalenessReport[]>;
  
  isStale(documentId: string, threshold: number): Promise<boolean>;
}

// Conflict detection
interface ConflictDetector {
  detectConflicts(
    workspaceId: string
  ): Promise<Conflict[]>;
  
  findConflictsForTopic(
    workspaceId: string,
    topic: string
  ): Promise<Conflict[]>;
}

// Quality scoring
interface QualityScorer {
  scoreDocument(documentId: string): Promise<QualityScore>;
  
  scoreWorkspace(workspaceId: string): Promise<WorkspaceQuality>;
}
```

### Domain Events
```typescript
// Duplicates detected
interface DuplicatesDetectedEvent extends DomainEvent {
  type: 'duplicates.detected';
  payload: {
    workspaceId: string;
    groupCount: number;
    documentCount: number;
  };
}

// Quality issue found
interface QualityIssueFoundEvent extends DomainEvent {
  type: 'quality.issue_found';
  payload: {
    documentId: string;
    issueType: string;
    severity: Severity;
  };
}
```

### Dependencies
- `@contextos/retrieval` - Compare documents
- `@contextos/database` - Query documents
- `@contextos/types` - Shared types
- External: `langchain`

---

## Domain Interaction Patterns

### Pattern 1: Document Ingestion Flow
```
User → Web App → Ingestion Domain
                      ↓ emit DocumentIngestedEvent
                  Event Bus
                      ↓ subscribe
              Quality Domain (check for duplicates)
                      ↓ emit DuplicatesDetectedEvent
                  Event Bus
                      ↓ subscribe
              Web App (notify user)
```

### Pattern 2: Architecture Analysis Flow
```
User → Web App → Orchestration Domain
                      ↓ start workflow
                  LangGraph Workflow
                      ├─→ Retrieval Domain (get docs)
                      ├─→ Reasoning Domain (analyze)
                      ├─→ Reasoning Domain (generate artifact)
                      └─→ Approval Gateway (human approval)
                      ↓ emit WorkflowCompletedEvent
                  Web App (display result)
```

### Pattern 3: Query Answering Flow
```
User → Web App → Orchestration Domain
                      ↓
                  Agent Router
                      ↓
                  Query Agent
                      ├─→ Retrieval Domain (search)
                      ├─→ Knowledge Graph (get relationships)
                      └─→ LLM (generate answer)
                      ↓
                  Web App (stream response)
```

## Cross-Cutting Concerns

### Error Handling
Each domain defines its own error hierarchy:
```typescript
class DomainError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
  }
}

class IngestionError extends DomainError {}
class RetrievalError extends DomainError {}
// ... etc
```

### Validation
Shared validation utilities:
```typescript
import { z } from 'zod';

// Each domain exports Zod schemas
export const DocumentSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  // ...
});
```

### Pagination
Standard pagination pattern:
```typescript
interface PaginatedRequest {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
```

---

## Next Steps

1. Review domain boundaries with team
2. Create detailed SPEC.md for each domain
3. Define API contracts (OpenAPI/TypeScript interfaces)
4. Implement domain package scaffolding
5. Set up event bus infrastructure
6. Begin implementation domain by domain

---

**Document Owner:** Architecture Team  
**Reviewers:** Domain Leads  
**Next Review:** After first domain implementation
