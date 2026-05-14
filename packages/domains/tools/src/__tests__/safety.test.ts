import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { validateArtifactWrite, assertAnalysisCurrent } from '../safety.js';
import { validateWorkspaceId } from '../workspace-paths.js';
import { ArtifactWriteViolationError, StaleAnalysisError, InvalidWorkspaceIdError } from '../errors.js';
import type { ToolExecutionContext } from '../types.js';

const TEST_DATA_ROOT = resolve(process.cwd(), 'data', 'workspaces');
const WS_ID = 'ws_900000000002';
const OUTPUT_DIR = resolve(TEST_DATA_ROOT, WS_ID, 'output');
const SOURCES_DIR = resolve(TEST_DATA_ROOT, WS_ID, 'sources');

function hash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function makeContext(): ToolExecutionContext {
  return {
    workspaceId: WS_ID,
    outputDir: OUTPUT_DIR,
    sourcesDir: SOURCES_DIR,
    manifestPath: resolve(OUTPUT_DIR, 'analysis-manifest.json'),
  };
}

function setupWorkspace(sourceHash: string): void {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  mkdirSync(SOURCES_DIR, { recursive: true });
  writeFileSync(resolve(SOURCES_DIR, 'file.md'), 'test content');
  writeFileSync(resolve(OUTPUT_DIR, 'analysis-manifest.json'), JSON.stringify({
    workspaceId: WS_ID,
    runId: 'run_1',
    generatedAt: new Date().toISOString(),
    sourceFiles: [{ fileName: 'file.md', fileType: 'markdown', hash: sourceHash, size: 12 }],
    artifacts: [],
    capabilities: {},
  }));
}

function cleanup(): void {
  try {
    rmSync(resolve(TEST_DATA_ROOT, WS_ID), { recursive: true, force: true });
  } catch {
    // ignore
  }
}

describe('validateArtifactWrite', () => {
  it('passes when fileName is in allowedWrites', () => {
    expect(() => validateArtifactWrite('workspace-report.md', ['workspace-report.md'])).not.toThrow();
  });

  it('throws ArtifactWriteViolationError for disallowed file', () => {
    expect(() => validateArtifactWrite('evil.sh', ['workspace-report.md'])).toThrow(ArtifactWriteViolationError);
  });

  it('throws when file is valid globally but not in THIS tool allowlist', () => {
    expect(() => validateArtifactWrite('workspace-report.md', ['calculation-results.json'])).toThrow(
      ArtifactWriteViolationError,
    );
  });
});

describe('assertAnalysisCurrent', () => {
  afterEach(cleanup);

  it('passes when hashes match', () => {
    const content = 'test content';
    setupWorkspace(hash(content));
    expect(() => assertAnalysisCurrent(makeContext())).not.toThrow();
  });

  it('throws StaleAnalysisError when hashes mismatch', () => {
    setupWorkspace('stale_hash_value');
    expect(() => assertAnalysisCurrent(makeContext())).toThrow(StaleAnalysisError);
  });
});

describe('validateWorkspaceId', () => {
  it('passes for valid workspace ID ws_123', () => {
    expect(() => validateWorkspaceId('ws_123')).not.toThrow();
  });

  it('passes for real-format workspace ID', () => {
    expect(() => validateWorkspaceId('ws_1778553596950')).not.toThrow();
  });

  it('rejects path traversal ../etc/passwd', () => {
    expect(() => validateWorkspaceId('../etc/passwd')).toThrow(InvalidWorkspaceIdError);
  });

  it('rejects embedded path traversal ws_123/../../foo', () => {
    expect(() => validateWorkspaceId('ws_123/../../foo')).toThrow(InvalidWorkspaceIdError);
  });

  it('rejects spaces hello world', () => {
    expect(() => validateWorkspaceId('hello world')).toThrow(InvalidWorkspaceIdError);
  });

  it('rejects empty string', () => {
    expect(() => validateWorkspaceId('')).toThrow(InvalidWorkspaceIdError);
  });

  it('rejects backslash paths', () => {
    expect(() => validateWorkspaceId('ws_123\\..\\foo')).toThrow(InvalidWorkspaceIdError);
  });

  it('rejects ws_ without digits', () => {
    expect(() => validateWorkspaceId('ws_')).toThrow(InvalidWorkspaceIdError);
  });

  it('rejects pure digits without ws_ prefix', () => {
    expect(() => validateWorkspaceId('12345')).toThrow(InvalidWorkspaceIdError);
  });
});
