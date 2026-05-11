import { Banner } from '@contextos/ui';

const thStyle = {
  textAlign: 'left' as const,
  padding: '8px 12px',
  borderBottom: '2px solid var(--color-border)',
  color: 'var(--color-muted)',
  fontSize: 12,
  fontWeight: 600,
  textTransform: 'uppercase' as const,
};

const tdStyle = {
  padding: '8px 12px',
  borderBottom: '1px solid var(--color-border-subtle)',
  fontSize: 14,
  color: 'var(--color-fg)',
};

interface ResultRow {
  group?: string;
  value: number;
  count: number;
  sourceRefs?: Array<{ sourceCell: string; sourceRange: string }>;
}

interface Props {
  rows: ResultRow[];
  hasGroup: boolean;
  operation: string;
  metric: string;
  warnings: string[];
}

export default function CalculationResultTable({ rows, hasGroup, operation, metric, warnings }: Props) {
  return (
    <div>
      {warnings.length > 0 && (
        <Banner variant="warning">
          {warnings.map((w, i) => (
            <div key={i}>⚠️ {w}</div>
          ))}
        </Banner>
      )}

      {rows.length === 0 ? (
        <p style={{ color: 'var(--color-muted)', margin: 0 }}>No results to display.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {hasGroup && <th style={thStyle}>Group</th>}
                <th style={thStyle}>{operation.charAt(0).toUpperCase() + operation.slice(1)} ({metric})</th>
                <th style={thStyle}>Count</th>
                <th style={thStyle}>Source Refs</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} style={{ backgroundColor: i % 2 === 0 ? 'var(--color-bg)' : 'var(--color-surface)' }}>
                  {hasGroup && <td style={tdStyle}>{row.group ?? '—'}</td>}
                  <td style={{ ...tdStyle, fontVariantNumeric: 'tabular-nums' }}>
                    {typeof row.value === 'number' ? Number(row.value.toFixed(4)) : row.value}
                  </td>
                  <td style={tdStyle}>{row.count}</td>
                  <td style={{ ...tdStyle, fontSize: 12, color: 'var(--color-muted)' }}>
                    {row.sourceRefs && row.sourceRefs.length > 0
                      ? `${row.sourceRefs.length} cell(s)`
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
