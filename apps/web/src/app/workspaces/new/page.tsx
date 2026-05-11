'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createWorkspaceAction } from '../actions';

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
          <input
            id="name"
            name="name"
            type="text"
            required
            maxLength={100}
            placeholder="e.g. Payment Service"
            style={{
              width: '100%',
              padding: '8px 12px',
              fontSize: 14,
              backgroundColor: '#0d1117',
              border: '1px solid #30363d',
              borderRadius: 6,
              color: '#e6edf3',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <label htmlFor="description" style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 600 }}>
            Description
          </label>
          <textarea
            id="description"
            name="description"
            rows={3}
            maxLength={500}
            placeholder="Brief description of the workspace"
            style={{
              width: '100%',
              padding: '8px 12px',
              fontSize: 14,
              backgroundColor: '#0d1117',
              border: '1px solid #30363d',
              borderRadius: 6,
              color: '#e6edf3',
              outline: 'none',
              resize: 'vertical',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {error && (
          <p style={{ color: '#f85149', fontSize: 13, margin: '0 0 16px' }}>{error}</p>
        )}

        <div style={{ display: 'flex', gap: 12 }}>
          <button
            type="submit"
            disabled={isPending}
            style={{
              backgroundColor: isPending ? '#21262d' : '#238636',
              color: '#fff',
              border: '1px solid #30363d',
              borderRadius: 6,
              padding: '8px 16px',
              fontSize: 14,
              fontWeight: 600,
              cursor: isPending ? 'not-allowed' : 'pointer',
            }}
          >
            {isPending ? 'Creating...' : 'Create Workspace'}
          </button>
          <button
            type="button"
            onClick={() => router.push('/workspaces')}
            style={{
              backgroundColor: '#21262d',
              color: '#e6edf3',
              border: '1px solid #30363d',
              borderRadius: 6,
              padding: '8px 16px',
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
