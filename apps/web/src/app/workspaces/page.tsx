import Link from 'next/link';
import { listWorkspaces } from '@/lib/workspaces';
import { formatRelativeTime } from '@/lib/utils';
import DeleteWorkspaceCardButton from '@/components/DeleteWorkspaceCardButton';
import { Badge, Button } from '@contextos/ui';

export const dynamic = 'force-dynamic';

const STATUS_COLORS: Record<string, string> = {
  empty: '#6e7681',
  has_sources: '#d29922',
  analyzed: '#3fb950',
};

export default function WorkspacesPage() {
  const workspaces = listWorkspaces();

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 24 }}>📂 Workspaces</h1>
        <div style={{ display: 'flex', gap: 12 }}>
          <Button as="a" href="/workspaces/new" variant="primary">
            + New Workspace
          </Button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
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
                  <Badge color={STATUS_COLORS[ws.status] ?? '#6e7681'}>
                    {ws.status.replace('_', ' ')}
                  </Badge>
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
          No workspaces yet. Create one to get started.
        </p>
      )}
    </div>
  );
}
