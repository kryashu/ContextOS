import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import type { WorkspaceAnswer, WorkspaceQuestionIntent, WorkspaceAnswerSourceRef } from '@contextos/types';
import { QuestionRouter } from './question-router.js';
import { LocalRetriever } from './local-retriever.js';

const INSUFFICIENT = 'I could not find enough information in this workspace to answer that.';
const MAX_CONTEXT_CHARS = 6000; // cap context sent to LLM

function now(): string {
  return new Date().toISOString();
}

/**
 * WorkspaceAnswerComposer dispatches by intent to build grounded answers.
 *
 * Invariants:
 * - Deterministic intents (about, irrelevant_files, capabilities, source_relationships, sheet_query) never call the LLM.
 * - document_fact calls LLM only when retrieved snippets exist.
 * - Every non-empty factual answer includes ≥1 sourceRef (enforceGrounding).
 */
export class WorkspaceAnswerComposer {
  private readonly router = new QuestionRouter();

  constructor(
    private readonly retriever: LocalRetriever,
    private readonly model?: BaseChatModel,
    private readonly modelFactory?: () => Promise<BaseChatModel>,
  ) {}

  async answer(question: string): Promise<WorkspaceAnswer> {
    const intent = this.router.classify(question);
    let result: WorkspaceAnswer;

    switch (intent) {
      case 'about':
        result = this.answerAbout(question);
        break;
      case 'irrelevant_files':
        result = this.answerIrrelevantFiles(question);
        break;
      case 'capabilities':
        result = this.answerCapabilities(question);
        break;
      case 'source_relationships':
        result = this.answerSourceRelationships(question);
        break;
      case 'sheet_query':
        result = this.answerSheetQuery(question);
        break;
      case 'document_fact':
        result = await this.answerDocumentFact(question);
        break;
      default:
        result = {
          question,
          intent: 'unknown',
          answer: INSUFFICIENT,
          sourceRefs: [],
          confidence: 0,
          timestamp: now(),
          warnings: ['Could not classify question.'],
        };
    }

    return this.enforceGrounding(result);
  }

  // ── Deterministic handlers (no LLM) ─────────────────────────────────

  private answerAbout(question: string): WorkspaceAnswer {
    const ctx = this.retriever.loadWorkspaceContext();
    if (!ctx) {
      return this.insufficient(question, 'about');
    }

    const parts: string[] = [];
    if (ctx.primaryTheme) parts.push(ctx.primaryTheme);
    if (ctx.keyTopics && ctx.keyTopics.length > 0) {
      parts.push('Key topics: ' + ctx.keyTopics.join(', ') + '.');
    }
    if (ctx.detectedCapabilities) {
      const caps = ctx.detectedCapabilities;
      const capList: string[] = [];
      if (caps.hasDocuments) capList.push('documents');
      if (caps.hasWorkbooks) capList.push('workbooks');
      if (caps.hasTables) capList.push('tables');
      if (caps.canCalculate) capList.push('calculations');
      if (caps.canChart) capList.push('charts');
      if (caps.canGenerateDFD) capList.push('DFD generation');
      if (capList.length > 0) parts.push('Detected: ' + capList.join(', ') + '.');
    }
    if (ctx.recommendedActions && ctx.recommendedActions.length > 0) {
      parts.push(`${ctx.recommendedActions.length} recommended action(s) available.`);
    }

    if (parts.length === 0) {
      return this.insufficient(question, 'about');
    }

    return {
      question,
      intent: 'about',
      answer: parts.join(' '),
      sourceRefs: [{ fileName: 'workspace-context.json', artifactType: 'workspace-context' }],
      confidence: 0.9,
      timestamp: now(),
      warnings: [],
    };
  }

  private answerIrrelevantFiles(question: string): WorkspaceAnswer {
    const ctx = this.retriever.loadWorkspaceContext();
    if (!ctx || !ctx.irrelevantSources || ctx.irrelevantSources.length === 0) {
      return {
        question,
        intent: 'irrelevant_files',
        answer: 'No irrelevant files were detected in this workspace.',
        sourceRefs: [{ fileName: 'workspace-context.json', artifactType: 'workspace-context' }],
        confidence: 0.8,
        timestamp: now(),
        warnings: [],
      };
    }

    const lines = ctx.irrelevantSources.map(
      (s) => `• ${s.fileName}: ${s.reason}`,
    );
    return {
      question,
      intent: 'irrelevant_files',
      answer: `The following files were flagged as irrelevant:\n${lines.join('\n')}`,
      sourceRefs: [{ fileName: 'workspace-context.json', artifactType: 'workspace-context' }],
      confidence: 0.9,
      timestamp: now(),
      warnings: [],
    };
  }

  private answerCapabilities(question: string): WorkspaceAnswer {
    const ctx = this.retriever.loadWorkspaceContext();
    const obs = this.retriever.loadNormalizedObservations();
    const refs: WorkspaceAnswerSourceRef[] = [];
    const parts: string[] = [];

    if (ctx) {
      refs.push({ fileName: 'workspace-context.json', artifactType: 'workspace-context' });
      if (ctx.detectedCapabilities?.hasWorkbooks) {
        parts.push('Spreadsheet data is available for table calculations.');
      }
      if (ctx.recommendedActions && ctx.recommendedActions.length > 0) {
        parts.push(
          'Recommended actions: ' +
            ctx.recommendedActions.map((a) => a.action).join('; ') +
            '.',
        );
      }
    }

    if (obs && obs.length > 0) {
      refs.push({ fileName: 'normalized-observations.json', artifactType: 'normalized-observations' });
      parts.push(`${obs.length} normalised observation(s) are available for calculations.`);
    }

    if (parts.length === 0) {
      return this.insufficient(question, 'capabilities');
    }

    return {
      question,
      intent: 'capabilities',
      answer: parts.join(' '),
      sourceRefs: refs,
      confidence: 0.85,
      timestamp: now(),
      warnings: [],
    };
  }

  private answerSourceRelationships(question: string): WorkspaceAnswer {
    const relMap = this.retriever.loadWorkspaceRelationships();
    if (!relMap || relMap.relationships.length === 0) {
      return this.insufficient(question, 'source_relationships');
    }

    const connected = relMap.relationships
      .filter(r => r.type !== 'isolated_source')
      .sort((a, b) => b.confidence - a.confidence);
    const isolated = relMap.relationships.filter(r => r.type === 'isolated_source');

    const parts: string[] = [];

    if (connected.length > 0) {
      parts.push(`I found ${connected.length} source relationship(s) in this workspace.\n`);
      parts.push('Strong relationships:');
      for (const r of connected) {
        parts.push(`- ${r.sourceA} → ${r.sourceB}`);
        parts.push(`  Type: ${r.type}`);
        if (r.evidence.length > 0) {
          parts.push(`  Reason: ${r.evidence.join('. ')}`);
        }
        parts.push(`  Confidence: ${(r.confidence * 100).toFixed(0)}%`);
      }
    }

    if (isolated.length > 0) {
      if (connected.length > 0) parts.push('');
      parts.push('Isolated sources:');
      for (const r of isolated) {
        parts.push(`- ${r.sourceA}`);
        if (r.evidence.length > 0) {
          parts.push(`  Reason: ${r.evidence[0]}`);
        }
      }
    }

    if (parts.length === 0) {
      return this.insufficient(question, 'source_relationships');
    }

    // Build snippet summary for sourceRef
    const snippetLines: string[] = [];
    for (const r of connected.slice(0, 3)) {
      snippetLines.push(`${r.sourceA} → ${r.sourceB} (${r.type})`);
    }
    if (isolated.length > 0) {
      snippetLines.push(`${isolated.length} isolated source(s)`);
    }

    return {
      question,
      intent: 'source_relationships',
      answer: parts.join('\n'),
      sourceRefs: [{
        fileName: 'workspace-relationships.json',
        artifactType: 'workspace-relationships',
        snippet: snippetLines.join('; '),
      }],
      confidence: 0.9,
      timestamp: now(),
      warnings: [],
    };
  }

  private answerSheetQuery(question: string): WorkspaceAnswer {
    const wb = this.retriever.loadWorkbookProfile();
    if (!wb) {
      return this.insufficient(question, 'sheet_query');
    }

    const refs: WorkspaceAnswerSourceRef[] = [
      { fileName: 'workbook-profile.json', artifactType: 'workbook-profile' },
    ];

    // Surface sheet names + summary
    const sheets = (wb as Record<string, unknown>)['sheets'];
    if (Array.isArray(sheets)) {
      const names = sheets
        .map((s: Record<string, unknown>) => s['name'] ?? s['sheetName'])
        .filter(Boolean) as string[];
      if (names.length > 0) {
        return {
          question,
          intent: 'sheet_query',
          answer: `The workbook contains ${names.length} sheet(s): ${names.join(', ')}.`,
          sourceRefs: refs,
          confidence: 0.9,
          timestamp: now(),
          warnings: [],
        };
      }
    }

    // Fallback: summarise keys
    const keys = Object.keys(wb);
    return {
      question,
      intent: 'sheet_query',
      answer: `Workbook profile available with sections: ${keys.join(', ')}.`,
      sourceRefs: refs,
      confidence: 0.7,
      timestamp: now(),
      warnings: [],
    };
  }

  // ── document_fact: LLM-assisted (only when snippets exist) ───────────

  private async answerDocumentFact(question: string): Promise<WorkspaceAnswer> {
    const snippets = this.retriever.searchSourceFiles(question);

    if (snippets.length === 0) {
      return this.insufficient(question, 'document_fact');
    }

    // Resolve model: eager instance first, then lazy factory
    let model = this.model;
    if (!model && this.modelFactory) {
      try {
        model = await this.modelFactory();
      } catch {
        // Factory failed (e.g. no provider configured) — fall through to raw snippets
      }
    }

    if (!model) {
      // No model available — return snippets directly
      const text = snippets
        .map((s) => `[${s.fileName}]: ${s.snippet}`)
        .join('\n\n');
      return {
        question,
        intent: 'document_fact',
        answer: text,
        sourceRefs: snippets.map((s) => ({
          fileName: s.fileName,
          snippet: s.snippet,
          artifactType: 'source-file' as const,
        })),
        confidence: 0.6,
        timestamp: now(),
        warnings: ['No LLM available — returning raw snippets.'],
      };
    }

    let context = snippets
      .map((s) => `--- ${s.fileName} ---\n${s.snippet}`)
      .join('\n\n');

    // Truncate to cap LLM input cost
    if (context.length > MAX_CONTEXT_CHARS) {
      context = context.slice(0, MAX_CONTEXT_CHARS) + '\n…[truncated]';
    }

    const systemPrompt =
      'You are a workspace Q&A assistant. Answer ONLY from the provided source excerpts. ' +
      'If the excerpts do not contain enough information, say "I could not find enough information in this workspace to answer that." ' +
      'Never invent information. Cite the file name(s) you used.';

    const result = await model.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(
        `Source excerpts:\n${context}\n\nQuestion: ${question}`,
      ),
    ]);

    const answerText =
      typeof result.content === 'string'
        ? result.content
        : JSON.stringify(result.content);

    return {
      question,
      intent: 'document_fact',
      answer: answerText,
      sourceRefs: snippets.map((s) => ({
        fileName: s.fileName,
        snippet: s.snippet,
        artifactType: 'source-file' as const,
      })),
      confidence: 0.75,
      timestamp: now(),
      warnings: [],
    };
  }

  // ── Grounding enforcement ────────────────────────────────────────────

  private enforceGrounding(answer: WorkspaceAnswer): WorkspaceAnswer {
    const isInsufficient =
      answer.answer.toLowerCase().includes('could not find enough information') ||
      answer.intent === 'unknown';

    if (!isInsufficient && answer.sourceRefs.length === 0) {
      return {
        ...answer,
        answer: INSUFFICIENT,
        confidence: 0,
        sourceRefs: [],
        warnings: [
          ...answer.warnings,
          'Answer was rejected because it had no source references.',
        ],
      };
    }

    return answer;
  }

  private insufficient(
    question: string,
    intent: WorkspaceQuestionIntent,
  ): WorkspaceAnswer {
    return {
      question,
      intent,
      answer: INSUFFICIENT,
      sourceRefs: [],
      confidence: 0,
      timestamp: now(),
      warnings: [],
    };
  }
}
