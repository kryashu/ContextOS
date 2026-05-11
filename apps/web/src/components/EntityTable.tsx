const card = {
  border: '1px solid var(--color-border)',
  borderRadius: 8,
  padding: 16,
  backgroundColor: 'var(--color-surface)',
} as const;

const th = {
  textAlign: 'left' as const,
  padding: '6px 12px',
  borderBottom: '1px solid var(--color-border)',
  color: 'var(--color-muted)',
  fontSize: 12,
  textTransform: 'uppercase' as const,
};

const td = {
  padding: '6px 12px',
  borderBottom: '1px solid var(--color-border-subtle)',
  fontSize: 14,
};

interface SourceRef {
  sourceId?: string;
  fileName?: string;
  sourceType?: string;
}

interface Node {
  id?: string;
  type?: string;
  label?: string;
  sources?: SourceRef[];
  metadata?: Record<string, unknown>;
}

function SourceRefs({ refs }: { refs?: SourceRef[] }) {
  if (!refs || refs.length === 0) return <span style={{ color: 'var(--color-muted)' }}>—</span>;
  const unique = [...new Set(refs.map(r => r.fileName))];
  return (
    <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>
      {unique.map((f, i) => (
        <span key={i}>
          {i > 0 && ', '}
          <span style={{ fontFamily: 'monospace' }}>{f}</span>
        </span>
      ))}
    </span>
  );
}

const typeBadge: Record<string, string> = {
  actor: '👤',
  system: '⚙️',
  process: '🔄',
  data_store: '🗄️',
  external_integration: '🔌',
  business_entity: '📦',
  endpoint: '🌐',
  event: '⚡',
};

export default function EntityTable({ nodes }: { nodes: Node[] }) {
  return (
    <section style={card}>
      <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>🔷 Entities ({nodes.length})</h2>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>Type</th>
              <th style={th}>Name</th>
              <th style={th}>Source References</th>
            </tr>
          </thead>
          <tbody>
            {nodes.map((node, i) => (
              <tr key={node.id ?? i}>
                <td style={td}>
                  <span title={node.type}>{typeBadge[node.type ?? ''] ?? '❓'} {node.type}</span>
                </td>
                <td style={{ ...td, fontWeight: 500 }}>{node.label}</td>
                <td style={td}><SourceRefs refs={node.sources} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
