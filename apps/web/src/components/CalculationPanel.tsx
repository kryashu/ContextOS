'use client';

import { useState, useTransition } from 'react';
import { runCalculation } from '@/app/workspaces/actions';
import CalculationResultTable from './CalculationResultTable';
import { Banner, Button, Select } from '@contextos/ui';

const OPERATIONS = ['count', 'sum', 'average', 'min', 'max', 'median', 'subtract', 'difference', 'percentage_change'] as const;
const COMPARISON_OPS = new Set(['subtract', 'difference', 'percentage_change']);
const COMPARE_BY_FIELDS = ['treatment', 'plantPart', 'variety', 'section', 'sheet'] as const;
const GROUP_BY_OPTIONS = ['', 'treatment', 'plantPart', 'variety', 'section', 'sheet', 'treatment+plantPart'] as const;
const FILTER_FIELDS = ['section', 'treatment', 'plantPart', 'variety'] as const;

const selectStyle = {
  backgroundColor: 'var(--color-input-bg)',
  color: 'var(--color-fg)',
  border: '1px solid var(--color-border)',
  borderRadius: 6,
  padding: '6px 10px',
  fontSize: 14,
  minWidth: 140,
} as const;

const labelStyle = {
  fontSize: 12,
  color: 'var(--color-muted)',
  marginBottom: 4,
  display: 'block' as const,
} as const;

interface ResultRow {
  group?: string;
  value: number;
  count: number;
  sourceRefs?: Array<{ sourceCell: string; sourceRange: string }>;
}

interface CalculationResultData {
  calculationId: string;
  operation: string;
  metric: string;
  groupBy?: string;
  rows: ResultRow[];
  warnings: string[];
}

interface Props {
  workspaceId: string;
  metrics: string[];
  filterOptions: Record<string, string[]>;
  analysisState: 'none' | 'stale' | 'current' | 'failed';
}

export default function CalculationPanel({ workspaceId, metrics, filterOptions, analysisState }: Props) {
  const [metric, setMetric] = useState(metrics[0] ?? '');
  const [operation, setOperation] = useState<string>('average');
  const [groupBy, setGroupBy] = useState<string>('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [compareBy, setCompareBy] = useState<string>('treatment');
  const [baseline, setBaseline] = useState<string>('');
  const [target, setTarget] = useState<string>('');
  const [result, setResult] = useState<CalculationResultData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const disabled = analysisState !== 'current' || metrics.length === 0;
  const isComparison = COMPARISON_OPS.has(operation);
  const compareByValues = filterOptions[compareBy] ?? [];

  function handleRun() {
    setError(null);
    setResult(null);

    const calcFilters = Object.entries(filters)
      .filter(([, v]) => v !== '')
      .map(([field, value]) => ({ field, operator: 'eq' as const, value }));

    startTransition(async () => {
      const res = await runCalculation(workspaceId, {
        metric,
        operation,
        groupBy: groupBy || undefined,
        filters: calcFilters.length > 0 ? calcFilters : undefined,
        ...(isComparison ? { compareBy, baseline, target } : {}),
      });

      if (res.success && res.result) {
        setResult(res.result as CalculationResultData);
      } else {
        setError(res.message);
      }
    });
  }

  return (
    <div>
      {analysisState === 'stale' && (
        <Banner variant="warning">
          ⚠️ Analysis is stale — re-run analysis before calculating.
        </Banner>
      )}

      {analysisState === 'none' && (
        <Banner variant="info">
          ℹ️ Run analysis first to enable calculations.
        </Banner>
      )}

      {metrics.length === 0 && analysisState === 'current' && (
        <Banner variant="info">
          ℹ️ No metrics detected in the workbook data.
        </Banner>
      )}

      {/* Controls */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 16 }}>
        <Select
          label="Metric"
          value={metric}
          onChange={setMetric}
          options={metrics.map(m => ({ value: m, label: m }))}
          disabled={disabled}
        />

        <Select
          label="Operation"
          value={operation}
          onChange={setOperation}
          options={OPERATIONS.map(op => ({ value: op, label: op }))}
          disabled={disabled}
        />

        <Select
          label="Group By"
          value={groupBy}
          onChange={setGroupBy}
          options={GROUP_BY_OPTIONS.filter(Boolean).map(g => ({ value: g, label: g }))}
          disabled={disabled}
          placeholder="None"
        />

        {/* Comparison controls */}
        {isComparison && (
          <>
            <Select
              label="Compare By"
              value={compareBy}
              onChange={(v) => { setCompareBy(v); setBaseline(''); setTarget(''); }}
              options={COMPARE_BY_FIELDS.map(f => ({ value: f, label: f }))}
              disabled={disabled}
            />
            <Select
              label="Baseline"
              value={baseline}
              onChange={setBaseline}
              options={compareByValues.map(v => ({ value: v, label: v }))}
              disabled={disabled}
              placeholder="Select…"
            />
            <Select
              label="Target"
              value={target}
              onChange={setTarget}
              options={compareByValues.map(v => ({ value: v, label: v }))}
              disabled={disabled}
              placeholder="Select…"
            />
          </>
        )}

        {/* Filter dropdowns */}
        {FILTER_FIELDS.map(field => {
          const opts = filterOptions[field] ?? [];
          if (opts.length === 0) return null;
          return (
            <Select
              key={field}
              label={field}
              value={filters[field] ?? ''}
              onChange={(v) => setFilters(prev => ({ ...prev, [field]: v }))}
              options={opts.map(v => ({ value: v, label: v }))}
              disabled={disabled}
              placeholder="All"
            />
          );
        })}

        <Button
          variant="primary"
          onClick={handleRun}
          disabled={disabled || isPending}
          loading={isPending}
          icon={isPending ? undefined : '▶'}
          style={{ alignSelf: 'flex-end' }}
        >
          {isPending ? 'Calculating...' : 'Run Calculation'}
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div style={{ color: '#f85149', fontSize: 13, marginBottom: 12 }}>
          ❌ {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <CalculationResultTable
          rows={result.rows}
          hasGroup={!!result.groupBy}
          operation={result.operation}
          metric={result.metric}
          warnings={result.warnings}
        />
      )}
    </div>
  );
}
