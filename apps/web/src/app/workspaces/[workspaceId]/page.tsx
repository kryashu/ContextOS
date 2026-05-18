import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { notFound } from 'next/navigation';

import { getWorkspace, getOutputDir, listSourceFiles, computeSourceHashes } from '@/lib/workspaces';
import { formatRelativeTime } from '@/lib/utils';
import { Badge, Banner, EmptyState, Card } from '@contextos/ui';
import { runWorkspaceAnalysis, runWorkspaceAgentAction, planWorkspaceCommandAction, runTableQueryAction, generateReportAction, downloadReportAction, generatePdfReportAction, downloadPdfReportAction } from '../actions';

import WorkspaceAgentPanel from '@/components/WorkspaceAgentPanel';
import WorkspaceSummary from '@/components/WorkspaceSummary';
import SourceInventory from '@/components/SourceInventory';
import EntityTable from '@/components/EntityTable';
import RelationshipTable from '@/components/RelationshipTable';
import FindingsPanel from '@/components/FindingsPanel';
import MermaidDiagram from '@/components/MermaidDiagram';
import RunAnalysisButton from '@/components/RunAnalysisButton';
import FileUpload from '@/components/FileUpload';
import SourceFileList from '@/components/SourceFileList';
import DeleteWorkspaceButton from '@/components/DeleteWorkspaceButton';
import WorkbookProfileView from '@/components/WorkbookProfileView';
import CalculationPanel from '@/components/CalculationPanel';
import WorkspaceContextReport from '@/components/WorkspaceContextReport';
import SourceProfileTable from '@/components/SourceProfileTable';
import SourceRelationshipPanel from '@/components/SourceRelationshipPanel';
import WorkspaceQA from '@/components/WorkspaceQA';
import ReportPanel from '@/components/ReportPanel';

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
  hasSourceProfiles: boolean;
  hasWorkspaceContext: boolean;
  hasSourceRelationships: boolean;
  hasReport: boolean;
  hasPdf: boolean;
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

  // Workspace context & source profiles (VS005)
  const workspaceCtx = hasArtifact('hasWorkspaceContext' as keyof ManifestCapabilities, 'workspace-context.json')
    ? readJSON(resolve(outputDir, 'workspace-context.json')) as Record<string, unknown> | null
    : null;

  const sourceProfilesData = hasArtifact('hasSourceProfiles' as keyof ManifestCapabilities, 'source-profiles.json')
    ? readJSON(resolve(outputDir, 'source-profiles.json')) as Array<Record<string, unknown>> | null
    : null;

  // Source relationships (VS007)
  const sourceRelationships = hasArtifact('hasSourceRelationships' as keyof ManifestCapabilities, 'workspace-relationships.json')
    ? readJSON(resolve(outputDir, 'workspace-relationships.json')) as Record<string, unknown> | null
    : null;

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
            <Badge color={statusColor}>
              {workspace.status.replace('_', ' ')}
            </Badge>
          </h1>
          <p style={{ margin: '4px 0 0', color: 'var(--color-muted)', fontSize: 14 }}>
            {workspace.description || workspace.id}
            {generatedAt && analysisState === 'current' && (
              <span style={{ marginLeft: 12 }}>
                🕐 Generated {formatRelativeTime(generatedAt)}
              </span>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          {sourceFiles.length > 0 && <RunAnalysisButton action={runAnalysis} />}
          <DeleteWorkspaceButton workspaceId={workspace.id} workspaceName={workspace.name} />
        </div>
      </div>

      {/* Analysis State Banner */}
      {analysisState === 'stale' && (
        <div style={{ marginBottom: 16 }}>
          <Banner variant="warning">
            ⚠️ Analysis is stale. Sources changed after this report was generated. Click &quot;Run Analysis&quot; to update.
          </Banner>
        </div>
      )}

      {analysisState === 'failed' && (
        <Banner variant="error">
          ❌ Analysis failed. Try running analysis again or check the uploaded source files.
        </Banner>
      )}

      {/* Source Files Section */}
      <Card style={{ padding: 20, marginBottom: 24 }}>
        <h2 style={{ margin: '0 0 16px', fontSize: 18 }}>📄 Source Files ({sourceFiles.length})</h2>
        <FileUpload workspaceId={workspace.id} />
        <SourceFileList files={sourceFiles} workspaceId={workspace.id} allowDelete />
      </Card>

      {/* Workspace Agent */}
      <WorkspaceAgentPanel
        workspaceId={workspace.id}
        analysisState={analysisState}
        runAgentAction={async (goal: string, allowWrites?: boolean) => {
          'use server';
          return runWorkspaceAgentAction(workspace.id, goal, allowWrites);
        }}
        planCommandAction={async (command: string) => {
          'use server';
          return planWorkspaceCommandAction(workspace.id, command);
        }}
        runTableQueryAction={async (filters, aggregations, fileScope?, includeRows?) => {
          'use server';
          return runTableQueryAction(workspace.id, filters, aggregations, fileScope, includeRows);
        }}
      />

      {/* No analysis yet */}
      {analysisState === 'none' && sourceFiles.length > 0 && (
        <EmptyState
          icon="📊"
          title="No analysis results yet."
          subtitle='Click "Run Analysis" to process the uploaded files.'
        />
      )}

      {analysisState === 'none' && sourceFiles.length === 0 && (
        <EmptyState
          icon="📁"
          title="Upload source files to begin."
          subtitle="Supported formats: .md, .csv, .json, .txt, .yaml, .yml, .xlsx, .pdf, .docx"
        />
      )}

      {/* Analysis Results — only render when manifest exists and state is current or stale */}
      {(analysisState === 'current' || analysisState === 'stale') && summary && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
          opacity: analysisState === 'stale' ? 0.7 : 1,
        }}>
          {workspaceCtx && <WorkspaceContextReport context={workspaceCtx} />}
          {sourceProfilesData ? <SourceProfileTable profiles={sourceProfilesData} /> : (
            <EmptyState icon="📋" title="No source profiles available." subtitle="Source profiles are generated during analysis." />
          )}
          {sourceRelationships ? <SourceRelationshipPanel data={sourceRelationships} /> : (
            <EmptyState icon="🔗" title="No source relationships available." subtitle="Relationships are detected during analysis." />
          )}
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
        <Card style={{
          padding: 20,
          marginTop: summary ? 24 : 0,
          opacity: analysisState === 'stale' ? 0.7 : 1,
        }}>
          <h2 style={{ margin: '0 0 16px', fontSize: 18 }}>📊 Workbook Profile</h2>
          <WorkbookProfileView profile={workbookProfile} observationCount={normalizedObs?.length ?? 0} />
        </Card>
      )}

      {/* Calculation Engine — when observations are available */}
      {(analysisState === 'current' || analysisState === 'stale') && normalizedObs && normalizedObs.length > 0 && (
        <Card style={{
          padding: 20,
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
        </Card>
      )}

      {/* Workspace Q&A */}
      {(analysisState === 'current' || analysisState === 'stale') && (
        <Card style={{
          padding: 20,
          marginTop: 24,
          opacity: analysisState === 'stale' ? 0.7 : 1,
        }}>
          <h2 style={{ margin: '0 0 16px', fontSize: 18 }}>💬 Workspace Q&amp;A</h2>
          <WorkspaceQA workspaceId={workspace.id} analysisState={analysisState} />
        </Card>
      )}

      {/* Workspace Report Export */}
      {(analysisState === 'current' || analysisState === 'stale') && (
        <Card style={{
          padding: 20,
          marginTop: 24,
          opacity: analysisState === 'stale' ? 0.7 : 1,
        }}>
          <h2 style={{ margin: '0 0 16px', fontSize: 18 }}>📄 Workspace Report</h2>
          <ReportPanel
            workspaceId={workspace.id}
            hasReport={hasArtifact('hasReport', 'workspace-report.md')}
            hasPdf={hasArtifact('hasPdf', 'workspace-report.pdf')}
            generateAction={async () => {
              'use server';
              return generateReportAction(workspace.id);
            }}
            downloadAction={async () => {
              'use server';
              return downloadReportAction(workspace.id);
            }}
            generatePdfAction={async () => {
              'use server';
              return generatePdfReportAction(workspace.id);
            }}
            downloadPdfAction={async () => {
              'use server';
              return downloadPdfReportAction(workspace.id);
            }}
          />
        </Card>
      )}
    </div>
  );
}
