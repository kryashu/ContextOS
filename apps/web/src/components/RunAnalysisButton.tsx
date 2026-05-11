'use client';

import { useState, useTransition } from 'react';

interface Props {
  action: () => Promise<{ success: boolean; message: string }>;
}

export default function RunAnalysisButton({ action }: Props) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  function handleClick() {
    setResult(null);
    startTransition(async () => {
      const res = await action();
      setResult(res);
      // Refresh the page to reload server-component data
      if (res.success) {
        window.location.reload();
      }
    });
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <button
        onClick={handleClick}
        disabled={isPending}
        style={{
          backgroundColor: isPending ? 'var(--color-btn-disabled)' : '#238636',
          color: '#fff',
          border: '1px solid var(--color-border)',
          borderRadius: 6,
          padding: '8px 16px',
          fontSize: 14,
          fontWeight: 600,
          cursor: isPending ? 'not-allowed' : 'pointer',
        }}
      >
        {isPending ? '⏳ Running...' : '▶ Run Analysis'}
      </button>
      {result && !result.success && (
        <span style={{ color: '#f85149', fontSize: 13 }}>{result.message}</span>
      )}
    </div>
  );
}
