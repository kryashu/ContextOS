'use client';

import { useState, useTransition } from 'react';
import { deleteSourceFileAction } from '@/app/workspaces/actions';
import { Button } from '@contextos/ui';

interface Props {
  workspaceId: string;
  fileName: string;
}

export default function DeleteSourceFileButton({ workspaceId, fileName }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    const confirmed = window.confirm(
      `⚠️ Permanently delete "${fileName}"?\n\n` +
      `This file will be removed from the workspace and any existing analysis will be cleared. ` +
      `This action cannot be undone.\n\n` +
      `Are you sure?`,
    );
    if (!confirmed) return;

    setError(null);
    startTransition(async () => {
      const res = await deleteSourceFileAction(workspaceId, fileName);
      if (res.success) {
        window.location.reload();
      } else {
        setError(res.message);
      }
    });
  }

  return (
    <>
      <Button
        variant="icon"
        onClick={handleClick}
        disabled={isPending}
        loading={isPending}
        icon={isPending ? undefined : '🗑️'}
        title={`Delete ${fileName}`}
      />
      {error && (
        <span style={{ color: '#f85149', fontSize: 11 }}>{error}</span>
      )}
    </>
  );
}
