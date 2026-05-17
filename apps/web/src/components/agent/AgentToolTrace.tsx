'use client';

import type { AgentToolTrace as AgentToolTraceEntry } from '@contextos/agents';

const STATUS_COLORS: Record<string, string> = {
  success: '#3fb950',
  failure: '#f85149',
  skipped: '#d29922',
};

export default function AgentToolTrace({ trace }: { trace: AgentToolTraceEntry[] }) {
  if (trace.length === 0) return null;

  return (
    <details style={{ marginTop: 12 }}>
      <summary
        style={{
          cursor: 'pointer',
          fontSize: 13,
          color: 'var(--color-muted)',
          userSelect: 'none',
        }}
      >
        Tool trace ({trace.length} tool{trace.length !== 1 ? 's' : ''})
      </summary>
      <div
        style={{
          marginTop: 8,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        {trace.map((entry, i) => (
          <div
            key={`${entry.toolId}-${i}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 13,
              padding: '4px 8px',
              borderRadius: 4,
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border-subtle)',
            }}
          >
            <span
              style={{
                display: 'inline-block',
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: STATUS_COLORS[entry.status] ?? '#6e7681',
                flexShrink: 0,
              }}
            />
            <code style={{ fontSize: 12 }}>{entry.toolId}</code>
            <span style={{ color: 'var(--color-muted)', fontSize: 12 }}>
              {entry.status}
            </span>
            {entry.durationMs > 0 && (
              <span style={{ color: 'var(--color-muted)', fontSize: 12 }}>
                {entry.durationMs}ms
              </span>
            )}
            {entry.error && (
              <span style={{ color: '#f85149', fontSize: 12 }}>{entry.error}</span>
            )}
            {entry.skippedReason && (
              <span style={{ color: '#d29922', fontSize: 12 }}>{entry.skippedReason}</span>
            )}
          </div>
        ))}
      </div>
    </details>
  );
}
