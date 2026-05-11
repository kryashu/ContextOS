import type { CSSProperties, ReactNode } from 'react';

interface Column<T> {
  key: string;
  label: string;
  align?: 'left' | 'right' | 'center';
  render?: (value: unknown, row: T, index: number) => ReactNode;
}

interface DataTableProps<T extends Record<string, unknown>> {
  columns: Column<T>[];
  rows: T[];
  striped?: boolean;
  emptyMessage?: string;
}

const thStyle: CSSProperties = {
  textAlign: 'left',
  padding: '6px 12px',
  borderBottom: '1px solid var(--color-border)',
  color: 'var(--color-muted)',
  fontSize: 12,
  fontWeight: 600,
  textTransform: 'uppercase',
};

const tdStyle: CSSProperties = {
  padding: '6px 12px',
  borderBottom: '1px solid var(--color-border-subtle)',
  fontSize: 14,
};

export function DataTable<T extends Record<string, unknown>>({
  columns,
  rows,
  striped = false,
  emptyMessage = 'No data to display.',
}: DataTableProps<T>) {
  if (rows.length === 0) {
    return <p style={{ color: 'var(--color-muted)', margin: 0 }}>{emptyMessage}</p>;
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} style={{ ...thStyle, textAlign: col.align ?? 'left' }}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              style={
                striped
                  ? { backgroundColor: i % 2 === 0 ? 'var(--color-bg)' : 'var(--color-surface)' }
                  : undefined
              }
            >
              {columns.map((col) => (
                <td key={col.key} style={{ ...tdStyle, textAlign: col.align ?? 'left' }}>
                  {col.render ? col.render(row[col.key], row, i) : String(row[col.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
