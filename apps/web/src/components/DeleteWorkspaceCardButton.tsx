'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deleteWorkspaceAction } from '@/app/workspaces/actions';
import { Button } from '@contextos/ui';

interface Props {
  workspaceId: string;
  workspaceName: string;
}

export default function DeleteWorkspaceCardButton({ workspaceId, workspaceName }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick(e: React.MouseEvent) {
    // Prevent the parent <Link> from navigating
    e.preventDefault();
    e.stopPropagation();

    const confirmed = window.confirm(
      `⚠️ Permanently delete workspace "${workspaceName}"?\n\n` +
      `This will delete ALL source files, analysis results, and workspace data. ` +
      `This action cannot be undone and there is no recovery mechanism.\n\n` +
      `Are you sure you want to proceed?`,
    );
    if (!confirmed) return;

    startTransition(async () => {
      const res = await deleteWorkspaceAction(workspaceId);
      if (res.success) {
        router.refresh();
      }
    });
  }

  return (
    <Button
      variant="icon"
      onClick={handleClick}
      disabled={isPending}
      loading={isPending}
      icon={isPending ? undefined : '🗑️'}
      title={`Delete workspace "${workspaceName}"`}
      style={{ fontSize: 14 }}
    />
  );
}
