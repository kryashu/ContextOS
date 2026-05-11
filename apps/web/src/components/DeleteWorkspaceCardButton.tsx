'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deleteWorkspaceAction } from '@/app/workspaces/actions';

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
    <button
      onClick={handleClick}
      disabled={isPending}
      title={`Delete workspace "${workspaceName}"`}
      style={{
        background: 'none',
        border: 'none',
        cursor: isPending ? 'not-allowed' : 'pointer',
        fontSize: 14,
        padding: '2px 6px',
        borderRadius: 4,
        opacity: isPending ? 0.5 : 1,
        color: '#f85149',
        lineHeight: 1,
      }}
    >
      {isPending ? '⏳' : '🗑️'}
    </button>
  );
}
