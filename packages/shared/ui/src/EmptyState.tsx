import type { CSSProperties } from 'react';

interface EmptyStateProps {
  icon?: string;
  title: string;
  subtitle?: string;
}

const containerStyle: CSSProperties = {
  border: '1px solid var(--color-border)',
  borderRadius: 8,
  padding: 32,
  textAlign: 'center',
  color: 'var(--color-muted)',
};

export function EmptyState({ icon, title, subtitle }: EmptyStateProps) {
  return (
    <div style={containerStyle}>
      {icon && <div style={{ fontSize: 24, marginBottom: 8 }}>{icon}</div>}
      <p style={{ fontSize: 18, margin: '0 0 8px' }}>{title}</p>
      {subtitle && <p style={{ margin: 0 }}>{subtitle}</p>}
    </div>
  );
}
