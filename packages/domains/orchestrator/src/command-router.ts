import type { CommandIntent, CommandExecutionStatus, ConfidenceLevel } from './types.js';

// ── Route result ────────────────────────────────────────────────────

export interface RouteResult {
  intent: CommandIntent;
  status: CommandExecutionStatus;
  confidence: ConfidenceLevel;
  requiredCapabilities: string[];
  nextStep?: string;
}

// ── Intent patterns (priority order) ────────────────────────────────

interface IntentPattern {
  intent: CommandIntent;
  status: CommandExecutionStatus;
  confidence: ConfidenceLevel;
  keywords: string[];
  requiredCapabilities: string[];
  nextStep?: string;
}

const INTENT_PATTERNS: IntentPattern[] = [
  // ── Future engines (planned_only) ─────────────────────────────────
  {
    intent: 'duplicate_key_query',
    status: 'planned_only',
    confidence: 'high',
    keywords: [
      'duplicate', 'duplicates', 'find duplicate', 'detect duplicate',
      'duplicate key', 'duplicate email', 'duplicate id',
    ],
    requiredCapabilities: ['generic_key_intelligence_engine'],
    nextStep: 'The Generic Key Intelligence Engine is not implemented yet.',
  },
  {
    intent: 'table_aggregate_query',
    status: 'executable',
    confidence: 'high',
    keywords: [
      'calculate total', 'sum of', 'total units', 'aggregate',
      'count all', 'average of', 'group by', 'pivot',
      'how many', 'min of', 'max of',
    ],
    requiredCapabilities: ['smart_table_query_engine'],
  },

  // ── Executable intents ────────────────────────────────────────────
  {
    intent: 'report_generation',
    status: 'executable',
    confidence: 'high',
    keywords: [
      'report', 'generate report', 'pdf', 'markdown report',
      'export report', 'create report',
    ],
    requiredCapabilities: [],
  },
  {
    intent: 'source_relationship_lookup',
    status: 'executable',
    confidence: 'high',
    keywords: [
      'related file', 'related to', 'relationship', 'linked',
      'connected', 'which files', 'file relationship',
      'source relationship',
    ],
    requiredCapabilities: [],
  },
  {
    intent: 'evidence_lookup',
    status: 'executable',
    confidence: 'medium',
    keywords: [
      'evidence', 'proof', 'cite', 'reference', 'show me where',
      'where does it say', 'find mention',
    ],
    requiredCapabilities: [],
  },
  {
    intent: 'document_lookup',
    status: 'executable',
    confidence: 'medium',
    keywords: [
      'show all documents', 'show document', 'find document',
      'look up', 'search for', 'find all', 'show all',
      'product', 'related to product',
    ],
    requiredCapabilities: [],
  },
  {
    intent: 'next_actions',
    status: 'executable',
    confidence: 'high',
    keywords: [
      'next', 'what should', 'suggest', 'recommend',
      'what can i', 'action', 'next step', 'todo', 'to do',
      'look at first',
    ],
    requiredCapabilities: [],
  },
  {
    intent: 'workspace_overview',
    status: 'executable',
    confidence: 'high',
    keywords: [
      'overview', 'summary', 'what is this', 'describe', 'about',
      'tell me about', 'workspace', 'high level', 'high-level',
      'understand', 'understanding',
    ],
    requiredCapabilities: [],
  },
];

// ── Router ──────────────────────────────────────────────────────────

export function routeCommand(command: string): RouteResult {
  const normalized = command.toLowerCase().trim();
  if (!normalized) {
    return {
      intent: 'unknown',
      status: 'needs_clarification',
      confidence: 'low',
      requiredCapabilities: [],
      nextStep: 'Please enter a command.',
    };
  }

  for (const pattern of INTENT_PATTERNS) {
    for (const keyword of pattern.keywords) {
      if (normalized.includes(keyword)) {
        return {
          intent: pattern.intent,
          status: pattern.status,
          confidence: pattern.confidence,
          requiredCapabilities: pattern.requiredCapabilities,
          nextStep: pattern.nextStep,
        };
      }
    }
  }

  return {
    intent: 'unknown',
    status: 'needs_clarification',
    confidence: 'low',
    requiredCapabilities: [],
    nextStep: 'Could not determine intent. Try rephrasing or use a preset command.',
  };
}
