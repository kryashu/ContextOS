import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Banner } from '../Banner';

describe('Banner', () => {
  it('renders children', () => {
    render(<Banner variant="warning">Caution!</Banner>);
    expect(screen.getByText('Caution!')).toBeInTheDocument();
  });

  it('applies warning colors', () => {
    const { container } = render(<Banner variant="warning">Warn</Banner>);
    const el = container.firstChild as HTMLElement;
    expect(el.style.color).toBe('rgb(210, 153, 34)');
  });

  it('applies error colors', () => {
    const { container } = render(<Banner variant="error">Err</Banner>);
    const el = container.firstChild as HTMLElement;
    expect(el.style.color).toBe('rgb(248, 81, 73)');
  });

  it('has alert role for warning/error', () => {
    render(<Banner variant="error">Err</Banner>);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('does not have alert role for info', () => {
    const { container } = render(<Banner variant="info">Info</Banner>);
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });
});
