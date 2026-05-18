'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@contextos/ui';

interface Props {
  action: () => Promise<{ success: boolean; message: string }>;
}

export default function RunAnalysisButton({ action }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  function handleClick() {
    setResult(null);
    startTransition(async () => {
      const res = await action();
      setResult(res);
      // Refresh the page to reload server-component data
      if (res.success) {
        router.refresh();
      }
    });
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <Button
        variant="primary"
        onClick={handleClick}
        disabled={isPending}
        loading={isPending}
        icon={isPending ? undefined : '▶'}
      >
        {isPending ? 'Running...' : 'Run Analysis'}
      </Button>
      {result && !result.success && (
        <span style={{ color: '#f85149', fontSize: 13 }}>{result.message}</span>
      )}
    </div>
  );
}
