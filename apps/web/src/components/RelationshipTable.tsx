import { Card, SourceRefs } from '@contextos/ui';

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
  sources?: Array<{ fileName?: string }>;
}

export default function RelationshipTable({ edges, nodes }: { edges: Edge[]; nodes: Node[] }) {
  const nodeMap = new Map(nodes.map(n => [n.id, n.label ?? n.id]));

  return (
    <Card>
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
    </Card>
  );
}
