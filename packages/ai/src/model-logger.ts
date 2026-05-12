/**
 * Estimate token count from text using a simple heuristic (~4 chars per token).
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

interface ModelCallLog {
  task: string;
  provider: string;
  model: string;
  estimatedInputTokens: number;
  timestamp: string;
}

/**
 * Log a structured model call for observability.
 */
export function logModelCall(entry: ModelCallLog): void {
  console.log(JSON.stringify({ type: 'model_call', ...entry }));
}
