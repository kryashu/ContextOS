import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { PdfReportRenderer } from '@contextos/qa';
import { validateArtifactWrite } from '../safety.js';
import type { ContextOSTool, ToolExecutionContext } from '../types.js';

const PDF_FILENAME = 'workspace-report.pdf';

const inputSchema = z.object({
  workspaceId: z.string().min(1),
});

const outputSchema = z.object({ path: z.string() });

export const generatePdfReport: ContextOSTool<
  z.infer<typeof inputSchema>,
  { path: string }
> = {
  id: 'generatePdfReport',
  name: 'Generate PDF Report',
  description: 'Generate a PDF version of the workspace report. Requires the Markdown report to exist.',
  category: 'reporting',
  safetyLevel: 'artifact_write',
  allowedWrites: [PDF_FILENAME],
  requiresCurrentAnalysis: true,
  requiresModel: false,
  inputSchema,
  outputSchema,
  async execute(_input, context: ToolExecutionContext) {
    validateArtifactWrite(PDF_FILENAME, this.allowedWrites!);

    const mdPath = resolve(context.outputDir, 'workspace-report.md');
    if (!existsSync(mdPath)) {
      throw new Error('Generate the Markdown report first.');
    }

    const markdown = readFileSync(mdPath, 'utf-8');
    const renderer = new PdfReportRenderer();
    const pdfBuffer = await renderer.render(markdown);
    writeFileSync(resolve(context.outputDir, PDF_FILENAME), pdfBuffer);

    return { path: PDF_FILENAME };
  },
};
