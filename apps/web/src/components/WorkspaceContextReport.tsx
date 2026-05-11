const card = {
  border: '1px solid var(--color-border)',
  borderRadius: 8,
  padding: 20,
  backgroundColor: 'var(--color-surface)',
} as const;

const badge = (color: string) =>
  ({
    display: 'inline-block',
    fontSize: 11,
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: 4,
    backgroundColor: color,
    color: '#fff',
  }) as const;

interface WorkspaceContextData {
  primaryTheme?: string;
  sourceKindCounts?: Record<string, number>;
  keyTopics?: string[];
  keyEntities?: string[];
  detectedCapabilities?: Record<string, boolean>;
  recommendedActions?: Array<{ action?: string; reason?: string }>;
  irrelevantSources?: Array<{ fileName?: string; reason?: string }>;
  assumptions?: string[];
}

export default function WorkspaceContextReport({
  context,
}: {
  context: Record<string, unknown>;
}) {
  const ctx = context as unknown as WorkspaceContextData;

  const kindEntries = ctx.sourceKindCounts
    ? Object.entries(ctx.sourceKindCounts).filter(([, v]) => v > 0)
    : [];

  const capEntries = ctx.detectedCapabilities
    ? Object.entries(ctx.detectedCapabilities).filter(([, v]) => v)
    : [];

  return (
    <section style={card}>
      <h2 style={{ margin: '0 0 16px', fontSize: 18 }}>
        🌐 Workspace Understanding
      </h2>

      {/* Primary Theme */}
      {ctx.primaryTheme && (
        <div style={{ marginBottom: 16 }}>
          <h3 style={{ margin: '0 0 4px', fontSize: 14, color: 'var(--color-muted)' }}>
            About this workspace
          </h3>
          <p style={{ margin: 0, fontSize: 15 }}>{ctx.primaryTheme}</p>
        </div>
      )}

      {/* Source composition */}
      {kindEntries.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 14, color: 'var(--color-muted)' }}>
            Source composition
          </h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {kindEntries.map(([kind, count]) => (
              <span key={kind} style={badge('#30363d')}>
                {kind}: {count}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Key Topics */}
      {ctx.keyTopics && ctx.keyTopics.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 14, color: 'var(--color-muted)' }}>
            Key topics
          </h3>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {ctx.keyTopics.slice(0, 12).map((t) => (
              <span key={t} style={badge('#1f6feb')}>
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Key Entities */}
      {ctx.keyEntities && ctx.keyEntities.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 14, color: 'var(--color-muted)' }}>
            Key entities
          </h3>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {ctx.keyEntities.slice(0, 12).map((e) => (
              <span key={e} style={badge('#8b5cf6')}>
                {e}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Capabilities */}
      {capEntries.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 14, color: 'var(--color-muted)' }}>
            Detected capabilities
          </h3>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {capEntries.map(([cap]) => (
              <span key={cap} style={badge('#238636')}>
                ✓ {cap.replace(/^(has|can)/, '').replace(/([A-Z])/g, ' $1').trim()}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Recommended Actions */}
      {ctx.recommendedActions && ctx.recommendedActions.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 14, color: 'var(--color-muted)' }}>
            Recommended actions
          </h3>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {ctx.recommendedActions.map((a, i) => (
              <li key={i} style={{ marginBottom: 4, fontSize: 13 }}>
                <strong>{a.action}</strong>
                {a.reason && <span style={{ color: 'var(--color-muted)' }}> — {a.reason}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Irrelevant Sources */}
      {ctx.irrelevantSources && ctx.irrelevantSources.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 14, color: 'var(--color-muted)' }}>
            Irrelevant / low-value files
          </h3>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {ctx.irrelevantSources.map((s, i) => (
              <li key={i} style={{ fontSize: 13, color: 'var(--color-muted)' }}>
                <code>{s.fileName}</code>
                {s.reason && <span> — {s.reason}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Assumptions */}
      {ctx.assumptions && ctx.assumptions.length > 0 && (
        <div>
          <h3 style={{ margin: '0 0 8px', fontSize: 14, color: 'var(--color-muted)' }}>
            Assumptions
          </h3>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {ctx.assumptions.map((a, i) => (
              <li key={i} style={{ fontSize: 13, color: 'var(--color-muted)' }}>{a}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
