const card = {
  border: '1px solid #30363d',
  borderRadius: 8,
  padding: 16,
  backgroundColor: '#161b22',
} as const;

const th = {
  textAlign: 'left' as const,
  padding: '6px 12px',
  borderBottom: '1px solid #30363d',
  color: '#8b949e',
  fontSize: 12,
  textTransform: 'uppercase' as const,
};

const td = {
  padding: '6px 12px',
  borderBottom: '1px solid #21262d',
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
  if (!refs || refs.length === 0) return <span style={{ color: '#8b949e' }}>—</span>;
  const unique = [...new Set(refs.map(r => r.fileName))];
  return (
    <span style={{ fontSize: 12, color: '#8b949e' }}>
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
