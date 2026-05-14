import { resolve } from 'node:path';
import { InvalidWorkspaceIdError } from './errors.js';
import type { ToolExecutionContext } from './types.js';

/**
 * Workspace ID format: ws_<digits>
 * Rejects path traversal (../, /, \) and non-matching IDs.
 */
const WORKSPACE_ID_PATTERN = /^ws_\d+$/;

export function validateWorkspaceId(workspaceId: string): void {
  if (!WORKSPACE_ID_PATTERN.test(workspaceId)) {
    throw new InvalidWorkspaceIdError(workspaceId);
  }
}

/**
 * Root data directory.
 * The tools package mirrors the same layout as apps/web — data/workspaces/{id}/.
 * Uses process.cwd() which should be the monorepo root when run from turbo/pnpm.
 */
function dataDir(): string {
  return resolve(process.cwd(), 'data', 'workspaces');
}

export function resolveOutputDir(workspaceId: string): string {
  validateWorkspaceId(workspaceId);
  return resolve(dataDir(), workspaceId, 'output');
}

export function resolveSourcesDir(workspaceId: string): string {
  validateWorkspaceId(workspaceId);
  return resolve(dataDir(), workspaceId, 'sources');
}

export function resolveManifestPath(workspaceId: string): string {
  validateWorkspaceId(workspaceId);
  return resolve(dataDir(), workspaceId, 'output', 'analysis-manifest.json');
}

export function buildContext(workspaceId: string): ToolExecutionContext {
  validateWorkspaceId(workspaceId);
  return {
    workspaceId,
    outputDir: resolveOutputDir(workspaceId),
    sourcesDir: resolveSourcesDir(workspaceId),
    manifestPath: resolveManifestPath(workspaceId),
  };
}
