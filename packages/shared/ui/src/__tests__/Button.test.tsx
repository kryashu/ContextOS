import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '../Button';

describe('Button', () => {
  it('renders children text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('renders icon + text when both provided', () => {
    render(<Button icon="🗑️">Delete</Button>);
    expect(screen.getByText(/🗑️/)).toBeInTheDocument();
    expect(screen.getByText(/Delete/)).toBeInTheDocument();
  });

  it('renders icon-only when no children', () => {
    render(<Button variant="icon" icon="🗑️" title="Delete" />);
    const btn = screen.getByTitle('Delete');
    expect(btn.textContent).toContain('🗑️');
  });

  it('renders text-only when no icon', () => {
    render(<Button>Cancel</Button>);
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('applies primary variant bg', () => {
    render(<Button variant="primary">Go</Button>);
    const btn = screen.getByRole('button');
    expect(btn.style.backgroundColor).toBe('rgb(35, 134, 54)');
  });

  it('applies danger variant bg', () => {
    render(<Button variant="danger">Delete</Button>);
    const btn = screen.getByRole('button');
    expect(btn.style.backgroundColor).toBe('rgb(218, 54, 51)');
  });

  it('applies icon variant with no border', () => {
    render(<Button variant="icon" icon="🗑️" title="Del" />);
    const btn = screen.getByTitle('Del');
    const style = btn.getAttribute('style') ?? '';
    // jsdom drops "border: none" — verify no border-width/border-style is applied
    expect(style).not.toContain('border:');
    expect(btn.style.background).toBe('none');
  });

  it('shows disabled cursor when disabled', () => {
    render(<Button disabled>Go</Button>);
    const btn = screen.getByRole('button');
    expect(btn.style.cursor).toBe('not-allowed');
    expect(btn).toBeDisabled();
  });

  it('shows loading state with ⏳', () => {
    render(<Button loading icon="▶">Run</Button>);
    const btn = screen.getByRole('button');
    expect(btn.textContent).toContain('⏳');
    expect(btn).toBeDisabled();
  });

  it('fires onClick when not disabled', () => {
    const handler = vi.fn();
    render(<Button onClick={handler}>Go</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(handler).toHaveBeenCalledOnce();
  });

  it('does not fire onClick when disabled', () => {
    const handler = vi.fn();
    render(<Button onClick={handler} disabled>Go</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(handler).not.toHaveBeenCalled();
  });

  it('renders as <a> when as="a"', () => {
    render(<Button as="a" href="/test">Link</Button>);
    const el = screen.getByText('Link');
    expect(el.tagName).toBe('A');
    expect(el.getAttribute('href')).toBe('/test');
  });
});
