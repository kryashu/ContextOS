'use client';

import type {
  WorkspaceAgentResponse,
  AgentResponseSection,
  AgentSourceRef,
  AgentDownload,
  AgentNextAction,
  WorkspaceAgentToolTrace,
} from '@contextos/agents';

interface Props {
  response: WorkspaceAgentResponse;
  onNextAction?: (action: AgentNextAction) => void;
}

const STATUS_STYLES: Record<
  WorkspaceAgentResponse['status'],
  { bg: string; fg: string; border: string; label: string }
> = {
  success: {
    bg: 'rgba(34, 197, 94, 0.12)',
    border: 'rgba(34, 197, 94, 0.45)',
    fg: 'var(--color-fg)',
    label: 'Success',
  },
  needs_clarification: {
    bg: 'rgba(245, 158, 11, 0.12)',
    border: 'rgba(245, 158, 11, 0.45)',
    fg: 'var(--color-fg)',
    label: 'Needs clarification',
  },
  no_matches: {
    bg: 'rgba(148, 163, 184, 0.18)',
    border: 'rgba(148, 163, 184, 0.45)',
    fg: 'var(--color-fg)',
    label: 'No matches',
  },
  error: {
    bg: 'rgba(239, 68, 68, 0.12)',
    border: 'rgba(239, 68, 68, 0.45)',
    fg: 'var(--color-fg)',
    label: 'Error',
  },
};

function dedupeStrings(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const key = item.trim();
    if (key.length === 0 || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function collectAllWarnings(response: WorkspaceAgentResponse): string[] {
  const fromTop = response.warnings ?? [];
  const fromSections: string[] = [];
  for (const section of response.sections) {
    if (section.kind === 'warning') {
      const messages = (section.content as { messages?: string[] }).messages;
      if (Array.isArray(messages)) fromSections.push(...messages);
    }
  }
  return dedupeStrings([...fromTop, ...fromSections]);
}

export default function WorkspaceAgentResponseDisplay({ response, onNextAction }: Props) {
  const status = STATUS_STYLES[response.status];
  const warnings = collectAllWarnings(response);

  return (
    <section style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span
          style={{
            backgroundColor: status.bg,
            color: status.fg,
            border: `1px solid ${status.border}`,
            padding: '2px 10px',
            borderRadius: 12,
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {status.label}
        </span>
        <span style={{ color: 'var(--color-muted)', fontSize: 12 }}>
          {response.intent.replace(/_/g, ' ')}
        </span>
        {response.summary && (
          <span style={{ fontSize: 14, fontWeight: 500 }}>{response.summary}</span>
        )}
      </header>

      {response.answer && (
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>{response.answer}</p>
      )}

      {response.sections.map((section, idx) => (
        <SectionRenderer key={idx} section={section} />
      ))}

      {warnings.length > 0 && <WarningsBlock warnings={warnings} />}

      {response.sourceRefs.length > 0 && <SourceRefsBlock refs={response.sourceRefs} />}

      {response.downloads && response.downloads.length > 0 && (
        <DownloadsBlock downloads={response.downloads} />
      )}

      {response.nextActions && response.nextActions.length > 0 && (
        <NextActionsBlock actions={response.nextActions} onSelect={onNextAction} />
      )}

      <ToolTraceBlock trace={response.toolTrace} />
    </section>
  );
}

function SectionRenderer({ section }: { section: AgentResponseSection }) {
  switch (section.kind) {
    case 'text':
      return <TextSection content={section.content as { body: string; title?: string }} />;
    case 'metric_list':
      return <MetricListSection content={section.content as { entries: Array<{ label: string; value: number | string; unit?: string }> }} />;
    case 'table':
      return <TableSection content={section.content as { columns: string[]; rows: Array<Record<string, unknown>>; title?: string; truncated?: boolean }} />;
    case 'evidence':
      return <EvidenceSection content={section.content as { entries: Array<{ fileName: string; snippet: string; sourceRange?: string }> }} />;
    case 'warning':
      // Warnings are rendered once at the top level (deduped). Skip the
      // per-section render to avoid showing "Warnings:" twice.
      return null;
    case 'downloads':
      return null; // handled at top level
    default:
      return null;
  }
}

function TextSection({ content }: { content: { body: string; title?: string } }) {
  return (
    <div>
      {content.title && <h4 style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 600 }}>{content.title}</h4>}
      <p style={{ margin: 0, fontSize: 13, whiteSpace: 'pre-wrap' }}>{content.body}</p>
    </div>
  );
}

function MetricListSection({ content }: { content: { entries: Array<{ label: string; value: number | string; unit?: string }> } }) {
  if (!content.entries.length) return null;
  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      {content.entries.map((e, i) => (
        <div
          key={i}
          style={{
            padding: '8px 12px',
            border: '1px solid var(--color-border)',
            borderRadius: 6,
            minWidth: 120,
          }}
        >
          <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>{e.label}</div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>
            {e.value}
            {e.unit && <span style={{ fontSize: 12, marginLeft: 4 }}>{e.unit}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

function TableSection({
  content,
}: {
  content: { columns: string[]; rows: Array<Record<string, unknown>>; title?: string; truncated?: boolean };
}) {
  if (!content.rows.length) return null;
  return (
    <div>
      {content.title && <h4 style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 600 }}>{content.title}</h4>}
      <div style={{ overflowX: 'auto', border: '1px solid var(--color-border)', borderRadius: 6 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              {content.columns.map((c) => (
                <th
                  key={c}
                  style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {content.rows.map((row, i) => (
              <tr key={i}>
                {content.columns.map((c) => (
                  <td key={c} style={{ padding: '6px 8px', borderBottom: '1px solid var(--color-border)' }}>
                    {formatCell(row[c])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {content.truncated && (
        <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--color-muted)' }}>Showing top rows only.</p>
      )}
    </div>
  );
}

function formatCell(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '—';
  if (typeof v === 'string') return v;
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return JSON.stringify(v);
}

function EvidenceSection({
  content,
}: {
  content: { entries: Array<{ fileName: string; snippet: string; sourceRange?: string }> };
}) {
  if (!content.entries.length) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {content.entries.map((e, i) => (
        <div
          key={i}
          style={{
            padding: 8,
            border: '1px solid var(--color-border)',
            borderRadius: 6,
            backgroundColor: 'var(--color-surface)',
          }}
        >
          <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>
            {e.fileName}
            {e.sourceRange && ` · ${e.sourceRange}`}
          </div>
          <div style={{ fontSize: 13, marginTop: 2 }}>{e.snippet}</div>
        </div>
      ))}
    </div>
  );
}

function WarningsBlock({ warnings }: { warnings: string[] }) {
  const unique = dedupeStrings(warnings);
  if (unique.length === 0) return null;
  return (
    <div
      style={{
        padding: 8,
        border: '1px solid rgba(245, 158, 11, 0.45)',
        borderRadius: 6,
        backgroundColor: 'rgba(245, 158, 11, 0.12)',
        color: 'var(--color-fg)',
        fontSize: 12,
      }}
      role="alert"
      aria-label="Warnings"
    >
      <strong>Warnings:</strong>
      <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
        {unique.map((w, i) => (
          <li key={i}>{w}</li>
        ))}
      </ul>
    </div>
  );
}

function SourceRefsBlock({ refs }: { refs: AgentSourceRef[] }) {
  return (
    <details>
      <summary style={{ cursor: 'pointer', fontSize: 12, color: 'var(--color-muted)' }}>
        Source references ({refs.length})
      </summary>
      <ul style={{ margin: '6px 0 0 16px', padding: 0, fontSize: 12 }}>
        {refs.slice(0, 50).map((r, i) => (
          <li key={i}>
            {r.fileName}
            {r.row !== undefined && ` · row ${r.row}`}
            {r.column && ` · ${r.column}`}
            {r.sourceRange && ` · ${r.sourceRange}`}
          </li>
        ))}
        {refs.length > 50 && <li>… {refs.length - 50} more</li>}
      </ul>
    </details>
  );
}

function DownloadsBlock({ downloads }: { downloads: AgentDownload[] }) {
  return (
    <div style={{ fontSize: 12 }}>
      <strong>Generated artifacts:</strong>
      <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
        {downloads.map((d, i) => (
          <li key={i}>
            {d.artifactName ?? d.label}
            {d.artifactName && d.label && d.artifactName !== d.label && ` — ${d.label}`}
          </li>
        ))}
      </ul>
    </div>
  );
}

function NextActionsBlock({
  actions,
  onSelect,
}: {
  actions: AgentNextAction[];
  onSelect?: (action: AgentNextAction) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {actions.map((a, i) => (
        <button
          key={i}
          onClick={() => onSelect?.(a)}
          style={{
            padding: '4px 10px',
            borderRadius: 14,
            border: '1px solid var(--color-border)',
            backgroundColor: 'transparent',
            color: 'var(--color-fg)',
            fontSize: 12,
            cursor: onSelect ? 'pointer' : 'default',
          }}
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}

function ToolTraceBlock({ trace }: { trace: WorkspaceAgentToolTrace[] }) {
  if (!trace.length) return null;
  return (
    <details>
      <summary style={{ cursor: 'pointer', fontSize: 12, color: 'var(--color-muted)' }}>
        Tool trace ({trace.length})
      </summary>
      <ul style={{ margin: '6px 0 0 16px', padding: 0, fontSize: 12 }}>
        {trace.map((t, i) => (
          <li key={i}>
            <code>{t.toolId}</code> · {t.status}
            {t.durationMs !== undefined && ` · ${t.durationMs}ms`}
            {t.summary && ` — ${t.summary}`}
          </li>
        ))}
      </ul>
    </details>
  );
}
