import type { CSSProperties, ReactNode } from 'react';

const defaultStyle: CSSProperties = {
  border: '1px solid var(--color-border)',
  borderRadius: 8,
  padding: 16,
  backgroundColor: 'var(--color-surface)',
};

interface CardProps {
  children: ReactNode;
  style?: CSSProperties;
  as?: 'section' | 'div';
}

export function Card({ children, style, as: Element = 'section' }: CardProps) {
  return <Element style={{ ...defaultStyle, ...style }}>{children}</Element>;
}
