# ContextOS - System Architecture

**Version:** 1.0  
**Date:** May 12, 2026  
**Status:** Design Target (partially implemented)

> **Implementation note:** This document describes the full design target for ContextOS. Not all components described here are implemented yet. See the [README](./README.md#current-status) for what exists today. The current implementation uses file-system storage (no PostgreSQL, Redis, or Neo4j), has no embedding pipeline or vector search, and does not yet use LangGraph for orchestration.

## Executive Summary

ContextOS is an open-source workspace intelligence system that analyzes collections of documents, extracts entities and relationships, detects quality issues, and generates architecture artifacts. It uses deterministic analyzers where possible and LLMs only when needed.

## Core Architectural Principles

1. **Spec-Driven Development** - Every module begins with a specification
2. **Modular Monolith** - Single deployable with clear internal boundaries
3. **Domain-Oriented Design** - Organized by business capability, not technical layer
4. **Event-Driven Internals** - Loose coupling through domain events
5. **Source-Grounded AI** - All AI responses cite original sources
6. **Structured Over Freeform** - Prefer structured outputs with validation
7. **Table Intelligence** - Structured data treated as first-class entities
8. **Human-in-the-Loop** - Critical artifacts require approval
9. **Clear Separation of Concerns** - Distinct layers for ingestion, retrieval, reasoning, orchestration
10. **Production-Grade from Day One** - Observability, testing, error handling

## High-Level System Architecture

> Components marked with ✅ are implemented. Others are design targets.

```
┌─────────────────────────────────────────────────────────────────────┐
│                     ✅ Frontend Layer                                │
│                    (Next.js App Router)                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │ ✅ Workspace  │  │ ✅ Q&A       │  │ ✅ Artifact   │             │
│  │  Dashboard   │  │  Interface   │  │  Viewer      │             │
│  └──────────────┘  └──────────────┘  └──────────────┘             │
└─────────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────▼─────────────────────────────────────┐
│                      Application Core                              │
│                                                                     │
│  ┌──────────────────┐  ┌──────────────────┐  ┌─────────────────┐ │
│  │ ✅ Parsing &     │  │   Retrieval      │  │ ✅ Extraction   │ │
│  │   Profiling      │  │   Domain         │  │   & Generation  │ │
│  │                  │  │   (planned)      │  │                 │ │
│  │ • Parsers        │  │ • Semantic       │  │ • Entity        │ │
│  │ • Profiler       │  │   Search         │  │   Extraction    │ │
│  │ • Classifier     │  │ • Hybrid         │  │ • Relationship  │ │
│  │                  │  │   Retrieval      │  │   Mapping       │ │
│  │                  │  │ • Reranking      │  │ • DFD Generator │ │
│  └──────────────────┘  └──────────────────┘  └─────────────────┘ │
│                                                                     │
│  ┌──────────────────┐  ┌──────────────────┐  ┌─────────────────┐ │
│  │  Orchestration   │  │ ✅ Cross-Source   │  │ ✅ Quality      │ │
│  │  Domain          │  │   Relationships  │  │   Domain        │ │
│  │  (planned)       │  │                  │  │                 │ │
│  │ • Agent Router   │  │ • Source         │  │ • Duplicate     │ │
│  │ • LangGraph      │  │   Relationship   │  │   Detection     │ │
│  │   Workflows      │  │   Mapper         │  │ • Conflict      │ │
│  │ • State Mgmt     │  │                  │  │   Detection     │ │
│  │                  │  │                  │  │                 │ │
│  └──────────────────┘  └──────────────────┘  └─────────────────┘ │
│                                                                     │
│  ┌──────────────────┐  ┌──────────────────┐                       │
│  │ ✅ Q&A Domain    │  │ ✅ Calculator    │                       │
│  │                  │  │                  │                       │
│  │ • Intent Router  │  │ • Table          │                       │
│  │ • Local Retriever│  │   Calculations   │                       │
│  │ • Answer Composer│  │                  │                       │
│  └──────────────────┘  └──────────────────┘                       │
└─────────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────▼─────────────────────────────────────┐
│                   ✅ Storage: File System                          │
│                  (planned: PostgreSQL + pgvector, Redis, Neo4j)    │
└─────────────────────────────────────────────────────────────────────┘
```

## Core Domain Boundaries

### 1. Ingestion Domain
**Responsibility:** Transform external documents into structured, searchable knowledge

**Components:**
- **Connector Registry** - Pluggable adapters for PDF, DOCX, Excel, Confluence, Figma, MCP
- **Content Extractors** - Format-specific parsing (pypdf, mammoth, xlsx, etc.)
- **Chunking Engine** - Semantic chunking with overlap, respecting document structure
- **Embedding Pipeline** - Batch embedding generation with rate limiting
- **Table Extractor** - Specialized extraction preserving tabular structure
- **Graph Builder** - Initial relationship extraction

**Key Interfaces:**
```typescript
interface DocumentConnector {
  type: ConnectorType;
  connect(config: ConnectorConfig): Promise<void>;
  fetchDocuments(filter?: Filter): AsyncIterable<RawDocument>;
  disconnect(): Promise<void>;
}

interface ContentExtractor {
  supportedFormats: string[];
  extract(raw: RawDocument): Promise<ExtractedContent>;
}

interface ChunkingStrategy {
  chunk(content: ExtractedContent): Promise<Chunk[]>;
}
```

### 2. Retrieval Domain
**Responsibility:** Find relevant information across the knowledge base

**Components:**
- **Semantic Search** - Vector similarity search using pgvector
- **Hybrid Retrieval** - Combines semantic + keyword (BM25)
- **Reranker** - Cross-encoder model for relevance scoring
- **Multi-hop Retrieval** - Follow relationships for deeper context
- **Table Query Engine** - Structured query against tabular data
- **Cache Manager** - Redis-based query result caching

**Key Interfaces:**
```typescript
interface RetrievalStrategy {
  search(query: Query, options: RetrievalOptions): Promise<SearchResult[]>;
}

interface Reranker {
  rerank(query: string, candidates: SearchResult[]): Promise<RankedResult[]>;
}
```

### 3. Reasoning Domain
**Responsibility:** Understand, analyze, and synthesize information

**Components:**
- **Architecture Analyzer** - Identifies components, boundaries, dependencies
- **Relationship Inference** - Discovers implicit connections
- **Contradiction Detector** - Finds conflicts across sources
- **Entity Resolver** - Unifies entities across documents
- **Artifact Generator** - Creates diagrams, ADRs, summaries
- **Risk Analyzer** - Identifies architecture risks

**Key Interfaces:**
```typescript
interface ArchitectureAnalyzer {
  analyzeSystem(context: WorkspaceContext): Promise<SystemArchitecture>;
  identifyComponents(docs: Document[]): Promise<Component[]>;
  inferDependencies(components: Component[]): Promise<Dependency[]>;
}

interface ArtifactGenerator {
  generateDFD(architecture: SystemArchitecture): Promise<Diagram>;
  generateC4(level: C4Level, scope: Scope): Promise<Diagram>;
  generateADR(decision: Decision): Promise<ADR>;
}
```

### 4. Orchestration Domain
**Responsibility:** Coordinate multi-step agentic workflows

**Components:**
- **Agent Router** - Routes queries to appropriate agents
- **Workflow Engine** - LangGraph-based state machines
- **State Manager** - Persistent workflow state
- **Tool Registry** - Available tools for agents
- **Approval Gateway** - Human-in-the-loop checkpoints

**Key Interfaces:**
```typescript
interface AgentWorkflow {
  id: string;
  name: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  execute(input: WorkflowInput): Promise<WorkflowResult>;
}

interface Agent {
  id: string;
  capabilities: string[];
  execute(task: Task, context: Context): Promise<AgentResult>;
}
```

### 5. Knowledge Graph Domain
**Responsibility:** Build and maintain semantic relationship graph

**Components:**
- **Entity Extractor** - NER and entity linking
- **Relationship Mapper** - Discovers typed relationships
- **Graph Store** - Neo4j or PostgreSQL graph storage
- **Trust Boundary Detector** - Identifies system boundaries
- **Temporal Tracker** - Tracks document versions and changes

**Key Interfaces:**
```typescript
interface KnowledgeGraph {
  addNode(entity: Entity): Promise<NodeId>;
  addEdge(from: NodeId, to: NodeId, relationship: Relationship): Promise<EdgeId>;
  query(pattern: GraphPattern): Promise<GraphResult>;
  findPath(from: NodeId, to: NodeId): Promise<Path[]>;
}
```

### 6. Quality Domain
**Responsibility:** Ensure workspace hygiene and data quality

**Components:**
- **Duplicate Detector** - Near-duplicate document detection
- **Staleness Analyzer** - Identifies outdated information
- **Conflict Detector** - Finds contradictions
- **Relevance Scorer** - Marks low-value documents
- **Coverage Analyzer** - Identifies gaps

## Technology Stack Rationale

### Frontend: Next.js (App Router)
- **Why:** Server Components reduce client bundle, Server Actions simplify mutations
- **Current:** Next.js 14 with App Router, React 18, Mermaid for diagram rendering

### Backend: Node.js + TypeScript
- **Why:** Unified language, rich ecosystem, LangChain native support
- **Current:** TypeScript strict mode, ESM modules, pnpm workspaces + Turborepo

### AI: LangChain.js + Multi-Provider
- **Why:** Standardized LLM interface, task-based routing, provider portability
- **Current:** Groq, Gemini, Ollama, OpenAI supported; Zod for structured output validation

### Storage: File System (current) → PostgreSQL + pgvector (planned)
- **Current:** JSON files on disk, no database required
- **Planned:** PostgreSQL 16 + pgvector for persistent storage and vector search

### Orchestration: Sequential Pipeline (current) → LangGraph.js (planned)
- **Current:** Sequential function calls in the CLI analyze command
- **Planned:** LangGraph.js state machines for multi-step agent workflows

## Data Flow

### Current Analysis Pipeline (Implemented)
```
Files on Disk → Parser Registry → Source Profiler → Classifier
                                                        ↓
                                              Entity Extractor (LLM)
                                                        ↓
                                              Relationship Mapper
                                                        ↓
                                            ┌───────────┴──────────┐
                                            ↓                      ↓
                                      DFD Generator       Quality Detector
                                            ↓                      ↓
                                      Cross-Source         Workspace Summary
                                      Relationships               ↓
                                            └──────┬───────────────┘
                                                   ↓
                                            Output Files (JSON, .mmd)
```

### Planned: Ingestion Flow (Not Yet Implemented)
```
External Source → Connector → Extractor → Chunker → Embedder → PostgreSQL
                                    ↓
                          Table Extractor → Structured Store
                                    ↓
                          Graph Builder → Knowledge Graph
```

### Planned: Query Flow (Not Yet Implemented)
```
User Query → Query Understanding → Retrieval Strategy Selection
                                          ↓
                                   Hybrid Retrieval
                                          ↓
                                      Reranking
                                          ↓
                                   Context Assembly
                                          ↓
                                   LLM Generation
                                          ↓
                                   Source Attribution
```

### Planned: Architecture Generation Flow (Not Yet Implemented)
```
User Request → Agent Router → Analysis Agent
                                   ↓
                          Gather Requirements
                                   ↓
                          Retrieve Documents
                                   ↓
                          Analyze Architecture
                                   ↓
                          Generate Artifacts
                                   ↓
                          Human Approval
                                   ↓
                          Store & Present
```

## Scalability Considerations (Planned)

> The current implementation is single-process, file-system-based. The following describes the scaling strategy for future phases.

### Phase 1: Single-Node (0-10k documents)
- Monolith deployment
- PostgreSQL with pgvector
- Redis for caching
- Vertical scaling

### Phase 2: Horizontally Scaled (10k-100k documents)
- API layer: multiple instances behind load balancer
- PostgreSQL read replicas
- Redis cluster
- Separate worker processes for ingestion
- CDN for static assets

### Phase 3: Distributed (100k+ documents)
- Microservices extraction (if needed)
- Distributed vector search (Qdrant/Milvus)
- Event streaming (Kafka)
- Separate graph database (Neo4j)
- Kubernetes orchestration

## Observability Strategy (Planned)

> The current implementation uses console logging. The following describes the planned observability stack.

### Tracing
- LangSmith for LLM calls
- OpenTelemetry for distributed tracing
- Custom spans for domain operations

### Metrics
- Prometheus for system metrics
- Custom business metrics (documents processed, queries/sec)
- Latency percentiles (p50, p95, p99)

### Logging
- Structured JSON logs
- Log levels: ERROR, WARN, INFO, DEBUG
- Correlation IDs across requests
- PII scrubbing

### Monitoring
- Uptime monitoring
- Query performance tracking
- Embedding generation rate
- Cache hit rates
- Error rates by domain

## Security Considerations (Planned)

> The current implementation is single-user with no authentication. The following describes the planned security model.

### Authentication & Authorization
- OAuth2/OIDC for user authentication
- Role-based access control (RBAC)
- Document-level permissions
- API key management for MCP integrations

### Data Protection
- Encryption at rest (PostgreSQL encryption)
- Encryption in transit (TLS 1.3)
- PII detection and redaction
- Audit logging for sensitive operations

### API Security
- Rate limiting
- Input validation
- SQL injection prevention (parameterized queries)
- XSS prevention (React automatic escaping)
- CSRF tokens

## Integration Points (Planned)

> No external integrations are implemented yet. The following describes the planned integration architecture.

### MCP (Model Context Protocol)
- Pluggable architecture for external tools
- Standardized tool calling interface
- Authentication passthrough
- Rate limiting per MCP server

### External Systems
- REST APIs for integrations
- Webhook support for real-time updates
- Bulk import/export capabilities
- SSO integration

## Key Architectural Decisions

### ADR-001: Modular Monolith Over Microservices
**Decision:** Start with a modular monolith  
**Rationale:** Simpler deployment, easier development, can extract later  
**Consequences:** Must maintain strong internal boundaries

### ADR-002: PostgreSQL Over Dedicated Vector DB
**Decision:** Use pgvector for MVP  
**Rationale:** Reduces operational complexity, good enough for initial scale  
**Consequences:** May need migration at high scale

### ADR-003: Server Components for Frontend
**Decision:** Use Next.js RSC extensively  
**Rationale:** Better performance, reduced client bundle  
**Consequences:** Steeper learning curve, fewer libraries support

### ADR-004: LangGraph for Orchestration
**Decision:** Use LangGraph.js for agent workflows  
**Rationale:** Explicit state machines, debuggability, persistence  
**Consequences:** Learning curve, less flexibility than custom code

### ADR-005: Table-First Approach for Structured Data
**Decision:** Treat tables as first-class entities  
**Rationale:** Embeddings alone lose structure, critical for analysis  
**Consequences:** Additional complexity in extraction and storage

## Success Metrics

### Technical Metrics
- Query latency: p95 < 2s
- Ingestion throughput: > 100 docs/min
- Embedding generation: < 5s per document
- Cache hit rate: > 80%
- System uptime: > 99.9%

### Business Metrics
- Documents processed
- Active workspaces
- Queries per day
- Artifacts generated
- User satisfaction (NPS)

## Next Steps

1. Review and approve this architecture
2. Define detailed domain specifications
3. Design database schema
4. Create LangGraph workflow specifications
5. Set up monorepo structure
6. Define API contracts
7. Begin MVP implementation

---

**Document Owner:** Architecture Team  
**Reviewers:** Engineering Leadership, Product  
**Next Review:** End of Phase 1
