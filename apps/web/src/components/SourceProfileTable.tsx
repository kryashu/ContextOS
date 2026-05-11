const card = {
  border: '1px solid var(--color-border)',
  borderRadius: 8,
  padding: 20,
  backgroundColor: 'var(--color-surface)',
} as const;

const kindColors: Record<string, string> = {
  document: '#58a6ff',
  workbook: '#3fb950',
  config: '#d29922',
  data: '#f0883e',
  notes: '#8b949e',
  unknown: '#6e7681',
};

interface ProfileEntry {
  sourceId?: string;
  fileName?: string;
  fileType?: string;
  sourceKind?: string;
  summary?: string;
  detectedTopics?: string[];
  detectedEntities?: string[];
  relevanceScore?: number;
  warnings?: string[];
}

export default function SourceProfileTable({
  profiles,
}: {
  profiles: Array<Record<string, unknown>>;
}) {
  const items = profiles as unknown as ProfileEntry[];
  if (items.length === 0) return null;

  return (
    <section style={card}>
      <h2 style={{ margin: '0 0 16px', fontSize: 18 }}>
        📑 Source Profiles ({items.length})
      </h2>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
              <th style={{ textAlign: 'left', padding: '6px 10px', color: 'var(--color-muted)' }}>File</th>
              <th style={{ textAlign: 'left', padding: '6px 10px', color: 'var(--color-muted)' }}>Kind</th>
              <th style={{ textAlign: 'right', padding: '6px 10px', color: 'var(--color-muted)' }}>Relevance</th>
              <th style={{ textAlign: 'left', padding: '6px 10px', color: 'var(--color-muted)' }}>Topics</th>
              <th style={{ textAlign: 'left', padding: '6px 10px', color: 'var(--color-muted)' }}>Warnings</th>
            </tr>
          </thead>
          <tbody>
            {items.map((p, i) => {
              const kind = p.sourceKind ?? 'unknown';
              const score = p.relevanceScore ?? 0;
              const scorePercent = Math.round(score * 100);
              const scoreColor =
                score >= 0.7 ? '#3fb950' : score >= 0.4 ? '#d29922' : '#f85149';

              return (
                <tr
                  key={p.sourceId ?? i}
                  style={{ borderBottom: '1px solid var(--color-border-subtle)' }}
                >
                  <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontSize: 12 }}>
                    {p.fileName ?? '—'}
                  </td>
                  <td style={{ padding: '8px 10px' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        fontSize: 11,
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: 4,
                        backgroundColor: kindColors[kind] ?? '#6e7681',
                        color: '#fff',
                      }}
                    >
                      {kind}
                    </span>
                  </td>
                  <td
                    style={{
                      padding: '8px 10px',
                      textAlign: 'right',
                      fontWeight: 600,
                      color: scoreColor,
                    }}
                  >
                    {scorePercent}%
                  </td>
                  <td style={{ padding: '8px 10px' }}>
                    {p.detectedTopics && p.detectedTopics.length > 0
                      ? p.detectedTopics.slice(0, 3).join(', ')
                      : <span style={{ color: 'var(--color-muted)' }}>—</span>}
                  </td>
                  <td style={{ padding: '8px 10px', color: '#f85149', fontSize: 12 }}>
                    {p.warnings && p.warnings.length > 0
                      ? p.warnings.join('; ')
                      : <span style={{ color: 'var(--color-muted)' }}>—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
