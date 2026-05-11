'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deleteWorkspaceAction } from '@/app/workspaces/actions';

interface Props {
  workspaceId: string;
  workspaceName: string;
}

export default function DeleteWorkspaceButton({ workspaceId, workspaceName }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    const confirmed = window.confirm(
      `⚠️ Permanently delete workspace "${workspaceName}"?\n\n` +
      `This will delete ALL source files, analysis results, and workspace data. ` +
      `This action cannot be undone and there is no recovery mechanism.\n\n` +
      `Are you sure you want to proceed?`,
    );
    if (!confirmed) return;

    setError(null);
    startTransition(async () => {
      const res = await deleteWorkspaceAction(workspaceId);
      if (res.success) {
        router.push('/workspaces');
      } else {
        setError(res.message);
      }
    });
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <button
        onClick={handleClick}
        disabled={isPending}
        style={{
          backgroundColor: isPending ? 'var(--color-btn-disabled)' : '#da3633',
          color: '#fff',
          border: '1px solid #f85149',
          borderRadius: 6,
          padding: '8px 16px',
          fontSize: 14,
          fontWeight: 600,
          cursor: isPending ? 'not-allowed' : 'pointer',
        }}
      >
        {isPending ? '⏳ Deleting...' : '🗑️ Delete Workspace'}
      </button>
      {error && (
        <span style={{ color: '#f85149', fontSize: 13 }}>{error}</span>
      )}
    </div>
  );
}
