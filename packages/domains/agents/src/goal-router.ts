import type { AgentGoalType } from './types.js';

/**
 * Keyword-based deterministic goal router.
 * Maps a free-text goal string to a known AgentGoalType.
 * No LLM — pure keyword matching with priority ordering.
 */

interface GoalPattern {
  type: AgentGoalType;
  keywords: string[];
}

const GOAL_PATTERNS: GoalPattern[] = [
  {
    type: 'report_generation',
    keywords: ['report', 'generate report', 'pdf', 'markdown report', 'export report', 'create report'],
  },
  {
    type: 'readiness_check',
    keywords: ['ready', 'readiness', 'status', 'health', 'analysis state', 'is analysis', 'check state'],
  },
  {
    type: 'source_importance',
    keywords: [
      'important', 'importance', 'relevance', 'most relevant', 'key source',
      'top source', 'critical source', 'which source', 'rank source',
    ],
  },
  {
    type: 'next_actions',
    keywords: [
      'next', 'what should', 'suggest', 'recommend', 'what can i',
      'action', 'next step', 'todo', 'to do',
    ],
  },
  {
    type: 'workspace_overview',
    keywords: [
      'overview', 'summary', 'what is this', 'describe', 'about',
      'tell me about', 'workspace', 'high level', 'high-level',
    ],
  },
];

export function routeGoal(goal: string): AgentGoalType {
  const normalized = goal.toLowerCase().trim();
  if (!normalized) return 'unknown';

  for (const pattern of GOAL_PATTERNS) {
    for (const keyword of pattern.keywords) {
      if (normalized.includes(keyword)) {
        return pattern.type;
      }
    }
  }

  return 'unknown';
}
