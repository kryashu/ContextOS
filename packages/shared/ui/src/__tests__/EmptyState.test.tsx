import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmptyState } from '../EmptyState';

describe('EmptyState', () => {
  it('renders title', () => {
    render(<EmptyState title="No data" />);
    expect(screen.getByText('No data')).toBeInTheDocument();
  });

  it('renders subtitle when provided', () => {
    render(<EmptyState title="No data" subtitle="Upload files first" />);
    expect(screen.getByText('Upload files first')).toBeInTheDocument();
  });

  it('omits subtitle when not provided', () => {
    const { container } = render(<EmptyState title="No data" />);
    const paragraphs = container.querySelectorAll('p');
    expect(paragraphs).toHaveLength(1);
  });

  it('renders icon when provided', () => {
    render(<EmptyState icon="📁" title="Empty" />);
    expect(screen.getByText('📁')).toBeInTheDocument();
  });
});
