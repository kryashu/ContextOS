import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Input } from '../Input';

describe('Input', () => {
  it('renders with correct type', () => {
    render(<Input type="email" aria-label="email" />);
    expect(screen.getByRole('textbox')).toHaveAttribute('type', 'email');
  });

  it('applies themed styles', () => {
    const { container } = render(<Input aria-label="test" />);
    const input = container.querySelector('input')!;
    expect(input.style.borderRadius).toBe('6px');
  });

  it('forwards HTML attributes', () => {
    render(<Input placeholder="Enter name" required maxLength={100} aria-label="name" />);
    const input = screen.getByPlaceholderText('Enter name');
    expect(input).toBeRequired();
    expect(input).toHaveAttribute('maxlength', '100');
  });

  it('fires onChange', () => {
    const handler = vi.fn();
    render(<Input onChange={handler} aria-label="test" />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'hello' } });
    expect(handler).toHaveBeenCalled();
  });
});
