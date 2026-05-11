'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createWorkspaceAction } from '../actions';
import { Input, Textarea, Button } from '@contextos/ui';

export default function NewWorkspacePage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await createWorkspaceAction(formData);
      if (result.success && result.workspaceId) {
        router.push(`/workspaces/${result.workspaceId}`);
      } else {
        setError(result.message);
      }
    });
  }

  return (
    <div>
      <h1 style={{ margin: '0 0 24px', fontSize: 24 }}>📁 New Workspace</h1>

      <form onSubmit={handleSubmit} style={{ maxWidth: 500 }}>
        <div style={{ marginBottom: 16 }}>
          <label htmlFor="name" style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 600 }}>
            Name <span style={{ color: '#f85149' }}>*</span>
          </label>
          <Input
            id="name"
            name="name"
            type="text"
            required
            maxLength={100}
            placeholder="e.g. Payment Service"
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <label htmlFor="description" style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 600 }}>
            Description
          </label>
          <Textarea
            id="description"
            name="description"
            rows={3}
            maxLength={500}
            placeholder="Brief description of the workspace"
          />
        </div>

        {error && (
          <p style={{ color: '#f85149', fontSize: 13, margin: '0 0 16px' }}>{error}</p>
        )}

        <div style={{ display: 'flex', gap: 12 }}>
          <Button
            type="submit"
            variant="primary"
            disabled={isPending}
          >
            {isPending ? 'Creating...' : 'Create Workspace'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.push('/workspaces')}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
