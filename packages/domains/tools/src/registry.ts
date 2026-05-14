import type { ContextOSTool, ToolDescriptor } from './types.js';
import { ToolNotFoundError, ToolInputValidationError } from './errors.js';
import { assertAnalysisCurrent } from './safety.js';
import { buildContext, validateWorkspaceId } from './workspace-paths.js';

export class ToolRegistry {
  private readonly tools = new Map<string, ContextOSTool>();

  register(tool: ContextOSTool): void {
    this.tools.set(tool.id, tool);
  }

  listTools(): ToolDescriptor[] {
    return [...this.tools.values()].map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      category: t.category,
      safetyLevel: t.safetyLevel,
      allowedWrites: t.allowedWrites,
      requiresCurrentAnalysis: t.requiresCurrentAnalysis,
      requiresModel: t.requiresModel,
    }));
  }

  getTool(id: string): ContextOSTool | undefined {
    return this.tools.get(id);
  }

  async executeTool(id: string, input: unknown): Promise<unknown> {
    const tool = this.tools.get(id);
    if (!tool) {
      throw new ToolNotFoundError(id);
    }

    // Validate workspaceId early (path-traversal protection)
    const raw = input as Record<string, unknown> | null;
    if (raw && typeof raw === 'object' && 'workspaceId' in raw) {
      validateWorkspaceId(raw.workspaceId as string);
    }

    // Validate input against the tool's Zod schema
    const parsed = tool.inputSchema.safeParse(input);
    if (!parsed.success) {
      throw new ToolInputValidationError(id, parsed.error.message);
    }

    // Build execution context from the validated workspaceId
    const workspaceId = (parsed.data as Record<string, unknown>).workspaceId as string;
    const context = buildContext(workspaceId);

    // Staleness check for tools that require current analysis
    if (tool.requiresCurrentAnalysis) {
      assertAnalysisCurrent(context);
    }

    return tool.execute(parsed.data, context);
  }
}

export const toolRegistry = new ToolRegistry();
