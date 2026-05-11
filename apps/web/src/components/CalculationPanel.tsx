'use client';

import { useState, useTransition } from 'react';
import { runCalculation } from '@/app/workspaces/actions';
import CalculationResultTable from './CalculationResultTable';

const OPERATIONS = ['count', 'sum', 'average', 'min', 'max', 'median', 'subtract', 'difference', 'percentage_change'] as const;
const COMPARISON_OPS = new Set(['subtract', 'difference', 'percentage_change']);
const COMPARE_BY_FIELDS = ['treatment', 'plantPart', 'variety', 'section', 'sheet'] as const;
const GROUP_BY_OPTIONS = ['', 'treatment', 'plantPart', 'variety', 'section', 'sheet', 'treatment+plantPart'] as const;
const FILTER_FIELDS = ['section', 'treatment', 'plantPart', 'variety'] as const;

const selectStyle = {
  backgroundColor: '#0d1117',
  color: '#e6edf3',
  border: '1px solid #30363d',
  borderRadius: 6,
  padding: '6px 10px',
  fontSize: 14,
  minWidth: 140,
} as const;

const labelStyle = {
  fontSize: 12,
  color: '#8b949e',
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
        <div style={{
          border: '1px solid #d29922',
          borderRadius: 6,
          padding: '8px 12px',
          backgroundColor: '#2d2200',
          color: '#d29922',
          fontSize: 13,
          marginBottom: 16,
        }}>
          ⚠️ Analysis is stale — re-run analysis before calculating.
        </div>
      )}

      {analysisState === 'none' && (
        <div style={{
          border: '1px solid #6e7681',
          borderRadius: 6,
          padding: '8px 12px',
          color: '#8b949e',
          fontSize: 13,
          marginBottom: 16,
        }}>
          ℹ️ Run analysis first to enable calculations.
        </div>
      )}

      {metrics.length === 0 && analysisState === 'current' && (
        <div style={{
          border: '1px solid #6e7681',
          borderRadius: 6,
          padding: '8px 12px',
          color: '#8b949e',
          fontSize: 13,
          marginBottom: 16,
        }}>
          ℹ️ No metrics detected in the workbook data.
        </div>
      )}

      {/* Controls */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 16 }}>
        <div>
          <label style={labelStyle}>Metric</label>
          <select
            style={selectStyle}
            value={metric}
            onChange={e => setMetric(e.target.value)}
            disabled={disabled}
          >
            {metrics.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        <div>
          <label style={labelStyle}>Operation</label>
          <select
            style={selectStyle}
            value={operation}
            onChange={e => setOperation(e.target.value)}
            disabled={disabled}
          >
            {OPERATIONS.map(op => <option key={op} value={op}>{op}</option>)}
          </select>
        </div>

        <div>
          <label style={labelStyle}>Group By</label>
          <select
            style={selectStyle}
            value={groupBy}
            onChange={e => setGroupBy(e.target.value)}
            disabled={disabled}
          >
            <option value="">None</option>
            {GROUP_BY_OPTIONS.filter(Boolean).map(g => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>

        {/* Comparison controls */}
        {isComparison && (
          <>
            <div>
              <label style={labelStyle}>Compare By</label>
              <select
                style={selectStyle}
                value={compareBy}
                onChange={e => { setCompareBy(e.target.value); setBaseline(''); setTarget(''); }}
                disabled={disabled}
              >
                {COMPARE_BY_FIELDS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Baseline</label>
              <select
                style={selectStyle}
                value={baseline}
                onChange={e => setBaseline(e.target.value)}
                disabled={disabled}
              >
                <option value="">Select…</option>
                {compareByValues.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Target</label>
              <select
                style={selectStyle}
                value={target}
                onChange={e => setTarget(e.target.value)}
                disabled={disabled}
              >
                <option value="">Select…</option>
                {compareByValues.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          </>
        )}

        {/* Filter dropdowns */}
        {FILTER_FIELDS.map(field => {
          const options = filterOptions[field] ?? [];
          if (options.length === 0) return null;
          return (
            <div key={field}>
              <label style={labelStyle}>{field}</label>
              <select
                style={selectStyle}
                value={filters[field] ?? ''}
                onChange={e => setFilters(prev => ({ ...prev, [field]: e.target.value }))}
                disabled={disabled}
              >
                <option value="">All</option>
                {options.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          );
        })}

        <button
          onClick={handleRun}
          disabled={disabled || isPending}
          style={{
            backgroundColor: disabled || isPending ? '#21262d' : '#238636',
            color: '#fff',
            border: '1px solid #30363d',
            borderRadius: 6,
            padding: '8px 16px',
            fontSize: 14,
            fontWeight: 600,
            cursor: disabled || isPending ? 'not-allowed' : 'pointer',
            alignSelf: 'flex-end',
          }}
        >
          {isPending ? '⏳ Calculating...' : '▶ Run Calculation'}
        </button>
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
