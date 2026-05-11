import { Card } from '@contextos/ui';

const statBox = {
  textAlign: 'center' as const,
  flex: 1,
  minWidth: 120,
};

export default function WorkspaceSummary({ data }: { data: Record<string, unknown> }) {
  const stats = [
    { label: 'Sources', value: data['totalSources'] ?? 0, icon: '📄' },
    { label: 'Entities', value: data['totalEntities'] ?? 0, icon: '🔷' },
    { label: 'Relationships', value: data['totalRelationships'] ?? 0, icon: '🔗' },
    { label: 'Duplicates', value: data['duplicateSources'] ?? 0, icon: '📋' },
    { label: 'Outdated', value: data['outdatedSources'] ?? 0, icon: '⏳' },
  ];

  return (
    <Card>
      <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>📊 Workspace Summary</h2>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {stats.map(s => (
          <div key={s.label} style={statBox}>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{String(s.value)}</div>
            <div style={{ color: 'var(--color-muted)', fontSize: 13 }}>{s.icon} {s.label}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}
