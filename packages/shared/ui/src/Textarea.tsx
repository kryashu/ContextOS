import type { CSSProperties, TextareaHTMLAttributes } from 'react';

const textareaStyle: CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  fontSize: 14,
  backgroundColor: 'var(--color-input-bg)',
  border: '1px solid var(--color-border)',
  borderRadius: 6,
  color: 'var(--color-fg)',
  outline: 'none',
  resize: 'vertical',
  boxSizing: 'border-box',
};

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  textareaStyle?: CSSProperties;
};

export function Textarea({ textareaStyle: custom, style, ...props }: TextareaProps) {
  return <textarea style={{ ...textareaStyle, ...custom, ...style }} {...props} />;
}
