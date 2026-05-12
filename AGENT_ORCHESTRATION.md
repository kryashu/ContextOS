# ContextOS - LangGraph Agent Orchestration

**Version:** 1.0  
**Date:** May 12, 2026  
**Status:** Design Target (not yet implemented)

> **Implementation note:** This document describes the planned LangGraph.js agent orchestration architecture. None of this is implemented yet. The current system uses a sequential pipeline (see the CLI `analyze` command). This document is retained as the design target for future agent workflow support.

## Overview

ContextOS will use LangGraph.js for orchestrating complex multi-agent workflows. LangGraph provides explicit state machines with persistence, making workflows debuggable, resumable, and auditable. This document defines the planned agent architecture, workflow patterns, and orchestration strategies.

## Why LangGraph?

### Advantages
1. **Explicit State Machines** - Clear, debuggable workflow logic
2. **Persistence** - Resume workflows after failures or approvals
3. **Streaming** - Stream intermediate results to users
4. **Human-in-the-Loop** - Built-in support for approval gates
5. **Observability** - Full tracing with LangSmith
6. **Deterministic** - Reproducible executions for debugging

### Trade-offs
- **Learning Curve** - More complex than simple LLM chains
- **Boilerplate** - More code than simple function composition
- **Overhead** - State management adds some latency

---

## Agent Architecture

### Agent Types

```typescript
// Base agent interface
interface Agent {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  systemPrompt: string;
  tools: Tool[];
  llm: ChatModel;
  config: AgentConfig;
}

interface AgentConfig {
  temperature: number;
  maxTokens: number;
  streaming: boolean;
  timeout: number;
  retryPolicy: RetryPolicy;
}
```

### Core Agents

#### 1. Query Agent
**Purpose:** Answer user queries with grounded responses

**Capabilities:**
- Semantic search across workspace
- Source attribution
- Multi-hop reasoning
- Table querying

**Tools:**
- `search_documents` - Semantic search
- `search_tables` - Query structured data
- `get_document` - Fetch full document
- `get_related_entities` - Graph traversal

**System Prompt:**
```
You are a workspace intelligence assistant. Your goal is to answer user questions 
by retrieving relevant information from their workspace documents. Always cite 
sources and be precise about what information comes from which document. If you're 
unsure, say so.
```

#### 2. Analysis Agent
**Purpose:** Analyze architecture and identify components

**Capabilities:**
- Identify system components
- Map dependencies
- Detect trust boundaries
- Extract architecture patterns

**Tools:**
- `search_documents` - Find relevant architecture docs
- `extract_entities` - NER for components
- `infer_relationships` - Discover connections
- `detect_patterns` - Identify common patterns

**System Prompt:**
```
You are an architecture analysis expert. Your goal is to understand system 
architecture from documentation. Identify components, their responsibilities, 
dependencies, and trust boundaries. Be thorough but concise.
```

#### 3. Artifact Agent
**Purpose:** Generate architecture artifacts

**Capabilities:**
- Create DFDs
- Generate C4 diagrams
- Write ADRs
- Produce risk analyses

**Tools:**
- `generate_mermaid` - Create Mermaid diagrams
- `format_adr` - Format ADR markdown
- `validate_diagram` - Check diagram syntax
- `get_similar_artifacts` - Learn from existing artifacts

**System Prompt:**
```
You are an architecture documentation specialist. Create clear, accurate, and 
useful architecture artifacts. Follow best practices and industry standards. 
Ensure diagrams are readable and ADRs are well-structured.
```

#### 4. Quality Agent
**Purpose:** Detect quality issues in workspace

**Capabilities:**
- Find duplicates
- Detect staleness
- Identify contradictions
- Score document quality

**Tools:**
- `compare_documents` - Similarity comparison
- `check_freshness` - Analyze document age
- `find_conflicts` - Detect contradictions
- `score_quality` - Calculate quality metrics

---

## Workflow Definitions

### Workflow 1: Answer Query

**Input:**
```typescript
interface QueryWorkflowInput {
  query: string;
  workspaceId: string;
  userId: string;
  filters?: QueryFilters;
}
```

**State:**
```typescript
interface QueryWorkflowState {
  query: string;
  workspaceId: string;
  userId: string;
  filters?: QueryFilters;
  searchResults: SearchResult[];
  context: RetrievalContext;
  answer: string;
  sources: Source[];
  confidence: number;
  error?: string;
}
```

**Graph Definition:**
```typescript
import { StateGraph, END } from "@langchain/langgraph";

const queryWorkflow = new StateGraph<QueryWorkflowState>({
  channels: {
    query: null,
    workspaceId: null,
    userId: null,
    filters: null,
    searchResults: null,
    context: null,
    answer: null,
    sources: null,
    confidence: null,
    error: null,
  },
});

// Node: Parse and understand query
queryWorkflow.addNode("understand_query", async (state) => {
  const analysis = await queryAgent.analyzeQuery(state.query);
  return {
    ...state,
    filters: analysis.extractedFilters,
    query: analysis.refinedQuery,
  };
});

// Node: Execute retrieval
queryWorkflow.addNode("retrieve_context", async (state) => {
  const results = await retrievalService.hybridSearch(
    state.query,
    state.workspaceId,
    { filters: state.filters }
  );
  
  const context = await retrievalService.assembleContext(results);
  
  return {
    ...state,
    searchResults: results,
    context,
  };
});

// Node: Generate answer
queryWorkflow.addNode("generate_answer", async (state) => {
  const response = await queryAgent.generateAnswer({
    query: state.query,
    context: state.context,
  });
  
  return {
    ...state,
    answer: response.answer,
    sources: response.sources,
    confidence: response.confidence,
  };
});

// Node: Handle errors
queryWorkflow.addNode("handle_error", async (state) => {
  return {
    ...state,
    answer: "I encountered an error processing your query.",
    confidence: 0,
  };
});

// Edges
queryWorkflow.addEdge("understand_query", "retrieve_context");
queryWorkflow.addEdge("retrieve_context", "generate_answer");
queryWorkflow.addEdge("generate_answer", END);
queryWorkflow.addEdge("handle_error", END);

// Conditional routing for error handling
queryWorkflow.addConditionalEdges(
  "retrieve_context",
  (state) => {
    return state.context?.results.length > 0 ? "generate_answer" : "handle_error";
  },
  {
    generate_answer: "generate_answer",
    handle_error: "handle_error",
  }
);

// Set entry point
queryWorkflow.setEntryPoint("understand_query");

const queryGraph = queryWorkflow.compile();
```

**Execution:**
```typescript
const result = await queryGraph.invoke({
  query: "What are the main components of the authentication system?",
  workspaceId: "workspace-uuid",
  userId: "user-uuid",
});

console.log(result.answer);
console.log(result.sources);
```

---

### Workflow 2: Generate Architecture Artifacts

**Input:**
```typescript
interface ArtifactWorkflowInput {
  workspaceId: string;
  userId: string;
  artifactType: ArtifactType; // 'dfd' | 'c4' | 'adr' | 'summary'
  scope?: string;
  level?: number;
}
```

**State:**
```typescript
interface ArtifactWorkflowState {
  workspaceId: string;
  userId: string;
  artifactType: ArtifactType;
  scope?: string;
  level?: number;
  documents: Document[];
  architecture: SystemArchitecture;
  draft: Artifact;
  approved: boolean;
  final: Artifact;
  error?: string;
}
```

**Graph Definition:**
```typescript
const artifactWorkflow = new StateGraph<ArtifactWorkflowState>({
  channels: {
    workspaceId: null,
    userId: null,
    artifactType: null,
    scope: null,
    level: null,
    documents: null,
    architecture: null,
    draft: null,
    approved: null,
    final: null,
    error: null,
  },
});

// Node: Gather requirements
artifactWorkflow.addNode("gather_requirements", async (state) => {
  // Search for relevant architecture documents
  const docs = await retrievalService.searchDocuments({
    workspaceId: state.workspaceId,
    query: `architecture system design ${state.scope || ""}`,
  });
  
  return {
    ...state,
    documents: docs,
  };
});

// Node: Analyze architecture
artifactWorkflow.addNode("analyze_architecture", async (state) => {
  const architecture = await analysisAgent.analyzeSystem({
    documents: state.documents,
    scope: state.scope,
  });
  
  return {
    ...state,
    architecture,
  };
});

// Node: Generate artifact
artifactWorkflow.addNode("generate_artifact", async (state) => {
  let draft: Artifact;
  
  switch (state.artifactType) {
    case "dfd":
      draft = await artifactAgent.generateDFD(
        state.architecture,
        state.level || 0
      );
      break;
    case "c4":
      draft = await artifactAgent.generateC4(
        state.architecture,
        state.level as C4Level,
        state.scope
      );
      break;
    case "adr":
      draft = await artifactAgent.generateADR(state.architecture);
      break;
    case "summary":
      draft = await artifactAgent.generateSummary(state.architecture);
      break;
  }
  
  return {
    ...state,
    draft,
  };
});

// Node: Human approval (interrupts workflow)
artifactWorkflow.addNode("request_approval", async (state) => {
  // This node interrupts execution
  // Workflow pauses here until approval is received
  return state;
});

// Node: Finalize artifact
artifactWorkflow.addNode("finalize_artifact", async (state) => {
  const final = await artifactService.saveArtifact({
    ...state.draft,
    approvalStatus: "approved",
    approvedBy: state.userId,
    approvedAt: new Date(),
  });
  
  return {
    ...state,
    final,
  };
});

// Node: Handle rejection
artifactWorkflow.addNode("handle_rejection", async (state) => {
  // Could implement regeneration with feedback here
  return {
    ...state,
    error: "Artifact rejected by user",
  };
});

// Edges
artifactWorkflow.addEdge("gather_requirements", "analyze_architecture");
artifactWorkflow.addEdge("analyze_architecture", "generate_artifact");
artifactWorkflow.addEdge("generate_artifact", "request_approval");

// Conditional edge based on approval
artifactWorkflow.addConditionalEdges(
  "request_approval",
  (state) => (state.approved ? "finalize" : "reject"),
  {
    finalize: "finalize_artifact",
    reject: "handle_rejection",
  }
);

artifactWorkflow.addEdge("finalize_artifact", END);
artifactWorkflow.addEdge("handle_rejection", END);

artifactWorkflow.setEntryPoint("gather_requirements");

const artifactGraph = artifactWorkflow.compile({
  // Enable interruption for approval
  interruptBefore: ["request_approval"],
});
```

**Execution with Approval:**
```typescript
// Start workflow
const executionId = uuidv4();
const execution = await artifactGraph.invoke(
  {
    workspaceId: "workspace-uuid",
    userId: "user-uuid",
    artifactType: "c4",
    level: C4Level.System,
  },
  { configurable: { thread_id: executionId } }
);

// Workflow pauses at "request_approval"
// Show draft to user

// User approves
const finalResult = await artifactGraph.invoke(
  { ...execution, approved: true },
  { configurable: { thread_id: executionId } }
);

console.log(finalResult.final);
```

---

### Workflow 3: Workspace Analysis

**Purpose:** Comprehensive workspace analysis with quality checks

**Input:**
```typescript
interface AnalysisWorkflowInput {
  workspaceId: string;
  userId: string;
  analysisType: 'full' | 'quality' | 'architecture' | 'relationships';
}
```

**State:**
```typescript
interface AnalysisWorkflowState {
  workspaceId: string;
  userId: string;
  analysisType: string;
  documents: Document[];
  qualityReport: QualityReport;
  architecture: SystemArchitecture;
  knowledgeGraph: KnowledgeGraphSummary;
  insights: Insight[];
  recommendations: Recommendation[];
}
```

**Workflow:** (Parallel execution pattern)
```typescript
const analysisWorkflow = new StateGraph<AnalysisWorkflowState>({
  channels: { /* ... */ },
});

// Parallel nodes
analysisWorkflow.addNode("fetch_documents", fetchDocuments);
analysisWorkflow.addNode("quality_check", qualityAgent.analyze);
analysisWorkflow.addNode("architecture_analysis", analysisAgent.analyze);
analysisWorkflow.addNode("graph_analysis", graphAgent.analyze);
analysisWorkflow.addNode("generate_insights", insightAgent.generate);
analysisWorkflow.addNode("generate_recommendations", recommendationAgent.generate);

// Edges for parallel execution
analysisWorkflow.addEdge("fetch_documents", "quality_check");
analysisWorkflow.addEdge("fetch_documents", "architecture_analysis");
analysisWorkflow.addEdge("fetch_documents", "graph_analysis");

// Converge at insights
analysisWorkflow.addEdge("quality_check", "generate_insights");
analysisWorkflow.addEdge("architecture_analysis", "generate_insights");
analysisWorkflow.addEdge("graph_analysis", "generate_insights");

// Final recommendations
analysisWorkflow.addEdge("generate_insights", "generate_recommendations");
analysisWorkflow.addEdge("generate_recommendations", END);

analysisWorkflow.setEntryPoint("fetch_documents");
```

---

## Tool Definitions

### Tool Interface
```typescript
interface Tool {
  name: string;
  description: string;
  parameters: ToolParameter[];
  execute: (params: Record<string, unknown>) => Promise<unknown>;
}

interface ToolParameter {
  name: string;
  type: string;
  description: string;
  required: boolean;
  default?: unknown;
}
```

### Example Tools

#### search_documents
```typescript
const searchDocumentsTool: Tool = {
  name: "search_documents",
  description: "Search for relevant documents using semantic and keyword search",
  parameters: [
    {
      name: "query",
      type: "string",
      description: "The search query",
      required: true,
    },
    {
      name: "filters",
      type: "object",
      description: "Optional filters (documentType, dateRange, etc.)",
      required: false,
    },
    {
      name: "limit",
      type: "number",
      description: "Maximum number of results",
      required: false,
      default: 10,
    },
  ],
  execute: async (params) => {
    const { query, filters, limit } = params;
    return await retrievalService.hybridSearch(query, filters, limit);
  },
};
```

#### generate_mermaid
```typescript
const generateMermaidTool: Tool = {
  name: "generate_mermaid",
  description: "Generate a Mermaid diagram from structured data",
  parameters: [
    {
      name: "diagramType",
      type: "string",
      description: "Type of diagram (flowchart, sequence, class, etc.)",
      required: true,
    },
    {
      name: "data",
      type: "object",
      description: "Structured data for the diagram",
      required: true,
    },
  ],
  execute: async (params) => {
    const { diagramType, data } = params;
    return await diagramService.generateMermaid(diagramType, data);
  },
};
```

---

## State Management

### Persistence
LangGraph supports pluggable state persistence:

```typescript
import { PostgresSaver } from "@langchain/langgraph/checkpoint/postgres";

const checkpointer = new PostgresSaver({
  connectionString: process.env.DATABASE_URL,
});

const graph = workflow.compile({
  checkpointer,
});
```

### State Schema
```typescript
// Define state schema with Zod for validation
import { z } from "zod";

const QueryStateSchema = z.object({
  query: z.string(),
  workspaceId: z.string().uuid(),
  userId: z.string().uuid(),
  filters: z.record(z.unknown()).optional(),
  searchResults: z.array(SearchResultSchema).optional(),
  context: RetrievalContextSchema.optional(),
  answer: z.string().optional(),
  sources: z.array(SourceSchema).optional(),
  confidence: z.number().min(0).max(1).optional(),
  error: z.string().optional(),
});
```

---

## Agent Router

### Routing Strategy
```typescript
class AgentRouter {
  private agents: Map<string, Agent> = new Map();
  
  registerAgent(agent: Agent): void {
    this.agents.set(agent.id, agent);
  }
  
  async route(query: Query, context: Context): Promise<Agent> {
    // Analyze query intent
    const intent = await this.analyzeIntent(query);
    
    // Find best matching agent by capabilities
    const candidates = Array.from(this.agents.values()).filter((agent) =>
      agent.capabilities.some((cap) => intent.requiredCapabilities.includes(cap))
    );
    
    if (candidates.length === 0) {
      throw new Error("No suitable agent found");
    }
    
    if (candidates.length === 1) {
      return candidates[0];
    }
    
    // Use LLM to select best agent
    const selection = await this.llm.invoke({
      messages: [
        {
          role: "system",
          content: "Select the most appropriate agent for this query.",
        },
        {
          role: "user",
          content: JSON.stringify({
            query: query.text,
            candidates: candidates.map((a) => ({
              name: a.name,
              description: a.description,
              capabilities: a.capabilities,
            })),
          }),
        },
      ],
    });
    
    const selectedId = this.parseAgentSelection(selection);
    return this.agents.get(selectedId)!;
  }
  
  private async analyzeIntent(query: Query): Promise<Intent> {
    // Use LLM to analyze query intent
    // ...
  }
}
```

---

## Observability

### LangSmith Integration
```typescript
import { Client } from "langsmith";

const langsmithClient = new Client({
  apiKey: process.env.LANGSMITH_API_KEY,
});

// Trace workflow execution
const result = await queryGraph.invoke(input, {
  callbacks: [
    {
      handleLLMStart: (llm, prompts) => {
        langsmithClient.createRun({
          name: "LLM Call",
          runType: "llm",
          inputs: { prompts },
        });
      },
      handleLLMEnd: (output) => {
        // Log output
      },
    },
  ],
});
```

### Custom Metrics
```typescript
interface WorkflowMetrics {
  executionId: string;
  workflowId: string;
  duration: number;
  nodeExecutions: NodeMetric[];
  llmCalls: number;
  totalTokens: number;
  cost: number;
  status: ExecutionStatus;
}

class MetricsCollector {
  async recordWorkflowExecution(metrics: WorkflowMetrics): Promise<void> {
    await metricsService.record({
      metric: "workflow.execution",
      value: metrics.duration,
      tags: {
        workflowId: metrics.workflowId,
        status: metrics.status,
      },
    });
  }
}
```

---

## Error Handling

### Retry Policy
```typescript
interface RetryPolicy {
  maxRetries: number;
  backoff: BackoffStrategy;
  retryableErrors: string[];
}

const defaultRetryPolicy: RetryPolicy = {
  maxRetries: 3,
  backoff: {
    type: "exponential",
    initialDelay: 1000,
    maxDelay: 10000,
    multiplier: 2,
  },
  retryableErrors: ["RateLimitError", "TimeoutError", "ServiceUnavailable"],
};
```

### Error Boundary Nodes
```typescript
workflow.addNode("handle_error", async (state) => {
  logger.error("Workflow error", {
    executionId: state.executionId,
    error: state.error,
  });
  
  // Emit error event
  eventBus.publish({
    type: "workflow.failed",
    payload: {
      executionId: state.executionId,
      error: state.error,
    },
  });
  
  return {
    ...state,
    status: "failed",
  };
});
```

---

## Testing Strategy

### Unit Tests
```typescript
describe("QueryWorkflow", () => {
  it("should generate answer from context", async () => {
    const mockState: QueryWorkflowState = {
      query: "test query",
      workspaceId: "workspace-1",
      userId: "user-1",
      context: mockContext,
    };
    
    const result = await queryWorkflow.invoke(mockState);
    
    expect(result.answer).toBeDefined();
    expect(result.sources.length).toBeGreaterThan(0);
    expect(result.confidence).toBeGreaterThan(0.5);
  });
});
```

### Integration Tests
```typescript
describe("End-to-End Query Workflow", () => {
  it("should answer query from real workspace", async () => {
    // Set up test workspace with documents
    const workspace = await createTestWorkspace();
    await ingestTestDocuments(workspace.id);
    
    // Execute workflow
    const result = await queryGraph.invoke({
      query: "What is the authentication flow?",
      workspaceId: workspace.id,
      userId: testUser.id,
    });
    
    expect(result.answer).toContain("authentication");
    expect(result.sources).toHaveLength(expect.any(Number));
  });
});
```

---

## Performance Optimization

### Streaming
```typescript
// Stream workflow updates to frontend
for await (const chunk of queryGraph.stream(input)) {
  websocket.send(JSON.stringify(chunk));
}
```

### Parallel Execution
```typescript
// Execute independent nodes in parallel
workflow.addNode("parallel_node", async (state) => {
  const [result1, result2, result3] = await Promise.all([
    task1(state),
    task2(state),
    task3(state),
  ]);
  
  return {
    ...state,
    result1,
    result2,
    result3,
  };
});
```

### Caching
```typescript
// Cache expensive operations
const cachedRetrieve = withCache(
  retrievalService.hybridSearch,
  { ttl: 300, key: (query) => `search:${query}` }
);
```

---

## Next Steps

1. Review workflow definitions with team
2. Implement base Agent class
3. Create QueryWorkflow
4. Set up LangSmith tracing
5. Implement state persistence
6. Build artifact generation workflow
7. Add comprehensive tests

---

**Document Owner:** Backend Team  
**Reviewers:** AI/ML Team, Architecture Team  
**Next Review:** After first workflow implementation
