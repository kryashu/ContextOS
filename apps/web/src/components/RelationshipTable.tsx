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
  fileName?: string;
}

interface Node {
  id?: string;
  label?: string;
}

interface Edge {
  id?: string;
  source?: string;
  target?: string;
  type?: string;
  label?: string;
  sources?: SourceRef[];
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

export default function RelationshipTable({ edges, nodes }: { edges: Edge[]; nodes: Node[] }) {
  const nodeMap = new Map(nodes.map(n => [n.id, n.label ?? n.id]));

  return (
    <section style={card}>
      <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>🔗 Relationships ({edges.length})</h2>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>Source</th>
              <th style={th}>Type</th>
              <th style={th}>Target</th>
              <th style={th}>Source References</th>
            </tr>
          </thead>
          <tbody>
            {edges.map((edge, i) => (
              <tr key={edge.id ?? i}>
                <td style={td}>{nodeMap.get(edge.source ?? '') ?? edge.source}</td>
                <td style={{ ...td, fontFamily: 'monospace', fontSize: 12 }}>{edge.type}</td>
                <td style={td}>{nodeMap.get(edge.target ?? '') ?? edge.target}</td>
                <td style={td}><SourceRefs refs={edge.sources} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
