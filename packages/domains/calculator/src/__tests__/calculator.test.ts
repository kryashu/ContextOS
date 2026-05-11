import { describe, it, expect } from 'vitest';
import { TableCalculator } from '../calculator.js';
import type { NormalizedObservation, CalculationRequest } from '@contextos/types';

// ── Test fixtures ──────────────────────────────────────────────────

function obs(overrides: Partial<NormalizedObservation> = {}): NormalizedObservation {
  return {
    sheet: 'Sheet1',
    section: 'Section A',
    variety: 'Tolerant variety',
    plantPart: 'Shoot',
    treatment: 'CK',
    metric: 'GABA',
    value: 10,
    unit: '',
    sourceCell: 'B5',
    sourceRange: 'A1:G10',
    ...overrides,
  };
}

const FIXTURES: NormalizedObservation[] = [
  obs({ treatment: 'CK', plantPart: 'Shoot', value: 10, sourceCell: 'B5' }),
  obs({ treatment: 'CK', plantPart: 'Root', value: 20, sourceCell: 'B6' }),
  obs({ treatment: 'As', plantPart: 'Shoot', value: 30, sourceCell: 'C5' }),
  obs({ treatment: 'As', plantPart: 'Root', value: 40, sourceCell: 'C6' }),
  obs({ treatment: 'As+GABA', plantPart: 'Shoot', value: 50, sourceCell: 'D5' }),
  obs({ treatment: 'As+GABA', plantPart: 'Root', value: 60, sourceCell: 'D6' }),
  // Different metric
  obs({ metric: 'Proline', treatment: 'CK', value: 100, sourceCell: 'E5' }),
  obs({ metric: 'Proline', treatment: 'As', value: 200, sourceCell: 'E6' }),
  // Different section
  obs({ section: 'Section B', treatment: 'CK', value: 5, sourceCell: 'F5' }),
];

// ── Tests ──────────────────────────────────────────────────────────

describe('TableCalculator', () => {
  // ── DoD: average GABA by treatment ──────────────────────────────
  it('calculates average GABA by treatment', () => {
    const calc = new TableCalculator(FIXTURES);
    const result = calc.calculate({
      metric: 'GABA',
      operation: 'average',
      groupBy: 'treatment',
    });

    expect(result.warnings).toHaveLength(0);
    expect(result.rows).toHaveLength(3);

    const ck = result.rows.find(r => r.group === 'CK');
    const as = result.rows.find(r => r.group === 'As');
    const asGaba = result.rows.find(r => r.group === 'As+GABA');

    // CK: (10 + 20 + 5) / 3 = 11.666...
    expect(ck).toBeDefined();
    expect(ck!.value).toBeCloseTo(11.667, 2);
    expect(ck!.count).toBe(3);

    // As: (30 + 40) / 2 = 35
    expect(as).toBeDefined();
    expect(as!.value).toBe(35);
    expect(as!.count).toBe(2);

    // As+GABA: (50 + 60) / 2 = 55
    expect(asGaba).toBeDefined();
    expect(asGaba!.value).toBe(55);
    expect(asGaba!.count).toBe(2);
  });

  // ── DoD: groupBy plantPart ──────────────────────────────────────
  it('groups by plantPart', () => {
    const calc = new TableCalculator(FIXTURES);
    const result = calc.calculate({
      metric: 'GABA',
      operation: 'sum',
      groupBy: 'plantPart',
    });

    const shoot = result.rows.find(r => r.group === 'Shoot');
    const root = result.rows.find(r => r.group === 'Root');

    // Shoot: 10 + 30 + 50 + 5 (Section B) = 95
    expect(shoot!.value).toBe(95);
    // Root: 20 + 40 + 60 = 120
    expect(root!.value).toBe(120);
  });

  // ── DoD: compound groupBy treatment+plantPart ───────────────────
  it('groups by treatment+plantPart compound key', () => {
    const calc = new TableCalculator(FIXTURES);
    const result = calc.calculate({
      metric: 'GABA',
      operation: 'average',
      groupBy: 'treatment+plantPart',
    });

    // CK has 3 GABA obs: Shoot(10), Root(20), Shoot-SectionB(5)
    const ckShoot = result.rows.find(r => r.group === 'CK | Shoot');
    const ckRoot = result.rows.find(r => r.group === 'CK | Root');
    const asShoot = result.rows.find(r => r.group === 'As | Shoot');

    expect(ckShoot).toBeDefined();
    expect(ckShoot!.value).toBeCloseTo(7.5, 2); // (10 + 5) / 2
    expect(ckRoot!.value).toBe(20);
    expect(asShoot!.value).toBe(30);
  });

  // ── DoD: filters ────────────────────────────────────────────────
  it('applies filters', () => {
    const calc = new TableCalculator(FIXTURES);
    const result = calc.calculate({
      metric: 'GABA',
      operation: 'average',
      groupBy: 'treatment',
      filters: [{ field: 'section', operator: 'eq', value: 'Section A' }],
    });

    // Section B observation (value=5) excluded — CK now only has 2 observations
    const ck = result.rows.find(r => r.group === 'CK');
    expect(ck!.value).toBe(15); // (10 + 20) / 2
    expect(ck!.count).toBe(2);
  });

  it('applies "in" filter with array', () => {
    const calc = new TableCalculator(FIXTURES);
    const result = calc.calculate({
      metric: 'GABA',
      operation: 'count',
      filters: [{ field: 'treatment', operator: 'in', value: ['CK', 'As'] }],
    });

    // CK: 3, As: 2 => 5 total
    expect(result.rows[0]!.value).toBe(5);
  });

  // ── Operations ──────────────────────────────────────────────────
  it('count operation', () => {
    const calc = new TableCalculator(FIXTURES);
    const result = calc.calculate({ metric: 'GABA', operation: 'count' });
    expect(result.rows[0]!.value).toBe(7); // 7 GABA observations
  });

  it('sum operation', () => {
    const calc = new TableCalculator(FIXTURES);
    const result = calc.calculate({ metric: 'GABA', operation: 'sum' });
    expect(result.rows[0]!.value).toBe(10 + 20 + 30 + 40 + 50 + 60 + 5);
  });

  it('min operation', () => {
    const calc = new TableCalculator(FIXTURES);
    const result = calc.calculate({ metric: 'GABA', operation: 'min' });
    expect(result.rows[0]!.value).toBe(5);
  });

  it('max operation', () => {
    const calc = new TableCalculator(FIXTURES);
    const result = calc.calculate({ metric: 'GABA', operation: 'max' });
    expect(result.rows[0]!.value).toBe(60);
  });

  it('median operation (odd count)', () => {
    const calc = new TableCalculator(FIXTURES);
    const result = calc.calculate({ metric: 'GABA', operation: 'median' });
    // sorted: 5, 10, 20, 30, 40, 50, 60 → median = 30
    expect(result.rows[0]!.value).toBe(30);
  });

  it('median operation (even count)', () => {
    const calc = new TableCalculator(FIXTURES);
    const result = calc.calculate({ metric: 'Proline', operation: 'median' });
    // sorted: 100, 200 → median = 150
    expect(result.rows[0]!.value).toBe(150);
  });

  // ── DoD: unknown metric → warning, not crash ───────────────────
  it('unknown metric returns warning and empty rows', () => {
    const calc = new TableCalculator(FIXTURES);
    const result = calc.calculate({ metric: 'NonExistent', operation: 'average' });

    expect(result.rows).toHaveLength(0);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('No observations found');
    expect(result.warnings[0]).toContain('NonExistent');
  });

  // ── DoD: null/non-numeric values skipped ────────────────────────
  it('skips null values for numeric operations', () => {
    const data = [
      obs({ value: 10 }),
      obs({ value: null }),
      obs({ value: 30 }),
    ];
    const calc = new TableCalculator(data);
    const result = calc.calculate({ metric: 'GABA', operation: 'average' });

    expect(result.rows[0]!.value).toBe(20); // (10 + 30) / 2
    expect(result.rows[0]!.count).toBe(2);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('null/non-numeric');
  });

  it('null values counted in count operation', () => {
    const data = [
      obs({ value: 10 }),
      obs({ value: null }),
    ];
    const calc = new TableCalculator(data);
    const result = calc.calculate({ metric: 'GABA', operation: 'count' });

    // count includes all observations regardless of value
    expect(result.rows[0]!.value).toBe(2);
  });

  // ── DoD: sourceRefs populated ───────────────────────────────────
  it('result rows include sourceRefs with sourceCell and sourceRange', () => {
    const calc = new TableCalculator(FIXTURES);
    const result = calc.calculate({
      metric: 'GABA',
      operation: 'average',
      groupBy: 'treatment',
    });

    const ck = result.rows.find(r => r.group === 'CK');
    expect(ck!.sourceRefs.length).toBeGreaterThan(0);
    expect(ck!.sourceRefs[0]).toHaveProperty('sourceCell');
    expect(ck!.sourceRefs[0]).toHaveProperty('sourceRange');
  });

  // ── topN / limit ────────────────────────────────────────────────
  it('limit restricts number of result rows', () => {
    const calc = new TableCalculator(FIXTURES);
    const result = calc.calculate({
      metric: 'GABA',
      operation: 'sum',
      groupBy: 'treatment',
      sort: { field: 'value', direction: 'desc' },
      limit: 2,
    });

    expect(result.rows).toHaveLength(2);
    // Highest sum first (desc)
    expect(result.rows[0]!.value).toBeGreaterThanOrEqual(result.rows[1]!.value);
  });

  // ── sort ────────────────────────────────────────────────────────
  it('sort ascending by value', () => {
    const calc = new TableCalculator(FIXTURES);
    const result = calc.calculate({
      metric: 'GABA',
      operation: 'sum',
      groupBy: 'treatment',
      sort: { field: 'value', direction: 'asc' },
    });

    for (let i = 1; i < result.rows.length; i++) {
      expect(result.rows[i]!.value).toBeGreaterThanOrEqual(result.rows[i - 1]!.value);
    }
  });

  // ── empty observations ──────────────────────────────────────────
  it('empty observations array returns warning', () => {
    const calc = new TableCalculator([]);
    const result = calc.calculate({ metric: 'GABA', operation: 'average' });

    expect(result.rows).toHaveLength(0);
    expect(result.warnings).toHaveLength(1);
  });

  // ── getAvailableMetrics / getAvailableValues ────────────────────
  it('getAvailableMetrics returns unique sorted metrics', () => {
    const calc = new TableCalculator(FIXTURES);
    expect(calc.getAvailableMetrics()).toEqual(['GABA', 'Proline']);
  });

  it('getAvailableValues returns unique sorted values for a field', () => {
    const calc = new TableCalculator(FIXTURES);
    expect(calc.getAvailableValues('treatment')).toEqual(['As', 'As+GABA', 'CK']);
  });

  it('getAvailableValues returns empty for non-groupable field', () => {
    const calc = new TableCalculator(FIXTURES);
    expect(calc.getAvailableValues('bogusField')).toEqual([]);
  });

  // ── result metadata ─────────────────────────────────────────────
  it('result contains correct metadata', () => {
    const calc = new TableCalculator(FIXTURES);
    const result = calc.calculate({
      metric: 'GABA',
      operation: 'average',
      groupBy: 'treatment',
    });

    expect(result.calculationId).toMatch(/^calc_\d+$/);
    expect(result.operation).toBe('average');
    expect(result.metric).toBe('GABA');
    expect(result.groupBy).toBe('treatment');
    expect(result.generatedAt).toBeTruthy();
  });

  // ── all filters excluded ────────────────────────────────────────
  it('returns warning when filters exclude everything', () => {
    const calc = new TableCalculator(FIXTURES);
    const result = calc.calculate({
      metric: 'GABA',
      operation: 'average',
      filters: [{ field: 'treatment', operator: 'eq', value: 'NoSuchTreatment' }],
    });

    expect(result.rows).toHaveLength(0);
    expect(result.warnings[0]).toContain('excluded by the applied filters');
  });
});

// ── Comparison operations ─────────────────────────────────────────
describe('TableCalculator — comparison operations', () => {
  // ── subtract: target avg - baseline avg ─────────────────────────
  it('subtract computes target average minus baseline average', () => {
    const calc = new TableCalculator(FIXTURES);
    const result = calc.calculate({
      metric: 'GABA',
      operation: 'subtract',
      compareBy: 'treatment',
      baseline: 'CK',
      target: 'As',
    });

    // CK avg GABA = (10 + 20 + 5) / 3 = 11.667, As avg GABA = (30 + 40) / 2 = 35
    // subtract: 35 - 11.667 = 23.333
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]!.value).toBeCloseTo(23.333, 2);
    expect(result.warnings).toHaveLength(0);
  });

  // ── subtract with groupBy ──────────────────────────────────────
  it('subtract with groupBy computes per-group differences', () => {
    const calc = new TableCalculator(FIXTURES);
    const result = calc.calculate({
      metric: 'GABA',
      operation: 'subtract',
      compareBy: 'treatment',
      baseline: 'CK',
      target: 'As',
      groupBy: 'plantPart',
    });

    const shoot = result.rows.find(r => r.group === 'Shoot');
    const root = result.rows.find(r => r.group === 'Root');

    // CK Shoot avg = (10 + 5) / 2 = 7.5, As Shoot avg = 30 → 30 - 7.5 = 22.5
    expect(shoot).toBeDefined();
    expect(shoot!.value).toBeCloseTo(22.5, 2);

    // CK Root avg = 20, As Root avg = 40 → 40 - 20 = 20
    expect(root).toBeDefined();
    expect(root!.value).toBe(20);
  });

  // ── difference is an alias for subtract ─────────────────────────
  it('difference operation behaves like subtract', () => {
    const calc = new TableCalculator(FIXTURES);
    const result = calc.calculate({
      metric: 'GABA',
      operation: 'difference',
      compareBy: 'treatment',
      baseline: 'CK',
      target: 'As',
    });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]!.value).toBeCloseTo(23.333, 2);
  });

  // ── percentage_change ───────────────────────────────────────────
  it('percentage_change computes ((target - baseline) / |baseline|) * 100', () => {
    const calc = new TableCalculator(FIXTURES);
    const result = calc.calculate({
      metric: 'Proline',
      operation: 'percentage_change',
      compareBy: 'treatment',
      baseline: 'CK',
      target: 'As',
    });

    // CK Proline avg = 100, As Proline avg = 200
    // ((200 - 100) / 100) * 100 = 100%
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]!.value).toBe(100);
    expect(result.warnings).toHaveLength(0);
  });

  // ── percentage_change with negative baseline ────────────────────
  it('percentage_change uses abs(baseline) for denominator', () => {
    const data = [
      obs({ treatment: 'A', value: -50 }),
      obs({ treatment: 'B', value: 50 }),
    ];
    const calc = new TableCalculator(data);
    const result = calc.calculate({
      metric: 'GABA',
      operation: 'percentage_change',
      compareBy: 'treatment',
      baseline: 'A',
      target: 'B',
    });

    // ((50 - (-50)) / |-50|) * 100 = 200%
    expect(result.rows[0]!.value).toBe(200);
  });

  // ── percentage_change with zero baseline → warning ──────────────
  it('percentage_change warns and skips when baseline average is 0', () => {
    const data = [
      obs({ treatment: 'A', value: 0 }),
      obs({ treatment: 'B', value: 50 }),
    ];
    const calc = new TableCalculator(data);
    const result = calc.calculate({
      metric: 'GABA',
      operation: 'percentage_change',
      compareBy: 'treatment',
      baseline: 'A',
      target: 'B',
    });

    expect(result.rows).toHaveLength(0);
    expect(result.warnings.some(w => w.includes('baseline average is 0'))).toBe(true);
  });

  // ── missing baseline group → warning ────────────────────────────
  it('returns warning when baseline group is missing', () => {
    const calc = new TableCalculator(FIXTURES);
    const result = calc.calculate({
      metric: 'GABA',
      operation: 'subtract',
      compareBy: 'treatment',
      baseline: 'NonExistent',
      target: 'As',
    });

    expect(result.rows).toHaveLength(0);
    expect(result.warnings.some(w => w.includes('baseline') && w.includes('NonExistent'))).toBe(true);
  });

  // ── missing target group → warning ──────────────────────────────
  it('returns warning when target group is missing', () => {
    const calc = new TableCalculator(FIXTURES);
    const result = calc.calculate({
      metric: 'GABA',
      operation: 'subtract',
      compareBy: 'treatment',
      baseline: 'CK',
      target: 'NonExistent',
    });

    expect(result.rows).toHaveLength(0);
    expect(result.warnings.some(w => w.includes('target') && w.includes('NonExistent'))).toBe(true);
  });

  // ── missing compareBy/baseline/target fields → warning ──────────
  it('returns warning when comparison fields are missing', () => {
    const calc = new TableCalculator(FIXTURES);
    const result = calc.calculate({
      metric: 'GABA',
      operation: 'subtract',
      // compareBy, baseline, target intentionally omitted
    });

    expect(result.rows).toHaveLength(0);
    expect(result.warnings[0]).toContain('compareBy');
  });

  // ── filters applied before comparison split ─────────────────────
  it('applies filters before baseline/target partitioning', () => {
    const calc = new TableCalculator(FIXTURES);
    const result = calc.calculate({
      metric: 'GABA',
      operation: 'subtract',
      compareBy: 'treatment',
      baseline: 'CK',
      target: 'As',
      filters: [{ field: 'section', operator: 'eq', value: 'Section A' }],
    });

    // Section B excluded → CK avg = (10 + 20) / 2 = 15, As avg = 35
    // 35 - 15 = 20
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]!.value).toBe(20);
  });

  // ── sourceRefs from both baseline and target ────────────────────
  it('preserves sourceRefs from both baseline and target rows', () => {
    const calc = new TableCalculator(FIXTURES);
    const result = calc.calculate({
      metric: 'GABA',
      operation: 'subtract',
      compareBy: 'treatment',
      baseline: 'CK',
      target: 'As',
    });

    // CK has 3 GABA obs, As has 2 → 5 sourceRefs
    expect(result.rows[0]!.sourceRefs.length).toBe(5);
    expect(result.rows[0]!.sourceRefs.every(r => r.sourceCell && r.sourceRange)).toBe(true);
  });

  // ── groupBy with partial group coverage → per-group warnings ────
  it('warns for groups missing in one partition', () => {
    const data = [
      obs({ treatment: 'CK', plantPart: 'Shoot', value: 10 }),
      obs({ treatment: 'CK', plantPart: 'Root', value: 20 }),
      obs({ treatment: 'As', plantPart: 'Shoot', value: 30 }),
      // No As+Root observation
    ];
    const calc = new TableCalculator(data);
    const result = calc.calculate({
      metric: 'GABA',
      operation: 'subtract',
      compareBy: 'treatment',
      baseline: 'CK',
      target: 'As',
      groupBy: 'plantPart',
    });

    // Shoot: 30 - 10 = 20 ✓
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]!.group).toBe('Shoot');
    expect(result.rows[0]!.value).toBe(20);

    // Root: missing target → warning
    expect(result.warnings.some(w => w.includes('Root') && w.includes('target'))).toBe(true);
  });
});
