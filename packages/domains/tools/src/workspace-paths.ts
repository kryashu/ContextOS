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
 * Injected data root. Call `setDataRoot(monorepoRoot)` before using tools
 * in contexts where process.cwd() is not the monorepo root (e.g. Next.js).
 */
let _dataRoot: string | null = null;

export function setDataRoot(root: string): void {
  _dataRoot = root;
}

/**
 * Root data directory.
 * Uses the injected root if set, otherwise falls back to process.cwd().
 */
function dataDir(): string {
  const root = _dataRoot ?? process.cwd();
  return resolve(root, 'data', 'workspaces');
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
