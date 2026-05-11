import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Select } from '../Select';

const options = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
  { value: 'c', label: 'Gamma' },
];

describe('Select', () => {
  it('renders label text', () => {
    render(<Select label="Metric" value="a" onChange={() => {}} options={options} />);
    expect(screen.getByText('Metric')).toBeInTheDocument();
  });

  it('renders all options', () => {
    render(<Select label="Metric" value="a" onChange={() => {}} options={options} />);
    expect(screen.getAllByRole('option')).toHaveLength(3);
  });

  it('renders placeholder option', () => {
    render(<Select label="Metric" value="" onChange={() => {}} options={options} placeholder="Pick..." />);
    expect(screen.getAllByRole('option')).toHaveLength(4);
    expect(screen.getByText('Pick...')).toBeInTheDocument();
  });

  it('calls onChange with selected value', () => {
    const handler = vi.fn();
    render(<Select label="Metric" value="a" onChange={handler} options={options} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'b' } });
    expect(handler).toHaveBeenCalledWith('b');
  });

  it('disables select when disabled', () => {
    render(<Select label="Metric" value="a" onChange={() => {}} options={options} disabled />);
    expect(screen.getByRole('combobox')).toBeDisabled();
  });

  it('associates label with select', () => {
    render(<Select label="Metric" value="a" onChange={() => {}} options={options} />);
    const select = screen.getByRole('combobox');
    const label = screen.getByText('Metric');
    expect(label.getAttribute('for')).toBe(select.id);
  });
});
