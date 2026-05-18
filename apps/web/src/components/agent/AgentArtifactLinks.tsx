'use client';

interface AgentArtifactLinksProps {
  hasReport: boolean;
  hasPdf: boolean;
  downloadAction: () => Promise<{ success: boolean; content?: string; error?: string }>;
  downloadPdfAction: () => Promise<{ success: boolean; content?: string; error?: string }>;
}

export default function AgentArtifactLinks({
  hasReport,
  hasPdf,
  downloadAction,
  downloadPdfAction,
}: AgentArtifactLinksProps) {
  if (!hasReport && !hasPdf) return null;

  return (
    <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {hasReport && (
        <button
          onClick={async () => {
            const res = await downloadAction();
            if (res.success && res.content) {
              const blob = new Blob([res.content], { type: 'text/markdown' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'workspace-report.md';
              a.click();
              URL.revokeObjectURL(url);
            }
          }}
          style={{
            padding: '6px 12px',
            borderRadius: 6,
            border: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-surface)',
            color: 'var(--color-fg)',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          📄 Download Markdown Report
        </button>
      )}
      {hasPdf && (
        <button
          onClick={async () => {
            const res = await downloadPdfAction();
            if (res.success && res.content) {
              const bytes = Uint8Array.from(atob(res.content), c => c.charCodeAt(0));
              const blob = new Blob([bytes], { type: 'application/pdf' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'workspace-report.pdf';
              a.click();
              URL.revokeObjectURL(url);
            }
          }}
          style={{
            padding: '6px 12px',
            borderRadius: 6,
            border: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-surface)',
            color: 'var(--color-fg)',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          📑 Download PDF Report
        </button>
      )}
    </div>
  );
}
