'use client';

import { useState, useTransition } from 'react';
import { uploadFilesAction } from '@/app/workspaces/actions';

interface Props {
  workspaceId: string;
}

export default function FileUpload({ workspaceId }: Props) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

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
      if (res.success) {
        window.location.reload();
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
          backgroundColor: isPending ? '#21262d' : '#21262d',
          color: isPending ? '#8b949e' : '#e6edf3',
          border: '1px solid #30363d',
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
          accept=".md,.csv,.json,.txt,.yaml,.yml,.xlsx"
          onChange={handleChange}
          disabled={isPending}
          style={{ display: 'none' }}
        />
      </label>
      <span style={{ marginLeft: 12, fontSize: 12, color: '#8b949e' }}>
        .md, .csv, .json, .txt, .yaml, .yml — max 5MB each
      </span>
      {result && (
        <p style={{
          marginTop: 8,
          fontSize: 13,
          color: result.success ? '#3fb950' : '#f85149',
        }}>
          {result.message}
        </p>
      )}
    </div>
  );
}
