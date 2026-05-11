import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DataTable } from '../DataTable';

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'age', label: 'Age', align: 'right' as const },
];

const rows = [
  { name: 'Alice', age: 30 },
  { name: 'Bob', age: 25 },
  { name: 'Carol', age: 35 },
];

describe('DataTable', () => {
  it('renders column headers', () => {
    render(<DataTable columns={columns} rows={rows} />);
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Age')).toBeInTheDocument();
  });

  it('renders correct number of rows', () => {
    const { container } = render(<DataTable columns={columns} rows={rows} />);
    const bodyRows = container.querySelectorAll('tbody tr');
    expect(bodyRows).toHaveLength(3);
  });

  it('uses custom render function', () => {
    const cols = [
      { key: 'name', label: 'Name', render: (v: unknown) => <strong>{String(v)}</strong> },
    ];
    render(<DataTable columns={cols} rows={[{ name: 'Test' }]} />);
    expect(screen.getByText('Test').tagName).toBe('STRONG');
  });

  it('respects align prop on header', () => {
    const { container } = render(<DataTable columns={columns} rows={rows} />);
    const ths = container.querySelectorAll('th');
    expect(ths[1]?.style.textAlign).toBe('right');
  });

  it('shows empty message when no rows', () => {
    render(<DataTable columns={columns} rows={[]} emptyMessage="Nothing here" />);
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });

  it('applies striped backgrounds', () => {
    const { container } = render(<DataTable columns={columns} rows={rows} striped />);
    const bodyRows = container.querySelectorAll('tbody tr');
    expect(bodyRows[0]?.style.backgroundColor).toBeTruthy();
  });
});
