'use client';

import { useState, useTransition } from 'react';
import type { WorkspaceAgentResponse, AgentNextAction } from '@contextos/agents';
import type { WorkspaceCommandPlan } from '@contextos/orchestrator';
import { Card } from '@contextos/ui';
import CommandPlanPreview from './agent/CommandPlanPreview';
import AgentCommandInput from './agent/AgentCommandInput';
import WorkspaceAgentResponseDisplay from './agent/WorkspaceAgentResponseDisplay';

type AnalysisState = 'none' | 'stale' | 'current' | 'failed';

interface WorkspaceAgentPanelProps {
  workspaceId: string;
  analysisState: AnalysisState;
  runCommandAction: (
    command: string,
    allowWrites?: boolean,
  ) => Promise<{ success: boolean; result?: WorkspaceAgentResponse; error?: string }>;
  planCommandAction: (
    command: string,
  ) => Promise<{ success: boolean; plan?: WorkspaceCommandPlan; error?: string }>;
}

const DISABLED_MESSAGES: Partial<Record<AnalysisState, string>> = {
  none: 'Run analysis before using the workspace agent.',
  stale: 'Analysis is stale. Re-run analysis before using the workspace agent.',
  failed: 'Analysis failed. Re-run analysis before using the workspace agent.',
};

export default function WorkspaceAgentPanel({
  analysisState,
  runCommandAction,
  planCommandAction,
}: WorkspaceAgentPanelProps) {
  const [goal, setGoal] = useState('');
  const [allowWrites, setAllowWrites] = useState(false);
  const [plan, setPlan] = useState<WorkspaceCommandPlan | null>(null);
  const [response, setResponse] = useState<WorkspaceAgentResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isDisabled = analysisState !== 'current';
  const disabledMessage = DISABLED_MESSAGES[analysisState];

  function handleRun() {
    const trimmed = goal.trim();
    if (!trimmed || isDisabled) return;
    setError(null);
    setResponse(null);

    startTransition(async () => {
      // Best-effort plan preview (secondary detail; failure is non-fatal)
      const planResp = await planCommandAction(trimmed);
      if (planResp.success && planResp.plan) {
        setPlan(planResp.plan);
      } else {
        setPlan(null);
      }

      const result = await runCommandAction(trimmed, allowWrites);
      if (result.success && result.result) {
        setResponse(result.result);
      } else {
        setError(result.error ?? 'The workspace agent encountered an error.');
      }
    });
  }

  function handleNextAction(action: AgentNextAction) {
    if (action.command) {
      setGoal(action.command);
    }
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

      {error && (
        <div
          style={{
            marginTop: 12,
            padding: 8,
            border: '1px solid var(--color-error, #b3261e)',
            borderRadius: 6,
            backgroundColor: 'var(--color-error-bg, #fdeded)',
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      {response && (
        <WorkspaceAgentResponseDisplay response={response} onNextAction={handleNextAction} />
      )}

      {plan && (
        <details style={{ marginTop: 12 }}>
          <summary style={{ cursor: 'pointer', fontSize: 12, color: 'var(--color-muted)' }}>
            Command plan (debug)
          </summary>
          <div style={{ marginTop: 6 }}>
            <CommandPlanPreview plan={plan} />
          </div>
        </details>
      )}
    </Card>
  );
}
