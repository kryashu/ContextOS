import type { CSSProperties, InputHTMLAttributes } from 'react';

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  fontSize: 14,
  backgroundColor: 'var(--color-input-bg)',
  border: '1px solid var(--color-border)',
  borderRadius: 6,
  color: 'var(--color-fg)',
  outline: 'none',
  boxSizing: 'border-box',
};

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  inputStyle?: CSSProperties;
};

export function Input({ inputStyle: custom, style, ...props }: InputProps) {
  return <input style={{ ...inputStyle, ...custom, ...style }} {...props} />;
}
