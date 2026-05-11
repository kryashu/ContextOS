import type { CSSProperties, ReactNode } from 'react';

interface BannerProps {
  variant: 'warning' | 'error' | 'info';
  children: ReactNode;
}

const variantMap: Record<BannerProps['variant'], { border: string; bg: string; color: string }> = {
  warning: { border: '#d29922', bg: '#2d2200', color: '#d29922' },
  error: { border: '#f85149', bg: '#2d0000', color: '#f85149' },
  info: { border: '#6e7681', bg: 'transparent', color: '#8b949e' },
};

export function Banner({ variant, children }: BannerProps) {
  const v = variantMap[variant];
  const style: CSSProperties = {
    border: `1px solid ${v.border}`,
    borderRadius: 6,
    padding: '8px 12px',
    backgroundColor: v.bg,
    color: v.color,
    fontSize: 13,
  };

  return (
    <div style={style} role={variant === 'info' ? undefined : 'alert'}>
      {children}
    </div>
  );
}
