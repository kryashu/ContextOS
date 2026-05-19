// ── Types ────────────────────────────────────────────────────────────
export type {
  AgentGoalType,
  AgentRunInput,
  AgentRunResult,
  AgentToolTrace,
  AgentToolTraceStatus,
} from './types.js';

// ── Unified workspace agent response ────────────────────────────────
export type {
  WorkspaceAgentResponse,
  WorkspaceAgentResponseStatus,
  WorkspaceAgentResultType,
  AgentResponseSection,
  AgentResponseSectionKind,
  AgentSourceRef,
  AgentNextAction,
  AgentDownload,
  AgentToolTrace as WorkspaceAgentToolTrace,
  AgentToolTraceStatus as WorkspaceAgentToolTraceStatus,
  MetricListEntry,
  MetricListSectionContent,
  TableSectionContent,
  EvidenceSectionEntry,
  EvidenceSectionContent,
  DownloadsSectionContent,
} from './workspace-agent-response.js';

// ── Goal router ─────────────────────────────────────────────────────
export { routeGoal } from './goal-router.js';

// ── Agents ──────────────────────────────────────────────────────────
export { WorkspaceAnalystAgent } from './workspace-analyst-agent.js';
export { WorkspaceCommandAgent } from './workspace-command-agent.js';
export type { WorkspaceCommandAgentInput } from './workspace-command-agent.js';

// ── Response formatters ─────────────────────────────────────────────
export * as ResponseFormatters from './response-formatters/index.js';
