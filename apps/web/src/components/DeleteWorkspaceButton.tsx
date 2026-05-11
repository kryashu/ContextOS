'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deleteWorkspaceAction } from '@/app/workspaces/actions';
import { Button } from '@contextos/ui';

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
      <Button
        variant="danger"
        onClick={handleClick}
        disabled={isPending}
        loading={isPending}
        icon={isPending ? undefined : '🗑️'}
      >
        {isPending ? 'Deleting...' : 'Delete Workspace'}
      </Button>
      {error && (
        <span style={{ color: '#f85149', fontSize: 13 }}>{error}</span>
      )}
    </div>
  );
}
