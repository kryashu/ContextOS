# ContextOS

**Open-source workspace intelligence system.**

ContextOS analyzes collections of documents — Markdown, CSV, JSON, YAML, Excel workbooks — and builds a structured understanding of what they contain, how they relate, and where quality issues exist. It produces entity-relationship graphs, data flow diagrams, quality findings, and source-grounded answers to questions about your workspace.

---

## Table of Contents

- [What ContextOS Is](#what-contextos-is)
- [Why It Exists](#why-it-exists)
- [What It Is Not](#what-it-is-not)
- [Current Capabilities](#current-capabilities)
- [Architecture Overview](#architecture-overview)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Running Analysis](#running-analysis)
- [Environment Variables](#environment-variables)
- [Output Artifacts](#output-artifacts)
- [How It Differs from RAG / Chatbot Tools](#how-it-differs-from-rag--chatbot-tools)
- [Current Status](#current-status)
- [Roadmap](#roadmap)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [License](#license)

---

## What ContextOS Is

ContextOS is a **workspace document analyzer**. Point it at a folder of documents and it will:

1. **Parse** every file (Markdown, CSV, JSON, YAML, XLSX)
2. **Profile** each source — detect file kind, topics, relevance, warnings — deterministically, without an LLM
3. **Classify** sources into categories (architecture, API docs, database schema, requirements, user flows, operations, structured data, irrelevant)
4. **Extract entities** (actors, systems, processes, data stores, integrations) and **relationships** between them
5. **Build a relationship graph** — merge duplicates, connect entities across files
6. **Generate a Data Flow Diagram** (Mermaid Level 0) from the graph
7. **Detect quality issues** — duplicate content, outdated documents, conflicting information
8. **Map cross-source relationships** — which files support, contradict, or overlap with each other
9. **Answer questions** about the workspace with source-grounded responses

All outputs cite their source files. Deterministic analysis runs without any LLM. Entity extraction and document-fact Q&A use an LLM only when needed.

---

## Why It Exists

Enterprise teams accumulate documents across many formats — API specs, database schemas, deployment configs, meeting notes, spreadsheets. Understanding how these documents relate to each other, finding contradictions between them, and getting a coherent picture of the system they describe is manual, slow, and error-prone.

ContextOS automates that understanding. It is built for engineers and architects who need to reason across a body of documents, not just search within one.

---

## What It Is Not

- **Not a chatbot.** It answers questions grounded in workspace documents, but its primary output is structured analysis, not conversation.
- **Not a RAG application.** There is no vector database or embedding-based retrieval in the current implementation. Retrieval uses file-system-based context loading.
- **Not a NotebookLM clone.** ContextOS focuses on entity extraction, relationship mapping, and quality detection — not summarization or podcast generation.
- **Not a code analysis tool.** It analyzes documentation and data files, not source code.

---

## Current Capabilities

Everything listed below is implemented and working.

### Parsing
- Markdown, CSV, JSON, YAML, plain text, Excel (`.xlsx`)
- Figma JSON and Confluence JSON (structural parsing)
- Pluggable parser registry — new formats can be added

### Profiling (deterministic, no LLM)
- File kind detection (document, workbook, data, config, notes)
- Topic extraction from content
- Entity detection from headings and structure
- Relevance scoring
- Warning detection (empty files, very short content)

### Classification
- Rule-based fast path for unambiguous files
- LLM fallback for ambiguous cases (when a provider is configured)
- Categories: architecture, api_documentation, database_schema, requirements, user_flow, operations, code, meeting_notes, structured_data, irrelevant

### Entity & Relationship Extraction (LLM-based)
- Entity types: actor, system, process, data_store, external_integration, business_entity, endpoint, event
- Relationship types: uses, calls, stores_in, reads_from, writes_to, integrates_with, triggers, publishes, subscribes_to, contains, depends_on, manages, implements
- Structured output validated with Zod schemas
- Confidence scores on all extractions

### Graph & Diagram Generation
- Entity merging (deduplication across sources)
- Relationship merging
- In-memory relationship graph (nodes + edges with source references)
- Mermaid Data Flow Diagram (Level 0) generation

### Quality Detection
- Duplicate source detection (content similarity)
- Outdated document detection
- Conflict detection across sources

### Cross-Source Relationship Mapping
- Deterministic mapping of how files relate to each other
- Support, contradiction, and overlap detection between sources

### Workspace Q&A
- Intent-based question routing (deterministic classifier)
- Deterministic answers for: workspace overview, irrelevant files, capabilities, source relationships, sheet queries
- LLM-grounded answers for document fact questions (requires configured provider)
- All answers include source references

### Workbook / Structured Data Analysis
- Excel workbook profiling (sheet structure, candidate metrics)
- Data normalization from spreadsheet observations
- Metric calculation with filtering (aggregation over structured data)

### Web UI
- Create and manage workspaces
- Upload files (drag-and-drop, validated extensions and size limits)
- Run analysis from the browser
- View all output artifacts: DFD diagrams (rendered Mermaid), entity tables, quality findings, source profiles, workspace context
- Ask questions about a workspace (interactive Q&A panel)
- Calculation panel for structured data (filter + aggregate)
- Stale analysis detection (hash-based cache invalidation)

### CLI
- `contextos analyze <path>` — run the full analysis pipeline
- `contextos ai:check` — verify LLM provider health and connectivity
- `contextos eval <test-name>` — run automated evaluation against expected outputs
- `contextos config:print` — display resolved configuration (secrets redacted)

### Multi-Provider AI
- Supported providers: Groq, Google Gemini, Ollama (local), OpenAI, Mock (testing)
- Task-based routing: lightweight tasks (classification, summarization) prefer local Ollama; complex tasks (extraction, relationship mapping) use hosted providers
- Automatic fallback from hosted to local Ollama (configurable, with size guards)
- Deterministic flows work with no LLM configured at all

### Evaluation Framework
- Automated scoring against expected outputs
- Metrics: entity recall, relationship recall, finding detection, irrelevant detection, Mermaid validity, source references, schema validity
- Weighted composite score with configurable pass threshold

---

## Architecture Overview

ContextOS is a TypeScript monorepo organized by domain. Each domain is an independent package with its own types, tests, and public API.

```
contextos/
├── apps/
│   └── web/                    # Next.js web application
├── packages/
│   ├── ai/                     # Multi-provider LLM layer (routing, fallback, config)
│   ├── cli/                    # Command-line interface
│   ├── shared/
│   │   ├── types/              # Domain type definitions
│   │   └── ui/                 # Shared UI components
│   └── domains/
│       ├── parsers/            # File format parsers (MD, CSV, JSON, XLSX, etc.)
│       ├── profiler/           # Deterministic source profiling
│       ├── classifier/         # Source classification (rule-based + LLM)
│       ├── extractor/          # LLM-based entity & relationship extraction
│       ├── generator/          # Relationship graph + DFD generation
│       ├── relationships/      # Cross-source relationship mapping
│       ├── quality/            # Quality issue detection
│       ├── qa/                 # Question routing + answer composition
│       └── calculator/         # Structured data calculations
├── data/workspaces/            # User workspaces (file-system storage)
└── evals/                      # Evaluation test fixtures
```

### Analysis Pipeline

```
Files → Parse → Profile → Classify → Extract Entities → Build Graph
                                                            │
                                    ┌───────────────────────┤
                                    ▼                       ▼
                              Generate DFD          Detect Quality Issues
                                    │                       │
                                    └───────┬───────────────┘
                                            ▼
                                      Write Outputs
```

Profiling is always deterministic. Classification uses rules first, LLM only when ambiguous. Entity extraction and document-fact Q&A require an LLM. Everything else is deterministic.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Language** | TypeScript (strict mode) |
| **Runtime** | Node.js 20+ |
| **Monorepo** | pnpm workspaces + Turborepo |
| **Web App** | Next.js 14 (App Router, Server Components, Server Actions) |
| **UI** | React 18, Mermaid (diagram rendering) |
| **AI Framework** | LangChain.js |
| **Validation** | Zod (LLM structured outputs + runtime validation) |
| **Testing** | Vitest |
| **Storage** | File system (no database required) |

---

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 8+
- (Optional) Ollama for local LLM
- (Optional) API key for Groq, Gemini, or OpenAI

### Install and Build

```bash
git clone https://github.com/kryashu/ContextOS.git
cd ContextOS

pnpm install
pnpm build
```

### Configure LLM (optional)

Deterministic analysis (parsing, profiling, graph building, quality detection) works without any LLM. To enable entity extraction and document-fact Q&A, configure a provider:

```bash
cp .env.example .env
```

Edit `.env`:

```bash
# Option 1: Groq (recommended, free tier)
LLM_PROVIDER=groq
GROQ_API_KEY=your_key_here

# Option 2: Google Gemini
LLM_PROVIDER=gemini
GOOGLE_API_KEY=your_key_here

# Option 3: Local Ollama (no API key needed)
LLM_PROVIDER=ollama
LOCAL_LLM_PROVIDER=ollama

# Option 4: No LLM — deterministic flows only
# Leave LLM_PROVIDER unset
```

### Verify Setup

```bash
# Check which providers are available
pnpm contextos ai:check

# Show resolved configuration
pnpm contextos config:print
```

---

## Running Analysis

### From the CLI

```bash
# Analyze any folder of documents
pnpm contextos analyze <workspace-path>

# Example: analyze the included demo workspace
pnpm contextos analyze demo-workspaces/checkout-system
```

Outputs are written to `<workspace-path>/output/`.

### From the Web UI

```bash
# Start the development server
pnpm dev

# Open http://localhost:3000
```

In the web UI:
1. Create a workspace
2. Upload files (Markdown, CSV, JSON, YAML, XLSX — up to 10 MB each, 50 files max)
3. Click **Run Analysis**
4. View results: DFD diagram, entity table, quality findings, source profiles
5. Ask questions in the Q&A panel

### Running Evaluations

```bash
# Run automated quality evaluation against expected outputs
pnpm contextos eval vertical-slice-001
```

This runs the analysis pipeline on the demo workspace and scores the output against expected entities, relationships, and findings. Exits with an error if the weighted score falls below 70%.

---

## Environment Variables

All configuration is via environment variables. See [`.env.example`](./.env.example) for the full reference.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `LLM_PROVIDER` | No | _(unset)_ | Primary LLM provider: `groq`, `gemini`, `openai`, `ollama` |
| `LOCAL_LLM_PROVIDER` | No | `ollama` | Local provider for lightweight tasks |
| `ENABLE_LOCAL_FALLBACK` | No | `false` | Fall back to Ollama when hosted provider fails |
| `LOCAL_FALLBACK_MAX_SIZE_KB` | No | `50` | Max document size (KB) for Ollama fallback |
| `GROQ_API_KEY` | If using Groq | — | Groq API key ([console.groq.com](https://console.groq.com)) |
| `GOOGLE_API_KEY` | If using Gemini | — | Google AI API key ([aistudio.google.com](https://aistudio.google.com)) |
| `OPENAI_API_KEY` | If using OpenAI | — | OpenAI API key |
| `OLLAMA_MODEL` | No | `llama3.2:3b` | Ollama model name |
| `GROQ_MODEL` | No | `llama-3.3-70b-versatile` | Groq model name |
| `GEMINI_MODEL` | No | `gemini-1.5-flash` | Gemini model name |
| `OPENAI_MODEL` | No | `gpt-4o-mini` | OpenAI model name |

### Task-Based Model Routing

| Task | Default Provider | Fallback | Notes |
|------|-----------------|----------|-------|
| Classification | Ollama (local) | — | Rule-based first; LLM only for ambiguous cases |
| Summarization | Ollama (local) | — | Lightweight |
| Entity Extraction | Hosted (Groq/Gemini) | Ollama* | Complex structured output |
| Relationship Mapping | Hosted (Groq/Gemini) | — | Too complex for small local models |
| Artifact Generation | Hosted (Groq/Gemini) | — | Requires structured reasoning |
| Q&A | Hosted (Groq/Gemini) | Ollama* | Document fact questions only |

\*Fallback requires `ENABLE_LOCAL_FALLBACK=true` and document < 50 KB.

---

## Output Artifacts

Analysis produces the following files in `<workspace>/output/`:

| File | Description |
|------|-------------|
| `analysis-manifest.json` | Manifest of what was produced, source file hashes, capabilities flags |
| `workspace-summary.json` | Source count, entity/relationship counts, statistics by type and category |
| `source-profiles.json` | Per-file profile: kind, topics, entities, relevance score, warnings |
| `workspace-context.json` | Aggregated workspace theme, key topics, file type distribution |
| `relationship-graph.json` | All entities and relationships as nodes and edges with source references |
| `workspace-relationships.json` | Cross-source relationship map (which files relate to which) |
| `dfd-level-0.mmd` | Mermaid Data Flow Diagram (Level 0 context diagram) |
| `findings.json` | Quality issues: duplicates, outdated docs, conflicts |
| `workbook-profile.json` | _(Excel workspaces only)_ Sheet structure and candidate metrics |
| `normalized-observations.json` | _(Excel workspaces only)_ Normalized data rows for calculation |

---

## How It Differs from RAG / Chatbot Tools

| Aspect | Typical RAG App | ContextOS |
|--------|----------------|-----------|
| **Primary output** | Chat responses | Structured analysis artifacts (graphs, diagrams, findings) |
| **Retrieval** | Embedding similarity search | File-system context loading; deterministic profiling |
| **LLM dependency** | Required for everything | Used only for entity extraction and ambiguous classification; most analysis is deterministic |
| **Document relationships** | Not modeled | Explicitly extracted and mapped across sources |
| **Quality detection** | Not addressed | Duplicates, conflicts, outdated content detected automatically |
| **Source grounding** | Optional citations | Every factual answer and every extracted entity traces back to a source file |
| **Structured data** | Treated as text | Excel workbooks profiled, normalized, and queryable with calculations |

---

## Current Status

**Version:** 0.1.0  
**Status:** Working vertical slice with CLI and Web UI.

The core analysis pipeline is implemented and produces real outputs. The system is file-system-based — no database, no vector store, no deployment infrastructure. It is a working tool, not a production platform yet.

### What Works Today
- Full analysis pipeline (CLI and Web UI)
- Multi-format parsing and deterministic profiling
- LLM-based entity extraction with structured output validation
- Relationship graph and DFD generation
- Quality issue detection
- Workspace Q&A with intent routing
- Workbook analysis and calculation
- Multi-provider LLM support with task routing and fallback
- Automated evaluation framework

### Known Limitations
- File-system storage only (no database)
- No authentication or multi-user support
- No vector embeddings or semantic search
- No PDF or DOCX parsing (only Markdown, CSV, JSON, YAML, XLSX)
- Single-process, single-machine
- OpenAI requires a paid account; Groq free tier can be rate-limited during peak usage

---

## Roadmap

These features are **not implemented** yet. They represent the planned direction.

### Near-Term
- PDF and DOCX parsing support
- PostgreSQL + pgvector for persistent storage and vector search
- Semantic search and hybrid retrieval (vector + keyword)
- LLM response caching (reduce API costs)
- C4 diagram generation (system context level)

### Medium-Term
- LangGraph.js agent workflows for multi-step reasoning
- Human-in-the-loop approval gates for generated artifacts
- ADR (Architecture Decision Record) generation
- Reranking (cross-encoder) for search results
- Multi-hop retrieval (follow relationships for deeper context)
- Confluence and Figma live integrations
- LangSmith observability integration

### Long-Term
- Multi-user workspaces with collaboration
- Authentication and RBAC
- Neo4j graph database for advanced graph queries
- Scheduled re-ingestion and change detection
- API access and webhooks
- Enterprise features (SSO, audit logs)

---

## Documentation

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System architecture and domain boundaries (design target) |
| [MONOREPO_STRUCTURE.md](./MONOREPO_STRUCTURE.md) | Package organization and build configuration |
| [DOMAIN_BOUNDARIES.md](./DOMAIN_BOUNDARIES.md) | Domain responsibilities, interfaces, and events (design target) |
| [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) | PostgreSQL schema design (not yet implemented) |
| [AGENT_ORCHESTRATION.md](./AGENT_ORCHESTRATION.md) | LangGraph agent workflows (not yet implemented) |
| [ROADMAP.md](./ROADMAP.md) | Implementation phases and scope |
| [TECHNICAL_RISKS.md](./TECHNICAL_RISKS.md) | Risk assessment and mitigations |
| [CODING_STANDARDS.md](./CODING_STANDARDS.md) | TypeScript conventions and patterns |

> **Note:** ARCHITECTURE.md, DOMAIN_BOUNDARIES.md, DATABASE_SCHEMA.md, and AGENT_ORCHESTRATION.md describe the full design target. Not all described components are implemented yet. See [Current Status](#current-status) for what exists today.

---

## Contributing

Contributions are welcome. To get started:

```bash
git clone https://github.com/kryashu/ContextOS.git
cd ContextOS
pnpm install
pnpm build
pnpm test
```

The codebase uses TypeScript strict mode, Vitest for testing, and Turborepo for build orchestration. Each domain package under `packages/domains/` is independently buildable and testable.

---

## License

MIT

---

**Last Updated:** May 6, 2026  
**Architecture Version:** 1.0  
**Status:** Design Phase Complete, Ready for Implementation
