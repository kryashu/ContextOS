import { Card, Badge } from '@contextos/ui';

const severityColors: Record<string, string> = {
  critical: '#f85149',
  high: '#f0883e',
  medium: '#d29922',
  low: '#3fb950',
  info: '#58a6ff',
};

interface Finding {
  id?: string;
  type?: string;
  severity?: string;
  title?: string;
  description?: string;
  recommendation?: string;
  affectedSources?: Array<{ fileName?: string }>;
}

export default function FindingsPanel({ findings }: { findings: Finding[] }) {
  return (
    <Card>
      <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>⚠️ Findings ({findings.length})</h2>
      {findings.length === 0 && (
        <p style={{ color: 'var(--color-muted)', margin: 0 }}>No quality issues detected.</p>
      )}
      {findings.map((f, i) => (
        <div key={f.id ?? i} style={{
          border: `1px solid ${severityColors[f.severity ?? 'info'] ?? 'var(--color-border)'}`,
          borderRadius: 6,
          padding: 12,
          marginBottom: i < findings.length - 1 ? 8 : 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Badge color={severityColors[f.severity ?? 'info'] ?? 'var(--color-border)'}>
              {f.severity}
            </Badge>
            <span style={{ fontWeight: 500, fontSize: 14 }}>{f.title}</span>
          </div>
          {f.description && <p style={{ margin: '4px 0', fontSize: 13, color: 'var(--color-muted)' }}>{f.description}</p>}
          {f.recommendation && (
            <p style={{ margin: '4px 0', fontSize: 13 }}>
              💡 <em>{f.recommendation}</em>
            </p>
          )}
          {f.affectedSources && f.affectedSources.length > 0 && (
            <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 4 }}>
              📎 {f.affectedSources.map(s => s.fileName).join(', ')}
            </div>
          )}
        </div>
      ))}
    </Card>
  );
}
