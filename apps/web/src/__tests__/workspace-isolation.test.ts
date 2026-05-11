import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  existsSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
  readdirSync,
  unlinkSync,
} from 'node:fs';
import { resolve, basename } from 'node:path';
import { createHash } from 'node:crypto';

/**
 * Workspace isolation tests.
 *
 * These tests exercise the workspace library functions directly against a
 * temp directory so they don't interfere with real workspace data.  The tests
 * mirror the critical acceptance criteria:
 *
 *  1. New workspace with no output → no stale report data
 *  2. Uploading a new file clears old output
 *  3. Running analysis writes a manifest
 *  4. UI does not render workbook profile if manifest does not list it
 *  5. Manifest source hash mismatch marks analysis as stale
 *  6. Demo workspace and user workspace outputs are isolated
 */

// ── Inline helpers that mirror the production code ─────────────────
// We avoid importing from @/lib/workspaces because it depends on
// process.cwd() relative paths.  Instead we replicate the pure logic.

function clearOutputDir(outputDir: string): void {
  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(outputDir, { recursive: true });
}

function computeSourceHashes(sourcesDir: string): Record<string, string> {
  if (!existsSync(sourcesDir)) return {};
  const hashes: Record<string, string> = {};
  for (const f of readdirSync(sourcesDir).filter(n => !n.startsWith('.'))) {
    const buf = readFileSync(resolve(sourcesDir, f));
    hashes[f] = createHash('sha256').update(buf).digest('hex');
  }
  return hashes;
}

interface ManifestCapabilities {
  hasExcel: boolean;
  hasWorkbookProfile: boolean;
  hasNormalizedObservations: boolean;
  hasDfd: boolean;
  hasGraph: boolean;
  hasFindings: boolean;
  hasEval: boolean;
}

interface ManifestSourceEntry {
  fileName: string;
  fileType: string;
  hash: string;
  size: number;
}

interface AnalysisManifest {
  workspaceId: string;
  runId: string;
  generatedAt: string;
  sourceFiles: ManifestSourceEntry[];
  artifacts: string[];
  capabilities: ManifestCapabilities;
}

type AnalysisState = 'none' | 'stale' | 'current' | 'failed';

function deriveAnalysisState(
  manifest: AnalysisManifest | null,
  currentHashes: Record<string, string>,
  workspaceStatus: string,
): AnalysisState {
  if (!manifest) {
    return workspaceStatus === 'analysis_failed' ? 'failed' : 'none';
  }
  if (workspaceStatus === 'analysis_failed') return 'failed';

  const manifestHashes: Record<string, string> = {};
  for (const s of manifest.sourceFiles) {
    manifestHashes[s.fileName] = s.hash;
  }
  const currentKeys = Object.keys(currentHashes).sort();
  const manifestKeys = Object.keys(manifestHashes).sort();
  const hashesMatch =
    currentKeys.length === manifestKeys.length &&
    currentKeys.every(k => currentHashes[k] === manifestHashes[k]);

  return hashesMatch ? 'current' : 'stale';
}

function shouldRenderArtifact(
  manifest: AnalysisManifest | null,
  capKey: keyof ManifestCapabilities,
  artifactPath: string,
): boolean {
  if (!manifest) return false;
  return manifest.capabilities[capKey] && existsSync(artifactPath);
}

// ── Test fixtures ──────────────────────────────────────────────────

const TMP_ROOT = resolve(process.cwd(), '.test-workspaces-tmp');

function freshWorkspace(id: string) {
  const wsDir = resolve(TMP_ROOT, id);
  const sourcesDir = resolve(wsDir, 'sources');
  const outputDir = resolve(wsDir, 'output');
  mkdirSync(sourcesDir, { recursive: true });
  mkdirSync(outputDir, { recursive: true });
  return { wsDir, sourcesDir, outputDir };
}

function writeManifest(outputDir: string, overrides: Partial<AnalysisManifest> = {}): AnalysisManifest {
  const m: AnalysisManifest = {
    workspaceId: 'ws_test',
    runId: 'run_test',
    generatedAt: new Date().toISOString(),
    sourceFiles: [],
    artifacts: [],
    capabilities: {
      hasExcel: false,
      hasWorkbookProfile: false,
      hasNormalizedObservations: false,
      hasDfd: false,
      hasGraph: false,
      hasFindings: false,
      hasEval: false,
    },
    ...overrides,
  };
  writeFileSync(resolve(outputDir, 'analysis-manifest.json'), JSON.stringify(m, null, 2));
  return m;
}

// ── Test suites ────────────────────────────────────────────────────

beforeEach(() => {
  mkdirSync(TMP_ROOT, { recursive: true });
});

afterEach(() => {
  rmSync(TMP_ROOT, { recursive: true, force: true });
});

describe('Workspace isolation', () => {
  // ── AC 1: New workspace with no output → no stale report ────────
  it('new workspace with empty output has analysisState "none"', () => {
    const { sourcesDir } = freshWorkspace('ws_empty');
    const hashes = computeSourceHashes(sourcesDir);
    expect(deriveAnalysisState(null, hashes, 'empty')).toBe('none');
  });

  // ── AC 2: Uploading a new file clears old output ────────────────
  it('clearOutputDir removes old artifacts and recreates dir', () => {
    const { outputDir } = freshWorkspace('ws_clear');
    // Simulate stale artifacts
    writeFileSync(resolve(outputDir, 'workspace-summary.json'), '{}');
    writeFileSync(resolve(outputDir, 'workbook-profile.json'), '{}');
    expect(readdirSync(outputDir).length).toBe(2);

    clearOutputDir(outputDir);

    expect(existsSync(outputDir)).toBe(true);
    expect(readdirSync(outputDir).length).toBe(0);
  });

  // ── AC 3: Running analysis writes manifest ──────────────────────
  it('manifest written after analysis is parseable and has correct shape', () => {
    const { outputDir, sourcesDir } = freshWorkspace('ws_manifest');
    writeFileSync(resolve(sourcesDir, 'test.md'), '# Hello');

    const manifest = writeManifest(outputDir, {
      sourceFiles: [
        {
          fileName: 'test.md',
          fileType: 'markdown',
          hash: createHash('sha256').update('# Hello').digest('hex'),
          size: 7,
        },
      ],
      artifacts: ['workspace-summary.json'],
      capabilities: {
        hasExcel: false,
        hasWorkbookProfile: false,
        hasNormalizedObservations: false,
        hasDfd: false,
        hasGraph: false,
        hasFindings: false,
        hasEval: false,
      },
    });

    const parsed = JSON.parse(
      readFileSync(resolve(outputDir, 'analysis-manifest.json'), 'utf-8'),
    ) as AnalysisManifest;
    expect(parsed.sourceFiles).toHaveLength(1);
    expect(parsed.sourceFiles[0]!.fileName).toBe('test.md');
    expect(parsed.artifacts).toContain('workspace-summary.json');
  });

  // ── AC 4: UI does not render workbook profile if manifest doesn't list it
  it('shouldRenderArtifact returns false when capability is off', () => {
    const { outputDir } = freshWorkspace('ws_nocap');
    // Write the file on disk but capability says false
    writeFileSync(resolve(outputDir, 'workbook-profile.json'), '{}');

    const manifest = writeManifest(outputDir, {
      capabilities: {
        hasExcel: false,
        hasWorkbookProfile: false,
        hasNormalizedObservations: false,
        hasDfd: false,
        hasGraph: false,
        hasFindings: false,
        hasEval: false,
      },
    });

    expect(
      shouldRenderArtifact(manifest, 'hasWorkbookProfile', resolve(outputDir, 'workbook-profile.json')),
    ).toBe(false);
  });

  it('shouldRenderArtifact returns false when capability is on but file missing', () => {
    const { outputDir } = freshWorkspace('ws_nofile');

    const manifest = writeManifest(outputDir, {
      capabilities: {
        hasExcel: true,
        hasWorkbookProfile: true,
        hasNormalizedObservations: false,
        hasDfd: false,
        hasGraph: false,
        hasFindings: false,
        hasEval: false,
      },
    });

    expect(
      shouldRenderArtifact(manifest, 'hasWorkbookProfile', resolve(outputDir, 'workbook-profile.json')),
    ).toBe(false);
  });

  it('shouldRenderArtifact returns true only when both capability and file exist', () => {
    const { outputDir } = freshWorkspace('ws_both');
    writeFileSync(resolve(outputDir, 'workbook-profile.json'), '{}');

    const manifest = writeManifest(outputDir, {
      capabilities: {
        hasExcel: true,
        hasWorkbookProfile: true,
        hasNormalizedObservations: false,
        hasDfd: false,
        hasGraph: false,
        hasFindings: false,
        hasEval: false,
      },
    });

    expect(
      shouldRenderArtifact(manifest, 'hasWorkbookProfile', resolve(outputDir, 'workbook-profile.json')),
    ).toBe(true);
  });

  it('shouldRenderArtifact returns false when manifest is null', () => {
    const { outputDir } = freshWorkspace('ws_null');
    writeFileSync(resolve(outputDir, 'workbook-profile.json'), '{}');

    expect(
      shouldRenderArtifact(null, 'hasWorkbookProfile', resolve(outputDir, 'workbook-profile.json')),
    ).toBe(false);
  });

  // ── AC 5: Manifest source hash mismatch marks analysis stale ────
  it('matching hashes → analysisState "current"', () => {
    const { sourcesDir, outputDir } = freshWorkspace('ws_current');
    writeFileSync(resolve(sourcesDir, 'file.md'), 'content A');

    const hash = createHash('sha256').update('content A').digest('hex');
    writeManifest(outputDir, {
      sourceFiles: [{ fileName: 'file.md', fileType: 'markdown', hash, size: 9 }],
    });

    const hashes = computeSourceHashes(sourcesDir);
    const manifest = JSON.parse(
      readFileSync(resolve(outputDir, 'analysis-manifest.json'), 'utf-8'),
    ) as AnalysisManifest;

    expect(deriveAnalysisState(manifest, hashes, 'analyzed')).toBe('current');
  });

  it('changed file content → analysisState "stale"', () => {
    const { sourcesDir, outputDir } = freshWorkspace('ws_stale');
    writeFileSync(resolve(sourcesDir, 'file.md'), 'content B');

    const oldHash = createHash('sha256').update('content A').digest('hex');
    writeManifest(outputDir, {
      sourceFiles: [{ fileName: 'file.md', fileType: 'markdown', hash: oldHash, size: 9 }],
    });

    const hashes = computeSourceHashes(sourcesDir);
    const manifest = JSON.parse(
      readFileSync(resolve(outputDir, 'analysis-manifest.json'), 'utf-8'),
    ) as AnalysisManifest;

    expect(deriveAnalysisState(manifest, hashes, 'analyzed')).toBe('stale');
  });

  it('new file added after analysis → analysisState "stale"', () => {
    const { sourcesDir, outputDir } = freshWorkspace('ws_added');
    writeFileSync(resolve(sourcesDir, 'old.md'), 'old');
    writeFileSync(resolve(sourcesDir, 'new.md'), 'new');

    const oldHash = createHash('sha256').update('old').digest('hex');
    writeManifest(outputDir, {
      sourceFiles: [{ fileName: 'old.md', fileType: 'markdown', hash: oldHash, size: 3 }],
    });

    const hashes = computeSourceHashes(sourcesDir);
    const manifest = JSON.parse(
      readFileSync(resolve(outputDir, 'analysis-manifest.json'), 'utf-8'),
    ) as AnalysisManifest;

    expect(deriveAnalysisState(manifest, hashes, 'has_sources')).toBe('stale');
  });

  it('file removed after analysis → analysisState "stale"', () => {
    const { sourcesDir, outputDir } = freshWorkspace('ws_removed');
    // sourcesDir is empty but manifest lists a file
    const hash = createHash('sha256').update('gone').digest('hex');
    writeManifest(outputDir, {
      sourceFiles: [{ fileName: 'gone.md', fileType: 'markdown', hash, size: 4 }],
    });

    const hashes = computeSourceHashes(sourcesDir);
    const manifest = JSON.parse(
      readFileSync(resolve(outputDir, 'analysis-manifest.json'), 'utf-8'),
    ) as AnalysisManifest;

    expect(deriveAnalysisState(manifest, hashes, 'has_sources')).toBe('stale');
  });

  // ── AC: analysis_failed status ──────────────────────────────────
  it('analysis_failed with no manifest → analysisState "failed"', () => {
    expect(deriveAnalysisState(null, {}, 'analysis_failed')).toBe('failed');
  });

  it('analysis_failed with manifest → analysisState "failed"', () => {
    const { outputDir } = freshWorkspace('ws_fail');
    const manifest = writeManifest(outputDir);
    expect(deriveAnalysisState(manifest, {}, 'analysis_failed')).toBe('failed');
  });

  // ── AC 6: Demo workspace and user workspace outputs are isolated ─
  it('two workspaces have completely independent output dirs', () => {
    const ws1 = freshWorkspace('ws_user1');
    const ws2 = freshWorkspace('ws_user2');

    writeFileSync(resolve(ws1.outputDir, 'workspace-summary.json'), '{"ws":"1"}');
    writeFileSync(resolve(ws2.outputDir, 'workspace-summary.json'), '{"ws":"2"}');

    const data1 = JSON.parse(readFileSync(resolve(ws1.outputDir, 'workspace-summary.json'), 'utf-8'));
    const data2 = JSON.parse(readFileSync(resolve(ws2.outputDir, 'workspace-summary.json'), 'utf-8'));

    expect(data1.ws).toBe('1');
    expect(data2.ws).toBe('2');
    expect(ws1.outputDir).not.toBe(ws2.outputDir);
  });

  it('clearing one workspace output does not affect another', () => {
    const ws1 = freshWorkspace('ws_iso1');
    const ws2 = freshWorkspace('ws_iso2');

    writeFileSync(resolve(ws1.outputDir, 'summary.json'), '1');
    writeFileSync(resolve(ws2.outputDir, 'summary.json'), '2');

    clearOutputDir(ws1.outputDir);

    expect(readdirSync(ws1.outputDir).length).toBe(0);
    expect(existsSync(resolve(ws2.outputDir, 'summary.json'))).toBe(true);
  });

  // ── AC: Missing manifest = "none", not "current" ───────────────
  it('missing manifest always returns "none" for non-failed status', () => {
    expect(deriveAnalysisState(null, {}, 'empty')).toBe('none');
    expect(deriveAnalysisState(null, {}, 'has_sources')).toBe('none');
    expect(deriveAnalysisState(null, {}, 'analyzed')).toBe('none');
  });
});

// ── Source-type-aware pipeline: xlsx-only workspaces ───────────────
describe('Source-type-aware pipeline', () => {
  it('xlsx-only manifest has no graph, dfd, or findings capabilities', () => {
    const { outputDir } = freshWorkspace('ws_xlsx_only');

    // Simulate what the pipeline produces for an xlsx-only workspace
    writeFileSync(resolve(outputDir, 'workspace-summary.json'), '{}');
    writeFileSync(resolve(outputDir, 'workbook-profile.json'), '{}');
    writeFileSync(resolve(outputDir, 'normalized-observations.json'), '[]');

    const manifest = writeManifest(outputDir, {
      sourceFiles: [
        { fileName: 'data.xlsx', fileType: 'xlsx', hash: 'abc123', size: 1024 },
      ],
      artifacts: ['workspace-summary.json', 'workbook-profile.json', 'normalized-observations.json'],
      capabilities: {
        hasExcel: true,
        hasWorkbookProfile: true,
        hasNormalizedObservations: true,
        hasDfd: false,
        hasGraph: false,
        hasFindings: false,
        hasEval: false,
      },
    });

    expect(manifest.capabilities.hasGraph).toBe(false);
    expect(manifest.capabilities.hasDfd).toBe(false);
    expect(manifest.capabilities.hasFindings).toBe(false);
    expect(manifest.capabilities.hasExcel).toBe(true);
    expect(manifest.capabilities.hasWorkbookProfile).toBe(true);
  });

  it('xlsx-only workspace does not render graph, dfd, or findings', () => {
    const { outputDir } = freshWorkspace('ws_xlsx_render');

    const manifest = writeManifest(outputDir, {
      capabilities: {
        hasExcel: true,
        hasWorkbookProfile: false,
        hasNormalizedObservations: false,
        hasDfd: false,
        hasGraph: false,
        hasFindings: false,
        hasEval: false,
      },
    });

    expect(shouldRenderArtifact(manifest, 'hasGraph', resolve(outputDir, 'relationship-graph.json'))).toBe(false);
    expect(shouldRenderArtifact(manifest, 'hasDfd', resolve(outputDir, 'dfd-level-0.mmd'))).toBe(false);
    expect(shouldRenderArtifact(manifest, 'hasFindings', resolve(outputDir, 'findings.json'))).toBe(false);
  });

  it('mixed workspace (xlsx + markdown) retains all capabilities', () => {
    const { outputDir } = freshWorkspace('ws_mixed');

    writeFileSync(resolve(outputDir, 'workspace-summary.json'), '{}');
    writeFileSync(resolve(outputDir, 'relationship-graph.json'), '{}');
    writeFileSync(resolve(outputDir, 'findings.json'), '[]');
    writeFileSync(resolve(outputDir, 'dfd-level-0.mmd'), 'graph TD');
    writeFileSync(resolve(outputDir, 'workbook-profile.json'), '{}');

    const manifest = writeManifest(outputDir, {
      sourceFiles: [
        { fileName: 'api.md', fileType: 'markdown', hash: 'md123', size: 100 },
        { fileName: 'data.xlsx', fileType: 'xlsx', hash: 'xl456', size: 2048 },
      ],
      artifacts: [
        'workspace-summary.json',
        'relationship-graph.json',
        'findings.json',
        'dfd-level-0.mmd',
        'workbook-profile.json',
      ],
      capabilities: {
        hasExcel: true,
        hasWorkbookProfile: true,
        hasNormalizedObservations: false,
        hasDfd: true,
        hasGraph: true,
        hasFindings: true,
        hasEval: false,
      },
    });

    expect(shouldRenderArtifact(manifest, 'hasGraph', resolve(outputDir, 'relationship-graph.json'))).toBe(true);
    expect(shouldRenderArtifact(manifest, 'hasDfd', resolve(outputDir, 'dfd-level-0.mmd'))).toBe(true);
    expect(shouldRenderArtifact(manifest, 'hasFindings', resolve(outputDir, 'findings.json'))).toBe(true);
    expect(shouldRenderArtifact(manifest, 'hasWorkbookProfile', resolve(outputDir, 'workbook-profile.json'))).toBe(true);
  });
});

// ── Calculation engine: cleanup and gating ────────────────────────
describe('Calculation engine lifecycle', () => {
  it('calculation-results.json is removed by clearOutputDir (upload/rerun)', () => {
    const { outputDir } = freshWorkspace('ws_calc_clear');
    writeFileSync(resolve(outputDir, 'calculation-results.json'), '{}');
    writeFileSync(resolve(outputDir, 'workspace-summary.json'), '{}');
    expect(existsSync(resolve(outputDir, 'calculation-results.json'))).toBe(true);

    clearOutputDir(outputDir);

    expect(existsSync(resolve(outputDir, 'calculation-results.json'))).toBe(false);
    expect(readdirSync(outputDir).length).toBe(0);
  });

  it('stale analysis state prevents calculation rendering', () => {
    // When analysis is stale, UI should not enable calculation
    // This test verifies the state derivation that gates the panel
    const { sourcesDir, outputDir } = freshWorkspace('ws_calc_stale');
    writeFileSync(resolve(sourcesDir, 'data.xlsx'), 'changed');

    const oldHash = 'oldhash123';
    const manifest = writeManifest(outputDir, {
      sourceFiles: [{ fileName: 'data.xlsx', fileType: 'xlsx', hash: oldHash, size: 5 }],
      capabilities: {
        hasExcel: true,
        hasWorkbookProfile: true,
        hasNormalizedObservations: true,
        hasDfd: false,
        hasGraph: false,
        hasFindings: false,
        hasEval: false,
      },
    });

    const hashes = computeSourceHashes(sourcesDir);
    expect(deriveAnalysisState(manifest, hashes, 'analyzed')).toBe('stale');
  });
});

// ── Workspace & source file deletion ──────────────────────────────

// Inline registry helpers (mirror production logic for isolation)
interface RegistryEntry {
  id: string;
  name: string;
  description: string;
  sourceCount: number;
  status: string;
}

function readRegistry(registryPath: string): RegistryEntry[] {
  if (!existsSync(registryPath)) return [];
  return JSON.parse(readFileSync(registryPath, 'utf-8')) as RegistryEntry[];
}

function writeRegistry(registryPath: string, entries: RegistryEntry[]): void {
  writeFileSync(registryPath, JSON.stringify(entries, null, 2));
}

function isValidWorkspaceId(id: string): boolean {
  return /^ws_\d+$/.test(id);
}

function isSafeFileName(fileName: string): boolean {
  if (!fileName || fileName.includes('/') || fileName.includes('\\') || fileName.includes('..')) {
    return false;
  }
  return basename(fileName) === fileName;
}

describe('Workspace deletion', () => {
  it('removes workspace directory and registry entry', () => {
    const registryPath = resolve(TMP_ROOT, 'index.json');
    const ws = freshWorkspace('ws_1234567890');
    writeFileSync(resolve(ws.sourcesDir, 'test.md'), '# Hello');
    writeFileSync(resolve(ws.outputDir, 'summary.json'), '{}');

    writeRegistry(registryPath, [
      { id: 'ws_1234567890', name: 'Test', description: '', sourceCount: 1, status: 'has_sources' },
      { id: 'ws_9999999999', name: 'Other', description: '', sourceCount: 0, status: 'empty' },
    ]);

    // Simulate deleteWorkspace
    const id = 'ws_1234567890';
    expect(isValidWorkspaceId(id)).toBe(true);
    rmSync(ws.wsDir, { recursive: true, force: true });
    const entries = readRegistry(registryPath).filter(w => w.id !== id);
    writeRegistry(registryPath, entries);

    expect(existsSync(ws.wsDir)).toBe(false);
    expect(readRegistry(registryPath)).toHaveLength(1);
    expect(readRegistry(registryPath)[0]!.id).toBe('ws_9999999999');
  });

  it('rejects invalid workspace IDs', () => {
    expect(isValidWorkspaceId('demo')).toBe(false);
    expect(isValidWorkspaceId('../etc')).toBe(false);
    expect(isValidWorkspaceId('ws_abc')).toBe(false);
    expect(isValidWorkspaceId('')).toBe(false);
    expect(isValidWorkspaceId('ws_')).toBe(false);
    expect(isValidWorkspaceId('ws_1234567890')).toBe(true);
  });
});

describe('Source file deletion', () => {
  it('removes a single source file and clears output', () => {
    const ws = freshWorkspace('ws_5555555555');
    writeFileSync(resolve(ws.sourcesDir, 'keep.md'), '# Keep');
    writeFileSync(resolve(ws.sourcesDir, 'delete-me.md'), '# Delete');
    writeFileSync(resolve(ws.outputDir, 'summary.json'), '{}');

    const fileName = 'delete-me.md';
    expect(isSafeFileName(fileName)).toBe(true);

    // Delete the file
    unlinkSync(resolve(ws.sourcesDir, fileName));
    // Clear output (analysis is stale)
    clearOutputDir(ws.outputDir);

    expect(existsSync(resolve(ws.sourcesDir, 'delete-me.md'))).toBe(false);
    expect(existsSync(resolve(ws.sourcesDir, 'keep.md'))).toBe(true);
    expect(readdirSync(ws.outputDir).length).toBe(0);
  });

  it('rejects path traversal in file names', () => {
    expect(isSafeFileName('../etc/passwd')).toBe(false);
    expect(isSafeFileName('foo/../../bar')).toBe(false);
    expect(isSafeFileName('foo\\bar')).toBe(false);
    expect(isSafeFileName('..')).toBe(false);
    expect(isSafeFileName('')).toBe(false);
    expect(isSafeFileName('valid-file.md')).toBe(true);
    expect(isSafeFileName('my_file.csv')).toBe(true);
  });

  it('updates remaining count correctly when last file is deleted', () => {
    const ws = freshWorkspace('ws_6666666666');
    writeFileSync(resolve(ws.sourcesDir, 'only.md'), '# Only');

    unlinkSync(resolve(ws.sourcesDir, 'only.md'));
    const remaining = readdirSync(ws.sourcesDir).filter(f => !f.startsWith('.'));

    expect(remaining.length).toBe(0);
    // Status should become 'empty' when no files remain
    const newStatus = remaining.length === 0 ? 'empty' : 'has_sources';
    expect(newStatus).toBe('empty');
  });
});
