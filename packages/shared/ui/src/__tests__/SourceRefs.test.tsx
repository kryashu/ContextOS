import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SourceRefs } from '../SourceRefs';

describe('SourceRefs', () => {
  it('renders dash for undefined refs', () => {
    render(<SourceRefs />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('renders dash for empty refs', () => {
    render(<SourceRefs refs={[]} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('renders comma-separated names', () => {
    const refs = [{ fileName: 'a.md' }, { fileName: 'b.csv' }, { fileName: 'c.json' }];
    const { container } = render(<SourceRefs refs={refs} />);
    expect(container.textContent).toContain('a.md');
    expect(container.textContent).toContain('b.csv');
    expect(container.textContent).toContain('c.json');
  });

  it('deduplicates repeated names', () => {
    const refs = [{ fileName: 'a.md' }, { fileName: 'a.md' }, { fileName: 'b.csv' }];
    const { container } = render(<SourceRefs refs={refs} />);
    const text = container.textContent ?? '';
    // Should only appear once
    expect(text.split('a.md').length - 1).toBe(1);
  });
});
