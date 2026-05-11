import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatCard } from '../StatCard';

describe('StatCard', () => {
  it('renders icon, label, and value', () => {
    render(<StatCard icon="📄" label="Sources" value={42} />);
    expect(screen.getByText(/📄/)).toBeInTheDocument();
    expect(screen.getByText(/Sources/)).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('renders value with large font weight', () => {
    render(<StatCard icon="📄" label="Sources" value={10} />);
    const value = screen.getByText('10');
    expect(value.style.fontWeight).toBe('600');
  });

  it('applies box styling', () => {
    const { container } = render(<StatCard icon="📄" label="Sources" value={0} />);
    const box = container.firstChild as HTMLElement;
    expect(box.style.borderRadius).toBe('6px');
  });
});
