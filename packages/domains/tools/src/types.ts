import type { ZodSchema } from 'zod';

// ── Safety levels (ordered by increasing risk) ──────────────────────

export type SafetyLevel = 'read_only' | 'compute' | 'artifact_write';

// ── Tool categories ─────────────────────────────────────────────────

export type ToolCategory = 'context' | 'analysis' | 'qa' | 'calculation' | 'reporting';

// ── Execution context resolved by the registry before execute() ─────

export interface ToolExecutionContext {
  workspaceId: string;
  outputDir: string;
  sourcesDir: string;
  manifestPath: string;
}

// ── Core tool interface ─────────────────────────────────────────────

export interface ContextOSTool<TInput = unknown, TOutput = unknown> {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: ToolCategory;
  readonly safetyLevel: SafetyLevel;
  readonly allowedWrites?: readonly string[];
  readonly requiresCurrentAnalysis: boolean;
  readonly requiresModel: boolean;
  readonly inputSchema: ZodSchema<TInput>;
  readonly outputSchema: ZodSchema<TOutput>;
  execute(input: TInput, context: ToolExecutionContext): Promise<TOutput>;
}

// ── Serializable descriptor (no execute fn, no schemas) ─────────────

export interface ToolDescriptor {
  id: string;
  name: string;
  description: string;
  category: ToolCategory;
  safetyLevel: SafetyLevel;
  allowedWrites?: readonly string[];
  requiresCurrentAnalysis: boolean;
  requiresModel: boolean;
}
