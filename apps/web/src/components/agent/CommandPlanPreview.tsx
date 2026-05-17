'use client';

import type { WorkspaceCommandPlan } from '@contextos/orchestrator';

const STATUS_COLORS: Record<string, string> = {
  executable: '#3fb950',
  planned_only: '#d29922',
  unsupported: '#f85149',
  needs_clarification: '#6e7681',
};

const STATUS_LABELS: Record<string, string> = {
  executable: 'Ready to execute',
  planned_only: 'Planned only',
  unsupported: 'Unsupported',
  needs_clarification: 'Needs clarification',
};

export default function CommandPlanPreview({ plan }: { plan: WorkspaceCommandPlan }) {
  const statusColor = STATUS_COLORS[plan.status] ?? '#6e7681';

  return (
    <div
      style={{
        marginTop: 12,
        padding: '10px 14px',
        borderRadius: 6,
        border: '1px solid var(--color-border-subtle)',
        backgroundColor: 'var(--color-surface)',
        fontSize: 13,
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span
          style={{
            display: 'inline-block',
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: statusColor,
            flexShrink: 0,
          }}
        />
        <strong>{plan.intent.replace(/_/g, ' ')}</strong>
        <span style={{ color: 'var(--color-muted)', fontSize: 12 }}>
          {STATUS_LABELS[plan.status] ?? plan.status} · {plan.confidence} confidence
        </span>
      </div>

      {/* Summary */}
      <p style={{ margin: '0 0 6px', color: 'var(--color-fg)' }}>{plan.summary}</p>

      {/* Next step for planned_only / needs_clarification */}
      {plan.nextStep && (
        <p style={{ margin: '0 0 6px', color: '#d29922', fontSize: 12 }}>
          {plan.nextStep}
        </p>
      )}

      {/* Required capabilities */}
      {plan.requiredCapabilities.length > 0 && (
        <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 4 }}>
          Requires: {plan.requiredCapabilities.join(', ')}
        </div>
      )}

      {/* Extracted data preview */}
      {hasExtractedData(plan) && (
        <details style={{ marginTop: 4 }}>
          <summary style={{ cursor: 'pointer', fontSize: 12, color: 'var(--color-muted)' }}>
            Parsed details
          </summary>
          <pre
            style={{
              marginTop: 4,
              padding: 8,
              borderRadius: 4,
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border-subtle)',
              fontSize: 11,
              overflow: 'auto',
              maxHeight: 160,
            }}
          >
            {JSON.stringify(plan.extracted, null, 2)}
          </pre>
        </details>
      )}

      {/* Warnings */}
      {plan.warnings.length > 0 && (
        <div style={{ marginTop: 6 }}>
          {plan.warnings.map((w, i) => (
            <div key={i} style={{ fontSize: 12, color: '#d29922' }}>
              ⚠️ {w}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function hasExtractedData(plan: WorkspaceCommandPlan): boolean {
  const e = plan.extracted;
  return !!(
    e.keyValues?.length ||
    e.filters?.length ||
    e.aggregations?.length ||
    e.targetFiles?.length ||
    e.fields?.length
  );
}
