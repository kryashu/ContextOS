import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import type { AnalysisManifest } from '@contextos/types';
import { ArtifactWriteViolationError, StaleAnalysisError } from './errors.js';
import type { ToolExecutionContext } from './types.js';

/**
 * Validate that a file write is within the tool's declared allowedWrites.
 */
export function validateArtifactWrite(
  fileName: string,
  allowedWrites: readonly string[],
): void {
  if (!allowedWrites.includes(fileName)) {
    throw new ArtifactWriteViolationError(fileName, allowedWrites);
  }
}

/**
 * Load the analysis manifest from the workspace output directory.
 * Throws if not found.
 */
export function loadManifest(context: ToolExecutionContext): AnalysisManifest {
  if (!existsSync(context.manifestPath)) {
    throw new Error(`No analysis manifest found at ${context.manifestPath}. Run analysis first.`);
  }
  return JSON.parse(readFileSync(context.manifestPath, 'utf-8')) as AnalysisManifest;
}

/**
 * Assert that the current source files match the hashes stored in the manifest.
 * Throws StaleAnalysisError if hashes don't match (sources changed after analysis).
 */
export function assertAnalysisCurrent(context: ToolExecutionContext): void {
  const manifest = loadManifest(context);

  const currentHashes = computeSourceHashes(context.sourcesDir);

  const manifestHashes: Record<string, string> = {};
  for (const s of manifest.sourceFiles ?? []) {
    manifestHashes[s.fileName] = s.hash;
  }

  const currentKeys = Object.keys(currentHashes).sort();
  const manifestKeys = Object.keys(manifestHashes).sort();

  const hashesMatch =
    currentKeys.length === manifestKeys.length &&
    currentKeys.every((k) => currentHashes[k] === manifestHashes[k]);

  if (!hashesMatch) {
    throw new StaleAnalysisError(context.workspaceId);
  }
}

/**
 * Compute SHA-256 hashes for all source files (mirrors apps/web/src/lib/workspaces.ts).
 */
function computeSourceHashes(sourcesDir: string): Record<string, string> {
  if (!existsSync(sourcesDir)) return {};
  const hashes: Record<string, string> = {};
  for (const f of readdirSync(sourcesDir).filter((f) => !f.startsWith('.'))) {
    const buf = readFileSync(resolve(sourcesDir, f));
    hashes[f] = createHash('sha256').update(buf).digest('hex');
  }
  return hashes;
}
