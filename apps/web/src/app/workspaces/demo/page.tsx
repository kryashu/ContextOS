import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

import WorkspaceSummary from '@/components/WorkspaceSummary';
import SourceInventory from '@/components/SourceInventory';
import EntityTable from '@/components/EntityTable';
import RelationshipTable from '@/components/RelationshipTable';
import FindingsPanel from '@/components/FindingsPanel';
import MermaidDiagram from '@/components/MermaidDiagram';
import EvalReport from '@/components/EvalReport';
import RunAnalysisButton from '@/components/RunAnalysisButton';
import { runAnalysis } from './actions';

/** Monorepo root — apps/web -> apps -> root */
const ROOT_DIR = resolve(process.cwd(), '..', '..');
const OUTPUT_DIR = resolve(ROOT_DIR, 'demo-workspaces/checkout-system/output');

const PROVIDER_COLORS: Record<string, string> = {
  mock: '#6e7681',
  groq: '#58a6ff',
  gemini: '#bc8cff',
  ollama: '#3fb950',
  openai: '#79c0ff',
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

function readJSON(filePath: string): unknown | null {
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

function readText(filePath: string): string | null {
  if (!existsSync(filePath)) return null;
  try {
    return readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

export const dynamic = 'force-dynamic';

export default function DemoWorkspacePage() {
  const summary = readJSON(resolve(OUTPUT_DIR, 'workspace-summary.json')) as Record<string, unknown> | null;
  const graph = readJSON(resolve(OUTPUT_DIR, 'relationship-graph.json')) as {
    nodes?: Array<Record<string, unknown>>;
    edges?: Array<Record<string, unknown>>;
  } | null;
  const findings = readJSON(resolve(OUTPUT_DIR, 'findings.json')) as Array<Record<string, unknown>> | null;
  const dfdContent = readText(resolve(OUTPUT_DIR, 'dfd-level-0.mmd'));
  const evalReport = readJSON(resolve(ROOT_DIR, 'eval-report.json')) as Record<string, unknown> | null;

  const hasData = summary !== null;

  const provider = process.env['LLM_PROVIDER'] ?? 'mock';
  const providerColor = PROVIDER_COLORS[provider] ?? '#6e7681';
  const generatedAt = summary?.['generatedAt'] as string | undefined;
  const evaluatedAt = evalReport?.['evaluatedAt'] as string | undefined;
  const isEvalStale = !!(generatedAt && evaluatedAt && new Date(evaluatedAt) < new Date(generatedAt));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24 }}>
            📁 checkout-system
            <span style={{
              marginLeft: 10,
              fontSize: 12,
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: 4,
              backgroundColor: providerColor,
              color: '#fff',
              verticalAlign: 'middle',
              textTransform: 'uppercase',
            }}>
              {provider}
            </span>
          </h1>
          <p style={{ margin: '4px 0 0', color: 'var(--color-muted)', fontSize: 14 }}>
            demo-workspaces/checkout-system
            {generatedAt && (
              <span style={{ marginLeft: 12 }}>
                🕐 Generated {formatRelativeTime(generatedAt)}
              </span>
            )}
          </p>
        </div>
        <RunAnalysisButton action={runAnalysis} />
      </div>

      {!hasData && (
        <div style={{
          border: '1px solid var(--color-border)',
          borderRadius: 8,
          padding: 32,
          textAlign: 'center',
          color: 'var(--color-muted)',
        }}>
          <p style={{ fontSize: 18, margin: '0 0 8px' }}>No analysis data found.</p>
          <p style={{ margin: 0 }}>Click &quot;Run Analysis&quot; to process the demo workspace.</p>
        </div>
      )}

      {hasData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <WorkspaceSummary data={summary!} />
          <SourceInventory data={summary!} />
          <EntityTable nodes={graph?.nodes ?? []} />
          <RelationshipTable edges={graph?.edges ?? []} nodes={graph?.nodes ?? []} />
          <FindingsPanel findings={findings ?? []} />
          {dfdContent && <MermaidDiagram content={dfdContent} />}
          {evalReport && <EvalReport report={evalReport} isStale={isEvalStale} />}
        </div>
      )}
    </div>
  );
}
