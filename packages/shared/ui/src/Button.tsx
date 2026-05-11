import type { CSSProperties, ReactNode } from 'react';

interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'danger' | 'action' | 'ghost' | 'icon';
  icon?: string;
  children?: ReactNode;
  disabled?: boolean;
  loading?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  type?: 'button' | 'submit' | 'reset';
  title?: string;
  as?: 'button' | 'a';
  href?: string;
  style?: CSSProperties;
}

const variantStyles: Record<string, CSSProperties> = {
  primary: {
    backgroundColor: '#238636',
    color: '#fff',
    border: '1px solid var(--color-border)',
    borderRadius: 6,
    padding: '8px 16px',
    fontSize: 14,
    fontWeight: 600,
  },
  secondary: {
    backgroundColor: 'var(--color-border-subtle)',
    color: 'var(--color-fg)',
    border: '1px solid var(--color-border)',
    borderRadius: 6,
    padding: '8px 16px',
    fontSize: 14,
  },
  danger: {
    backgroundColor: '#da3633',
    color: '#fff',
    border: '1px solid #f85149',
    borderRadius: 6,
    padding: '8px 16px',
    fontSize: 14,
    fontWeight: 600,
  },
  action: {
    backgroundColor: '#1f6feb',
    color: '#fff',
    border: '1px solid var(--color-border)',
    borderRadius: 6,
    padding: '8px 16px',
    fontSize: 14,
    fontWeight: 600,
  },
  ghost: {
    background: 'transparent',
    color: 'var(--color-fg)',
    border: '1px solid var(--color-border)',
    borderRadius: 6,
    padding: '4px 8px',
    fontSize: 18,
    lineHeight: 1,
  },
  icon: {
    background: 'none',
    border: 'none',
    padding: '2px 6px',
    borderRadius: 4,
    fontSize: 16,
    color: '#f85149',
    lineHeight: 1,
  },
};

const disabledBg: Record<string, string> = {
  primary: 'var(--color-btn-disabled)',
  secondary: 'var(--color-btn-disabled)',
  danger: 'var(--color-btn-disabled)',
  action: 'var(--color-btn-disabled)',
  ghost: 'transparent',
  icon: 'none',
};

export function Button({
  variant = 'primary',
  icon,
  children,
  disabled = false,
  loading = false,
  onClick,
  type = 'button',
  title,
  as: Element = 'button',
  href,
  style: customStyle,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const displayIcon = loading ? '⏳' : icon;

  const base = variantStyles[variant] ?? variantStyles.primary;
  const style: CSSProperties = {
    ...base,
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    opacity: variant === 'icon' && isDisabled ? 0.5 : undefined,
    ...(isDisabled && variant !== 'ghost' && variant !== 'icon'
      ? { backgroundColor: disabledBg[variant] }
      : {}),
    ...customStyle,
  };

  const content = (
    <>
      {displayIcon && <span>{displayIcon}</span>}
      {displayIcon && children ? ' ' : null}
      {children}
    </>
  );

  if (Element === 'a') {
    return (
      <a href={href} style={style} title={title} onClick={onClick}>
        {content}
      </a>
    );
  }

  return (
    <button
      type={type}
      disabled={isDisabled}
      onClick={onClick}
      title={title}
      style={style}
    >
      {content}
    </button>
  );
}
