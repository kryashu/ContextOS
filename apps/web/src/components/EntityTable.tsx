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
  type?: string;
  label?: string;
  sources?: Array<{ fileName?: string }>;
  metadata?: Record<string, unknown>;
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
    <Card>
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
    </Card>
  );
}
