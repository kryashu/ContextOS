import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync, rmSync, unlinkSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, basename } from 'node:path';

/** Monorepo root — apps/web -> apps -> root */
const ROOT_DIR = resolve(process.cwd(), '..', '..');
const DATA_DIR = resolve(ROOT_DIR, 'data/workspaces');
const REGISTRY_PATH = resolve(DATA_DIR, 'index.json');

export interface WorkspaceEntry {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  sourceCount: number;
  status: 'empty' | 'has_sources' | 'analyzed' | 'analysis_failed';
}

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function readRegistry(): WorkspaceEntry[] {
  ensureDataDir();
  if (!existsSync(REGISTRY_PATH)) return [];
  try {
    return JSON.parse(readFileSync(REGISTRY_PATH, 'utf-8')) as WorkspaceEntry[];
  } catch {
    return [];
  }
}

function writeRegistry(entries: WorkspaceEntry[]): void {
  ensureDataDir();
  writeFileSync(REGISTRY_PATH, JSON.stringify(entries, null, 2));
}

export function createWorkspace(name: string, description?: string): WorkspaceEntry {
  const id = `ws_${Date.now()}`;
  const now = new Date().toISOString();
  const entry: WorkspaceEntry = {
    id,
    name,
    description: description ?? '',
    createdAt: now,
    updatedAt: now,
    sourceCount: 0,
    status: 'empty',
  };

  // Create directories
  mkdirSync(getSourcesDir(id), { recursive: true });
  mkdirSync(getOutputDir(id), { recursive: true });

  // Add to registry
  const entries = readRegistry();
  entries.push(entry);
  writeRegistry(entries);

  return entry;
}

export function getWorkspace(id: string): WorkspaceEntry | undefined {
  return readRegistry().find(w => w.id === id);
}

export function listWorkspaces(): WorkspaceEntry[] {
  return readRegistry();
}

export function updateWorkspace(id: string, updates: Partial<WorkspaceEntry>): void {
  const entries = readRegistry();
  const idx = entries.findIndex(w => w.id === id);
  if (idx === -1) return;
  entries[idx] = { ...entries[idx]!, ...updates, updatedAt: new Date().toISOString() };
  writeRegistry(entries);
}

export function getWorkspaceDir(id: string): string {
  return resolve(DATA_DIR, id);
}

export function getSourcesDir(id: string): string {
  return resolve(DATA_DIR, id, 'sources');
}

export function getOutputDir(id: string): string {
  return resolve(DATA_DIR, id, 'output');
}

export interface SourceFile {
  name: string;
  size: number;
  type: string;
}

export function listSourceFiles(id: string): SourceFile[] {
  const dir = getSourcesDir(id);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(f => !f.startsWith('.'))
    .map(f => {
      const st = statSync(resolve(dir, f));
      return { name: f, size: st.size, type: detectFileType(f) };
    });
}

export function clearOutputDir(id: string): void {
  const dir = getOutputDir(id);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
}

export function computeSourceHashes(id: string): Record<string, string> {
  const dir = getSourcesDir(id);
  if (!existsSync(dir)) return {};
  const hashes: Record<string, string> = {};
  for (const f of readdirSync(dir).filter(f => !f.startsWith('.'))) {
    const buf = readFileSync(resolve(dir, f));
    hashes[f] = createHash('sha256').update(buf).digest('hex');
  }
  return hashes;
}

function detectFileType(fileName: string): string {
  if (fileName.endsWith('.md')) return 'markdown';
  if (fileName.endsWith('.csv')) return 'csv';
  if (fileName.endsWith('.json')) return 'json';
  if (fileName.endsWith('.xlsx')) return 'xlsx';
  if (fileName.endsWith('.pdf')) return 'pdf';
  if (fileName.endsWith('.docx')) return 'docx';
  if (fileName.endsWith('.txt')) return 'text';
  if (fileName.endsWith('.yaml') || fileName.endsWith('.yml')) return 'yaml';
  if (fileName.includes('.figma.')) return 'figma';
  if (fileName.includes('.confluence.')) return 'confluence';
  return 'unknown';
}

function isValidWorkspaceId(id: string): boolean {
  return /^ws_\d+$/.test(id);
}

function isSafeFileName(fileName: string): boolean {
  // Reject path separators, parent directory traversal, and empty names
  if (!fileName || fileName.includes('/') || fileName.includes('\\') || fileName.includes('..')) {
    return false;
  }
  // Ensure the basename matches the original (no path tricks)
  return basename(fileName) === fileName;
}

export function deleteWorkspace(id: string): void {
  if (!isValidWorkspaceId(id)) {
    throw new Error('Invalid workspace ID.');
  }

  const entries = readRegistry();
  const idx = entries.findIndex(w => w.id === id);
  if (idx === -1) {
    throw new Error('Workspace not found.');
  }

  // Remove workspace directory from disk
  const dir = getWorkspaceDir(id);
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }

  // Remove from registry
  entries.splice(idx, 1);
  writeRegistry(entries);
}

export function deleteSourceFile(workspaceId: string, fileName: string): void {
  if (!isValidWorkspaceId(workspaceId)) {
    throw new Error('Invalid workspace ID.');
  }
  if (!isSafeFileName(fileName)) {
    throw new Error('Invalid file name.');
  }

  const workspace = getWorkspace(workspaceId);
  if (!workspace) {
    throw new Error('Workspace not found.');
  }

  const filePath = resolve(getSourcesDir(workspaceId), fileName);
  if (!existsSync(filePath)) {
    throw new Error('File not found.');
  }

  unlinkSync(filePath);

  // Clear stale output
  clearOutputDir(workspaceId);

  // Update registry
  const remaining = listSourceFiles(workspaceId);
  updateWorkspace(workspaceId, {
    sourceCount: remaining.length,
    status: remaining.length === 0 ? 'empty' : 'has_sources',
  });
}
