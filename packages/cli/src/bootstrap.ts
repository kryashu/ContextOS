/**
 * CLI bootstrap — must be the first import in the CLI entry point.
 * Loads .env files from the monorepo root so that all downstream packages
 * (especially @contextos/ai config) see the expected env vars.
 *
 * Priority (highest to lowest):
 *   1. Shell / inline env vars  (process.env already set)
 *   2. .env.local               (developer overrides, gitignored)
 *   3. .env                     (project defaults, committed)
 *
 * dotenv's default behaviour (override: false) never overwrites an
 * existing process.env value, giving shell env the highest priority.
 */
import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// packages/cli/dist -> packages/cli -> packages -> root
const rootDir = resolve(__dirname, '..', '..', '..');

// Load .env.local first (if it exists), then .env.
// override defaults to false — process.env values are never overwritten.
const envLocalPath = resolve(rootDir, '.env.local');
if (existsSync(envLocalPath)) {
  config({ path: envLocalPath });
}
config({ path: resolve(rootDir, '.env') });

/** Monorepo root directory, used to resolve relative paths. */
export { rootDir };
