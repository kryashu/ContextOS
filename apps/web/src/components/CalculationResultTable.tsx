const thStyle = {
  textAlign: 'left' as const,
  padding: '8px 12px',
  borderBottom: '2px solid #30363d',
  color: '#8b949e',
  fontSize: 12,
  fontWeight: 600,
  textTransform: 'uppercase' as const,
};

const tdStyle = {
  padding: '8px 12px',
  borderBottom: '1px solid #21262d',
  fontSize: 14,
  color: '#e6edf3',
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
        <div style={{
          border: '1px solid #d29922',
          borderRadius: 6,
          padding: '8px 12px',
          backgroundColor: '#2d2200',
          color: '#d29922',
          fontSize: 13,
          marginBottom: 12,
        }}>
          {warnings.map((w, i) => (
            <div key={i}>⚠️ {w}</div>
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        <p style={{ color: '#8b949e', margin: 0 }}>No results to display.</p>
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
                <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#0d1117' : '#161b22' }}>
                  {hasGroup && <td style={tdStyle}>{row.group ?? '—'}</td>}
                  <td style={{ ...tdStyle, fontVariantNumeric: 'tabular-nums' }}>
                    {typeof row.value === 'number' ? Number(row.value.toFixed(4)) : row.value}
                  </td>
                  <td style={tdStyle}>{row.count}</td>
                  <td style={{ ...tdStyle, fontSize: 12, color: '#8b949e' }}>
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
