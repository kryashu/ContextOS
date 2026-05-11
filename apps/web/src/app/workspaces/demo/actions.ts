'use server';

import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

/** Monorepo root — apps/web -> apps -> root */
const ROOT_DIR = resolve(process.cwd(), '..', '..');

/** Hardcoded workspace path — no user input. */
const WORKSPACE_PATH = resolve(ROOT_DIR, 'demo-workspaces/checkout-system');

const EXEC_OPTIONS = {
  cwd: ROOT_DIR,
  stdio: 'pipe' as const,
  timeout: 120_000,
  env: { ...process.env, FORCE_COLOR: '0' },
};

export async function runAnalysis(): Promise<{ success: boolean; message: string }> {
  try {
    // Step 1: Run demo analysis
    execFileSync('pnpm', ['contextos', 'demo', WORKSPACE_PATH], EXEC_OPTIONS);

    // Step 2: Run eval (non-blocking — failure doesn't prevent UI refresh)
    let evalMessage = '';
    try {
      execFileSync('pnpm', ['contextos', 'eval', 'vertical-slice-001'], EXEC_OPTIONS);
    } catch (evalErr) {
      const evalMsg = evalErr instanceof Error ? evalErr.message : String(evalErr);
      evalMessage = ` Eval warning: ${evalMsg}`;
    }

    return { success: true, message: `Analysis and eval completed.${evalMessage}` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: `Analysis failed: ${msg}` };
  }
}
