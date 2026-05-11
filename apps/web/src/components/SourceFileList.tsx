import type { SourceFile } from '@/lib/workspaces';
import DeleteSourceFileButton from './DeleteSourceFileButton';

interface Props {
  files: SourceFile[];
  workspaceId: string;
  allowDelete?: boolean;
}

const TYPE_ICONS: Record<string, string> = {
  markdown: '📝',
  csv: '📊',
  json: '🔧',
  text: '📄',
  yaml: '⚙️',
  figma: '🎨',
  confluence: '📚',
  unknown: '❓',
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function SourceFileList({ files, workspaceId, allowDelete = false }: Props) {
  if (files.length === 0) {
    return (
      <p style={{ color: 'var(--color-muted)', fontSize: 14 }}>
        No source files yet. Upload files to get started.
      </p>
    );
  }

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
      <thead>
        <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
          <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--color-muted)', fontWeight: 600 }}>File</th>
          <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--color-muted)', fontWeight: 600 }}>Type</th>
          <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--color-muted)', fontWeight: 600 }}>Size</th>
          {allowDelete && (
            <th style={{ textAlign: 'center', padding: '8px 12px', color: 'var(--color-muted)', fontWeight: 600, width: 60 }}></th>
          )}
        </tr>
      </thead>
      <tbody>
        {files.map(f => (
          <tr key={f.name} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
            <td style={{ padding: '8px 12px' }}>{f.name}</td>
            <td style={{ padding: '8px 12px' }}>
              {TYPE_ICONS[f.type] ?? '❓'} {f.type}
            </td>
            <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--color-muted)' }}>
              {formatSize(f.size)}
            </td>
            {allowDelete && (
              <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                <DeleteSourceFileButton workspaceId={workspaceId} fileName={f.name} />
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
