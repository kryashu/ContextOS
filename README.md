# ContextOS - AI-Powered Workspace Intelligence Platform

**Version:** 0.1.0 (Pre-MVP)  
**Date:** May 6, 2026  
**Status:** Architecture & Design Phase

## Overview

ContextOS is an AI-powered Workspace Intelligence and Architecture Reasoning Platform designed to understand relationships across heterogeneous enterprise documents and systems. Unlike simple RAG applications, ContextOS builds a semantic knowledge graph, detects quality issues, and generates architecture artifacts through sophisticated agentic workflows.

### What Makes ContextOS Different?

This is **NOT**:
- ❌ A chatbot
- ❌ A simple RAG app
- ❌ A NotebookLM clone
- ❌ A Jira assistant

This **IS**:
- ✅ A workspace intelligence engine
- ✅ A semantic system understanding platform
- ✅ An architecture reasoning system
- ✅ A knowledge relationship mapper

### Key Capabilities

- **Multi-Format Ingestion** - PDFs, DOCX, Excel, Confluence, Figma, APIs, Git repos
- **Semantic Understanding** - Builds knowledge graph of entities and relationships
- **Architecture Reasoning** - Identifies components, dependencies, trust boundaries
- **Artifact Generation** - DFDs, C4 diagrams, ADRs, risk analyses
- **Quality Intelligence** - Detects duplicates, stale docs, conflicts, gaps
- **Source-Grounded Responses** - All AI answers cite original sources

---

## Architecture Documentation

This repository contains comprehensive architecture and design documentation:

### Core Architecture

1. **[ARCHITECTURE.md](./ARCHITECTURE.md)** ⭐ **START HERE**
   - High-level system architecture
   - Technology stack and rationale
   - Domain boundaries overview
   - Data flow diagrams
   - Scalability considerations
   - Key architectural decisions (ADRs)

2. **[MONOREPO_STRUCTURE.md](./MONOREPO_STRUCTURE.md)**
   - Complete monorepo folder structure
   - Package organization (pnpm workspaces + Turborepo)
   - Dependency rules and conventions
   - Build configuration
   - Development workflow

3. **[DOMAIN_BOUNDARIES.md](./DOMAIN_BOUNDARIES.md)**
   - Detailed domain specifications
   - Domain responsibilities and interfaces
   - API contracts and events
   - Communication patterns
   - Domain interaction flows

### Technical Design

4. **[DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md)**
   - PostgreSQL + pgvector schema design
   - All tables with indexes and constraints
   - Migration strategy
   - Performance optimization
   - Backup and recovery

5. **[AGENT_ORCHESTRATION.md](./AGENT_ORCHESTRATION.md)**
   - LangGraph.js workflow definitions
   - Agent architecture and routing
   - State management and persistence
   - Tool definitions
   - Observability and error handling

### Planning & Operations

6. **[ROADMAP.md](./ROADMAP.md)** ⭐ **IMPORTANT**
   - MVP scope definition (what's in/out)
   - Phase-wise implementation plan (16 weeks)
   - Success criteria and metrics
   - Resource requirements
   - Post-MVP roadmap

7. **[TECHNICAL_RISKS.md](./TECHNICAL_RISKS.md)**
   - Comprehensive risk assessment
   - Mitigation strategies
   - Monitoring dashboards
   - Incident response plan

8. **[CODING_STANDARDS.md](./CODING_STANDARDS.md)**
   - TypeScript best practices
   - Naming conventions
   - Error handling patterns
   - Testing standards
   - Code review checklist

---

## Technology Stack

### Frontend
- **Framework:** Next.js 15 (App Router, Server Components)
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS
- **State:** TanStack Query
- **UI Components:** Custom + shadcn/ui

### Backend
- **Runtime:** Node.js 20+
- **Language:** TypeScript
- **AI Framework:** LangChain.js + LangGraph.js
- **LLM:** Multi-provider support (Groq, Gemini, Ollama, OpenAI)
  - Task-based routing: lightweight tasks → Ollama (local), complex reasoning → hosted LLMs
  - Intelligent fallback with safeguards

### Data Layer
- **Primary Database:** PostgreSQL 16 + pgvector
- **Cache/Queue:** Redis
- **Graph DB:** Neo4j (optional, Phase 9+)

### Infrastructure
- **Monorepo:** pnpm workspaces + Turborepo
- **Hosting:** Vercel (frontend) + Railway/Render (backend)
- **Observability:** LangSmith, Sentry, Axiom
- **CI/CD:** GitHub Actions

---

## LLM Provider Setup

ContextOS supports multiple LLM providers with intelligent task-based routing for optimal cost and performance.

### Recommended Setup (Hardware-Light)

For running ContextOS with minimal hardware requirements (only ~4GB RAM for local models):

**1. Install Ollama (local, free):**
```bash
brew install ollama
ollama pull llama3.2:3b
```

**2. Get free Groq API key:**
- Visit [https://console.groq.com](https://console.groq.com)
- Sign up for free tier (14,400 requests/day)
- Copy your API key

**3. Configure environment:**
```bash
# Copy example config
cp .env.example .env

# Edit .env with your settings
LLM_PROVIDER=groq
LOCAL_LLM_PROVIDER=ollama
ENABLE_LOCAL_FALLBACK=true
GROQ_API_KEY=your_groq_key_here
```

### Task-Based Routing

ContextOS automatically routes different tasks to the most appropriate model:

| Task | Primary Provider | Fallback | Rationale |
|------|-----------------|----------|-----------|
| **Classification** | Ollama 3b (local) | None | Fast, simple pattern matching |
| **Summarization** | Ollama 3b (local) | None | Lightweight, good quality |
| **Entity Extraction** | Groq/Gemini (hosted) | Ollama 3b* | Complex reasoning needs hosted LLMs |
| **Relationship Mapping** | Groq/Gemini (hosted) | None | Too complex for small models |
| **Artifact Generation** | Groq/Gemini (hosted) | None | Requires structured reasoning |

*Fallback only when `ENABLE_LOCAL_FALLBACK=true` and document < 50KB

### Supported Providers

**Groq** (Recommended)
- Free tier: 14,400 requests/day
- Model: llama-3.3-70b-versatile
- Get key: [console.groq.com](https://console.groq.com)

**Google Gemini** (Low Cost)
- Model: gemini-1.5-flash
- Get key: [aistudio.google.com](https://aistudio.google.com)

**Ollama** (Local)
- Model: llama3.2:3b (4GB RAM)
- Free, runs offline
- Install: `brew install ollama`

**OpenAI** (Expensive)
- Models: gpt-4o, gpt-4o-mini
- Requires paid account
- Get key: [platform.openai.com](https://platform.openai.com)

### Intelligent Fallback

When primary hosted LLM fails (quota exceeded, rate limit), ContextOS can automatically fall back to local Ollama:

**Fallback Conditions:**
- `ENABLE_LOCAL_FALLBACK=true`
- Ollama is running locally
- Document size < 50KB (configurable)
- Task supports fallback (classification, summarization, extraction)

**Safeguards:**
- Content truncation to 8K tokens
- Warning logs for quality expectations
- Skip fallback for complex tasks (relationship mapping, artifact generation)

**Quality Impact:**
- Fallback results may have 10-20% lower accuracy
- Suitable for development and cost-sensitive deployments
- Not recommended for production entity extraction

### Configuration Reference

See [`.env.example`](./.env.example) for complete configuration options including:
- Provider selection (`LLM_PROVIDER`, `LOCAL_LLM_PROVIDER`)
- Model customization (`GROQ_MODEL`, `GEMINI_MODEL`, `OLLAMA_MODEL`)
- Fallback settings (`ENABLE_LOCAL_FALLBACK`, `LOCAL_FALLBACK_MAX_SIZE_KB`)
- API keys for all providers

---

## Project Principles

### Architectural Principles

1. **Spec-Driven Development** - Every module begins with a specification
2. **Modular Monolith** - Single deployable with clear internal boundaries
3. **Domain-Oriented Design** - Organized by business capability
4. **Event-Driven Internals** - Loose coupling through domain events
5. **Strong Typing** - TypeScript strict mode everywhere
6. **Source-Grounded AI** - All responses cite original sources
7. **Table Intelligence** - Structured data as first-class entities
8. **Human-in-the-Loop** - Critical artifacts require approval
9. **Production-Grade from Day One** - Observability, testing, error handling

### Engineering Principles

1. **Clarity over Cleverness**
2. **Type Safety First**
3. **Fail Fast**
4. **Domain Language**
5. **SOLID Principles**
6. **Test What Matters**
7. **Document Why, Not What**
8. **Performance Second** (optimize after profiling)

---

## Domain Architecture

ContextOS is organized into 6 core domains:

### 1. Ingestion Domain
**Responsibility:** Transform external documents into structured, searchable knowledge

**Key Components:**
- Connector Registry (PDF, DOCX, Excel, Confluence, Figma, MCP)
- Content Extractors
- Semantic Chunking Engine
- Embedding Pipeline
- Table Extractor
- Initial Graph Builder

### 2. Retrieval Domain
**Responsibility:** Find relevant information across the knowledge base

**Key Components:**
- Semantic Search (pgvector)
- Hybrid Retrieval (semantic + keyword)
- Reranker
- Multi-hop Retrieval
- Table Query Engine
- Query Cache Manager

### 3. Reasoning Domain
**Responsibility:** Understand, analyze, and synthesize information

**Key Components:**
- Architecture Analyzer
- Relationship Inference
- Contradiction Detector
- Entity Resolver
- Artifact Generator (DFDs, C4, ADRs)
- Risk Analyzer

### 4. Orchestration Domain
**Responsibility:** Coordinate multi-step agentic workflows

**Key Components:**
- Agent Router
- Workflow Engine (LangGraph)
- State Manager
- Tool Registry
- Approval Gateway

### 5. Knowledge Graph Domain
**Responsibility:** Build and maintain semantic relationship graph

**Key Components:**
- Entity Extractor
- Relationship Mapper
- Graph Store
- Trust Boundary Detector
- Temporal Tracker

### 6. Quality Domain
**Responsibility:** Ensure workspace hygiene and data quality

**Key Components:**
- Duplicate Detector
- Staleness Analyzer
- Conflict Detector
- Relevance Scorer
- Coverage Analyzer

---

## MVP Scope (Phases 0-5, 16 weeks)

### ✅ What's IN

- ✅ PDF, DOCX, Markdown ingestion
- ✅ Semantic + hybrid search
- ✅ Query interface with streaming responses
- ✅ Source attribution
- ✅ Component identification
- ✅ Basic dependency mapping
- ✅ DFD and C4 (system level) generation
- ✅ Duplicate detection
- ✅ Quality scoring
- ✅ Single-user workspaces
- ✅ Modern responsive UI

### ❌ What's OUT (Post-MVP)

- ❌ Excel/CSV structured data (Phase 6)
- ❌ Confluence/Figma integrations (Phase 7)
- ❌ Multi-user collaboration (Phase 8)
- ❌ Advanced graph queries (Phase 9)
- ❌ ADR generation, risk analysis (Phase 10)
- ❌ Enterprise features (SSO, RBAC) (Phase 11)

---

## MVP Timeline

```
Phase 0: Foundation (Weeks 1-2)
  └─ Setup monorepo, database, base packages

Phase 1: Core Ingestion (Weeks 3-5)
  └─ Document upload, extraction, embedding

Phase 2: Query & Retrieval (Weeks 6-8)
  └─ Semantic search, query interface, streaming

Phase 3: Architecture Analysis (Weeks 9-11)
  └─ Component identification, artifact generation

Phase 4: Quality & Polish (Weeks 12-14)
  └─ Duplicate detection, testing, documentation

Phase 5: Beta & Iteration (Weeks 15-16)
  └─ User testing, feedback, production prep

──────────────────────────────────────────
Total: 16 weeks (~4 months to MVP)
```

---

## Success Criteria

### Technical Metrics
- Query response time: p95 < 3s
- Document ingestion: < 30s for typical PDF
- System uptime: > 95% (MVP)
- Test coverage: > 70%

### Business Metrics
- 10+ test workspaces
- 100+ documents ingested
- 500+ queries answered
- 20+ architecture diagrams generated
- User satisfaction: 80%+ positive

---

## Current Status: Vertical Slice 001

Vertical Slice 001 is implemented and working: a complete end-to-end demo that processes a workspace, extracts entities and relationships, generates artifacts, and detects quality issues.

### What's Working

- ✅ Multi-format parsing (Markdown, CSV, JSON)
- ✅ Document classification
- ✅ Entity and relationship extraction using LLMs
- ✅ Relationship graph generation
- ✅ Data Flow Diagram (DFD) generation (Mermaid format)
- ✅ Quality issue detection (duplicates, outdated docs, conflicts)
- ✅ Multi-provider LLM support (Groq, Gemini, Ollama, OpenAI, Mock)
- ✅ Task-based routing and intelligent fallback
- ✅ Provider health checking and validation
- ✅ Evaluation system with quality metrics

### Running the Demo

**Prerequisites:**
```bash
Node.js >= 20
pnpm >= 8
```

**Setup:**
```bash
# Install dependencies
pnpm install

# Build packages
pnpm build

# Configure LLM provider (choose one)
# Option 1: Use mock provider (no API key needed)
set -x LLM_PROVIDER mock

# Option 2: Use Groq (free tier)
set -x LLM_PROVIDER groq
set -x GROQ_API_KEY your_api_key_here

# Option 3: Use Gemini
set -x LLM_PROVIDER gemini
set -x GOOGLE_API_KEY your_api_key_here
```

**Run Demo:**
```bash
# Run on demo workspace (checkout-system)
pnpm contextos demo ./demo-workspaces/checkout-system

# Output will be written to:
# demo-workspaces/checkout-system/output/
```

### Provider Health Check

Validate that your LLM providers are configured correctly:

```bash
# Check all configured providers
set -x LLM_PROVIDER mock  # or groq, gemini, etc.
pnpm contextos ai:check

# Output:
# ✅ Shows which providers are working
# ✅ Tests structured output capability
# ✅ Measures response latency
# ✅ Generates ai-provider-report.json
```

**Example output:**
```
🔍 ContextOS AI Provider Health Check

Provider Status:
────────────────────────────────────────────────────────────
✅ mock       fake-list-chat-model (1ms)
⊝ ollama     LOCAL_LLM_PROVIDER not set to ollama
⊝ groq       GROQ_API_KEY not configured
⊝ gemini     GOOGLE_API_KEY/GEMINI_API_KEY not configured
────────────────────────────────────────────────────────────

📊 Report saved to ai-provider-report.json
```

### Evaluation System

Run automated quality checks on the demo outputs:

```bash
# Run Vertical Slice 001 evaluation
pnpm contextos eval vertical-slice-001

# This will:
# 1. Run demo on checkout-system workspace
# 2. Load expected outputs from evals/vertical-slice-001.expected.json
# 3. Calculate 7 quality metrics:
#    - Entity Recall (25%)
#    - Relationship Recall (25%)
#    - Finding Detection (15%)
#    - Irrelevant Detection (10%)
#    - Mermaid Validity (10%)
#    - Source References (10%)
#    - Schema Validity (5%)
# 4. Generate eval-report.json with weighted score
# 5. Exit with error if score < 70%
```

**Example output:**
```
Evaluation Results:
═══════════════════════════════════════════════════════════
✅ Entity Recall              100.0%
✅ Relationship Recall         100.0%
✅ Finding Detection           100.0%
✅ Irrelevant Detection        100.0%
✅ Mermaid Validity            100.0%
✅ Source References            95.0%
✅ Schema Validity             100.0%
═══════════════════════════════════════════════════════════
✅ Total Score: 98.5% (threshold: 70%)
```

### Demo Output Files

The demo generates 4 output files in `<workspace>/output/`:

1. **workspace-summary.json** - High-level workspace analysis
   - Total sources, entities, relationships
   - Statistics by type and category
   - Quality metrics

2. **relationship-graph.json** - Full entity relationship graph
   - All extracted entities with metadata
   - All relationships between entities
   - Source references for traceability

3. **findings.json** - Quality issues detected
   - Duplicate sources
   - Outdated documents
   - Conflicting information
   - Missing dependencies

4. **dfd-level-0.mmd** - Data Flow Diagram (Mermaid syntax)
   - Actors, processes, data stores
   - Data flows between components
   - External systems

### Known Limitations

- **OpenAI requires paid account** - Free tier has zero quota
- **Groq free tier variability** - 14,400 requests/day but can be rate-limited during peak times
- **Ollama fallback quality** - 10-20% lower accuracy for complex extraction tasks
- **Mock provider** - Returns deterministic test data, not real LLM responses
- **Single workspace only** - No multi-workspace support yet
- **No persistence** - Outputs are files, not stored in database

### Next Steps

See [ROADMAP.md](./ROADMAP.md) for the full MVP implementation plan (16 weeks):
- Phase 2: Web UI with document upload
- Phase 3: PostgreSQL + pgvector integration
- Phase 4: Agentic workflows with LangGraph
- Phase 5: Architecture reasoning and artifact generation
- And more...

---

## Getting Started (Future)

### Prerequisites
```bash
Node.js >= 20
pnpm >= 8
PostgreSQL >= 16 (with pgvector)
Redis >= 7
```

### Setup
```bash
# Clone repository
git clone https://github.com/your-org/contextos.git
cd contextos

# Install dependencies
pnpm install

# Setup environment
cp .env.example .env
# Configure LLM providers (see "LLM Provider Setup" section above)
# Recommended: GROQ_API_KEY for hosted + Ollama for local
# Also configure: DATABASE_URL, REDIS_URL

# Setup database
pnpm db:migrate
pnpm db:seed

# Start development
pnpm dev
```

### Development
```bash
# Run all apps
pnpm dev

# Run specific app
pnpm --filter @contextos/web dev

# Run tests
pnpm test

# Type check
pnpm type-check

# Lint
pnpm lint
```

---

## Team Structure

### MVP Team (Recommended)
- **2-3 Full-Stack Engineers** (backend-focused)
- **1 Frontend Engineer** (Next.js/React)
- **1 AI/ML Engineer** (LangChain, LLMs)
- **1 Product Manager** (part-time)
- **1 Designer** (part-time)

---

## Key Risks & Mitigations

### P0 Critical Risks
1. **LLM API Cost Explosion**
   - Mitigation: Aggressive caching, rate limiting, budget monitoring

2. **Vector Search Performance Degradation**
   - Mitigation: Early profiling, index optimization, migration path to dedicated vector DB

3. **Data Quality Issues**
   - Mitigation: Extraction validation, source attribution, user feedback loop

See [TECHNICAL_RISKS.md](./TECHNICAL_RISKS.md) for full risk analysis.

---

## Documentation Status

| Document | Status | Owner | Last Updated |
|----------|--------|-------|--------------|
| ARCHITECTURE.md | ✅ Complete | Architecture Team | May 6, 2026 |
| MONOREPO_STRUCTURE.md | ✅ Complete | Backend Lead | May 6, 2026 |
| DOMAIN_BOUNDARIES.md | ✅ Complete | Architecture Team | May 6, 2026 |
| DATABASE_SCHEMA.md | ✅ Complete | Backend Team | May 6, 2026 |
| AGENT_ORCHESTRATION.md | ✅ Complete | AI/ML Team | May 6, 2026 |
| ROADMAP.md | ✅ Complete | Product/Engineering | May 6, 2026 |
| TECHNICAL_RISKS.md | ✅ Complete | CTO/Engineering Mgr | May 6, 2026 |
| CODING_STANDARDS.md | ✅ Complete | Engineering Mgr | May 6, 2026 |

---

## Next Steps

### Immediate (Week 1)
1. ✅ Finalize architecture documents (DONE)
2. ⏳ Recruit team
3. ⏳ Set up project management (Linear/Jira)
4. ⏳ Initialize repository
5. ⏳ Set up development environment

### Week 2
- Begin Phase 0: Foundation
- Complete infrastructure setup
- Scaffold base packages

### Ongoing
- Weekly team sync
- Bi-weekly stakeholder demo
- Monthly roadmap review

---

## Contributing

(To be added once repository is initialized)

---

## License

(To be determined)

---

## Contact

For questions about this architecture, contact:
- **Architecture Team Lead:** [Name]
- **Engineering Manager:** [Name]
- **Product Manager:** [Name]

---

**Last Updated:** May 6, 2026  
**Architecture Version:** 1.0  
**Status:** Design Phase Complete, Ready for Implementation
