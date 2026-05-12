import { Card, Badge } from '@contextos/ui';

const typeLabels: Record<string, string> = {
  shared_topic: '📌 Shared Topic',
  shared_entity: '🏷️ Shared Entity',
  table_document_support: '📊 Table ↔ Document',
  config_document_support: '⚙️ Config ↔ Document',
  possible_duplicate: '⚠️ Possible Duplicate',
  isolated_source: '🔇 Isolated',
};

const typeColors: Record<string, string> = {
  shared_topic: '#58a6ff',
  shared_entity: '#3fb950',
  table_document_support: '#d29922',
  config_document_support: '#d29922',
  possible_duplicate: '#f0883e',
  isolated_source: '#6e7681',
};

interface Relationship {
  sourceA?: string;
  sourceB?: string;
  type?: string;
  confidence?: number;
  evidence?: string[];
}

interface RelationshipMap {
  relationships?: Relationship[];
}

export default function SourceRelationshipPanel({ data }: { data: RelationshipMap }) {
  const relationships = data.relationships ?? [];
  if (relationships.length === 0) return null;

  const connected = relationships.filter(r => r.type !== 'isolated_source');
  const isolated = relationships.filter(r => r.type === 'isolated_source');

  return (
    <Card>
      <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>
        🔗 Source Relationships ({connected.length})
        {isolated.length > 0 && (
          <span style={{ fontWeight: 400, fontSize: 13, color: 'var(--color-muted)', marginLeft: 8 }}>
            + {isolated.length} isolated
          </span>
        )}
      </h2>

      {connected.map((r, i) => (
        <div key={i} style={{
          border: `1px solid ${typeColors[r.type ?? ''] ?? 'var(--color-border)'}`,
          borderRadius: 6,
          padding: 12,
          marginBottom: i < connected.length - 1 ? 8 : 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Badge color={typeColors[r.type ?? ''] ?? 'var(--color-border)'}>
              {typeLabels[r.type ?? ''] ?? r.type}
            </Badge>
            <span style={{ fontWeight: 500, fontSize: 14 }}>
              {r.sourceA} ↔ {r.sourceB}
            </span>
            {r.confidence !== undefined && (
              <span style={{ fontSize: 12, color: 'var(--color-muted)', marginLeft: 'auto' }}>
                {(r.confidence * 100).toFixed(0)}%
              </span>
            )}
          </div>
          {r.evidence && r.evidence.length > 0 && (
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--color-muted)' }}>
              {r.evidence.join(' · ')}
            </p>
          )}
        </div>
      ))}

      {isolated.length > 0 && (
        <div style={{ marginTop: connected.length > 0 ? 12 : 0, fontSize: 13, color: 'var(--color-muted)' }}>
          <strong>Isolated sources:</strong>{' '}
          {isolated.map(r => r.sourceA).join(', ')}
        </div>
      )}
    </Card>
  );
}
