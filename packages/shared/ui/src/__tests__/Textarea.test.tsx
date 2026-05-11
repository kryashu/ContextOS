import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Textarea } from '../Textarea';

describe('Textarea', () => {
  it('renders with correct rows', () => {
    render(<Textarea rows={5} aria-label="desc" />);
    const ta = screen.getByRole('textbox');
    expect(ta).toHaveAttribute('rows', '5');
  });

  it('applies themed styles', () => {
    const { container } = render(<Textarea aria-label="desc" />);
    const ta = container.querySelector('textarea')!;
    expect(ta.style.borderRadius).toBe('6px');
  });

  it('fires onChange', () => {
    const handler = vi.fn();
    render(<Textarea onChange={handler} aria-label="desc" />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'hello' } });
    expect(handler).toHaveBeenCalled();
  });
});
