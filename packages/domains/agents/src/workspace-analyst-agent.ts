import type { ToolRegistry } from '@contextos/tools';
import type { SourceProfile, WorkspaceContext } from '@contextos/types';
import type {
  AgentGoalType,
  AgentRunInput,
  AgentRunResult,
  AgentToolTrace,
} from './types.js';
import { routeGoal } from './goal-router.js';

// ── Internal helpers ────────────────────────────────────────────────

interface AnalysisState {
  state: 'current' | 'stale' | 'none';
  capabilities?: Record<string, boolean>;
}

async function traceTool(
  registry: ToolRegistry,
  toolId: string,
  input: Record<string, unknown>,
  trace: AgentToolTrace[],
): Promise<unknown> {
  const start = Date.now();
  try {
    const result = await registry.executeTool(toolId, input);
    trace.push({ toolId, status: 'success', durationMs: Date.now() - start });
    return result;
  } catch (err) {
    trace.push({
      toolId,
      status: 'failure',
      durationMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

function skipTool(
  toolId: string,
  reason: string,
  trace: AgentToolTrace[],
): void {
  trace.push({ toolId, status: 'skipped', durationMs: 0, skippedReason: reason });
}

// ── Workflow implementations ────────────────────────────────────────

async function workspaceOverview(
  registry: ToolRegistry,
  workspaceId: string,
  trace: AgentToolTrace[],
): Promise<{ answer: string; warnings: string[] }> {
  const warnings: string[] = [];

  const ctx = (await traceTool(
    registry,
    'getWorkspaceContext',
    { workspaceId },
    trace,
  )) as WorkspaceContext;

  const profiles = (await traceTool(
    registry,
    'getSourceProfiles',
    { workspaceId },
    trace,
  )) as SourceProfile[];

  const topicList = ctx.keyTopics.length > 0
    ? ctx.keyTopics.join(', ')
    : 'none detected';

  const sourceCount = profiles.length;
  const highRelevance = profiles.filter((p) => p.relevanceScore >= 0.7).length;

  const lines = [
    `**Theme:** ${ctx.primaryTheme}`,
    `**Key topics:** ${topicList}`,
    `**Sources:** ${sourceCount} total, ${highRelevance} high-relevance`,
  ];

  if (ctx.keyEntities.length > 0) {
    lines.push(`**Key entities:** ${ctx.keyEntities.join(', ')}`);
  }

  return { answer: lines.join('\n'), warnings };
}

async function nextActions(
  registry: ToolRegistry,
  workspaceId: string,
  trace: AgentToolTrace[],
): Promise<{ answer: string; warnings: string[] }> {
  const warnings: string[] = [];

  const questions = (await traceTool(
    registry,
    'getSuggestedQuestions',
    { workspaceId },
    trace,
  )) as string[];

  if (questions.length === 0) {
    return { answer: 'No suggested actions available. Try asking a specific question about the workspace.', warnings };
  }

  const lines = ['**Suggested next actions:**', ...questions.map((q, i) => `${i + 1}. ${q}`)];
  return { answer: lines.join('\n'), warnings };
}

async function reportGeneration(
  registry: ToolRegistry,
  workspaceId: string,
  allowWrites: boolean,
  trace: AgentToolTrace[],
): Promise<{ answer: string; warnings: string[] }> {
  const warnings: string[] = [];

  if (!allowWrites) {
    skipTool('generateMarkdownReport', 'allowWrites is false', trace);
    return {
      answer: 'Report generation requires write permission. Set allowWrites=true to generate reports.',
      warnings: ['Report generation was blocked because allowWrites=false.'],
    };
  }

  const result = (await traceTool(
    registry,
    'generateMarkdownReport',
    { workspaceId },
    trace,
  )) as { path: string };

  return { answer: `Markdown report generated: ${result.path}`, warnings };
}

async function readinessCheck(
  registry: ToolRegistry,
  workspaceId: string,
  analysisState: AnalysisState,
  trace: AgentToolTrace[],
): Promise<{ answer: string; warnings: string[] }> {
  const warnings: string[] = [];
  const caps = analysisState.capabilities;

  const lines = [`**Analysis state:** ${analysisState.state}`];

  if (caps) {
    const available = Object.entries(caps)
      .filter(([, v]) => v)
      .map(([k]) => k);
    const missing = Object.entries(caps)
      .filter(([, v]) => !v)
      .map(([k]) => k);

    if (available.length > 0) {
      lines.push(`**Available capabilities:** ${available.join(', ')}`);
    }
    if (missing.length > 0) {
      lines.push(`**Missing capabilities:** ${missing.join(', ')}`);
    }
  }

  // Also fetch suggested questions to show readiness context
  try {
    const questions = (await traceTool(
      registry,
      'getSuggestedQuestions',
      { workspaceId },
      trace,
    )) as string[];
    if (questions.length > 0) {
      lines.push(`**${questions.length} suggested question(s) available.**`);
    }
  } catch {
    warnings.push('Could not fetch suggested questions.');
  }

  return { answer: lines.join('\n'), warnings };
}

async function sourceImportance(
  registry: ToolRegistry,
  workspaceId: string,
  trace: AgentToolTrace[],
): Promise<{ answer: string; warnings: string[] }> {
  const warnings: string[] = [];

  const profiles = (await traceTool(
    registry,
    'getSourceProfiles',
    { workspaceId },
    trace,
  )) as SourceProfile[];

  if (profiles.length === 0) {
    return { answer: 'No source profiles found.', warnings };
  }

  const sorted = [...profiles].sort((a, b) => b.relevanceScore - a.relevanceScore);
  const top = sorted.slice(0, 5);

  const lines = [
    '**Source importance ranking (top 5):**',
    ...top.map(
      (p, i) =>
        `${i + 1}. **${p.fileName}** — relevance: ${(p.relevanceScore * 100).toFixed(0)}%, topics: ${p.detectedTopics.join(', ') || 'none'}`,
    ),
  ];

  if (sorted.length > 5) {
    lines.push(`\n_...and ${sorted.length - 5} more source(s)._`);
  }

  return { answer: lines.join('\n'), warnings };
}

function unknownGoal(goal: string): { answer: string; warnings: string[] } {
  return {
    answer: [
      `I couldn't determine a specific workflow for: "${goal}"`,
      '',
      'Try one of these:',
      '- "Give me an overview of this workspace"',
      '- "What should I do next?"',
      '- "Generate a report"',
      '- "Is the analysis ready?"',
      '- "Which sources are most important?"',
    ].join('\n'),
    warnings: [],
  };
}

// ── Main agent ──────────────────────────────────────────────────────

export class WorkspaceAnalystAgent {
  constructor(private readonly registry: ToolRegistry) {}

  async run(input: AgentRunInput): Promise<AgentRunResult> {
    const { workspaceId, goal, allowWrites = false } = input;
    const toolTrace: AgentToolTrace[] = [];
    const goalType: AgentGoalType = routeGoal(goal);

    // Step 1: Always check analysis state first
    let analysisState: AnalysisState;
    try {
      analysisState = (await traceTool(
        this.registry,
        'checkAnalysisState',
        { workspaceId },
        toolTrace,
      )) as AnalysisState;
    } catch (err) {
      return {
        goal: goalType,
        answer: 'Failed to check analysis state. Ensure the workspace exists.',
        toolTrace,
        warnings: [err instanceof Error ? err.message : String(err)],
      };
    }

    // Step 2: Stop early if analysis is none or stale (except readiness_check which reports it)
    if (
      analysisState.state !== 'current' &&
      goalType !== 'readiness_check' &&
      goalType !== 'unknown'
    ) {
      const stateMsg =
        analysisState.state === 'none'
          ? 'No analysis has been run for this workspace. Run analysis first.'
          : 'Analysis is stale — sources have changed since last analysis. Re-run analysis.';

      return {
        goal: goalType,
        answer: stateMsg,
        toolTrace,
        warnings: [`Analysis state: ${analysisState.state}`],
      };
    }

    // Step 3: Execute the workflow for the routed goal
    try {
      let result: { answer: string; warnings: string[] };

      switch (goalType) {
        case 'workspace_overview':
          result = await workspaceOverview(this.registry, workspaceId, toolTrace);
          break;
        case 'next_actions':
          result = await nextActions(this.registry, workspaceId, toolTrace);
          break;
        case 'report_generation':
          result = await reportGeneration(this.registry, workspaceId, allowWrites, toolTrace);
          break;
        case 'readiness_check':
          result = await readinessCheck(this.registry, workspaceId, analysisState, toolTrace);
          break;
        case 'source_importance':
          result = await sourceImportance(this.registry, workspaceId, toolTrace);
          break;
        case 'unknown':
        default:
          result = unknownGoal(goal);
          break;
      }

      return {
        goal: goalType,
        answer: result.answer,
        toolTrace,
        warnings: result.warnings,
      };
    } catch (err) {
      return {
        goal: goalType,
        answer: `Workflow "${goalType}" failed: ${err instanceof Error ? err.message : String(err)}`,
        toolTrace,
        warnings: [err instanceof Error ? err.message : String(err)],
      };
    }
  }
}
