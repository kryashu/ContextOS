import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Fuzzy resolution of a workspace source file by explicit filename and/or
 * a natural-language source hint. Deterministic; no model calls.
 */

export type ResolveStatus =
  | 'exact'
  | 'resolved'
  | 'no_matches'
  | 'needs_clarification';

export type ResolveMatchMethod =
  | 'exact'
  | 'case_insensitive'
  | 'normalized'
  | 'fuzzy_levenshtein'
  | 'source_hint_filename'
  | 'source_hint_profile';

export interface ResolveResult {
  status: ResolveStatus;
  resolvedFileName?: string;
  alternatives?: string[];
  matchMethod?: ResolveMatchMethod;
}

export interface ResolveInput {
  fileName?: string;
  sourceHint?: string;
}

// ── Levenshtein distance ────────────────────────────────────────────

/**
 * Classic DP Levenshtein distance. O(m*n) time, O(min(m,n)) space.
 */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // Ensure b is the shorter string for smaller array allocation.
  let s = a;
  let t = b;
  if (s.length < t.length) {
    const tmp = s;
    s = t;
    t = tmp;
  }

  const prev = new Array<number>(t.length + 1);
  const curr = new Array<number>(t.length + 1);
  for (let j = 0; j <= t.length; j++) prev[j] = j;

  for (let i = 1; i <= s.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= t.length; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      const del = (prev[j] ?? 0) + 1;
      const ins = (curr[j - 1] ?? 0) + 1;
      const sub = (prev[j - 1] ?? 0) + cost;
      curr[j] = Math.min(ins, del, sub);
    }
    for (let j = 0; j <= t.length; j++) prev[j] = curr[j] ?? 0;
  }

  return prev[t.length] ?? 0;
}

// ── Normalization helpers ───────────────────────────────────────────

function normalize(s: string): string {
  return s.toLowerCase().replace(/[\s_-]+/g, '');
}

function extension(fileName: string): string {
  const idx = fileName.lastIndexOf('.');
  return idx >= 0 ? fileName.slice(idx + 1).toLowerCase() : '';
}

function listSourceFiles(sourcesDir: string): string[] {
  if (!existsSync(sourcesDir)) return [];
  try {
    return readdirSync(sourcesDir, { withFileTypes: true })
      .filter((e) => e.isFile())
      .map((e) => e.name);
  } catch {
    return [];
  }
}

// ── Source profile loader ───────────────────────────────────────────

interface SourceProfileEntry {
  fileName?: string;
  summary?: string;
  detectedEntities?: string[];
  detectedTopics?: string[];
}

function loadSourceProfiles(outputDir: string): SourceProfileEntry[] {
  const path = resolve(outputDir, 'source-profiles.json');
  if (!existsSync(path)) return [];
  try {
    const raw = readFileSync(path, 'utf-8');
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SourceProfileEntry[]) : [];
  } catch {
    return [];
  }
}

// ── Token matching helpers ──────────────────────────────────────────

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2);
}

function fileNameTokens(fileName: string): string[] {
  const base = fileName.replace(/\.[^.]+$/, '');
  return tokenize(base);
}

/**
 * Returns true when every meaningful hint token appears either as a token
 * in the filename or as a substring of the normalized filename.
 */
function fileMatchesHint(fileName: string, hintTokens: string[]): boolean {
  if (hintTokens.length === 0) return false;
  const tokens = new Set(fileNameTokens(fileName));
  const normalized = normalize(fileName);
  return hintTokens.every(
    (t) => tokens.has(t) || normalized.includes(t),
  );
}

function profileMatchesHint(
  profile: SourceProfileEntry,
  hintTokens: string[],
): boolean {
  if (hintTokens.length === 0) return false;
  const haystack = [
    profile.fileName ?? '',
    profile.summary ?? '',
    ...(profile.detectedEntities ?? []),
    ...(profile.detectedTopics ?? []),
  ]
    .join(' ')
    .toLowerCase();
  // Require every meaningful token to appear somewhere in the haystack.
  return hintTokens.every((t) => haystack.includes(t));
}

// ── Main resolver ───────────────────────────────────────────────────

const FUZZY_MAX_DISTANCE = 3;

export function resolveWorkspaceSourceFile(
  input: ResolveInput,
  sourcesDir: string,
  outputDir: string,
): ResolveResult {
  const files = listSourceFiles(sourcesDir);
  if (files.length === 0) {
    return { status: 'no_matches' };
  }

  const fileNameAttempt = resolveByFileName(input.fileName, files);
  if (fileNameAttempt) return fileNameAttempt;

  const hintAttempt = resolveBySourceHint(input.sourceHint, files, outputDir);
  if (hintAttempt) return hintAttempt;

  return { status: 'no_matches' };
}

function resolveByFileName(
  fileName: string | undefined,
  files: string[],
): ResolveResult | undefined {
  if (!fileName) return undefined;

  // 1. Exact match.
  const exact = files.find((f) => f === fileName);
  if (exact) return { status: 'exact', resolvedFileName: exact, matchMethod: 'exact' };

  // 2. Case-insensitive match.
  const lower = fileName.toLowerCase();
  const ci = files.find((f) => f.toLowerCase() === lower);
  if (ci) return { status: 'resolved', resolvedFileName: ci, matchMethod: 'case_insensitive' };

  // 3. Normalized match (strip spaces/underscores/hyphens).
  const norm = normalize(fileName);
  const normMatches = files.filter((f) => normalize(f) === norm);
  if (normMatches.length === 1) {
    return { status: 'resolved', resolvedFileName: normMatches[0], matchMethod: 'normalized' };
  }
  if (normMatches.length > 1) {
    return {
      status: 'needs_clarification',
      alternatives: normMatches,
      matchMethod: 'normalized',
    };
  }

  // 4. Conservative fuzzy filename match (same extension, Levenshtein <= 3).
  const ext = extension(fileName);
  const candidates = files
    .filter((f) => extension(f) === ext)
    .map((f) => ({ name: f, dist: levenshtein(normalize(f), norm) }))
    .filter((c) => c.dist <= FUZZY_MAX_DISTANCE)
    .sort((a, b) => a.dist - b.dist);

  if (candidates.length === 0) return undefined;

  // If best is clearly better than the next, return it; otherwise ask.
  const best = candidates[0];
  if (!best) return undefined;
  const close = candidates.filter((c) => c.dist === best.dist);
  if (close.length === 1) {
    return {
      status: 'resolved',
      resolvedFileName: best.name,
      matchMethod: 'fuzzy_levenshtein',
    };
  }
  return {
    status: 'needs_clarification',
    alternatives: close.map((c) => c.name),
    matchMethod: 'fuzzy_levenshtein',
  };
}

function resolveBySourceHint(
  sourceHint: string | undefined,
  files: string[],
  outputDir: string,
): ResolveResult | undefined {
  if (!sourceHint) return undefined;
  const hintTokens = tokenize(sourceHint);
  if (hintTokens.length === 0) return undefined;

  // 5. Hint tokens vs filenames.
  const fileMatches = files.filter((f) => fileMatchesHint(f, hintTokens));
  if (fileMatches.length === 1) {
    return {
      status: 'resolved',
      resolvedFileName: fileMatches[0],
      matchMethod: 'source_hint_filename',
    };
  }
  if (fileMatches.length > 1) {
    return {
      status: 'needs_clarification',
      alternatives: fileMatches,
      matchMethod: 'source_hint_filename',
    };
  }

  // 6. Hint tokens vs source-profiles.json (summary, entities, topics).
  const profiles = loadSourceProfiles(outputDir);
  const knownFiles = new Set(files);
  const profileMatches = profiles
    .filter((p) => p.fileName && knownFiles.has(p.fileName))
    .filter((p) => profileMatchesHint(p, hintTokens))
    .map((p) => p.fileName as string);

  // Dedupe while preserving order.
  const uniqueProfileMatches: string[] = [];
  for (const m of profileMatches) {
    if (!uniqueProfileMatches.includes(m)) uniqueProfileMatches.push(m);
  }

  if (uniqueProfileMatches.length === 1) {
    return {
      status: 'resolved',
      resolvedFileName: uniqueProfileMatches[0],
      matchMethod: 'source_hint_profile',
    };
  }
  if (uniqueProfileMatches.length > 1) {
    return {
      status: 'needs_clarification',
      alternatives: uniqueProfileMatches,
      matchMethod: 'source_hint_profile',
    };
  }

  return undefined;
}
