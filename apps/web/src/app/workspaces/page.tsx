import Link from 'next/link';
import { listWorkspaces } from '@/lib/workspaces';
import DeleteWorkspaceCardButton from '@/components/DeleteWorkspaceCardButton';

export const dynamic = 'force-dynamic';

const STATUS_COLORS: Record<string, string> = {
  empty: '#6e7681',
  has_sources: '#d29922',
  analyzed: '#3fb950',
};

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function WorkspacesPage() {
  const workspaces = listWorkspaces();

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 24 }}>📂 Workspaces</h1>
        <div style={{ display: 'flex', gap: 12 }}>
          <Link
            href="/workspaces/new"
            style={{
              backgroundColor: '#238636',
              color: '#fff',
              border: '1px solid var(--color-border)',
              borderRadius: 6,
              padding: '8px 16px',
              fontSize: 14,
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            + New Workspace
          </Link>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
        {/* Pinned demo workspace */}
        <Link
          href="/workspaces/demo"
          style={{ textDecoration: 'none', color: 'inherit' }}
        >
          <div style={{
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            padding: 20,
            backgroundColor: 'var(--color-surface)',
            cursor: 'pointer',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <h3 style={{ margin: '0 0 4px', fontSize: 16, color: 'var(--color-fg)' }}>📁 checkout-system</h3>
              <span style={{
                fontSize: 11,
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: 4,
                backgroundColor: '#6e7681',
                color: '#fff',
                textTransform: 'uppercase',
              }}>
                demo
              </span>
            </div>
            <p style={{ margin: '0 0 12px', color: 'var(--color-muted)', fontSize: 13 }}>
              Built-in demo workspace with sample files
            </p>
            <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--color-muted)' }}>
              <span>📄 4 sources</span>
            </div>
          </div>
        </Link>

        {/* User workspaces */}
        {workspaces.map(ws => (
          <Link
            key={ws.id}
            href={`/workspaces/${ws.id}`}
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <div style={{
              border: '1px solid var(--color-border)',
              borderRadius: 8,
              padding: 20,
              backgroundColor: 'var(--color-surface)',
              cursor: 'pointer',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <h3 style={{ margin: '0 0 4px', fontSize: 16, color: 'var(--color-fg)' }}>📁 {ws.name}</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: 4,
                    backgroundColor: STATUS_COLORS[ws.status] ?? '#6e7681',
                    color: '#fff',
                    textTransform: 'uppercase',
                  }}>
                    {ws.status.replace('_', ' ')}
                  </span>
                  <DeleteWorkspaceCardButton workspaceId={ws.id} workspaceName={ws.name} />
                </div>
              </div>
              {ws.description && (
                <p style={{ margin: '0 0 12px', color: 'var(--color-muted)', fontSize: 13 }}>{ws.description}</p>
              )}
              <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--color-muted)' }}>
                <span>📄 {ws.sourceCount} sources</span>
                <span>🕐 {formatRelativeTime(ws.updatedAt)}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {workspaces.length === 0 && (
        <p style={{ color: 'var(--color-muted)', textAlign: 'center', marginTop: 32 }}>
          No custom workspaces yet. Create one or explore the demo workspace above.
        </p>
      )}
    </div>
  );
}
