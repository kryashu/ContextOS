import type { CSSProperties } from 'react';

interface StatCardProps {
  icon: string;
  label: string;
  value: string | number;
}

const boxStyle: CSSProperties = {
  backgroundColor: 'var(--color-bg)',
  border: '1px solid var(--color-border)',
  borderRadius: 6,
  padding: '12px 16px',
  minWidth: 100,
};

export function StatCard({ icon, label, value }: StatCardProps) {
  return (
    <div style={boxStyle}>
      <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>
        {icon} {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--color-fg)' }}>
        {String(value)}
      </div>
    </div>
  );
}
