import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { notFound } from 'next/navigation';

import { getWorkspace, getOutputDir, listSourceFiles, computeSourceHashes } from '@/lib/workspaces';
import { runWorkspaceAnalysis } from '../actions';

import WorkspaceSummary from '@/components/WorkspaceSummary';
import SourceInventory from '@/components/SourceInventory';
import EntityTable from '@/components/EntityTable';
import RelationshipTable from '@/components/RelationshipTable';
import FindingsPanel from '@/components/FindingsPanel';
import MermaidDiagram from '@/components/MermaidDiagram';
import RunAnalysisButton from '@/components/RunAnalysisButton';
import FileUpload from '@/components/FileUpload';
import SourceFileList from '@/components/SourceFileList';
import WorkbookProfileView from '@/components/WorkbookProfileView';
import CalculationPanel from '@/components/CalculationPanel';

export const dynamic = 'force-dynamic';

type AnalysisState = 'none' | 'stale' | 'current' | 'failed';

interface ManifestCapabilities {
  hasExcel: boolean;
  hasWorkbookProfile: boolean;
  hasNormalizedObservations: boolean;
  hasDfd: boolean;
  hasGraph: boolean;
  hasFindings: boolean;
  hasEval: boolean;
}

interface ManifestSourceEntry {
  fileName: string;
  fileType: string;
  hash: string;
  size: number;
}

interface AnalysisManifest {
  workspaceId: string;
  runId: string;
  generatedAt: string;
  sourceFiles: ManifestSourceEntry[];
  artifacts: string[];
  capabilities: ManifestCapabilities;
}

const STATUS_COLORS: Record<string, string> = {
  empty: '#6e7681',
  has_sources: '#d29922',
  analyzed: '#3fb950',
  analysis_failed: '#f85149',
};

const ANALYSIS_STATE_COLORS: Record<AnalysisState, string> = {
  none: '#6e7681',
  stale: '#d29922',
  current: '#3fb950',
  failed: '#f85149',
};

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

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

interface PageProps {
  params: { workspaceId: string };
}

export default function WorkspaceDetailPage({ params }: PageProps) {
  const workspace = getWorkspace(params.workspaceId);
  if (!workspace) notFound();

  const outputDir = getOutputDir(workspace.id);
  const sourceFiles = listSourceFiles(workspace.id);

  // ── Manifest-driven artifact loading ──────────────────────────────
  const manifestPath = resolve(outputDir, 'analysis-manifest.json');
  const manifest = readJSON(manifestPath) as AnalysisManifest | null;

  // Determine analysis state
  let analysisState: AnalysisState = 'none';
  if (manifest) {
    if (workspace.status === 'analysis_failed') {
      analysisState = 'failed';
    } else {
      // Validate source hashes
      const currentHashes = computeSourceHashes(workspace.id);
      const manifestHashes: Record<string, string> = {};
      for (const s of manifest.sourceFiles) {
        manifestHashes[s.fileName] = s.hash;
      }
      const currentKeys = Object.keys(currentHashes).sort();
      const manifestKeys = Object.keys(manifestHashes).sort();
      const hashesMatch =
        currentKeys.length === manifestKeys.length &&
        currentKeys.every(k => currentHashes[k] === manifestHashes[k]);

      analysisState = hashesMatch ? 'current' : 'stale';
    }
  } else if (workspace.status === 'analysis_failed') {
    analysisState = 'failed';
  }

  // Helper: check capability AND file existence
  function hasArtifact(capKey: keyof ManifestCapabilities, fileName: string): boolean {
    if (!manifest) return false;
    return manifest.capabilities[capKey] && existsSync(resolve(outputDir, fileName));
  }

  // Only load artifacts that the manifest says exist AND are on disk
  const hasSummary = manifest !== null && existsSync(resolve(outputDir, 'workspace-summary.json'));
  const summary = hasSummary
    ? readJSON(resolve(outputDir, 'workspace-summary.json')) as Record<string, unknown> | null
    : null;

  const graph = hasArtifact('hasGraph', 'relationship-graph.json')
    ? readJSON(resolve(outputDir, 'relationship-graph.json')) as {
        nodes?: Array<Record<string, unknown>>;
        edges?: Array<Record<string, unknown>>;
      } | null
    : null;

  const findings = hasArtifact('hasFindings', 'findings.json')
    ? readJSON(resolve(outputDir, 'findings.json')) as Array<Record<string, unknown>> | null
    : null;

  const dfdContent = hasArtifact('hasDfd', 'dfd-level-0.mmd')
    ? readText(resolve(outputDir, 'dfd-level-0.mmd'))
    : null;

  // Workbook artifacts: also verify source files still exist in workspace
  let workbookProfile: Record<string, unknown> | null = null;
  let normalizedObs: Array<Record<string, unknown>> | null = null;
  if (hasArtifact('hasWorkbookProfile', 'workbook-profile.json')) {
    const sourceNames = new Set(sourceFiles.map(f => f.name));
    const hasXlsxSource = sourceFiles.some(f => f.type === 'xlsx');
    if (hasXlsxSource) {
      workbookProfile = readJSON(resolve(outputDir, 'workbook-profile.json')) as Record<string, unknown> | null;
    }
    if (hasArtifact('hasNormalizedObservations', 'normalized-observations.json') && hasXlsxSource) {
      normalizedObs = readJSON(resolve(outputDir, 'normalized-observations.json')) as Array<Record<string, unknown>> | null;
    }
  }

  // Extract calculation panel data from observations
  const candidateMetrics = workbookProfile
    ? (workbookProfile['candidateMetrics'] ?? []) as string[]
    : [];

  const calcFilterOptions: Record<string, string[]> = {};
  if (normalizedObs) {
    for (const field of ['section', 'treatment', 'plantPart', 'variety'] as const) {
      const values = [...new Set(
        normalizedObs
          .map(o => o[field] as string | undefined)
          .filter((v): v is string => typeof v === 'string' && v.length > 0),
      )].sort();
      if (values.length > 0) {
        calcFilterOptions[field] = values;
      }
    }
  }

  const generatedAt = manifest?.generatedAt ?? (summary?.['generatedAt'] as string | undefined);
  const statusColor = STATUS_COLORS[workspace.status] ?? '#6e7681';

  async function runAnalysis(): Promise<{ success: boolean; message: string }> {
    'use server';
    return runWorkspaceAnalysis(workspace!.id);
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24 }}>
            📁 {workspace.name}
            <span style={{
              marginLeft: 10,
              fontSize: 12,
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: 4,
              backgroundColor: statusColor,
              color: '#fff',
              verticalAlign: 'middle',
              textTransform: 'uppercase',
            }}>
              {workspace.status.replace('_', ' ')}
            </span>
          </h1>
          <p style={{ margin: '4px 0 0', color: '#8b949e', fontSize: 14 }}>
            {workspace.description || workspace.id}
            {generatedAt && analysisState === 'current' && (
              <span style={{ marginLeft: 12 }}>
                🕐 Generated {formatRelativeTime(generatedAt)}
              </span>
            )}
          </p>
        </div>
        {sourceFiles.length > 0 && <RunAnalysisButton action={runAnalysis} />}
      </div>

      {/* Analysis State Banner */}
      {analysisState === 'stale' && (
        <div style={{
          border: '1px solid #d29922',
          borderRadius: 8,
          padding: '12px 20px',
          backgroundColor: '#2d2200',
          color: '#d29922',
          marginBottom: 24,
          fontSize: 14,
        }}>
          ⚠️ Analysis is stale. Sources changed after this report was generated. Click &quot;Run Analysis&quot; to update.
        </div>
      )}

      {analysisState === 'failed' && (
        <div style={{
          border: '1px solid #f85149',
          borderRadius: 8,
          padding: '12px 20px',
          backgroundColor: '#2d0000',
          color: '#f85149',
          marginBottom: 24,
          fontSize: 14,
        }}>
          ❌ Analysis failed. Try running analysis again or check the uploaded source files.
        </div>
      )}

      {/* Source Files Section */}
      <div style={{
        border: '1px solid #30363d',
        borderRadius: 8,
        padding: 20,
        backgroundColor: '#161b22',
        marginBottom: 24,
      }}>
        <h2 style={{ margin: '0 0 16px', fontSize: 18 }}>📄 Source Files ({sourceFiles.length})</h2>
        <FileUpload workspaceId={workspace.id} />
        <SourceFileList files={sourceFiles} />
      </div>

      {/* No analysis yet */}
      {analysisState === 'none' && sourceFiles.length > 0 && (
        <div style={{
          border: '1px solid #30363d',
          borderRadius: 8,
          padding: 32,
          textAlign: 'center',
          color: '#8b949e',
        }}>
          <p style={{ fontSize: 18, margin: '0 0 8px' }}>No analysis results yet.</p>
          <p style={{ margin: 0 }}>Click &quot;Run Analysis&quot; to process the uploaded files.</p>
        </div>
      )}

      {analysisState === 'none' && sourceFiles.length === 0 && (
        <div style={{
          border: '1px solid #30363d',
          borderRadius: 8,
          padding: 32,
          textAlign: 'center',
          color: '#8b949e',
        }}>
          <p style={{ fontSize: 18, margin: '0 0 8px' }}>Upload source files to begin.</p>
          <p style={{ margin: 0 }}>Supported formats: .md, .csv, .json, .txt, .yaml, .yml, .xlsx</p>
        </div>
      )}

      {/* Analysis Results — only render when manifest exists and state is current or stale */}
      {(analysisState === 'current' || analysisState === 'stale') && summary && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
          opacity: analysisState === 'stale' ? 0.7 : 1,
        }}>
          <WorkspaceSummary data={summary} />
          <SourceInventory data={summary} />
          {graph && <EntityTable nodes={graph.nodes ?? []} />}
          {graph && <RelationshipTable edges={graph.edges ?? []} nodes={graph.nodes ?? []} />}
          {findings && <FindingsPanel findings={findings} />}
          {dfdContent && <MermaidDiagram content={dfdContent} />}
        </div>
      )}

      {/* Workbook Intelligence — only when manifest confirms it */}
      {(analysisState === 'current' || analysisState === 'stale') && workbookProfile && (
        <div style={{
          border: '1px solid #30363d',
          borderRadius: 8,
          padding: 20,
          backgroundColor: '#161b22',
          marginTop: summary ? 24 : 0,
          opacity: analysisState === 'stale' ? 0.7 : 1,
        }}>
          <h2 style={{ margin: '0 0 16px', fontSize: 18 }}>📊 Workbook Profile</h2>
          <WorkbookProfileView profile={workbookProfile} observationCount={normalizedObs?.length ?? 0} />
        </div>
      )}

      {/* Calculation Engine — when observations are available */}
      {(analysisState === 'current' || analysisState === 'stale') && normalizedObs && normalizedObs.length > 0 && (
        <div style={{
          border: '1px solid #30363d',
          borderRadius: 8,
          padding: 20,
          backgroundColor: '#161b22',
          marginTop: 24,
          opacity: analysisState === 'stale' ? 0.7 : 1,
        }}>
          <h2 style={{ margin: '0 0 16px', fontSize: 18 }}>🧮 Table Calculations</h2>
          <CalculationPanel
            workspaceId={workspace.id}
            metrics={candidateMetrics}
            filterOptions={calcFilterOptions}
            analysisState={analysisState}
          />
        </div>
      )}
    </div>
  );
}
