import type { AgentToolTrace, AgentToolTraceStatus } from '../workspace-agent-response.js';

/**
 * Small collector that records tool-trace entries with timings. Designed to
 * keep summaries short and human-readable (no raw JSON), as required by the
 * primary-UI guard.
 */
export class TraceCollector {
  private readonly entries: AgentToolTrace[] = [];

  add(entry: AgentToolTrace): void {
    this.entries.push(entry);
  }

  skip(toolId: string, reason: string): void {
    this.entries.push({
      toolId,
      status: 'skipped',
      summary: reason,
      durationMs: 0,
    });
  }

  async time<T>(
    toolId: string,
    successSummary: (result: T) => string,
    fn: () => Promise<T>,
  ): Promise<T> {
    const start = Date.now();
    try {
      const result = await fn();
      this.entries.push({
        toolId,
        status: 'success',
        summary: truncate(successSummary(result), 240),
        durationMs: Date.now() - start,
      });
      return result;
    } catch (err) {
      this.entries.push({
        toolId,
        status: 'failed',
        summary: truncate(`error: ${errorMessage(err)}`, 240),
        durationMs: Date.now() - start,
      });
      throw err;
    }
  }

  record(toolId: string, status: AgentToolTraceStatus, summary: string, durationMs?: number): void {
    this.entries.push({
      toolId,
      status,
      summary: truncate(summary, 240),
      durationMs,
    });
  }

  snapshot(): AgentToolTrace[] {
    return [...this.entries];
  }
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return 'unknown error';
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '…';
}
