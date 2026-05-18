'use client';

import type { KeyIntelligenceResult } from '@contextos/key-intelligence';

const STATUS_COLORS: Record<string, string> = {
  success: '#3fb950',
  no_matches: '#d29922',
  needs_clarification: '#6e7681',
  error: '#f85149',
};

export default function KeyIntelligenceResultDisplay({ result }: { result: KeyIntelligenceResult }) {
  return (
    <div style={{ marginTop: 16 }}>
      {/* Status header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span
          style={{
            width: 8, height: 8, borderRadius: '50%',
            backgroundColor: STATUS_COLORS[result.status] ?? '#6e7681',
          }}
        />
        <strong style={{ fontSize: 14 }}>
          {result.status === 'success' && 'Key Intelligence'}
          {result.status === 'no_matches' && 'No key matches found'}
          {result.status === 'needs_clarification' && 'Clarification needed'}
          {result.status === 'error' && 'Key intelligence error'}
        </strong>
      </div>

      {/* Duplicate groups */}
      {result.duplicateGroups.length > 0 && (
        <details open style={{ marginBottom: 12 }}>
          <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
            Duplicate Keys ({result.duplicateGroups.length} group{result.duplicateGroups.length !== 1 ? 's' : ''})
          </summary>
          <div style={{ maxHeight: 240, overflow: 'auto' }}>
            {result.duplicateGroups.map((group, i) => (
              <div
                key={i}
                style={{
                  padding: '6px 10px',
                  borderRadius: 4,
                  backgroundColor: 'var(--color-surface)',
                  border: '1px solid var(--color-border-subtle)',
                  marginBottom: 4,
                  fontSize: 12,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>
                    <strong>{group.value}</strong>
                    <span style={{ color: 'var(--color-muted)', marginLeft: 6 }}>({group.keyType})</span>
                  </span>
                  <span style={{ fontWeight: 600 }}>{group.count}x</span>
                </div>
                <div style={{ color: 'var(--color-muted)', marginTop: 2 }}>
                  {group.locations.slice(0, 5).map((loc, j) => (
                    <span key={j}>
                      {loc.fileName}{loc.column ? `:${loc.column}` : ''}{loc.row != null ? ` row ${loc.row}` : ''}
                      {j < Math.min(group.locations.length, 5) - 1 ? ' · ' : ''}
                    </span>
                  ))}
                  {group.locations.length > 5 && <span> (+{group.locations.length - 5} more)</span>}
                </div>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Document matches */}
      {result.documentMatches.length > 0 && (
        <details open style={{ marginBottom: 12 }}>
          <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
            Document Matches ({result.documentMatches.length})
          </summary>
          <div style={{ maxHeight: 240, overflow: 'auto' }}>
            {result.documentMatches.map((match, i) => (
              <div
                key={i}
                style={{
                  padding: '6px 10px',
                  borderRadius: 4,
                  backgroundColor: 'var(--color-surface)',
                  border: '1px solid var(--color-border-subtle)',
                  marginBottom: 4,
                  fontSize: 12,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span><strong>{match.fileName}</strong></span>
                  <span style={{ color: 'var(--color-muted)' }}>{match.keyType}</span>
                </div>
                <div style={{ color: 'var(--color-muted)', marginTop: 2, fontFamily: 'monospace', fontSize: 11 }}>
                  {match.value}
                </div>
                {match.evidence && (
                  <div style={{ color: 'var(--color-muted)', marginTop: 2, fontStyle: 'italic', fontSize: 11 }}>
                    {match.evidence}
                  </div>
                )}
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Relationships */}
      {result.relationships.length > 0 && (
        <details style={{ marginBottom: 12 }}>
          <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
            Key Relationships ({result.relationships.length})
          </summary>
          <div style={{ maxHeight: 200, overflow: 'auto' }}>
            {result.relationships.map((rel, i) => (
              <div
                key={i}
                style={{
                  padding: '6px 10px',
                  borderRadius: 4,
                  backgroundColor: 'var(--color-surface)',
                  border: '1px solid var(--color-border-subtle)',
                  marginBottom: 4,
                  fontSize: 12,
                }}
              >
                <span><strong>{rel.value}</strong></span>
                <span style={{ color: 'var(--color-muted)', marginLeft: 6 }}>
                  ({rel.keyType}) — {rel.tableMatches.length} table, {rel.documentMatches.length} doc
                </span>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Key profiles */}
      {result.keyProfiles.length > 0 && (
        <details style={{ marginBottom: 12 }}>
          <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
            Key Profiles ({result.keyProfiles.length})
          </summary>
          <div style={{ maxHeight: 200, overflow: 'auto' }}>
            {result.keyProfiles.map((profile, i) => (
              <div
                key={i}
                style={{
                  padding: '6px 10px',
                  borderRadius: 4,
                  backgroundColor: 'var(--color-surface)',
                  border: '1px solid var(--color-border-subtle)',
                  marginBottom: 4,
                  fontSize: 12,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span><strong>{profile.fieldName}</strong> ({profile.keyType})</span>
                  <span style={{ color: 'var(--color-muted)' }}>
                    {Math.round(profile.uniquenessScore * 100)}% unique
                  </span>
                </div>
                <div style={{ color: 'var(--color-muted)', marginTop: 2 }}>
                  {profile.fileName}{profile.sheet ? ` / ${profile.sheet}` : ''} — {profile.duplicateCount} duplicates
                </div>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Warnings */}
      {result.warnings.length > 0 && (
        <div style={{ marginTop: 8, fontSize: 12, color: '#d29922' }}>
          {result.warnings.map((w, i) => (
            <div key={i}>⚠️ {w}</div>
          ))}
        </div>
      )}
    </div>
  );
}
