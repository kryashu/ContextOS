'use client';

import type { CSSProperties } from 'react';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  disabled?: boolean;
  placeholder?: string;
  id?: string;
}

const selectStyle: CSSProperties = {
  backgroundColor: 'var(--color-input-bg)',
  color: 'var(--color-fg)',
  border: '1px solid var(--color-border)',
  borderRadius: 6,
  padding: '6px 10px',
  fontSize: 14,
  minWidth: 140,
};

const labelStyle: CSSProperties = {
  fontSize: 12,
  color: 'var(--color-muted)',
  marginBottom: 4,
  display: 'block',
};

export function Select({
  label,
  value,
  onChange,
  options,
  disabled = false,
  placeholder,
  id: providedId,
}: SelectProps) {
  const id = providedId ?? `select-${label.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <div>
      <label htmlFor={id} style={labelStyle}>
        {label}
      </label>
      <select
        id={id}
        style={selectStyle}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
