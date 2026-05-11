import type { CSSProperties, ReactNode } from 'react';

interface BadgeProps {
  color: string;
  children: ReactNode;
}

export function Badge({ color, children }: BadgeProps) {
  const style: CSSProperties = {
    display: 'inline-block',
    fontSize: 11,
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: 4,
    backgroundColor: color,
    color: '#fff',
    textTransform: 'uppercase',
  };

  return <span style={style}>{children}</span>;
}
