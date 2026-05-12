# Demo Workspace: checkout-system

This directory contains a sample workspace used for testing the ContextOS analysis pipeline. It is not a product feature — it exists so you can verify that the system works end-to-end.

## What's in the Demo Workspace

The `demo-workspaces/checkout-system/` folder contains 9 files representing a fictional e-commerce checkout system:

| File | Purpose |
|------|---------|
| `README.md` | System overview with architecture description |
| `api-spec.md` | REST API endpoints for checkout |
| `database-schema.csv` | PostgreSQL table definitions |
| `user-flow.figma.json` | Checkout user experience flow |
| `requirements.confluence.json` | Business requirements and KPIs |
| `monitoring.md` | Observability with Datadog |
| `deployment.md` | Kubernetes deployment architecture |
| `duplicate-api-spec.md` | Intentional duplicate (for quality detection testing) |
| `outdated-flow.md` | Deprecated legacy flow (for quality detection testing) |

## Running Analysis on the Demo Workspace

```bash
# Install and build
pnpm install
pnpm build

# Configure an LLM provider (or skip for deterministic-only analysis)
cp .env.example .env
# Edit .env with your provider settings

# Run analysis
pnpm contextos analyze demo-workspaces/checkout-system
```

> **Note:** The `demo` command still works but is deprecated. Use `analyze` instead.

## Output

Results are written to `demo-workspaces/checkout-system/output/`. See the main [README.md](./README.md#output-artifacts) for a description of each output file.

## Running the Evaluation

The evaluation framework scores analysis output against expected results:

```bash
pnpm contextos eval vertical-slice-001
```

This runs the full pipeline on the demo workspace, then checks:
- Entity recall (are expected entities found?)
- Relationship recall (are expected relationships found?)
- Finding detection (are quality issues detected?)
- Irrelevant detection (are irrelevant sources flagged?)
- Mermaid validity (is the DFD syntactically correct?)
- Source references (do outputs cite their sources?)
- Schema validity (do outputs conform to expected schemas?)

Expected outputs are defined in `evals/vertical-slice-001.expected.json`. The test passes if the weighted score is ≥ 70%.

## Expected Analysis Output

When run with an LLM provider configured, the demo workspace typically produces:
- ~25 entities (actors, systems, processes, data stores, integrations)
- ~38 relationships between entities
- 3 quality findings (1 duplicate, 1 outdated, 1 conflict)
- A Level 0 Data Flow Diagram in Mermaid format

Entity and relationship counts vary slightly depending on the LLM provider and model used.
