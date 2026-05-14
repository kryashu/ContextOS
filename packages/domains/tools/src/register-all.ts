import { toolRegistry } from './registry.js';

import { checkAnalysisState } from './tools/check-analysis-state.js';
import { getWorkspaceContext } from './tools/get-workspace-context.js';
import { getSourceProfiles } from './tools/get-source-profiles.js';
import { getSourceRelationshipMap } from './tools/get-source-relationship-map.js';
import { getWorkbookProfile } from './tools/get-workbook-profile.js';
import { getNormalizedObservations } from './tools/get-normalized-observations.js';
import { getSuggestedQuestions } from './tools/get-suggested-questions.js';
import { askWorkspaceQuestion } from './tools/ask-workspace-question.js';
import { runCalculation } from './tools/run-calculation.js';
import { generateMarkdownReport } from './tools/generate-markdown-report.js';
import { generatePdfReport } from './tools/generate-pdf-report.js';

export function registerAllTools(): void {
  toolRegistry.register(checkAnalysisState);
  toolRegistry.register(getWorkspaceContext);
  toolRegistry.register(getSourceProfiles);
  toolRegistry.register(getSourceRelationshipMap);
  toolRegistry.register(getWorkbookProfile);
  toolRegistry.register(getNormalizedObservations);
  toolRegistry.register(getSuggestedQuestions);
  toolRegistry.register(askWorkspaceQuestion);
  toolRegistry.register(runCalculation);
  toolRegistry.register(generateMarkdownReport);
  toolRegistry.register(generatePdfReport);
}
