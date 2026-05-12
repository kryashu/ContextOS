# ContextOS - Database Schema Design

**Version:** 1.0  
**Date:** May 12, 2026  
**Status:** Design Target (not yet implemented)  
**Database:** PostgreSQL 16+ with pgvector extension

> **Implementation note:** This document describes the planned PostgreSQL schema. The current implementation uses file-system storage (JSON files on disk). No database is required to run ContextOS today. This schema will be implemented when persistent storage is added.

## Overview

ContextOS will use PostgreSQL as the primary data store with pgvector for vector similarity search. The schema is organized around domain boundaries with clear separation of concerns. For the initial phase, PostgreSQL's native capabilities will handle graph queries (recursive CTEs); Neo4j migration path available if needed.

## Design Principles

1. **Domain-Oriented Schema** - Tables grouped by domain
2. **Normalized Design** - 3NF where possible, denormalized for performance where needed
3. **Strong Typing** - Use PostgreSQL types (JSONB, UUID, ENUM)
4. **Audit Trail** - created_at, updated_at on all entities
5. **Soft Deletes** - deleted_at for important data
6. **Vector Storage** - pgvector for embeddings
7. **Full-Text Search** - PostgreSQL tsvector for keyword search
8. **Partitioning** - Ready for table partitioning at scale

## Extensions Required

```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";      -- UUID generation
CREATE EXTENSION IF NOT EXISTS "vector";         -- pgvector for embeddings
CREATE EXTENSION IF NOT EXISTS "pg_trgm";        -- Trigram similarity
CREATE EXTENSION IF NOT EXISTS "btree_gin";      -- GIN indexes on multiple columns
```

## Schema Organization

```
Database: contextos_db

Schemas:
├── public                    -- Default schema
├── core                      -- Core entities (workspaces, users)
├── ingestion                 -- Ingestion domain tables
├── retrieval                 -- Retrieval domain tables (minimal)
├── reasoning                 -- Reasoning domain tables
├── orchestration             -- Orchestration domain tables
├── knowledge_graph           -- Knowledge graph tables
└── quality                   -- Quality domain tables
```

---

## Core Schema

### users
```sql
CREATE TABLE core.users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  avatar_url TEXT,
  role VARCHAR(50) NOT NULL DEFAULT 'member',
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_users_email ON core.users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_status ON core.users(status) WHERE deleted_at IS NULL;
```

### workspaces
```sql
CREATE TABLE core.workspaces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  owner_id UUID NOT NULL REFERENCES core.users(id),
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  settings JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_workspaces_owner ON core.workspaces(owner_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_workspaces_status ON core.workspaces(status) WHERE deleted_at IS NULL;
```

### workspace_members
```sql
CREATE TABLE core.workspace_members (
  workspace_id UUID NOT NULL REFERENCES core.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL DEFAULT 'viewer',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (workspace_id, user_id)
);

CREATE INDEX idx_workspace_members_user ON core.workspace_members(user_id);
```

---

## Ingestion Schema

### sources
```sql
CREATE TABLE ingestion.sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES core.workspaces(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL, -- pdf, docx, excel, confluence, figma, mcp
  config JSONB NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  last_sync_at TIMESTAMPTZ,
  last_sync_status VARCHAR(50),
  sync_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_sources_workspace ON ingestion.sources(workspace_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_sources_type ON ingestion.sources(type) WHERE deleted_at IS NULL;
CREATE INDEX idx_sources_status ON ingestion.sources(status) WHERE deleted_at IS NULL;
```

### documents
```sql
CREATE TABLE ingestion.documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES core.workspaces(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES ingestion.sources(id) ON DELETE CASCADE,
  external_id VARCHAR(500),
  title VARCHAR(500) NOT NULL,
  content TEXT NOT NULL,
  url TEXT,
  mime_type VARCHAR(100),
  size_bytes BIGINT,
  hash VARCHAR(64), -- SHA-256 hash for deduplication
  metadata JSONB NOT NULL DEFAULT '{}',
  structure JSONB, -- Document structure (headings, sections, etc.)
  extracted_at TIMESTAMPTZ,
  indexed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_documents_workspace ON ingestion.documents(workspace_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_documents_source ON ingestion.documents(source_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_documents_hash ON ingestion.documents(hash) WHERE deleted_at IS NULL;
CREATE INDEX idx_documents_external_id ON ingestion.documents(external_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_documents_metadata ON ingestion.documents USING GIN(metadata);

-- Full-text search
ALTER TABLE ingestion.documents ADD COLUMN search_vector tsvector;
CREATE INDEX idx_documents_search ON ingestion.documents USING GIN(search_vector);

-- Trigger to update search_vector
CREATE OR REPLACE FUNCTION ingestion.update_document_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.content, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_document_search_vector
BEFORE INSERT OR UPDATE OF title, content ON ingestion.documents
FOR EACH ROW EXECUTE FUNCTION ingestion.update_document_search_vector();
```

### chunks
```sql
CREATE TABLE ingestion.chunks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES ingestion.documents(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding vector(1536), -- OpenAI ada-002 dimension, adjust as needed
  position INTEGER NOT NULL,
  token_count INTEGER,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chunks_document ON ingestion.chunks(document_id);
CREATE INDEX idx_chunks_position ON ingestion.chunks(document_id, position);

-- Vector similarity search index (HNSW for fast approximate nearest neighbor)
CREATE INDEX idx_chunks_embedding ON ingestion.chunks 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Alternative: IVFFlat for exact search (use one or the other)
-- CREATE INDEX idx_chunks_embedding ON ingestion.chunks 
-- USING ivfflat (embedding vector_cosine_ops)
-- WITH (lists = 100);
```

### tables
```sql
CREATE TABLE ingestion.tables (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES ingestion.documents(id) ON DELETE CASCADE,
  name VARCHAR(255),
  position INTEGER NOT NULL,
  headers TEXT[] NOT NULL,
  rows JSONB NOT NULL, -- Array of row objects
  row_count INTEGER NOT NULL,
  column_count INTEGER NOT NULL,
  schema JSONB, -- Inferred schema (types, constraints)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tables_document ON ingestion.tables(document_id);
CREATE INDEX idx_tables_rows ON ingestion.tables USING GIN(rows);
```

### ingestion_jobs
```sql
CREATE TABLE ingestion.ingestion_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES core.workspaces(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES ingestion.sources(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  document_count INTEGER DEFAULT 0,
  processed_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ingestion_jobs_workspace ON ingestion.ingestion_jobs(workspace_id);
CREATE INDEX idx_ingestion_jobs_status ON ingestion.ingestion_jobs(status);
CREATE INDEX idx_ingestion_jobs_created ON ingestion.ingestion_jobs(created_at DESC);
```

---

## Retrieval Schema

### query_cache
```sql
CREATE TABLE retrieval.query_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES core.workspaces(id) ON DELETE CASCADE,
  query_hash VARCHAR(64) NOT NULL, -- Hash of query + filters
  query_text TEXT NOT NULL,
  filters JSONB,
  results JSONB NOT NULL,
  result_count INTEGER NOT NULL,
  strategy VARCHAR(50) NOT NULL,
  ttl TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_query_cache_hash ON retrieval.query_cache(query_hash, workspace_id);
CREATE INDEX idx_query_cache_ttl ON retrieval.query_cache(ttl);

-- Cleanup expired cache entries
CREATE INDEX idx_query_cache_cleanup ON retrieval.query_cache(created_at) 
WHERE created_at < NOW() - INTERVAL '1 day';
```

### query_logs
```sql
CREATE TABLE retrieval.query_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES core.workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES core.users(id),
  query_text TEXT NOT NULL,
  filters JSONB,
  strategy VARCHAR(50) NOT NULL,
  result_count INTEGER NOT NULL,
  latency_ms INTEGER NOT NULL,
  cache_hit BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_query_logs_workspace ON retrieval.query_logs(workspace_id, created_at DESC);
CREATE INDEX idx_query_logs_user ON retrieval.query_logs(user_id, created_at DESC);

-- Partition by month for better query performance
-- ALTER TABLE retrieval.query_logs PARTITION BY RANGE (created_at);
```

---

## Reasoning Schema

### system_architectures
```sql
CREATE TABLE reasoning.system_architectures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES core.workspaces(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  insights JSONB,
  analyzed_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_architectures_workspace ON reasoning.system_architectures(workspace_id);
```

### components
```sql
CREATE TABLE reasoning.components (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  architecture_id UUID NOT NULL REFERENCES reasoning.system_architectures(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(100) NOT NULL,
  description TEXT,
  technologies TEXT[],
  responsibilities TEXT[],
  source_references JSONB, -- Array of {documentId, chunkId, excerpt}
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_components_architecture ON reasoning.components(architecture_id);
CREATE INDEX idx_components_type ON reasoning.components(type);
```

### dependencies
```sql
CREATE TABLE reasoning.dependencies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  architecture_id UUID NOT NULL REFERENCES reasoning.system_architectures(id) ON DELETE CASCADE,
  from_component_id UUID NOT NULL REFERENCES reasoning.components(id) ON DELETE CASCADE,
  to_component_id UUID NOT NULL REFERENCES reasoning.components(id) ON DELETE CASCADE,
  type VARCHAR(100) NOT NULL,
  protocol VARCHAR(100),
  description TEXT,
  source_references JSONB,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_no_self_dependency CHECK (from_component_id != to_component_id)
);

CREATE INDEX idx_dependencies_architecture ON reasoning.dependencies(architecture_id);
CREATE INDEX idx_dependencies_from ON reasoning.dependencies(from_component_id);
CREATE INDEX idx_dependencies_to ON reasoning.dependencies(to_component_id);
```

### artifacts
```sql
CREATE TABLE reasoning.artifacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES core.workspaces(id) ON DELETE CASCADE,
  architecture_id UUID REFERENCES reasoning.system_architectures(id) ON DELETE SET NULL,
  type VARCHAR(50) NOT NULL, -- dfd, c4, adr, summary, risk_analysis
  name VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  format VARCHAR(50) NOT NULL, -- mermaid, markdown, json
  metadata JSONB NOT NULL DEFAULT '{}',
  approval_status VARCHAR(50) NOT NULL DEFAULT 'pending',
  approved_by UUID REFERENCES core.users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_artifacts_workspace ON reasoning.artifacts(workspace_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_artifacts_type ON reasoning.artifacts(type) WHERE deleted_at IS NULL;
CREATE INDEX idx_artifacts_status ON reasoning.artifacts(approval_status);
```

### contradictions
```sql
CREATE TABLE reasoning.contradictions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES core.workspaces(id) ON DELETE CASCADE,
  type VARCHAR(100) NOT NULL,
  topic VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  severity VARCHAR(50) NOT NULL,
  document_references JSONB NOT NULL, -- Array of document/chunk references
  suggestion TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'open',
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES core.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_contradictions_workspace ON reasoning.contradictions(workspace_id);
CREATE INDEX idx_contradictions_severity ON reasoning.contradictions(severity);
CREATE INDEX idx_contradictions_status ON reasoning.contradictions(status);
```

---

## Orchestration Schema

### agents
```sql
CREATE TABLE orchestration.agents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT NOT NULL,
  capabilities TEXT[] NOT NULL,
  system_prompt TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_agents_capabilities ON orchestration.agents USING GIN(capabilities);
```

### workflows
```sql
CREATE TABLE orchestration.workflows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT NOT NULL,
  definition JSONB NOT NULL, -- LangGraph workflow definition
  version VARCHAR(50) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### workflow_executions
```sql
CREATE TABLE orchestration.workflow_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_id UUID NOT NULL REFERENCES orchestration.workflows(id),
  workspace_id UUID NOT NULL REFERENCES core.workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES core.users(id),
  status VARCHAR(50) NOT NULL DEFAULT 'running',
  current_node VARCHAR(255),
  state JSONB NOT NULL DEFAULT '{}',
  input JSONB NOT NULL,
  output JSONB,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_executions_workflow ON orchestration.workflow_executions(workflow_id);
CREATE INDEX idx_executions_workspace ON orchestration.workflow_executions(workspace_id);
CREATE INDEX idx_executions_status ON orchestration.workflow_executions(status);
CREATE INDEX idx_executions_user ON orchestration.workflow_executions(user_id);
```

### execution_history
```sql
CREATE TABLE orchestration.execution_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  execution_id UUID NOT NULL REFERENCES orchestration.workflow_executions(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  node_name VARCHAR(255) NOT NULL,
  action VARCHAR(100) NOT NULL,
  input JSONB,
  output JSONB,
  error TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_execution_history_execution ON orchestration.execution_history(execution_id, step_number);
```

### approval_requests
```sql
CREATE TABLE orchestration.approval_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  execution_id UUID NOT NULL REFERENCES orchestration.workflow_executions(id) ON DELETE CASCADE,
  type VARCHAR(100) NOT NULL,
  content JSONB NOT NULL,
  requester_id UUID REFERENCES core.users(id),
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  approved BOOLEAN,
  feedback TEXT,
  resolved_by UUID REFERENCES core.users(id),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_approval_requests_execution ON orchestration.approval_requests(execution_id);
CREATE INDEX idx_approval_requests_status ON orchestration.approval_requests(status);
```

---

## Knowledge Graph Schema

### entities
```sql
CREATE TABLE knowledge_graph.entities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES core.workspaces(id) ON DELETE CASCADE,
  type VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  canonical_name VARCHAR(255), -- Resolved/normalized name
  properties JSONB NOT NULL DEFAULT '{}',
  source_references JSONB NOT NULL,
  confidence NUMERIC(3,2) NOT NULL DEFAULT 1.0 CHECK (confidence BETWEEN 0 AND 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_entities_workspace ON knowledge_graph.entities(workspace_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_entities_type ON knowledge_graph.entities(type) WHERE deleted_at IS NULL;
CREATE INDEX idx_entities_name ON knowledge_graph.entities(name) WHERE deleted_at IS NULL;
CREATE INDEX idx_entities_canonical ON knowledge_graph.entities(canonical_name) WHERE deleted_at IS NULL;
CREATE INDEX idx_entities_properties ON knowledge_graph.entities USING GIN(properties);
```

### relationships
```sql
CREATE TABLE knowledge_graph.relationships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES core.workspaces(id) ON DELETE CASCADE,
  from_entity_id UUID NOT NULL REFERENCES knowledge_graph.entities(id) ON DELETE CASCADE,
  to_entity_id UUID NOT NULL REFERENCES knowledge_graph.entities(id) ON DELETE CASCADE,
  type VARCHAR(100) NOT NULL,
  properties JSONB NOT NULL DEFAULT '{}',
  source_references JSONB NOT NULL,
  confidence NUMERIC(3,2) NOT NULL DEFAULT 1.0 CHECK (confidence BETWEEN 0 AND 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT chk_no_self_relationship CHECK (from_entity_id != to_entity_id)
);

CREATE INDEX idx_relationships_workspace ON knowledge_graph.relationships(workspace_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_relationships_from ON knowledge_graph.relationships(from_entity_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_relationships_to ON knowledge_graph.relationships(to_entity_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_relationships_type ON knowledge_graph.relationships(type) WHERE deleted_at IS NULL;

-- Composite index for graph traversal
CREATE INDEX idx_relationships_graph ON knowledge_graph.relationships(from_entity_id, to_entity_id) 
WHERE deleted_at IS NULL;
```

### trust_boundaries
```sql
CREATE TABLE knowledge_graph.trust_boundaries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES core.workspaces(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  entity_ids UUID[] NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_trust_boundaries_workspace ON knowledge_graph.trust_boundaries(workspace_id);
CREATE INDEX idx_trust_boundaries_entities ON knowledge_graph.trust_boundaries USING GIN(entity_ids);
```

---

## Quality Schema

### duplicate_groups
```sql
CREATE TABLE quality.duplicate_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES core.workspaces(id) ON DELETE CASCADE,
  document_ids UUID[] NOT NULL,
  similarity NUMERIC(5,4) NOT NULL CHECK (similarity BETWEEN 0 AND 1),
  type VARCHAR(50) NOT NULL,
  suggested_action TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'open',
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES core.users(id),
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_duplicate_groups_workspace ON quality.duplicate_groups(workspace_id);
CREATE INDEX idx_duplicate_groups_status ON quality.duplicate_groups(status);
```

### staleness_reports
```sql
CREATE TABLE quality.staleness_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES core.workspaces(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES ingestion.documents(id) ON DELETE CASCADE,
  staleness_score NUMERIC(5,4) NOT NULL CHECK (staleness_score BETWEEN 0 AND 1),
  age_days INTEGER NOT NULL,
  related_documents UUID[],
  suggestion TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'open',
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_staleness_workspace ON quality.staleness_reports(workspace_id);
CREATE INDEX idx_staleness_document ON quality.staleness_reports(document_id);
CREATE INDEX idx_staleness_score ON quality.staleness_reports(staleness_score DESC);
```

### quality_scores
```sql
CREATE TABLE quality.quality_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES ingestion.documents(id) ON DELETE CASCADE,
  overall_score NUMERIC(5,4) NOT NULL CHECK (overall_score BETWEEN 0 AND 1),
  completeness_score NUMERIC(5,4) NOT NULL,
  accuracy_score NUMERIC(5,4) NOT NULL,
  relevance_score NUMERIC(5,4) NOT NULL,
  freshness_score NUMERIC(5,4) NOT NULL,
  issues JSONB NOT NULL DEFAULT '[]',
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_quality_scores_document ON quality.quality_scores(document_id);
CREATE INDEX idx_quality_scores_overall ON quality.quality_scores(overall_score DESC);
```

---

## Materialized Views

### workspace_statistics
```sql
CREATE MATERIALIZED VIEW core.workspace_statistics AS
SELECT 
  w.id AS workspace_id,
  w.name AS workspace_name,
  COUNT(DISTINCT d.id) AS document_count,
  COUNT(DISTINCT c.id) AS chunk_count,
  COUNT(DISTINCT s.id) AS source_count,
  COUNT(DISTINCT e.id) AS entity_count,
  COUNT(DISTINCT r.id) AS relationship_count,
  COUNT(DISTINCT a.id) AS artifact_count,
  MAX(d.created_at) AS last_document_added,
  AVG(qs.overall_score) AS avg_quality_score
FROM core.workspaces w
LEFT JOIN ingestion.documents d ON w.id = d.workspace_id AND d.deleted_at IS NULL
LEFT JOIN ingestion.chunks c ON d.id = c.document_id
LEFT JOIN ingestion.sources s ON w.id = s.workspace_id AND s.deleted_at IS NULL
LEFT JOIN knowledge_graph.entities e ON w.id = e.workspace_id AND e.deleted_at IS NULL
LEFT JOIN knowledge_graph.relationships r ON w.id = r.workspace_id AND r.deleted_at IS NULL
LEFT JOIN reasoning.artifacts a ON w.id = a.workspace_id AND a.deleted_at IS NULL
LEFT JOIN quality.quality_scores qs ON d.id = qs.document_id
WHERE w.deleted_at IS NULL
GROUP BY w.id, w.name;

CREATE UNIQUE INDEX idx_workspace_stats ON core.workspace_statistics(workspace_id);

-- Refresh schedule (run via cron or pg_cron)
-- REFRESH MATERIALIZED VIEW CONCURRENTLY core.workspace_statistics;
```

---

## Database Functions

### Vector Similarity Search
```sql
CREATE OR REPLACE FUNCTION retrieval.search_similar_chunks(
  query_embedding vector(1536),
  p_workspace_id UUID,
  p_limit INTEGER DEFAULT 10,
  p_threshold FLOAT DEFAULT 0.7
)
RETURNS TABLE (
  chunk_id UUID,
  document_id UUID,
  content TEXT,
  similarity FLOAT,
  metadata JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.document_id,
    c.content,
    1 - (c.embedding <=> query_embedding) AS similarity,
    c.metadata
  FROM ingestion.chunks c
  JOIN ingestion.documents d ON c.document_id = d.id
  WHERE d.workspace_id = p_workspace_id
    AND d.deleted_at IS NULL
    AND 1 - (c.embedding <=> query_embedding) >= p_threshold
  ORDER BY c.embedding <=> query_embedding
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;
```

### Graph Path Finding
```sql
CREATE OR REPLACE FUNCTION knowledge_graph.find_paths(
  p_from_entity_id UUID,
  p_to_entity_id UUID,
  p_max_depth INTEGER DEFAULT 5
)
RETURNS TABLE (
  path UUID[],
  path_length INTEGER,
  relationship_types TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE entity_paths AS (
    -- Base case: direct relationships
    SELECT 
      ARRAY[r.from_entity_id, r.to_entity_id] AS path,
      1 AS depth,
      ARRAY[r.type] AS rel_types
    FROM knowledge_graph.relationships r
    WHERE r.from_entity_id = p_from_entity_id
      AND r.deleted_at IS NULL
    
    UNION ALL
    
    -- Recursive case: extend paths
    SELECT 
      ep.path || r.to_entity_id,
      ep.depth + 1,
      ep.rel_types || r.type
    FROM entity_paths ep
    JOIN knowledge_graph.relationships r ON r.from_entity_id = ep.path[array_length(ep.path, 1)]
    WHERE r.to_entity_id != ALL(ep.path) -- Avoid cycles
      AND ep.depth < p_max_depth
      AND r.deleted_at IS NULL
  )
  SELECT 
    ep.path,
    ep.depth,
    ep.rel_types
  FROM entity_paths ep
  WHERE ep.path[array_length(ep.path, 1)] = p_to_entity_id
  ORDER BY ep.depth;
END;
$$ LANGUAGE plpgsql;
```

---

## Migration Strategy

### Phase 1: Core + Ingestion
1. Create core schema (users, workspaces)
2. Create ingestion schema (sources, documents, chunks, tables)
3. Set up pgvector indexes

### Phase 2: Retrieval + Reasoning
1. Create retrieval schema (query_cache, query_logs)
2. Create reasoning schema (architectures, components, artifacts)

### Phase 3: Orchestration + Graph
1. Create orchestration schema (agents, workflows, executions)
2. Create knowledge_graph schema (entities, relationships)

### Phase 4: Quality
1. Create quality schema (duplicates, staleness, scores)

---

## Performance Considerations

### Indexing Strategy
- **Vector Indexes:** Use HNSW for fast approximate search
- **JSONB Indexes:** GIN indexes on frequently queried JSONB fields
- **Composite Indexes:** For common query patterns
- **Partial Indexes:** Include WHERE clauses for soft-deletes

### Partitioning (Future)
- Partition `query_logs` by month
- Partition `execution_history` by month
- Consider partitioning `chunks` by workspace at high scale

### Connection Pooling
- Use PgBouncer for connection pooling
- Transaction mode for short transactions
- Session mode for long-running queries

### Caching
- Redis for query result caching
- Materialized views for aggregated statistics
- Application-level caching for hot data

---

## Backup & Recovery

### Backup Strategy
- **Full Backup:** Daily using pg_dump
- **Incremental Backup:** WAL archiving for point-in-time recovery
- **Vector Embeddings:** Separate backup (can be regenerated if needed)

### Disaster Recovery
- RTO: 4 hours
- RPO: 1 hour
- Automated failover with replication

---

## Next Steps

1. Review schema with team
2. Set up PostgreSQL with pgvector
3. Create initial migration files
4. Implement repository pattern in code
5. Set up database seeding for development
6. Write integration tests for critical queries

---

**Document Owner:** Backend Team  
**Reviewers:** Data Team, Architecture Team  
**Next Review:** After MVP implementation
