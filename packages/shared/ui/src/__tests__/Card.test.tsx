import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card } from '../Card';

describe('Card', () => {
  it('renders children', () => {
    render(<Card>Hello</Card>);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('renders as section by default', () => {
    const { container } = render(<Card>Content</Card>);
    expect(container.querySelector('section')).not.toBeNull();
  });

  it('renders as div when as="div"', () => {
    const { container } = render(<Card as="div">Content</Card>);
    expect(container.querySelector('div')).not.toBeNull();
    expect(container.querySelector('section')).toBeNull();
  });

  it('merges custom style', () => {
    const { container } = render(<Card style={{ padding: 32 }}>Content</Card>);
    const el = container.firstChild as HTMLElement;
    expect(el.style.padding).toBe('32px');
    expect(el.style.borderRadius).toBe('8px');
  });
});
