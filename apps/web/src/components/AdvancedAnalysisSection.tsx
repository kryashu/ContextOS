import { Card, EmptyState } from '@contextos/ui';
import WorkspaceContextReport from './WorkspaceContextReport';
import SourceProfileTable from './SourceProfileTable';
import SourceRelationshipPanel from './SourceRelationshipPanel';
import WorkspaceSummary from './WorkspaceSummary';
import SourceInventory from './SourceInventory';
import EntityTable from './EntityTable';
import RelationshipTable from './RelationshipTable';
import FindingsPanel from './FindingsPanel';
import MermaidDiagram from './MermaidDiagram';
import WorkbookProfileView from './WorkbookProfileView';
import CalculationPanel from './CalculationPanel';
import WorkspaceQA from './WorkspaceQA';
import ReportPanel from './ReportPanel';

type AnalysisState = 'none' | 'stale' | 'current' | 'failed';

interface AdvancedAnalysisSectionProps {
  analysisState: AnalysisState;
  workspaceId: string;
  // Analysis artifacts
  summary: Record<string, unknown> | null;
  workspaceCtx: Record<string, unknown> | null;
  sourceProfilesData: Array<Record<string, unknown>> | null;
  sourceRelationships: Record<string, unknown> | null;
  graph: { nodes?: Array<Record<string, unknown>>; edges?: Array<Record<string, unknown>> } | null;
  findings: Array<Record<string, unknown>> | null;
  dfdContent: string | null;
  // Workbook
  workbookProfile: Record<string, unknown> | null;
  normalizedObs: Array<Record<string, unknown>> | null;
  candidateMetrics: string[];
  calcFilterOptions: Record<string, string[]>;
  // Report
  hasReport: boolean;
  hasPdf: boolean;
  generateAction: () => Promise<{ success: boolean; message: string }>;
  downloadAction: () => Promise<{ success: boolean; content?: string; message: string }>;
  generatePdfAction: () => Promise<{ success: boolean; message: string }>;
  downloadPdfAction: () => Promise<{ success: boolean; content?: string; message: string }>;
}

export default function AdvancedAnalysisSection({
  analysisState,
  workspaceId,
  summary,
  workspaceCtx,
  sourceProfilesData,
  sourceRelationships,
  graph,
  findings,
  dfdContent,
  workbookProfile,
  normalizedObs,
  candidateMetrics,
  calcFilterOptions,
  hasReport,
  hasPdf,
  generateAction,
  downloadAction,
  generatePdfAction,
  downloadPdfAction,
}: AdvancedAnalysisSectionProps) {
  const isVisible = analysisState === 'current' || analysisState === 'stale';
  if (!isVisible) return null;

  const opacity = analysisState === 'stale' ? 0.7 : 1;

  return (
    <details style={{ marginTop: 24 }}>
      <summary
        style={{
          cursor: 'pointer',
          fontSize: 16,
          fontWeight: 600,
          padding: '8px 0',
          color: 'var(--color-fg)',
          userSelect: 'none',
        }}
      >
        🔬 Advanced Analysis
      </summary>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginTop: 16, opacity }}>
        {/* Workspace Context */}
        {workspaceCtx && <WorkspaceContextReport context={workspaceCtx} />}

        {/* Source Profiles */}
        {sourceProfilesData ? (
          <SourceProfileTable profiles={sourceProfilesData} />
        ) : (
          <EmptyState icon="📋" title="No source profiles available." subtitle="Source profiles are generated during analysis." />
        )}

        {/* Source Relationships */}
        {sourceRelationships ? (
          <SourceRelationshipPanel data={sourceRelationships} />
        ) : (
          <EmptyState icon="🔗" title="No source relationships available." subtitle="Relationships are detected during analysis." />
        )}

        {/* Workspace Summary */}
        {summary && <WorkspaceSummary data={summary} />}

        {/* Source Inventory */}
        {summary && <SourceInventory data={summary} />}

        {/* Entity/Relationship Graph */}
        {graph && <EntityTable nodes={graph.nodes ?? []} />}
        {graph && <RelationshipTable edges={graph.edges ?? []} nodes={graph.nodes ?? []} />}

        {/* Findings */}
        {findings && <FindingsPanel findings={findings} />}

        {/* DFD Diagram */}
        {dfdContent && <MermaidDiagram content={dfdContent} />}

        {/* Workbook Profile */}
        {workbookProfile && (
          <Card style={{ padding: 20 }}>
            <h2 style={{ margin: '0 0 16px', fontSize: 18 }}>📊 Workbook Profile</h2>
            <WorkbookProfileView profile={workbookProfile} observationCount={normalizedObs?.length ?? 0} />
          </Card>
        )}

        {/* Calculation Engine */}
        {normalizedObs && normalizedObs.length > 0 && (
          <Card style={{ padding: 20 }}>
            <h2 style={{ margin: '0 0 16px', fontSize: 18 }}>🧮 Table Calculations</h2>
            <CalculationPanel
              workspaceId={workspaceId}
              metrics={candidateMetrics}
              filterOptions={calcFilterOptions}
              analysisState={analysisState}
            />
          </Card>
        )}

        {/* Workspace Q&A */}
        <Card style={{ padding: 20 }}>
          <h2 style={{ margin: '0 0 16px', fontSize: 18 }}>💬 Workspace Q&amp;A</h2>
          <WorkspaceQA workspaceId={workspaceId} analysisState={analysisState} />
        </Card>

        {/* Report Panel */}
        <Card style={{ padding: 20 }}>
          <h2 style={{ margin: '0 0 16px', fontSize: 18 }}>📄 Workspace Report</h2>
          <ReportPanel
            workspaceId={workspaceId}
            hasReport={hasReport}
            hasPdf={hasPdf}
            generateAction={generateAction}
            downloadAction={downloadAction}
            generatePdfAction={generatePdfAction}
            downloadPdfAction={downloadPdfAction}
          />
        </Card>
      </div>
    </details>
  );
}
