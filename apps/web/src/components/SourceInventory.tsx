const card = {
  border: '1px solid var(--color-border)',
  borderRadius: 8,
  padding: 16,
  backgroundColor: 'var(--color-surface)',
} as const;

export default function SourceInventory({ data }: { data: Record<string, unknown> }) {
  const byType = (data['sourcesByType'] ?? {}) as Record<string, number>;
  const byCategory = (data['sourcesByCategory'] ?? {}) as Record<string, number>;

  return (
    <section style={card}>
      <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>📁 Source Inventory</h2>
      <div style={{ display: 'flex', gap: 32 }}>
        <div>
          <h3 style={{ margin: '0 0 8px', fontSize: 14, color: 'var(--color-muted)' }}>By Type</h3>
          {Object.entries(byType).map(([type, count]) => (
            <div key={type} style={{ display: 'flex', justifyContent: 'space-between', gap: 24, fontSize: 14 }}>
              <span style={{ fontFamily: 'monospace' }}>{type}</span>
              <span>{count}</span>
            </div>
          ))}
        </div>
        <div>
          <h3 style={{ margin: '0 0 8px', fontSize: 14, color: 'var(--color-muted)' }}>By Category</h3>
          {Object.entries(byCategory).map(([cat, count]) => (
            <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', gap: 24, fontSize: 14 }}>
              <span>{cat}</span>
              <span>{count}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
