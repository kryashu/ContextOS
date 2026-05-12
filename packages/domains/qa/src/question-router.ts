import type { WorkspaceQuestionIntent } from '@contextos/types';

interface IntentRule {
  intent: WorkspaceQuestionIntent;
  patterns: RegExp[];
}

const RULES: IntentRule[] = [
  {
    intent: 'about',
    patterns: [
      /what\s+(is|are)\s+(this\s+)?workspace\s+about/i,
      /\boverview\b/i,
      /\btheme\b.*workspace/i,
      /\bdescribe\s+(this\s+)?workspace/i,
      /\bsummar(y|ize|ise)\b.*workspace/i,
      /\bwhat\s+does\s+(this\s+)?workspace\s+contain/i,
    ],
  },
  {
    intent: 'irrelevant_files',
    patterns: [
      /\birrelevant\b/i,
      /\blow[\s-]?value\b.*files?/i,
      /\bnoise\b.*files?/i,
      /\bnot\s+relevant\b/i,
      /\bunimportant\b.*files?/i,
      /which\s+files?\s+(are|should\s+be)\s+(ignored|removed|irrelevant)/i,
    ],
  },
  {
    intent: 'capabilities',
    patterns: [
      /\bwhat\s+(calculations?|actions?|operations?)\s+(are\s+)?(possible|available|supported)/i,
      /\bwhat\s+can\s+(i|you|we)\s+(do|calculate|compute|analyse|analyze)/i,
      /\bcapabilit(y|ies)\b/i,
      /\bwhat.*can\s+be\s+(done|calculated|computed)/i,
    ],
  },
  {
    intent: 'sheet_query',
    patterns: [
      /\bsheet(s)?\b/i,
      /\bworkbook(s)?\b/i,
      /\bexcel\b/i,
      /\btab(s)?\b.*\b(related|about|contain|match)/i,
      /\bspreadsheet(s)?\b/i,
    ],
  },
];

const MIN_DOCUMENT_FACT_LENGTH = 8;

/**
 * QuestionRouter classifies a question into a WorkspaceQuestionIntent.
 * Pure / deterministic — no LLM call.
 */
export class QuestionRouter {
  classify(question: string): WorkspaceQuestionIntent {
    const trimmed = question.trim();
    if (trimmed.length === 0) return 'unknown';

    for (const rule of RULES) {
      for (const pattern of rule.patterns) {
        if (pattern.test(trimmed)) {
          return rule.intent;
        }
      }
    }

    // If the question is long enough to be a real question, treat as document_fact
    if (trimmed.length >= MIN_DOCUMENT_FACT_LENGTH && trimmed.includes(' ')) {
      return 'document_fact';
    }

    return 'unknown';
  }
}
