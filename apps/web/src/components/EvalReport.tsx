const card = {
  border: '1px solid var(--color-border)',
  borderRadius: 8,
  padding: 16,
  backgroundColor: 'var(--color-surface)',
} as const;

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

interface EvalResult {
  testName?: string;
  score?: number;
  passed?: boolean;
  details?: Record<string, unknown>;
}

interface Report {
  totalScore?: number;
  passed?: boolean;
  passingThreshold?: number;
  evaluatedAt?: string;
  results?: EvalResult[];
}

export default function EvalReport({ report, isStale }: { report: Report | Record<string, unknown>; isStale?: boolean }) {
  const r = report as Report;
  const totalPct = ((r.totalScore ?? 0) * 100).toFixed(1);
  const thresholdPct = ((r.passingThreshold ?? 0.7) * 100).toFixed(0);

  return (
    <section style={card}>
      <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>
        🧪 Eval Report
        <span style={{
          marginLeft: 8,
          fontSize: 14,
          color: r.passed ? '#3fb950' : '#f85149',
        }}>
          {r.passed ? '✅' : '❌'} {totalPct}% (threshold: {thresholdPct}%)
        </span>
      </h2>
      {isStale && (
        <div style={{
          backgroundColor: '#2d1b00',
          border: '1px solid #d29922',
          borderRadius: 6,
          padding: '8px 12px',
          marginBottom: 12,
          fontSize: 13,
          color: '#d29922',
        }}>
          ⚠️ Eval report is older than the latest analysis — re-run to update.
        </div>
      )}
      {r.evaluatedAt && (
        <p style={{ fontSize: 12, color: 'var(--color-muted)', margin: '0 0 12px' }}>
          Evaluated: {new Date(r.evaluatedAt).toLocaleString()}
        </p>
      )}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={th}>Metric</th>
            <th style={th}>Score</th>
            <th style={th}>Status</th>
          </tr>
        </thead>
        <tbody>
          {(r.results ?? []).map((result, i) => {
            const pct = ((result.score ?? 0) * 100).toFixed(1);
            return (
              <tr key={i}>
                <td style={td}>{result.testName}</td>
                <td style={{ ...td, fontFamily: 'monospace' }}>{pct}%</td>
                <td style={td}>{result.passed ? '✅ Pass' : '❌ Fail'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
