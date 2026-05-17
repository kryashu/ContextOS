'use client';

import type { AgentRunResult } from '@contextos/agents';
import { Card } from '@contextos/ui';
import AgentToolTrace from './AgentToolTrace';

const GOAL_LABELS: Record<string, string> = {
  workspace_overview: 'Workspace Overview',
  next_actions: 'Next Actions',
  report_generation: 'Report Generation',
  readiness_check: 'Readiness Check',
  source_importance: 'Source Importance',
  unknown: 'Unknown',
};

interface AgentResultDisplayProps {
  result: AgentRunResult;
  generatedAt: string;
}

export default function AgentResultDisplay({ result, generatedAt }: AgentResultDisplayProps) {
  return (
    <Card style={{ padding: 16, marginTop: 16 }}>
      {/* Header: goal badge + timestamp */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 12,
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{
            display: 'inline-block',
            padding: '2px 8px',
            borderRadius: 12,
            fontSize: 12,
            fontWeight: 600,
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-fg)',
          }}
        >
          {GOAL_LABELS[result.goal] ?? result.goal}
        </span>
        <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>
          {generatedAt}
        </span>
      </div>

      {/* Answer */}
      <div
        style={{
          whiteSpace: 'pre-wrap',
          fontSize: 14,
          lineHeight: 1.6,
          color: 'var(--color-fg)',
        }}
      >
        {result.answer}
      </div>

      {/* Warnings */}
      {result.warnings.length > 0 && (
        <div style={{ marginTop: 12 }}>
          {result.warnings.map((warning, i) => (
            <div
              key={i}
              style={{
                padding: '6px 10px',
                marginBottom: 4,
                borderRadius: 4,
                fontSize: 13,
                backgroundColor: 'rgba(210, 153, 34, 0.1)',
                border: '1px solid rgba(210, 153, 34, 0.3)',
                color: '#d29922',
              }}
            >
              ⚠️ {warning}
            </div>
          ))}
        </div>
      )}

      {/* Tool trace */}
      <AgentToolTrace trace={result.toolTrace} />
    </Card>
  );
}
