# ContextOS - Roadmap

**Version:** 1.1  
**Date:** May 12, 2026  
**Status:** Vertical slice complete, platform build-out in progress

## Overview

This document tracks what has been implemented, what is actively being worked on, and what is planned for future phases.

---

## Completed

The following features are implemented and working.

### Parsing & Profiling
- [x] File parsing: Markdown, CSV, JSON, YAML, plain text, Excel (.xlsx)
- [x] Figma JSON and Confluence JSON structural parsing
- [x] Pluggable parser registry
- [x] Deterministic source profiling (kind, topics, relevance, warnings)

### Classification
- [x] Rule-based fast classification for unambiguous files
- [x] LLM-based classification fallback for ambiguous cases
- [x] Irrelevant source detection

### Entity & Relationship Extraction
- [x] LLM-based entity extraction (actors, systems, processes, data stores, integrations, endpoints, events)
- [x] LLM-based relationship extraction (uses, calls, stores_in, reads_from, etc.)
- [x] Structured output validation with Zod schemas
- [x] Confidence scoring

### Graph & Artifacts
- [x] Entity merging (deduplication across sources)
- [x] Relationship merging
- [x] In-memory relationship graph (nodes + edges with source references)
- [x] Mermaid Data Flow Diagram (Level 0) generation

### Quality Detection
- [x] Duplicate source detection
- [x] Outdated document detection
- [x] Conflict detection

### Cross-Source Relationships
- [x] Deterministic cross-source relationship mapping

### Workspace Q&A
- [x] Intent-based question routing (deterministic)
- [x] Deterministic answers for workspace overview, irrelevant files, capabilities, source relationships, sheet queries
- [x] LLM-grounded document fact answers
- [x] Source references on all answers

### Workbook / Structured Data
- [x] Excel workbook profiling
- [x] Data normalization
- [x] Metric calculation with filtering

### Web UI
- [x] Workspace CRUD
- [x] File upload with validation
- [x] Run analysis from browser
- [x] View all output artifacts (DFD, entities, findings, profiles, context)
- [x] Interactive Q&A panel
- [x] Calculation panel for structured data
- [x] Stale analysis detection

### CLI
- [x] `contextos analyze <path>` — full analysis pipeline
- [x] `contextos ai:check` — provider health check
- [x] `contextos eval <test-name>` — automated evaluation
- [x] `contextos config:print` — resolved config display

### AI Layer
- [x] Multi-provider support: Groq, Gemini, Ollama, OpenAI, Mock
- [x] Task-based model routing
- [x] Automatic fallback (hosted → local Ollama)
- [x] Deterministic flows work without any LLM configured

### Evaluation
- [x] Automated scoring: entity recall, relationship recall, finding detection, Mermaid validity, source references, schema validity
- [x] Weighted composite score with configurable threshold

---

## Planned: Near-Term

These features are the next priorities. None are implemented yet.

### Persistent Storage
- [ ] PostgreSQL + pgvector integration
- [ ] Document, chunk, and embedding persistence
- [ ] Migration framework

### Search & Retrieval
- [ ] Vector embedding generation pipeline
- [ ] Semantic search (pgvector)
- [ ] Hybrid retrieval (semantic + keyword / BM25)
- [ ] Query result caching (Redis)

### Parsing Expansion
- [ ] PDF parsing
- [ ] DOCX parsing

### Artifact Expansion
- [ ] C4 diagram generation (system context level)
- [ ] LLM response caching to reduce API costs

---

## Planned: Medium-Term

### Agent Workflows
- [ ] LangGraph.js state machine workflows
- [ ] Multi-step reasoning chains
- [ ] Human-in-the-loop approval gates

### Advanced Analysis
- [ ] ADR (Architecture Decision Record) generation
- [ ] Reranking with cross-encoder models
- [ ] Multi-hop retrieval (follow relationships)
- [ ] Staleness detection
- [ ] Coverage analysis

### Integrations
- [ ] Confluence live connector
- [ ] Figma live connector
- [ ] MCP framework

### Observability
- [ ] LangSmith tracing
- [ ] Structured logging with correlation IDs

---

## Planned: Long-Term

### Collaboration & Multi-User
- [ ] Authentication
- [ ] Multi-user workspaces
- [ ] RBAC (role-based access control)

### Advanced Graph
- [ ] Neo4j integration for graph queries
- [ ] Trust boundary detection
- [ ] Temporal tracking (document version history)

### Platform
- [ ] API access
- [ ] Webhooks
- [ ] Scheduled re-ingestion and change detection
- [ ] Enterprise features (SSO, audit logs)

---

## Success Criteria

### Technical
- Analysis pipeline runs end-to-end on any folder of supported documents
- Evaluation framework score ≥ 70% on demo workspace
- Deterministic flows work with no LLM configured

### Quality
- All tests passing
- No P0/P1 bugs
- Type-safe across all packages (TypeScript strict mode)
