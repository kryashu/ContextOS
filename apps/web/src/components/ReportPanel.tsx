'use client';

import { useState, useTransition } from 'react';
import { Button } from '@contextos/ui';

interface Props {
  workspaceId: string;
  hasReport: boolean;
  hasPdf: boolean;
  generateAction: () => Promise<{ success: boolean; message: string }>;
  downloadAction: () => Promise<{ success: boolean; content?: string; message: string }>;
  generatePdfAction: () => Promise<{ success: boolean; message: string }>;
  downloadPdfAction: () => Promise<{ success: boolean; content?: string; message: string }>;
}

export default function ReportPanel({
  workspaceId,
  hasReport,
  hasPdf,
  generateAction,
  downloadAction,
  generatePdfAction,
  downloadPdfAction,
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

  function handleGeneratePdf() {
    setError(null);
    startTransition(async () => {
      const res = await generatePdfAction();
      if (res.success) {
        window.location.reload();
      } else {
        setError(res.message);
      }
    });
  }

  function handleDownloadPdf() {
    setError(null);
    startTransition(async () => {
      const res = await downloadPdfAction();
      if (res.success && res.content) {
        const bytes = Uint8Array.from(atob(res.content), c => c.charCodeAt(0));
        const blob = new Blob([bytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `workspace-report-${workspaceId}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      } else if (!res.success) {
        setError(res.message);
      }
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
      </div>
      {hasReport && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Button
            variant="action"
            onClick={handleGeneratePdf}
            disabled={isPending}
            icon="📑"
          >
            {isPending && !hasPdf ? 'Generating PDF...' : 'Generate PDF'}
          </Button>
          {hasPdf && (
            <Button
              variant="secondary"
              onClick={handleDownloadPdf}
              disabled={isPending}
              icon="⬇"
            >
              Download PDF
            </Button>
          )}
        </div>
      )}
      {error && (
        <span style={{ color: '#f85149', fontSize: 13 }}>{error}</span>
      )}
    </div>
  );
}
