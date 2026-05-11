# ContextOS - Monorepo Structure

**Version:** 1.0  
**Date:** May 6, 2026  
**Status:** Initial Design

## Overview

ContextOS uses a domain-oriented monorepo structure organized around business capabilities rather than technical layers. This approach promotes:
- High cohesion within domains
- Low coupling between domains
- Clear ownership boundaries
- Easier navigation and understanding
- Natural microservices extraction points (if needed)

## Monorepo Tool Choice: pnpm Workspaces + Turborepo

**pnpm** - Package management
- Efficient disk usage with content-addressable storage
- Strict dependency resolution (no phantom dependencies)
- Fast installation

**Turborepo** - Build orchestration
- Intelligent caching
- Parallel task execution
- Remote caching support
- Simple configuration

## Directory Structure

```
contextos/
├── .github/                          # GitHub workflows, templates
│   ├── workflows/
│   │   ├── ci.yml                   # Continuous integration
│   │   ├── deploy-staging.yml       # Staging deployment
│   │   └── deploy-production.yml    # Production deployment
│   └── CODEOWNERS                   # Code ownership
│
├── apps/                             # Deployable applications
│   ├── web/                          # Next.js 15 frontend
│   │   ├── app/                      # App router pages
│   │   │   ├── (workspace)/          # Workspace routes
│   │   │   │   ├── [workspaceId]/
│   │   │   │   │   ├── page.tsx     # Dashboard
│   │   │   │   │   ├── query/
│   │   │   │   │   │   └── page.tsx # Query interface
│   │   │   │   │   ├── artifacts/
│   │   │   │   │   │   └── page.tsx # Generated artifacts
│   │   │   │   │   └── settings/
│   │   │   │   │       └── page.tsx # Workspace settings
│   │   │   │   └── layout.tsx
│   │   │   ├── api/                  # API routes
│   │   │   │   ├── ingestion/
│   │   │   │   ├── query/
│   │   │   │   ├── artifacts/
│   │   │   │   └── health/
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx              # Landing page
│   │   ├── components/               # React components
│   │   │   ├── workspace/
│   │   │   ├── query/
│   │   │   ├── artifacts/
│   │   │   └── ui/                   # Shared UI components
│   │   ├── lib/                      # Frontend utilities
│   │   ├── styles/
│   │   ├── public/
│   │   ├── next.config.js
│   │   ├── tailwind.config.js
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── api/                          # Standalone API (optional future)
│       └── package.json
│
├── packages/                         # Shared libraries
│   │
│   ├── domains/                      # Domain packages
│   │   ├── ingestion/                # Ingestion domain
│   │   │   ├── src/
│   │   │   │   ├── index.ts
│   │   │   │   ├── connectors/
│   │   │   │   │   ├── index.ts
│   │   │   │   │   ├── base.ts
│   │   │   │   │   ├── pdf-connector.ts
│   │   │   │   │   ├── docx-connector.ts
│   │   │   │   │   ├── excel-connector.ts
│   │   │   │   │   ├── confluence-connector.ts
│   │   │   │   │   ├── figma-connector.ts
│   │   │   │   │   └── mcp-connector.ts
│   │   │   │   ├── extractors/
│   │   │   │   │   ├── index.ts
│   │   │   │   │   ├── pdf-extractor.ts
│   │   │   │   │   ├── docx-extractor.ts
│   │   │   │   │   ├── excel-extractor.ts
│   │   │   │   │   └── table-extractor.ts
│   │   │   │   ├── chunking/
│   │   │   │   │   ├── index.ts
│   │   │   │   │   ├── semantic-chunker.ts
│   │   │   │   │   ├── recursive-chunker.ts
│   │   │   │   │   └── document-aware-chunker.ts
│   │   │   │   ├── embedding/
│   │   │   │   │   ├── index.ts
│   │   │   │   │   ├── embedding-pipeline.ts
│   │   │   │   │   └── batch-embedder.ts
│   │   │   │   ├── graph/
│   │   │   │   │   ├── index.ts
│   │   │   │   │   └── initial-graph-builder.ts
│   │   │   │   ├── types.ts
│   │   │   │   └── events.ts         # Domain events
│   │   │   ├── tests/
│   │   │   ├── README.md
│   │   │   ├── SPEC.md               # Domain specification
│   │   │   ├── tsconfig.json
│   │   │   └── package.json
│   │   │
│   │   ├── retrieval/                # Retrieval domain
│   │   │   ├── src/
│   │   │   │   ├── index.ts
│   │   │   │   ├── strategies/
│   │   │   │   │   ├── semantic-search.ts
│   │   │   │   │   ├── hybrid-search.ts
│   │   │   │   │   └── multi-hop-retrieval.ts
│   │   │   │   ├── reranking/
│   │   │   │   │   ├── index.ts
│   │   │   │   │   └── cross-encoder-reranker.ts
│   │   │   │   ├── cache/
│   │   │   │   │   └── query-cache.ts
│   │   │   │   ├── table-query/
│   │   │   │   │   └── table-query-engine.ts
│   │   │   │   ├── types.ts
│   │   │   │   └── events.ts
│   │   │   ├── tests/
│   │   │   ├── SPEC.md
│   │   │   ├── tsconfig.json
│   │   │   └── package.json
│   │   │
│   │   ├── reasoning/                # Reasoning domain
│   │   │   ├── src/
│   │   │   │   ├── index.ts
│   │   │   │   ├── architecture/
│   │   │   │   │   ├── analyzer.ts
│   │   │   │   │   ├── component-identifier.ts
│   │   │   │   │   └── dependency-mapper.ts
│   │   │   │   ├── relationships/
│   │   │   │   │   ├── inference-engine.ts
│   │   │   │   │   └── contradiction-detector.ts
│   │   │   │   ├── artifacts/
│   │   │   │   │   ├── dfd-generator.ts
│   │   │   │   │   ├── c4-generator.ts
│   │   │   │   │   ├── adr-generator.ts
│   │   │   │   │   └── risk-analyzer.ts
│   │   │   │   ├── entity/
│   │   │   │   │   └── entity-resolver.ts
│   │   │   │   ├── types.ts
│   │   │   │   └── events.ts
│   │   │   ├── tests/
│   │   │   ├── SPEC.md
│   │   │   ├── tsconfig.json
│   │   │   └── package.json
│   │   │
│   │   ├── orchestration/            # Orchestration domain
│   │   │   ├── src/
│   │   │   │   ├── index.ts
│   │   │   │   ├── agents/
│   │   │   │   │   ├── base-agent.ts
│   │   │   │   │   ├── analysis-agent.ts
│   │   │   │   │   ├── ingestion-agent.ts
│   │   │   │   │   └── artifact-agent.ts
│   │   │   │   ├── workflows/
│   │   │   │   │   ├── analyze-workspace.ts
│   │   │   │   │   ├── generate-architecture.ts
│   │   │   │   │   └── answer-query.ts
│   │   │   │   ├── router/
│   │   │   │   │   └── agent-router.ts
│   │   │   │   ├── state/
│   │   │   │   │   └── state-manager.ts
│   │   │   │   ├── tools/
│   │   │   │   │   └── tool-registry.ts
│   │   │   │   ├── approval/
│   │   │   │   │   └── approval-gateway.ts
│   │   │   │   ├── types.ts
│   │   │   │   └── events.ts
│   │   │   ├── tests/
│   │   │   ├── SPEC.md
│   │   │   ├── tsconfig.json
│   │   │   └── package.json
│   │   │
│   │   ├── knowledge-graph/          # Knowledge graph domain
│   │   │   ├── src/
│   │   │   │   ├── index.ts
│   │   │   │   ├── entities/
│   │   │   │   │   ├── extractor.ts
│   │   │   │   │   └── resolver.ts
│   │   │   │   ├── relationships/
│   │   │   │   │   └── mapper.ts
│   │   │   │   ├── graph/
│   │   │   │   │   ├── graph-store.ts
│   │   │   │   │   └── query-engine.ts
│   │   │   │   ├── trust/
│   │   │   │   │   └── boundary-detector.ts
│   │   │   │   ├── temporal/
│   │   │   │   │   └── version-tracker.ts
│   │   │   │   ├── types.ts
│   │   │   │   └── events.ts
│   │   │   ├── tests/
│   │   │   ├── SPEC.md
│   │   │   ├── tsconfig.json
│   │   │   └── package.json
│   │   │
│   │   └── quality/                  # Quality domain
│   │       ├── src/
│   │       │   ├── index.ts
│   │       │   ├── duplicate/
│   │       │   │   └── detector.ts
│   │       │   ├── staleness/
│   │       │   │   └── analyzer.ts
│   │       │   ├── conflict/
│   │       │   │   └── detector.ts
│   │       │   ├── relevance/
│   │       │   │   └── scorer.ts
│   │       │   ├── coverage/
│   │       │   │   └── analyzer.ts
│   │       │   ├── types.ts
│   │       │   └── events.ts
│   │       ├── tests/
│   │       ├── SPEC.md
│   │       ├── tsconfig.json
│   │       └── package.json
│   │
│   ├── shared/                       # Cross-cutting concerns
│   │   ├── database/                 # Database layer
│   │   │   ├── src/
│   │   │   │   ├── index.ts
│   │   │   │   ├── client.ts
│   │   │   │   ├── repositories/
│   │   │   │   │   ├── base.ts
│   │   │   │   │   ├── document.repo.ts
│   │   │   │   │   ├── chunk.repo.ts
│   │   │   │   │   ├── workspace.repo.ts
│   │   │   │   │   └── artifact.repo.ts
│   │   │   │   ├── migrations/
│   │   │   │   └── types.ts
│   │   │   ├── tests/
│   │   │   ├── tsconfig.json
│   │   │   └── package.json
│   │   │
│   │   ├── types/                    # Shared type definitions
│   │   │   ├── src/
│   │   │   │   ├── index.ts
│   │   │   │   ├── document.ts
│   │   │   │   ├── chunk.ts
│   │   │   │   ├── workspace.ts
│   │   │   │   ├── query.ts
│   │   │   │   ├── artifact.ts
│   │   │   │   └── user.ts
│   │   │   ├── tsconfig.json
│   │   │   └── package.json
│   │   │
│   │   ├── config/                   # Configuration management
│   │   │   ├── src/
│   │   │   │   ├── index.ts
│   │   │   │   ├── env.ts
│   │   │   │   └── validation.ts
│   │   │   ├── tsconfig.json
│   │   │   └── package.json
│   │   │
│   │   ├── observability/            # Logging, tracing, metrics
│   │   │   ├── src/
│   │   │   │   ├── index.ts
│   │   │   │   ├── logger.ts
│   │   │   │   ├── tracer.ts
│   │   │   │   ├── metrics.ts
│   │   │   │   └── langsmith.ts
│   │   │   ├── tsconfig.json
│   │   │   └── package.json
│   │   │
│   │   ├── events/                   # Event bus
│   │   │   ├── src/
│   │   │   │   ├── index.ts
│   │   │   │   ├── event-bus.ts
│   │   │   │   ├── handlers.ts
│   │   │   │   └── types.ts
│   │   │   ├── tsconfig.json
│   │   │   └── package.json
│   │   │
│   │   ├── auth/                     # Authentication/Authorization
│   │   │   ├── src/
│   │   │   │   ├── index.ts
│   │   │   │   ├── auth-provider.ts
│   │   │   │   ├── rbac.ts
│   │   │   │   └── permissions.ts
│   │   │   ├── tsconfig.json
│   │   │   └── package.json
│   │   │
│   │   └── utils/                    # Common utilities
│   │       ├── src/
│   │       │   ├── index.ts
│   │       │   ├── retry.ts
│   │       │   ├── rate-limit.ts
│   │       │   ├── validation.ts
│   │       │   └── async.ts
│   │       ├── tsconfig.json
│   │       └── package.json
│   │
│   └── ui/                           # Shared UI components
│       ├── src/
│       │   ├── index.ts
│       │   ├── button.tsx
│       │   ├── input.tsx
│       │   ├── card.tsx
│       │   └── ...
│       ├── tsconfig.json
│       └── package.json
│
├── tools/                            # Development tools
│   ├── scripts/
│   │   ├── seed-database.ts
│   │   ├── generate-types.ts
│   │   └── benchmark.ts
│   └── cli/
│       └── contextos-cli.ts
│
├── docs/                             # Documentation
│   ├── architecture/
│   │   ├── decisions/                # ADRs
│   │   │   ├── 001-modular-monolith.md
│   │   │   ├── 002-postgresql-over-vector-db.md
│   │   │   └── ...
│   │   └── diagrams/
│   ├── api/
│   │   └── openapi.yaml
│   ├── guides/
│   │   ├── getting-started.md
│   │   ├── deployment.md
│   │   └── contributing.md
│   └── specs/
│       ├── ingestion-spec.md
│       ├── retrieval-spec.md
│       └── ...
│
├── infra/                            # Infrastructure as code
│   ├── docker/
│   │   ├── Dockerfile
│   │   ├── docker-compose.yml
│   │   └── docker-compose.dev.yml
│   ├── k8s/                          # Kubernetes manifests (future)
│   └── terraform/                    # Terraform configs (future)
│
├── .vscode/                          # VS Code settings
│   ├── settings.json
│   ├── launch.json
│   └── extensions.json
│
├── .husky/                           # Git hooks
│   ├── pre-commit
│   └── commit-msg
│
├── pnpm-workspace.yaml               # pnpm workspace config
├── turbo.json                        # Turborepo config
├── tsconfig.base.json                # Base TypeScript config
├── .eslintrc.js                      # ESLint config
├── .prettierrc                       # Prettier config
├── .gitignore
├── LICENSE
├── README.md
└── package.json                      # Root package.json
```

## Package Naming Convention

All packages follow the pattern: `@contextos/<package-name>`

Examples:
- `@contextos/ingestion`
- `@contextos/retrieval`
- `@contextos/database`
- `@contextos/types`

## Domain Package Structure

Each domain package follows a consistent structure:

```
domain-name/
├── src/
│   ├── index.ts                      # Public API exports
│   ├── types.ts                      # Domain types
│   ├── events.ts                     # Domain events
│   ├── errors.ts                     # Domain-specific errors
│   └── [feature-folders]/
├── tests/
│   ├── unit/
│   ├── integration/
│   └── fixtures/
├── SPEC.md                           # Domain specification
├── README.md                         # Usage documentation
├── tsconfig.json
└── package.json
```

## Dependency Rules

### Layer Dependencies
```
apps/
  ↓ can depend on
packages/domains/
  ↓ can depend on
packages/shared/
```

### Domain Dependencies
- Domains can depend on `packages/shared/*`
- Domains SHOULD NOT depend on other domains directly
- Cross-domain communication via events or orchestration layer
- Exception: orchestration can depend on other domains (it's the coordinator)

### Enforcement
Use `eslint-plugin-import` with custom rules:
```javascript
// .eslintrc.js
rules: {
  'import/no-restricted-paths': [
    'error',
    {
      zones: [
        {
          target: './packages/domains/ingestion',
          from: './packages/domains/!(ingestion)',
          message: 'Domains should not depend on other domains directly'
        },
        // ... repeat for each domain
      ]
    }
  ]
}
```

## Build Configuration

### turbo.json
```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": [
    ".env",
    "tsconfig.base.json"
  ],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": ["coverage/**"]
    },
    "lint": {
      "outputs": []
    },
    "type-check": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

### pnpm-workspace.yaml
```yaml
packages:
  - 'apps/*'
  - 'packages/**/*'
  - 'tools/*'
```

### Root package.json
```json
{
  "name": "contextos",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "test": "turbo run test",
    "test:unit": "turbo run test:unit",
    "test:integration": "turbo run test:integration",
    "lint": "turbo run lint",
    "type-check": "turbo run type-check",
    "format": "prettier --write \"**/*.{ts,tsx,md,json}\"",
    "clean": "turbo run clean && rm -rf node_modules",
    "db:migrate": "pnpm --filter @contextos/database migrate",
    "db:seed": "pnpm --filter @contextos/database seed"
  },
  "devDependencies": {
    "@typescript-eslint/eslint-plugin": "^6.0.0",
    "@typescript-eslint/parser": "^6.0.0",
    "eslint": "^8.50.0",
    "eslint-config-prettier": "^9.0.0",
    "eslint-plugin-import": "^2.28.0",
    "prettier": "^3.0.0",
    "turbo": "^1.10.0",
    "typescript": "^5.2.0"
  },
  "engines": {
    "node": ">=20.0.0",
    "pnpm": ">=8.0.0"
  },
  "packageManager": "pnpm@8.10.0"
}
```

## TypeScript Configuration

### tsconfig.base.json
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022"],
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "noUncheckedIndexedAccess": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "incremental": true,
    "composite": true
  }
}
```

### Domain package tsconfig.json (example)
```json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

## Development Workflow

### Local Development
```bash
# Install dependencies
pnpm install

# Start development (all apps)
pnpm dev

# Start specific app
pnpm --filter @contextos/web dev

# Run tests
pnpm test

# Run tests for specific domain
pnpm --filter @contextos/ingestion test

# Type check
pnpm type-check

# Lint
pnpm lint
```

### Adding a New Domain
```bash
# Create directory structure
mkdir -p packages/domains/new-domain/src
cd packages/domains/new-domain

# Create package.json
cat > package.json <<EOF
{
  "name": "@contextos/new-domain",
  "version": "0.1.0",
  "private": true,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "jest"
  }
}
EOF

# Create SPEC.md
echo "# New Domain Specification" > SPEC.md

# Create src/index.ts
touch src/index.ts src/types.ts src/events.ts
```

## CI/CD Integration

### GitHub Actions Workflow
```yaml
name: CI
on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: 20
          cache: 'pnpm'
      
      - run: pnpm install --frozen-lockfile
      - run: pnpm type-check
      - run: pnpm lint
      - run: pnpm test
      - run: pnpm build
```

## Benefits of This Structure

1. **Domain-First Organization**
   - Easy to understand business capabilities
   - Clear ownership boundaries
   - Natural microservices boundaries

2. **Independent Development**
   - Teams can work on domains independently
   - Clear interfaces between domains
   - Reduced merge conflicts

3. **Efficient Builds**
   - Turborepo caches unchanged packages
   - Parallel builds across packages
   - Fast incremental builds

4. **Type Safety**
   - Shared types package
   - TypeScript project references
   - Compile-time dependency checking

5. **Testability**
   - Test domains in isolation
   - Mock dependencies easily
   - Fast unit tests

6. **Scalability**
   - Easy to extract domains to microservices
   - Clear API boundaries
   - Independent deployment (future)

## Migration Path to Microservices (If Needed)

If scale demands microservices, each domain can become a service:

```
monolith                    microservices
────────                    ─────────────
packages/domains/ingestion  →  ingestion-service/
packages/domains/retrieval  →  retrieval-service/
packages/domains/reasoning  →  reasoning-service/
```

Shared packages become:
- `@contextos/types` → gRPC/protobuf definitions
- `@contextos/events` → message broker schemas (Kafka/RabbitMQ)
- Domain communication → REST/gRPC instead of function calls

---

**Next Steps:**
1. Initialize monorepo structure
2. Set up build tooling (pnpm, Turborepo)
3. Create base packages (types, database, config)
4. Scaffold domain packages
5. Set up CI/CD pipelines
