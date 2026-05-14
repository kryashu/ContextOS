import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { WorkspaceReportGenerator } from '@contextos/qa';
import { validateArtifactWrite } from '../safety.js';
import type { ContextOSTool, ToolExecutionContext } from '../types.js';

const REPORT_FILENAME = 'workspace-report.md';

const inputSchema = z.object({
  workspaceId: z.string().min(1),
});

const outputSchema = z.object({ path: z.string() });

export const generateMarkdownReport: ContextOSTool<
  z.infer<typeof inputSchema>,
  { path: string }
> = {
  id: 'generateMarkdownReport',
  name: 'Generate Markdown Report',
  description: 'Generate a comprehensive Markdown report of the workspace analysis.',
  category: 'reporting',
  safetyLevel: 'artifact_write',
  allowedWrites: [REPORT_FILENAME],
  requiresCurrentAnalysis: true,
  requiresModel: false,
  inputSchema,
  outputSchema,
  async execute(_input, context: ToolExecutionContext) {
    validateArtifactWrite(REPORT_FILENAME, this.allowedWrites!);

    const generator = new WorkspaceReportGenerator(context.outputDir, context.sourcesDir);
    const markdown = generator.generate();
    const outPath = resolve(context.outputDir, REPORT_FILENAME);
    writeFileSync(outPath, markdown);

    return { path: REPORT_FILENAME };
  },
};
