import type { ToolRegistry } from '@contextos/tools';
import type {
  CommandIntent,
  WorkspaceCommandPlan,
} from '@contextos/orchestrator';
import { createWorkspaceCommandPlan } from '@contextos/orchestrator';
import type { TableQueryResult } from '@contextos/table-query';
import type { KeyIntelligenceResult } from '@contextos/key-intelligence';
import type { SourceRelationshipMap } from '@contextos/types';

import { WorkspaceAnalystAgent } from './workspace-analyst-agent.js';
import type { AgentGoalType } from './types.js';
import type { WorkspaceAgentResponse } from './workspace-agent-response.js';
import { TraceCollector } from './workspace-command/trace-collector.js';
import {
  formatTableQueryResult,
  formatKeyIntelligenceResult,
  formatDocumentLookupResult,
  formatAgentRunResult,
  formatClarificationResult,
  formatErrorResult,
  formatSourceRelationshipResult,
} from './response-formatters/index.js';

const MAX_COMMAND_LENGTH = 500;

/**
 * Intents that must NEVER fall back to WorkspaceAnalystAgent. They are
 * always served by a deterministic tool route. Tested in
 * workspace-command-agent.no-hallucination.test.ts.
 */
const SPECIALIZED_INTENTS: ReadonlySet<CommandIntent> = new Set<CommandIntent>([
  'table_aggregate_query',
  'duplicate_key_query',
  'document_lookup',
  'evidence_lookup',
  'source_relationship_lookup',
]);

const ANALYST_GOAL_INTENTS: ReadonlySet<CommandIntent> = new Set<CommandIntent>([
  'workspace_overview',
  'next_actions',
  'report_generation',
]);

export interface WorkspaceCommandAgentInput {
  workspaceId: string;
  command: string;
  allowWrites?: boolean;
}

/**
 * Single entry-point for natural-language workspace commands. Plans the
 * command, routes it deterministically to the correct tool (or the analyst
 * agent for overview-style goals), and returns a unified, evidence-backed
 * WorkspaceAgentResponse.
 *
 * Specialized intents (see SPECIALIZED_INTENTS) never delegate to the
 * analyst agent. This is enforced by tests.
 */
export class WorkspaceCommandAgent {
  private readonly analyst: WorkspaceAnalystAgent;

  constructor(
    private readonly registry: ToolRegistry,
    analyst?: WorkspaceAnalystAgent,
  ) {
    this.analyst = analyst ?? new WorkspaceAnalystAgent(registry);
  }

  async run(input: WorkspaceCommandAgentInput): Promise<WorkspaceAgentResponse> {
    const { workspaceId, command, allowWrites = false } = input;
    const trace = new TraceCollector();

    // ── 1. Validate command ─────────────────────────────────────────
    const trimmed = (command ?? '').trim();
    if (!trimmed) {
      return formatErrorResult({
        intent: 'unknown',
        message: 'Command cannot be empty.',
        toolTrace: trace.snapshot(),
      });
    }
    if (trimmed.length > MAX_COMMAND_LENGTH) {
      return formatErrorResult({
        intent: 'unknown',
        message: `Command must be ${MAX_COMMAND_LENGTH} characters or fewer.`,
        toolTrace: trace.snapshot(),
      });
    }

    // ── 2. Plan ──────────────────────────────────────────────────────
    let plan: WorkspaceCommandPlan;
    try {
      plan = await trace.time(
        'command_planning',
        (p: WorkspaceCommandPlan) =>
          `intent=${p.intent}, status=${p.status}, confidence=${p.confidence}`,
        () => Promise.resolve(createWorkspaceCommandPlan(trimmed)),
      );
    } catch {
      return formatErrorResult({
        intent: 'unknown',
        message: 'Failed to plan command. Please try rephrasing.',
        toolTrace: trace.snapshot(),
      });
    }

    // ── 3. Clarification short-circuit ──────────────────────────────
    if (plan.intent === 'unknown' || plan.status === 'needs_clarification') {
      return formatClarificationResult({ plan, toolTrace: trace.snapshot() });
    }

    // ── 4. Route by intent ──────────────────────────────────────────
    try {
      switch (plan.intent) {
        case 'table_aggregate_query':
          return await this.runTableQuery(workspaceId, plan, trace);
        case 'duplicate_key_query':
          return await this.runDuplicateKeys(workspaceId, plan, trace);
        case 'document_lookup':
        case 'evidence_lookup':
          return await this.runDocumentLookup(workspaceId, plan, trace);
        case 'source_relationship_lookup':
          return await this.runSourceRelationships(workspaceId, plan, trace);
        case 'workspace_overview':
        case 'next_actions':
        case 'report_generation':
          return await this.runAnalystGoal(workspaceId, plan, allowWrites, trace);
        default:
          return formatClarificationResult({ plan, toolTrace: trace.snapshot() });
      }
    } catch {
      // Never leak error.message or stack traces.
      return formatErrorResult({
        intent: plan.intent,
        message: 'The workspace agent encountered an unexpected error. Please try again.',
        toolTrace: trace.snapshot(),
      });
    }
  }

  // ── Routes ────────────────────────────────────────────────────────

  private async runTableQuery(
    workspaceId: string,
    plan: WorkspaceCommandPlan,
    trace: TraceCollector,
  ): Promise<WorkspaceAgentResponse> {
    const aggregations = plan.extracted.aggregations ?? [];
    if (aggregations.length === 0) {
      trace.skip(
        'runTableQuery',
        'no aggregations were extracted from the command',
      );
      return formatClarificationResult({
        plan,
        toolTrace: trace.snapshot(),
        reason:
          'I understood this as a table query, but could not identify what to calculate. ' +
          "Try: 'calculate total units sold' or 'sum units in transit'.",
      });
    }

    const filters = plan.extracted.filters ?? [];
    const result = await trace.time<TableQueryResult>(
      'runTableQuery',
      (r) => `status=${r.status}, matched=${r.matchedRowCount}, aggregations=${r.aggregations.length}`,
      () =>
        this.registry.executeTool('runTableQuery', {
          workspaceId,
          filters,
          aggregations,
          fileScope: plan.extracted.targetFiles,
          includeRows: true,
        }) as Promise<TableQueryResult>,
    );

    return formatTableQueryResult({
      workspaceId,
      command: plan.originalCommand,
      result,
      toolTrace: trace.snapshot(),
    });
  }

  private async runDuplicateKeys(
    workspaceId: string,
    plan: WorkspaceCommandPlan,
    trace: TraceCollector,
  ): Promise<WorkspaceAgentResponse> {
    const keyType = plan.extracted.keyType;
    const result = await trace.time<KeyIntelligenceResult>(
      'findDuplicateKeys',
      (r) => `status=${r.status}, duplicateGroups=${r.duplicateGroups.length}`,
      () =>
        this.registry.executeTool('findDuplicateKeys', {
          workspaceId,
          keyType,
        }) as Promise<KeyIntelligenceResult>,
    );

    return formatKeyIntelligenceResult({
      workspaceId,
      command: plan.originalCommand,
      result,
      keyType,
      toolTrace: trace.snapshot(),
    });
  }

  private async runDocumentLookup(
    workspaceId: string,
    plan: WorkspaceCommandPlan,
    trace: TraceCollector,
  ): Promise<WorkspaceAgentResponse> {
    const keyValue = plan.extracted.keyValue;
    if (!keyValue) {
      trace.skip(
        'findDocumentsForKey',
        'no key value was extracted from the command',
      );
      return formatClarificationResult({
        plan,
        toolTrace: trace.snapshot(),
        reason:
          'Please specify which key or identifier to look up (e.g. product ABC-123, license LIC-2025-88).',
      });
    }

    const result = await trace.time<KeyIntelligenceResult>(
      'findDocumentsForKey',
      (r) => `status=${r.status}, documentMatches=${r.documentMatches.length}`,
      () =>
        this.registry.executeTool('findDocumentsForKey', {
          workspaceId,
          value: keyValue,
          keyType: plan.extracted.keyType,
        }) as Promise<KeyIntelligenceResult>,
    );

    return formatDocumentLookupResult({
      workspaceId,
      command: plan.originalCommand,
      intent: plan.intent,
      keyValue,
      result,
      toolTrace: trace.snapshot(),
    });
  }

  private async runSourceRelationships(
    workspaceId: string,
    plan: WorkspaceCommandPlan,
    trace: TraceCollector,
  ): Promise<WorkspaceAgentResponse> {
    const result = await trace.time<SourceRelationshipMap>(
      'getSourceRelationshipMap',
      (r) => `relationships=${r.relationships?.length ?? 0}`,
      () =>
        this.registry.executeTool('getSourceRelationshipMap', {
          workspaceId,
        }) as Promise<SourceRelationshipMap>,
    );

    return formatSourceRelationshipResult({
      workspaceId,
      command: plan.originalCommand,
      result,
      toolTrace: trace.snapshot(),
    });
  }

  private async runAnalystGoal(
    workspaceId: string,
    plan: WorkspaceCommandPlan,
    allowWrites: boolean,
    trace: TraceCollector,
  ): Promise<WorkspaceAgentResponse> {
    // Hard guard: must never reach here for specialized intents.
    if (SPECIALIZED_INTENTS.has(plan.intent)) {
      trace.skip(
        'WorkspaceAnalystAgent',
        `specialized intent ${plan.intent} must not fall back to the analyst`,
      );
      return formatErrorResult({
        intent: plan.intent,
        message: 'Specialized intent attempted to fall back to the analyst agent.',
        toolTrace: trace.snapshot(),
      });
    }
    if (!ANALYST_GOAL_INTENTS.has(plan.intent)) {
      return formatClarificationResult({ plan, toolTrace: trace.snapshot() });
    }

    const goal = plan.intent as AgentGoalType;
    const start = Date.now();
    const result = await this.analyst.run({
      workspaceId,
      goal,
      allowWrites,
    });
    trace.record(
      'WorkspaceAnalystAgent',
      'success',
      `goal=${goal}, toolCalls=${result.toolTrace.length}, warnings=${result.warnings.length}`,
      Date.now() - start,
    );

    return formatAgentRunResult({
      workspaceId,
      command: plan.originalCommand,
      intent: plan.intent,
      result,
      extraToolTrace: trace.snapshot(),
    });
  }
}
