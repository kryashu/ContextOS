/**
 * Workspace context — a global understanding of what a workspace
 * contains, what it is about, and what actions are available.
 * Written to workspace-context.json for every workspace.
 */

import type { SourceKind } from './source-profile.js';

export interface DetectedCapabilities {
  hasDocuments: boolean;
  hasWorkbooks: boolean;
  hasTables: boolean;
  canCalculate: boolean;
  canChart: boolean;
  canGenerateDFD: boolean;
  canAnswerQuestions: boolean;
  hasIrrelevantSources: boolean;
}

export interface RecommendedAction {
  action: string;
  reason: string;
  capability: string;
}

export interface IrrelevantSource {
  fileName: string;
  reason: string;
}

export interface WorkspaceContext {
  workspaceId: string;
  generatedAt: string;
  primaryTheme: string;
  sourceKindCounts: Record<SourceKind, number>;
  keyTopics: string[];
  keyEntities: string[];
  detectedCapabilities: DetectedCapabilities;
  recommendedActions: RecommendedAction[];
  irrelevantSources: IrrelevantSource[];
  assumptions: string[];
}
