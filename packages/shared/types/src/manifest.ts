/**
 * Analysis manifest — written after every analysis run.
 * Used by the UI to determine what artifacts exist, whether
 * the analysis is current, and which capabilities are available.
 */

export interface ManifestSourceEntry {
  fileName: string;
  fileType: string;
  hash: string;
  size: number;
}

export interface ManifestCapabilities {
  hasExcel: boolean;
  hasWorkbookProfile: boolean;
  hasNormalizedObservations: boolean;
  hasDfd: boolean;
  hasGraph: boolean;
  hasFindings: boolean;
  hasEval: boolean;
  hasSourceProfiles: boolean;
  hasWorkspaceContext: boolean;
}

export interface AnalysisManifest {
  workspaceId: string;
  runId: string;
  generatedAt: string;
  sourceFiles: ManifestSourceEntry[];
  artifacts: string[];
  capabilities: ManifestCapabilities;
}
