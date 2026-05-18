'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { uploadFilesAction, type FileResult } from '@/app/workspaces/actions';

const REJECTION_LABELS: Record<string, string> = {
  unsupported_extension: 'Unsupported file type',
  oversized: 'File is too large',
  empty: 'File is empty',
  invalid_name: 'Invalid file name',
  write_failed: 'Could not save file',
};

interface Props {
  workspaceId: string;
}

export default function FileUpload({ workspaceId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ success: boolean; message: string; fileResults?: FileResult[] } | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setResult(null);
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]!);
    }

    startTransition(async () => {
      const res = await uploadFilesAction(workspaceId, formData);
      setResult(res);
      if (res.success && res.fileCount > 0) {
        router.refresh();
      }
    });

    // Reset input so the same file can be re-selected
    e.target.value = '';
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <label
        style={{
          display: 'inline-block',
          backgroundColor: isPending ? 'var(--color-btn-disabled)' : 'var(--color-border-subtle)',
          color: isPending ? 'var(--color-muted)' : 'var(--color-fg)',
          border: '1px solid var(--color-border)',
          borderRadius: 6,
          padding: '8px 16px',
          fontSize: 14,
          fontWeight: 600,
          cursor: isPending ? 'not-allowed' : 'pointer',
        }}
      >
        {isPending ? '⏳ Uploading...' : '📎 Upload Files'}
        <input
          type="file"
          multiple
          accept=".md,.csv,.json,.txt,.yaml,.yml,.xlsx,.pdf,.docx"
          onChange={handleChange}
          disabled={isPending}
          style={{ display: 'none' }}
        />
      </label>
      <span style={{ marginLeft: 12, fontSize: 12, color: 'var(--color-muted)' }}>
        .md, .csv, .json, .txt, .yaml, .yml, .pdf, .docx — max 5MB each
      </span>
      {result && (
        <div style={{ marginTop: 8 }}>
          <p style={{
            fontSize: 13,
            color: result.success ? '#3fb950' : '#f85149',
          }}>
            {result.message}
          </p>
          {result.fileResults && result.fileResults.length > 0 && (
            <ul style={{ margin: '4px 0 0', padding: '0 0 0 20px', fontSize: 12, lineHeight: 1.6 }}>
              {result.fileResults.map((fr, i) => (
                <li key={i} style={{ color: fr.status === 'accepted' ? '#3fb950' : '#f85149' }}>
                  {fr.status === 'accepted' ? '✅' : '❌'} {fr.fileName}
                  {fr.reason && (
                    <span style={{ color: 'var(--color-muted)', marginLeft: 6 }}>
                      — {REJECTION_LABELS[fr.reason] ?? 'Could not upload file'}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
