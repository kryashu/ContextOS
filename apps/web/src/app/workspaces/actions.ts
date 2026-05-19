'use server';

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  createWorkspace as createWs,
  getWorkspace,
  getSourcesDir,
  getWorkspaceDir,
  getOutputDir,
  clearOutputDir,
  updateWorkspace,
  computeSourceHashes,
  deleteWorkspace,
  deleteSourceFile,
} from '@/lib/workspaces';
import { TableCalculator } from '@contextos/calculator';
import { WorkspaceAnswerComposer, LocalRetriever, WorkspaceReportGenerator, PdfReportRenderer } from '@contextos/qa';
import { getModelForTask, TaskType } from '@contextos/ai';
import { toolRegistry, setDataRoot } from '@contextos/tools';
import { WorkspaceAnalystAgent, WorkspaceCommandAgent } from '@contextos/agents';
import type { AgentRunResult, WorkspaceAgentResponse } from '@contextos/agents';
import { createWorkspaceCommandPlan } from '@contextos/orchestrator';
import type { WorkspaceCommandPlan } from '@contextos/orchestrator';
import type { TableQueryResult } from '@contextos/table-query';
import type { WorkspaceAnswer } from '@contextos/types';

/** Monorepo root — apps/web -> apps -> root */
const ROOT_DIR = resolve(process.cwd(), '..', '..');
setDataRoot(ROOT_DIR);

const ALLOWED_EXTENSIONS = ['.md', '.csv', '.json', '.txt', '.yaml', '.yml', '.xlsx', '.pdf', '.docx'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB (xlsx can be larger)
const MAX_FILES = 50;

export async function createWorkspaceAction(
  formData: FormData,
): Promise<{ success: boolean; workspaceId?: string; message: string }> {
  try {
    const name = formData.get('name');
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return { success: false, message: 'Workspace name is required.' };
    }

    const description = formData.get('description');
    const entry = createWs(
      name.trim(),
      typeof description === 'string' ? description.trim() : undefined,
    );

    return { success: true, workspaceId: entry.id, message: 'Workspace created.' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: `Failed to create workspace: ${msg}` };
  }
}

export interface FileResult {
  fileName: string;
  status: 'accepted' | 'rejected';
  reason?: string;
}

export async function uploadFilesAction(
  workspaceId: string,
  formData: FormData,
): Promise<{ success: boolean; fileCount: number; message: string; fileResults?: FileResult[] }> {
  try {
    const workspace = getWorkspace(workspaceId);
    if (!workspace) {
      return { success: false, fileCount: 0, message: 'Workspace not found.' };
    }

    const files = formData.getAll('files') as File[];
    if (files.length === 0) {
      return { success: false, fileCount: 0, message: 'No files provided.' };
    }
    if (files.length > MAX_FILES) {
      return { success: false, fileCount: 0, message: `Maximum ${MAX_FILES} files per upload.` };
    }

    const sourcesDir = getSourcesDir(workspaceId);
    let uploaded = 0;
    const fileResults: FileResult[] = [];

    for (const file of files) {
      if (!(file instanceof File) || file.size === 0) {
        if (file instanceof File) {
          fileResults.push({ fileName: file.name, status: 'rejected', reason: 'empty' });
        }
        continue;
      }

      // Validate extension
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        fileResults.push({ fileName: file.name, status: 'rejected', reason: 'unsupported_extension' });
        continue;
      }

      // Validate size
      if (file.size > MAX_FILE_SIZE) {
        fileResults.push({ fileName: file.name, status: 'rejected', reason: 'oversized' });
        continue;
      }

      // Sanitize filename — only allow alphanumeric, hyphens, underscores, dots
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const buffer = Buffer.from(await file.arrayBuffer());
      try {
        writeFileSync(resolve(sourcesDir, safeName), buffer);
        uploaded++;
        fileResults.push({ fileName: safeName, status: 'accepted' });
      } catch {
        fileResults.push({ fileName: file.name, status: 'rejected', reason: 'write_failed' });
      }
    }

    updateWorkspace(workspaceId, {
      sourceCount: uploaded + workspace.sourceCount,
      status: uploaded > 0 ? 'has_sources' : workspace.status,
    });

    // Clear stale output when new files are uploaded
    if (uploaded > 0) {
      clearOutputDir(workspaceId);
    }

    return {
      success: true,
      fileCount: uploaded,
      message: `Uploaded ${uploaded} file${uploaded !== 1 ? 's' : ''}.`,
      fileResults,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, fileCount: 0, message: `Upload failed: ${msg}` };
  }
}

export async function runWorkspaceAnalysis(
  workspaceId: string,
): Promise<{ success: boolean; message: string }> {
  try {
    const workspace = getWorkspace(workspaceId);
    if (!workspace) {
      return { success: false, message: 'Workspace not found.' };
    }

    const workspaceDir = getWorkspaceDir(workspaceId);

    // Clear stale output before running analysis
    clearOutputDir(workspaceId);

    execFileSync('pnpm', ['contextos', 'analyze', workspaceDir], {
      cwd: ROOT_DIR,
      stdio: 'pipe',
      timeout: 120_000,
      env: { ...process.env, FORCE_COLOR: '0' },
    });

    updateWorkspace(workspaceId, { status: 'analyzed' });

    return { success: true, message: 'Analysis completed.' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    updateWorkspace(workspaceId, { status: 'analysis_failed' });
    return { success: false, message: `Analysis failed: ${msg}` };
  }
}

export async function runCalculation(
  workspaceId: string,
  request: {
    metric: string;
    operation: string;
    groupBy?: string;
    filters?: Array<{ field: string; operator: string; value: string | number | string[] }>;
    sort?: { field: string; direction: string };
    limit?: number;
  },
): Promise<{ success: boolean; result?: unknown; message: string }> {
  try {
    const workspace = getWorkspace(workspaceId);
    if (!workspace) {
      return { success: false, message: 'Workspace not found.' };
    }

    const outputDir = getOutputDir(workspaceId);

    // Validate manifest exists and has observations
    const manifestPath = resolve(outputDir, 'analysis-manifest.json');
    if (!existsSync(manifestPath)) {
      return { success: false, message: 'No analysis manifest found. Run analysis first.' };
    }

    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    if (!manifest.capabilities?.hasNormalizedObservations) {
      return { success: false, message: 'No normalized observations available. Upload an Excel file and run analysis.' };
    }

    // Validate analysis is current (not stale)
    const currentHashes = computeSourceHashes(workspaceId);
    const manifestHashes: Record<string, string> = {};
    for (const s of manifest.sourceFiles ?? []) {
      manifestHashes[s.fileName] = s.hash;
    }
    const currentKeys = Object.keys(currentHashes).sort();
    const manifestKeys = Object.keys(manifestHashes).sort();
    const hashesMatch =
      currentKeys.length === manifestKeys.length &&
      currentKeys.every((k: string) => currentHashes[k] === manifestHashes[k]);

    if (!hashesMatch) {
      return { success: false, message: 'Analysis is stale. Re-run analysis before calculating.' };
    }

    // Read observations
    const obsPath = resolve(outputDir, 'normalized-observations.json');
    if (!existsSync(obsPath)) {
      return { success: false, message: 'normalized-observations.json not found.' };
    }

    const observations = JSON.parse(readFileSync(obsPath, 'utf-8'));
    if (!Array.isArray(observations)) {
      return { success: false, message: 'Invalid observations data.' };
    }

    // Run calculation
    const calculator = new TableCalculator(observations);
    const result = calculator.calculate(request as Parameters<typeof calculator.calculate>[0]);

    // Persist result
    writeFileSync(
      resolve(outputDir, 'calculation-results.json'),
      JSON.stringify(result, null, 2),
    );

    return { success: true, result, message: 'Calculation completed.' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: `Calculation failed: ${msg}` };
  }
}

export async function deleteWorkspaceAction(
  workspaceId: string,
): Promise<{ success: boolean; message: string }> {
  try {
    deleteWorkspace(workspaceId);
    return { success: true, message: 'Workspace deleted.' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: `Failed to delete workspace: ${msg}` };
  }
}

export async function deleteSourceFileAction(
  workspaceId: string,
  fileName: string,
): Promise<{ success: boolean; message: string }> {
  try {
    deleteSourceFile(workspaceId, fileName);
    return { success: true, message: `Deleted ${fileName}.` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: `Failed to delete file: ${msg}` };
  }
}

const MAX_QUESTION_LENGTH = 500;

export async function askWorkspaceQuestion(
  workspaceId: string,
  question: string,
): Promise<{ success: boolean; answer?: WorkspaceAnswer; message: string }> {
  try {
    const workspace = getWorkspace(workspaceId);
    if (!workspace) {
      return { success: false, message: 'Workspace not found.' };
    }

    const trimmed = question.trim();
    if (!trimmed) {
      return { success: false, message: 'Question cannot be empty.' };
    }
    if (trimmed.length > MAX_QUESTION_LENGTH) {
      return { success: false, message: `Question must be ${MAX_QUESTION_LENGTH} characters or fewer.` };
    }

    const outputDir = getOutputDir(workspaceId);

    // Validate manifest exists
    const manifestPath = resolve(outputDir, 'analysis-manifest.json');
    if (!existsSync(manifestPath)) {
      return { success: false, message: 'No analysis manifest found. Run analysis first.' };
    }

    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));

    // Validate analysis is current (not stale)
    const currentHashes = computeSourceHashes(workspaceId);
    const manifestHashes: Record<string, string> = {};
    for (const s of manifest.sourceFiles ?? []) {
      manifestHashes[s.fileName] = s.hash;
    }
    const currentKeys = Object.keys(currentHashes).sort();
    const manifestKeys = Object.keys(manifestHashes).sort();
    const hashesMatch =
      currentKeys.length === manifestKeys.length &&
      currentKeys.every((k: string) => currentHashes[k] === manifestHashes[k]);

    if (!hashesMatch) {
      return { success: false, message: 'Analysis is stale. Re-run analysis before asking questions.' };
    }

    const sourcesDir = getSourcesDir(workspaceId);
    const retriever = new LocalRetriever(outputDir, sourcesDir);
    const modelFactory = async () => {
      const m = await getModelForTask(TaskType.QA);
      if (!m) throw new Error('No LLM provider configured for Q&A.');
      return m;
    };
    const composer = new WorkspaceAnswerComposer(retriever, undefined, modelFactory);
    const answer = await composer.answer(trimmed);

    return { success: true, answer, message: 'OK' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: `Q&A failed: ${msg}` };
  }
}

export async function generateReportAction(
  workspaceId: string,
): Promise<{ success: boolean; message: string }> {
  try {
    const workspace = getWorkspace(workspaceId);
    if (!workspace) {
      return { success: false, message: 'Workspace not found.' };
    }

    const outputDir = getOutputDir(workspaceId);
    const manifestPath = resolve(outputDir, 'analysis-manifest.json');
    if (!existsSync(manifestPath)) {
      return { success: false, message: 'No analysis found. Run analysis first.' };
    }

    const sourcesDir = getSourcesDir(workspaceId);
    const generator = new WorkspaceReportGenerator(outputDir, sourcesDir);
    const markdown = generator.generate();
    writeFileSync(resolve(outputDir, 'workspace-report.md'), markdown);

    return { success: true, message: 'Report generated.' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: `Report generation failed: ${msg}` };
  }
}

export async function downloadReportAction(
  workspaceId: string,
): Promise<{ success: boolean; content?: string; message: string }> {
  try {
    const workspace = getWorkspace(workspaceId);
    if (!workspace) {
      return { success: false, message: 'Workspace not found.' };
    }

    const outputDir = getOutputDir(workspaceId);
    const reportPath = resolve(outputDir, 'workspace-report.md');
    if (!existsSync(reportPath)) {
      return { success: false, message: 'No report found. Generate a report first.' };
    }

    const content = readFileSync(reportPath, 'utf-8');
    return { success: true, content, message: 'OK' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: `Download failed: ${msg}` };
  }
}

export async function generatePdfReportAction(
  workspaceId: string,
): Promise<{ success: boolean; message: string }> {
  try {
    const workspace = getWorkspace(workspaceId);
    if (!workspace) {
      return { success: false, message: 'Workspace not found.' };
    }

    const outputDir = getOutputDir(workspaceId);
    const mdPath = resolve(outputDir, 'workspace-report.md');
    if (!existsSync(mdPath)) {
      return { success: false, message: 'Generate the Markdown report first.' };
    }

    const markdown = readFileSync(mdPath, 'utf-8');
    const renderer = new PdfReportRenderer();
    const pdfBuffer = await renderer.render(markdown);
    writeFileSync(resolve(outputDir, 'workspace-report.pdf'), pdfBuffer);

    return { success: true, message: 'PDF report generated.' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: `PDF generation failed: ${msg}` };
  }
}

export async function downloadPdfReportAction(
  workspaceId: string,
): Promise<{ success: boolean; content?: string; message: string }> {
  try {
    const workspace = getWorkspace(workspaceId);
    if (!workspace) {
      return { success: false, message: 'Workspace not found.' };
    }

    const outputDir = getOutputDir(workspaceId);
    const pdfPath = resolve(outputDir, 'workspace-report.pdf');
    if (!existsSync(pdfPath)) {
      return { success: false, message: 'No PDF report found. Generate a PDF report first.' };
    }

    const content = readFileSync(pdfPath).toString('base64');
    return { success: true, content, message: 'OK' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: `Download failed: ${msg}` };
  }
}

// ── Workspace Agent ─────────────────────────────────────────────────

const MAX_GOAL_LENGTH = 500;

export async function runWorkspaceAgentAction(
  workspaceId: string,
  goal: string,
  allowWrites?: boolean,
): Promise<{ success: boolean; result?: AgentRunResult; error?: string }> {
  try {
    const workspace = getWorkspace(workspaceId);
    if (!workspace) {
      return { success: false, error: 'Workspace not found.' };
    }

    const trimmedGoal = goal.trim();
    if (!trimmedGoal) {
      return { success: false, error: 'Goal cannot be empty.' };
    }
    if (trimmedGoal.length > MAX_GOAL_LENGTH) {
      return { success: false, error: `Goal must be ${MAX_GOAL_LENGTH} characters or fewer.` };
    }

    const agent = new WorkspaceAnalystAgent(toolRegistry);
    const result = await agent.run({
      workspaceId,
      goal: trimmedGoal,
      allowWrites: allowWrites ?? false,
    });

    return { success: true, result };
  } catch {
    return { success: false, error: 'The workspace agent encountered an error. Please try again.' };
  }
}

// ── Command Plan ────────────────────────────────────────────────────

const MAX_COMMAND_LENGTH = 500;

export async function planWorkspaceCommandAction(
  workspaceId: string,
  command: string,
): Promise<{ success: boolean; plan?: WorkspaceCommandPlan; error?: string }> {
  try {
    const workspace = getWorkspace(workspaceId);
    if (!workspace) {
      return { success: false, error: 'Workspace not found.' };
    }

    const trimmed = command.trim();
    if (!trimmed) {
      return { success: false, error: 'Command cannot be empty.' };
    }
    if (trimmed.length > MAX_COMMAND_LENGTH) {
      return { success: false, error: `Command must be ${MAX_COMMAND_LENGTH} characters or fewer.` };
    }

    const plan = createWorkspaceCommandPlan(trimmed);
    return { success: true, plan };
  } catch {
    return { success: false, error: 'Failed to plan command. Please try again.' };
  }
}

// ── Table Query ─────────────────────────────────────────────────────

export async function runTableQueryAction(
  workspaceId: string,
  filters: Array<{ field: string; operator: string; value: string | number }>,
  aggregations: Array<{ field: string; operation: string; label?: string }>,
  fileScope?: string[],
  includeRows?: boolean,
): Promise<{ success: boolean; result?: TableQueryResult; error?: string }> {
  try {
    const workspace = getWorkspace(workspaceId);
    if (!workspace) {
      return { success: false, error: 'Workspace not found.' };
    }

    if (!aggregations || aggregations.length === 0) {
      return { success: false, error: 'At least one aggregation is required.' };
    }

    const result = await toolRegistry.executeTool('runTableQuery', {
      workspaceId,
      filters: filters ?? [],
      aggregations,
      fileScope,
      includeRows,
    });

    return { success: true, result: result as TableQueryResult };
  } catch {
    return { success: false, error: 'Table query failed. Please try again.' };
  }
}

// ── Key Intelligence ────────────────────────────────────────────────

import type { KeyIntelligenceResult } from '@contextos/key-intelligence';

export async function findDuplicateKeysAction(
  workspaceId: string,
  keyType?: string,
): Promise<{ success: boolean; result?: KeyIntelligenceResult; error?: string }> {
  try {
    const workspace = getWorkspace(workspaceId);
    if (!workspace) {
      return { success: false, error: 'Workspace not found.' };
    }

    const result = await toolRegistry.executeTool('findDuplicateKeys', {
      workspaceId,
      keyType,
    });

    return { success: true, result: result as KeyIntelligenceResult };
  } catch {
    return { success: false, error: 'Duplicate key detection failed. Please try again.' };
  }
}

export async function findDocumentsForKeyAction(
  workspaceId: string,
  value: string,
  keyType?: string,
): Promise<{ success: boolean; result?: KeyIntelligenceResult; error?: string }> {
  try {
    const workspace = getWorkspace(workspaceId);
    if (!workspace) {
      return { success: false, error: 'Workspace not found.' };
    }

    if (!value || value.trim().length === 0) {
      return { success: false, error: 'A key value is required for document lookup.' };
    }

    const result = await toolRegistry.executeTool('findDocumentsForKey', {
      workspaceId,
      value: value.trim(),
      keyType,
    });

    return { success: true, result: result as KeyIntelligenceResult };
  } catch {
    return { success: false, error: 'Document lookup failed. Please try again.' };
  }
}

// ── Workspace Command Agent (unified) ───────────────────────────────

export async function runWorkspaceCommandAction(
  workspaceId: string,
  command: string,
  allowWrites?: boolean,
): Promise<{ success: boolean; result?: WorkspaceAgentResponse; error?: string }> {
  try {
    const workspace = getWorkspace(workspaceId);
    if (!workspace) {
      return { success: false, error: 'Workspace not found.' };
    }

    const trimmed = command.trim();
    if (!trimmed) {
      return { success: false, error: 'Command cannot be empty.' };
    }
    if (trimmed.length > MAX_COMMAND_LENGTH) {
      return { success: false, error: `Command must be ${MAX_COMMAND_LENGTH} characters or fewer.` };
    }

    const agent = new WorkspaceCommandAgent(
      toolRegistry,
      new WorkspaceAnalystAgent(toolRegistry),
    );
    const result = await agent.run({
      workspaceId,
      command: trimmed,
      allowWrites: allowWrites ?? false,
    });

    return { success: true, result };
  } catch {
    return { success: false, error: 'The workspace command agent encountered an error. Please try again.' };
  }
}
