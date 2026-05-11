import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from '../Badge';

describe('Badge', () => {
  it('renders text', () => {
    render(<Badge color="#238636">active</Badge>);
    expect(screen.getByText('active')).toBeInTheDocument();
  });

  it('applies color as background', () => {
    const { container } = render(<Badge color="#f85149">error</Badge>);
    const el = container.firstChild as HTMLElement;
    expect(el.style.backgroundColor).toBe('rgb(248, 81, 73)');
  });

  it('renders as inline span', () => {
    const { container } = render(<Badge color="#000">test</Badge>);
    expect(container.firstChild?.nodeName).toBe('SPAN');
  });
});
