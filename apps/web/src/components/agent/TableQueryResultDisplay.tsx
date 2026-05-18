'use client';

import type { TableQueryResult } from '@contextos/table-query';

const STATUS_COLORS: Record<string, string> = {
  success: '#3fb950',
  no_matches: '#d29922',
  needs_clarification: '#6e7681',
  error: '#f85149',
};

export default function TableQueryResultDisplay({ result }: { result: TableQueryResult }) {
  return (
    <div style={{ marginTop: 16 }}>
      {/* Status header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span
          style={{
            width: 8, height: 8, borderRadius: '50%',
            backgroundColor: STATUS_COLORS[result.status] ?? '#6e7681',
          }}
        />
        <strong style={{ fontSize: 14 }}>
          {result.status === 'success' && `${result.matchedRowCount} row(s) matched`}
          {result.status === 'no_matches' && 'No rows matched'}
          {result.status === 'needs_clarification' && 'Clarification needed'}
          {result.status === 'error' && 'Query error'}
        </strong>
      </div>

      {/* Aggregation results */}
      {result.aggregations.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          {result.aggregations.map((agg, i) => (
            <div
              key={i}
              style={{
                display: 'flex', justifyContent: 'space-between',
                padding: '6px 10px', borderRadius: 4,
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border-subtle)',
                marginBottom: 4, fontSize: 13,
              }}
            >
              <span>{agg.label}</span>
              <span style={{ fontWeight: 600 }}>
                {typeof agg.value === 'number' ? agg.value.toLocaleString() : agg.value}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Source refs (collapsible per aggregation) */}
      {result.aggregations.some((a) => a.sourceRefs.length > 0) && (
        <details style={{ marginBottom: 10 }}>
          <summary style={{ cursor: 'pointer', fontSize: 12, color: 'var(--color-muted)' }}>
            Source references ({result.aggregations.reduce((n, a) => n + a.sourceRefs.length, 0)} rows)
          </summary>
          <div style={{ marginTop: 6, maxHeight: 180, overflow: 'auto', fontSize: 11 }}>
            {result.aggregations.map((agg, i) => (
              <div key={i} style={{ marginBottom: 6 }}>
                <div style={{ fontWeight: 500, marginBottom: 2 }}>{agg.label}:</div>
                {agg.sourceRefs.slice(0, 20).map((ref, j) => (
                  <div key={j} style={{ color: 'var(--color-muted)', paddingLeft: 8 }}>
                    {ref.fileName}{ref.sheet ? ` → ${ref.sheet}` : ''} row {ref.row}
                    {ref.sourceRange ? ` (${ref.sourceRange})` : ''}
                  </div>
                ))}
                {agg.sourceRefs.length > 20 && (
                  <div style={{ color: 'var(--color-muted)', paddingLeft: 8 }}>
                    … and {agg.sourceRefs.length - 20} more
                  </div>
                )}
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Needs clarification: show alternatives */}
      {result.status === 'needs_clarification' && result.resolvedFields.length > 0 && (
        <div style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--color-border-subtle)', fontSize: 13 }}>
          <div style={{ fontWeight: 500, marginBottom: 6 }}>Could not resolve these fields:</div>
          {result.resolvedFields
            .filter((f) => !f.resolvedColumn)
            .map((f, i) => (
              <div key={i} style={{ marginBottom: 4 }}>
                <span style={{ color: '#d29922' }}>{f.requestedField}</span>
                {f.alternatives.length > 0 && (
                  <span style={{ color: 'var(--color-muted)' }}>
                    {' — did you mean: '}
                    {f.alternatives.join(', ')}?
                  </span>
                )}
              </div>
            ))}
        </div>
      )}

      {/* Warnings */}
      {result.warnings.length > 0 && (
        <div style={{ marginTop: 8 }}>
          {result.warnings.map((w, i) => (
            <div key={i} style={{ fontSize: 12, color: '#d29922' }}>⚠️ {w}</div>
          ))}
        </div>
      )}
    </div>
  );
}
