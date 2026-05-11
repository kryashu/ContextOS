interface SourceRef {
  fileName?: string;
}

interface SourceRefsProps {
  refs?: SourceRef[];
}

export function SourceRefs({ refs }: SourceRefsProps) {
  if (!refs || refs.length === 0) {
    return <span style={{ color: 'var(--color-muted)' }}>—</span>;
  }
  const unique = [...new Set(refs.map((r) => r.fileName))];
  return (
    <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>
      {unique.map((f, i) => (
        <span key={i}>
          {i > 0 && ', '}
          <span style={{ fontFamily: 'monospace' }}>{f}</span>
        </span>
      ))}
    </span>
  );
}
