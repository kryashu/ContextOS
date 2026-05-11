# ContextOS - Vertical Slice 001: Workspace Intelligence Demo

## Quick Start

This is a working demonstration of ContextOS's core intelligence capabilities - proving the product concept before building the full platform.

### Prerequisites

- Node.js 20+
- pnpm 8+
- OpenAI API key

### Installation

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build
```

### Running the Demo

```bash
# Set your OpenAI API key
export OPENAI_API_KEY="your-api-key-here"

# Run the demo
pnpm contextos demo /Users/kumanand4/Desktop/LangChainJS/ContextOS/demo-workspaces/checkout-system
```

Or use absolute path from repository root:
```bash
pnpm contextos demo demo-workspaces/checkout-system
```

### What the Demo Does

The demo processes the `checkout-system` workspace (a realistic e-commerce checkout system) and:

1. **📁 Loads workspace files** - Discovers all files in the workspace
2. **📄 Parses sources** - Handles Markdown, CSV, JSON, Figma JSON, Confluence JSON
3. **🏷️ Classifies sources** - Categorizes as API docs, database schema, requirements, flows, operations, etc.
4. **🧠 Extracts entities** - Uses GPT-4o to identify actors, systems, processes, data stores, integrations, business entities
5. **🔗 Maps relationships** - Builds a knowledge graph of how entities connect
6. **📊 Generates DFD** - Creates a Data Flow Diagram (Level 0) in Mermaid format
7. **🔍 Detects quality issues** - Finds duplicates, outdated docs, conflicts, low-relevance sources
8. **📝 Creates summary** - Generates comprehensive workspace intelligence report

### Output Files

All outputs are written to `demo-workspaces/checkout-system/output/`:

- **workspace-summary.json** - High-level workspace statistics and insights
- **relationship-graph.json** - Full entity-relationship graph (nodes and edges)
- **dfd-level-0.mmd** - Mermaid Data Flow Diagram (Level 0 Context)
- **findings.json** - Quality issues detected (duplicates, conflicts, outdated docs)

### Demo Workspace

The `checkout-system` demo workspace contains 9 realistic files:

- **README.md** - System overview with architecture description
- **api-spec.md** - REST API endpoints for checkout
- **database-schema.csv** - PostgreSQL table definitions
- **user-flow.figma.json** - Checkout user experience flow
- **requirements.confluence.json** - Business requirements and KPIs
- **monitoring.md** - Observability with Datadog
- **deployment.md** - Kubernetes deployment architecture
- **duplicate-api-spec.md** - Intentional duplicate (for quality detection)
- **outdated-flow.md** - Deprecated legacy flow (for quality detection)

### Example Output

```
🚀 ContextOS Demo - Workspace Intelligence

📁 Workspace: demo-workspaces/checkout-system

Step 1: Loading workspace...
✅ Found 9 files

Step 2: Parsing sources...
✅ Parsed 9 sources

Step 3: Classifying sources...
✅ Classified sources by category

Step 4: Extracting entities and relationships...
✅ Extracted 25 entities and 38 relationships

Step 5: Building relationship graph...
✅ Built graph with 25 nodes and 38 edges

Step 6: Detecting quality issues...
✅ Found 3 quality issues

Step 7: Generating Data Flow Diagram...
✅ Generated DFD Level 0

Step 8: Creating workspace summary...
✅ Summary created

Step 9: Writing outputs...
✅ Outputs written to demo-workspaces/checkout-system/output/

✨ Demo complete!

📊 Workspace Summary:
   9 sources analyzed
   25 entities extracted
   38 relationships identified

🎯 Key Entities:
   Actors: Customer, Admin, User
   Systems: Checkout Service, Payment Service, Inventory Service, Order Service, Notification Service
   External Integrations: Stripe, SendGrid, Twilio, Datadog

⚠️  Quality Issues:
   1 duplicate sources
   1 outdated sources
   1 conflicting sources
```

## Architecture

### Monorepo Structure

```
ContextOS/
├── packages/
│   ├── shared/
│   │   └── types/              # Domain type definitions
│   ├── domains/
│   │   ├── parsers/            # File parsers (MD, CSV, JSON)
│   │   ├── classifier/         # Source classification
│   │   ├── extractor/          # LLM-based entity extraction
│   │   ├── generator/          # Artifact generation (DFD, graphs)
│   │   └── quality/            # Quality issue detection
│   └── cli/                    # Command-line interface
├── demo-workspaces/
│   └── checkout-system/        # Demo workspace
├── docs/                       # Architecture documentation
└── package.json
```

### Domain Boundaries

Each domain package is independently buildable and testable:

- **Types** - Core domain type definitions (Source, Entity, Relationship, Artifact, Finding)
- **Parsers** - File format parsers with pluggable architecture
- **Classifier** - Rule-based and LLM-based source classification
- **Extractor** - GPT-4o structured output for entity extraction
- **Generator** - Relationship mapping and Mermaid diagram generation
- **Quality** - Duplicate detection, conflict identification, relevance scoring
- **CLI** - Command orchestration and output generation

## Technology Stack

- **Runtime**: Node.js 20+ with ESM modules
- **Language**: TypeScript 5.4+ (strict mode)
- **Build**: Turborepo for monorepo orchestration
- **Package Manager**: pnpm workspaces
- **AI**: LangChain.js + OpenAI GPT-4o
- **Validation**: Zod for structured LLM outputs

## Definition of Done

✅ **All requirements met**:
- [x] Single command produces all artifacts
- [x] Mermaid diagram is valid
- [x] All outputs include source references
- [x] No module bypasses domain interfaces
- [x] Ingestion works for MD, CSV, JSON, Figma, Confluence
- [x] Classification categorizes sources correctly
- [x] Entity extraction identifies actors, systems, processes, data stores, integrations
- [x] Relationship mapper builds in-memory graph
- [x] DFD generator creates Level 0 diagram
- [x] Quality detector finds duplicates, outdated docs, conflicts

## Next Steps

### Immediate (Post-Demo)
1. Add comprehensive tests for all domain modules
2. Implement LLM caching to reduce API costs
3. Add progress indicators and better error handling
4. Support PDF and DOCX parsing

### Phase 2 (Full Platform)
1. PostgreSQL + pgvector for persistent storage
2. Web UI for interactive exploration
3. Real-time collaboration features
4. Advanced graph algorithms (centrality, clustering)
5. Multi-language support

## License

Private - Not for distribution

## Contact

Principal Staff Engineer & AI Systems Architect
