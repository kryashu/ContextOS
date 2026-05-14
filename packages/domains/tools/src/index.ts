// ── Types ────────────────────────────────────────────────────────────
export type {
  SafetyLevel,
  ToolCategory,
  ContextOSTool,
  ToolExecutionContext,
  ToolDescriptor,
} from './types.js';

// ── Errors ──────────────────────────────────────────────────────────
export {
  ToolNotFoundError,
  ToolInputValidationError,
  StaleAnalysisError,
  ArtifactWriteViolationError,
  InvalidWorkspaceIdError,
} from './errors.js';

// ── Safety utilities ────────────────────────────────────────────────
export { validateArtifactWrite, assertAnalysisCurrent, loadManifest } from './safety.js';

// ── Workspace path utilities ────────────────────────────────────────
export { validateWorkspaceId, buildContext } from './workspace-paths.js';

// ── Registry ────────────────────────────────────────────────────────
export { ToolRegistry, toolRegistry } from './registry.js';

// ── Individual tools (for direct use) ───────────────────────────────
export { checkAnalysisState } from './tools/check-analysis-state.js';
export { getWorkspaceContext } from './tools/get-workspace-context.js';
export { getSourceProfiles } from './tools/get-source-profiles.js';
export { getSourceRelationshipMap } from './tools/get-source-relationship-map.js';
export { getWorkbookProfile } from './tools/get-workbook-profile.js';
export { getNormalizedObservations } from './tools/get-normalized-observations.js';
export { getSuggestedQuestions } from './tools/get-suggested-questions.js';
export { askWorkspaceQuestion } from './tools/ask-workspace-question.js';
export { runCalculation } from './tools/run-calculation.js';
export { generateMarkdownReport } from './tools/generate-markdown-report.js';
export { generatePdfReport } from './tools/generate-pdf-report.js';

// ── Register all tools on import ────────────────────────────────────
import { registerAllTools } from './register-all.js';
registerAllTools();
