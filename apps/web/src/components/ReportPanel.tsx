'use client';

import { useState, useTransition } from 'react';
import { Button } from '@contextos/ui';

interface Props {
  workspaceId: string;
  hasReport: boolean;
  generateAction: () => Promise<{ success: boolean; message: string }>;
  downloadAction: () => Promise<{ success: boolean; content?: string; message: string }>;
}

export default function ReportPanel({
  workspaceId,
  hasReport,
  generateAction,
  downloadAction,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleGenerate() {
    setError(null);
    startTransition(async () => {
      const res = await generateAction();
      if (res.success) {
        window.location.reload();
      } else {
        setError(res.message);
      }
    });
  }

  function handleDownload() {
    setError(null);
    startTransition(async () => {
      const res = await downloadAction();
      if (res.success && res.content) {
        const blob = new Blob([res.content], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `workspace-report-${workspaceId}.md`;
        a.click();
        URL.revokeObjectURL(url);
      } else if (!res.success) {
        setError(res.message);
      }
    });
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <Button
        variant="action"
        onClick={handleGenerate}
        disabled={isPending}
        loading={isPending && !hasReport}
        icon="📄"
      >
        {isPending && !hasReport ? 'Generating...' : 'Generate Report'}
      </Button>
      {hasReport && (
        <Button
          variant="secondary"
          onClick={handleDownload}
          disabled={isPending}
          icon="⬇"
        >
          Download Markdown
        </Button>
      )}
      {error && (
        <span style={{ color: '#f85149', fontSize: 13 }}>{error}</span>
      )}
    </div>
  );
}
