// ── Tool registry errors ────────────────────────────────────────────

export class ToolNotFoundError extends Error {
  constructor(toolId: string) {
    super(`Tool not found: ${toolId}`);
    this.name = 'ToolNotFoundError';
  }
}

export class ToolInputValidationError extends Error {
  constructor(toolId: string, details: string) {
    super(`Invalid input for tool "${toolId}": ${details}`);
    this.name = 'ToolInputValidationError';
  }
}

export class StaleAnalysisError extends Error {
  constructor(workspaceId: string) {
    super(`Analysis is stale for workspace "${workspaceId}". Re-run analysis before using this tool.`);
    this.name = 'StaleAnalysisError';
  }
}

export class ArtifactWriteViolationError extends Error {
  constructor(fileName: string, allowedWrites: readonly string[]) {
    super(
      `Writing "${fileName}" is not allowed. Permitted files: ${allowedWrites.join(', ')}`,
    );
    this.name = 'ArtifactWriteViolationError';
  }
}

export class InvalidWorkspaceIdError extends Error {
  constructor(workspaceId: string) {
    super(`Invalid workspace ID: "${workspaceId}". Must match ws_<digits> with no path separators.`);
    this.name = 'InvalidWorkspaceIdError';
  }
}
