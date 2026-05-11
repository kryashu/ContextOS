'use server';

import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  createWorkspace as createWs,
  getWorkspace,
  getSourcesDir,
  getWorkspaceDir,
  getOutputDir,
  clearOutputDir,
  updateWorkspace,
} from '@/lib/workspaces';

/** Monorepo root — apps/web -> apps -> root */
const ROOT_DIR = resolve(process.cwd(), '..', '..');

const ALLOWED_EXTENSIONS = ['.md', '.csv', '.json', '.txt', '.yaml', '.yml', '.xlsx'];
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

export async function uploadFilesAction(
  workspaceId: string,
  formData: FormData,
): Promise<{ success: boolean; fileCount: number; message: string }> {
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

    for (const file of files) {
      if (!(file instanceof File) || file.size === 0) continue;

      // Validate extension
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        continue; // skip unsupported files silently
      }

      // Validate size
      if (file.size > MAX_FILE_SIZE) {
        continue; // skip oversized files
      }

      // Sanitize filename — only allow alphanumeric, hyphens, underscores, dots
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const buffer = Buffer.from(await file.arrayBuffer());
      writeFileSync(resolve(sourcesDir, safeName), buffer);
      uploaded++;
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

    execFileSync('pnpm', ['contextos', 'demo', workspaceDir], {
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
