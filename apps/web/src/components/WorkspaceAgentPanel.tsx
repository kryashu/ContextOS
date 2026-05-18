'use client';

import { useState, useTransition } from 'react';
import type { AgentRunResult } from '@contextos/agents';
import type { WorkspaceCommandPlan, CommandIntent } from '@contextos/orchestrator';
import type { TableQueryResult } from '@contextos/table-query';
import type { KeyIntelligenceResult } from '@contextos/key-intelligence';
import { Card } from '@contextos/ui';
import CommandPlanPreview from './agent/CommandPlanPreview';
import AgentCommandInput from './agent/AgentCommandInput';
import AgentExecutionResult from './agent/AgentExecutionResult';

type AnalysisState = 'none' | 'stale' | 'current' | 'failed';

// ── Routing guard: only these intents may call runWorkspaceAgentAction ──
const AGENT_ALLOWED_INTENTS: Set<CommandIntent> = new Set([
  'workspace_overview',
  'next_actions',
  'report_generation',
  'source_relationship_lookup',
]);

interface WorkspaceAgentPanelProps {
  workspaceId: string;
  analysisState: AnalysisState;
  runAgentAction: (
    goal: string,
    allowWrites?: boolean,
  ) => Promise<{ success: boolean; result?: AgentRunResult; error?: string }>;
  planCommandAction: (
    command: string,
  ) => Promise<{ success: boolean; plan?: WorkspaceCommandPlan; error?: string }>;
  runTableQueryAction: (
    filters: Array<{ field: string; operator: string; value: string | number }>,
    aggregations: Array<{ field: string; operation: string; label?: string }>,
    fileScope?: string[],
    includeRows?: boolean,
  ) => Promise<{ success: boolean; result?: TableQueryResult; error?: string }>;
  findDuplicateKeysAction: (
    keyType?: string,
  ) => Promise<{ success: boolean; result?: KeyIntelligenceResult; error?: string }>;
  findDocumentsForKeyAction: (
    value: string,
    keyType?: string,
  ) => Promise<{ success: boolean; result?: KeyIntelligenceResult; error?: string }>;
}

const DISABLED_MESSAGES: Partial<Record<AnalysisState, string>> = {
  none: 'Run analysis before using the workspace agent.',
  stale: 'Analysis is stale. Re-run analysis before using the workspace agent.',
  failed: 'Analysis failed. Re-run analysis before using the workspace agent.',
};

export default function WorkspaceAgentPanel({
  analysisState,
  runAgentAction,
  planCommandAction,
  runTableQueryAction,
  findDuplicateKeysAction,
  findDocumentsForKeyAction,
}: WorkspaceAgentPanelProps) {
  const [goal, setGoal] = useState('');
  const [allowWrites, setAllowWrites] = useState(false);
  const [plan, setPlan] = useState<WorkspaceCommandPlan | null>(null);
  const [result, setResult] = useState<AgentRunResult | null>(null);
  const [tableResult, setTableResult] = useState<TableQueryResult | null>(null);
  const [keyIntelligenceResult, setKeyIntelligenceResult] = useState<KeyIntelligenceResult | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isDisabled = analysisState !== 'current';
  const disabledMessage = DISABLED_MESSAGES[analysisState];

  /**
   * Ensure we have a valid, current plan for the given command.
   * Returns the plan if successful, null otherwise (error is set internally).
   */
  async function ensurePlan(command: string): Promise<WorkspaceCommandPlan | null> {
    // Reuse existing plan if command hasn't changed
    if (plan && plan.originalCommand === command) {
      return plan;
    }

    const response = await planCommandAction(command);
    if (response.success && response.plan) {
      setPlan(response.plan);
      return response.plan;
    }

    setError(response.error ?? 'Failed to plan command.');
    return null;
  }

  /**
   * Execute the plan by routing to the correct action based on intent.
   * Specialized intents NEVER fall through to runAgentAction.
   */
  async function executePlan(currentPlan: WorkspaceCommandPlan): Promise<void> {
    const { intent, extracted } = currentPlan;

    // ── table_aggregate_query ────────────────────────────────────────
    if (intent === 'table_aggregate_query') {
      const aggregations = (extracted.aggregations ?? []).map((a) => ({
        field: a.field,
        operation: a.operation,
        label: a.label,
      }));
      if (aggregations.length === 0) {
        setError(
          'I understood this as a table query, but could not identify what to calculate. ' +
          "Try: 'calculate total units sold'.",
        );
        return;
      }
      const filters = (extracted.filters ?? []).map((f) => ({
        field: f.field,
        operator: f.operator,
        value: f.value,
      }));
      const response = await runTableQueryAction(
        filters,
        aggregations,
        extracted.targetFiles,
        true,
      );
      if (response.success && response.result) {
        setTableResult(response.result);
      } else {
        setError(response.error ?? 'Table query failed.');
      }
      return;
    }

    // ── duplicate_key_query ──────────────────────────────────────────
    if (intent === 'duplicate_key_query') {
      const response = await findDuplicateKeysAction(extracted.keyType);
      if (response.success && response.result) {
        setKeyIntelligenceResult(response.result);
      } else {
        setError(response.error ?? 'Duplicate key detection failed.');
      }
      return;
    }

    // ── document_lookup / evidence_lookup ─────────────────────────────
    if (intent === 'document_lookup' || intent === 'evidence_lookup') {
      if (!extracted.keyValue) {
        setError(
          'Please specify which key or identifier to look up (e.g. product ABC-123).',
        );
        return;
      }
      const response = await findDocumentsForKeyAction(extracted.keyValue, extracted.keyType);
      if (response.success && response.result) {
        setKeyIntelligenceResult(response.result);
      } else {
        setError(response.error ?? 'Document lookup failed.');
      }
      return;
    }

    // ── Agent-allowed intents ────────────────────────────────────────
    if (AGENT_ALLOWED_INTENTS.has(intent)) {
      if (intent === 'report_generation' && !allowWrites) {
        setError(
          'Enable "Allow report/artifact generation" to generate reports.',
        );
        return;
      }
      const response = await runAgentAction(goal.trim(), allowWrites);
      if (response.success && response.result) {
        setResult(response.result);
        setGeneratedAt(new Date().toISOString());
      } else {
        setError(response.error ?? 'An unexpected error occurred.');
      }
      return;
    }

    // ── Blocked intents: unknown / needs_clarification / any unhandled ─
    if (currentPlan.status === 'needs_clarification' && currentPlan.nextStep) {
      setError(currentPlan.nextStep);
    } else {
      setError(
        "I couldn't determine a specific workflow for this command. " +
        'Try rephrasing or use a preset command.',
      );
    }
  }

  function handleRun() {
    if (!goal.trim() || isDisabled) return;
    setError(null);
    setResult(null);
    setTableResult(null);
    setKeyIntelligenceResult(null);

    startTransition(async () => {
      const currentPlan = await ensurePlan(goal.trim());
      if (!currentPlan) return;
      await executePlan(currentPlan);
    });
  }

  return (
    <Card style={{ padding: 20, marginBottom: 24 }}>
      <h2 style={{ margin: '0 0 12px', fontSize: 18 }}>🤖 Workspace Agent</h2>

      <AgentCommandInput
        goal={goal}
        setGoal={setGoal}
        allowWrites={allowWrites}
        setAllowWrites={setAllowWrites}
        isDisabled={isDisabled}
        isPending={isPending}
        disabledMessage={disabledMessage}
        onSubmit={handleRun}
      />

      {/* Command plan preview */}
      {plan && <CommandPlanPreview plan={plan} />}

      {/* Results */}
      <AgentExecutionResult
        result={result}
        tableResult={tableResult}
        keyIntelligenceResult={keyIntelligenceResult}
        error={error}
        generatedAt={generatedAt}
      />
    </Card>
  );
}
