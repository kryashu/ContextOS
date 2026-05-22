import type { WorkspaceCommandPlan, ExtractedCommandData, CommandIntent } from './types.js';
import { routeCommand } from './command-router.js';
import {
  extractDates,
  extractPossibleKeyValues,
  extractAggregateFields,
  extractFilterExpressions,
  extractKeyType,
  extractFileName,
  extractSourceHint,
  extractRowRequest,
} from './command-parser.js';

let commandCounter = 0;

function generateCommandId(): string {
  commandCounter++;
  return `cmd_${Date.now()}_${commandCounter}`;
}

// ── Intent summaries ────────────────────────────────────────────────

const INTENT_SUMMARIES: Record<string, string> = {
  workspace_overview: 'Provide a high-level overview of the workspace.',
  next_actions: 'Suggest what to look at or do next.',
  report_generation: 'Generate a workspace report.',
  source_relationship_lookup: 'Look up relationships between source files.',
  document_lookup: 'Find documents matching the query.',
  evidence_lookup: 'Find evidence or references for the query.',
  table_aggregate_query: 'Run a table aggregation query.',
  duplicate_key_query: 'Detect duplicate keys across data sources.',
  source_content_query: 'Explain the contents of a specific source file.',
  unknown: 'Could not determine what to do.',
};

// ── Plan builder ────────────────────────────────────────────────────

export function createWorkspaceCommandPlan(command: string): WorkspaceCommandPlan {
  const route = routeCommand(command);

  // Pre-extract file name & source hint so refinement can use them.
  const fileName = extractFileName(command);
  const sourceHint = extractSourceHint(command);

  // ── Intent refinement ────────────────────────────────────────────
  // A concrete file reference always wins over keyword-based routing —
  // "Summarize release_notes_ABC-123.pdf" should explain the PDF, not run
  // report generation. A free-form source hint is weaker: it only upgrades
  // when the router could not classify the command on its own.
  let intent: CommandIntent = route.intent;
  let confidence = route.confidence;
  let routeStatus = route.status;
  if (fileName !== undefined && intent !== 'source_content_query') {
    intent = 'source_content_query';
    confidence = 'high';
    routeStatus = 'executable';
  } else if (sourceHint !== undefined && intent === 'unknown') {
    intent = 'source_content_query';
    confidence = 'high';
    routeStatus = 'executable';
  }

  const extracted = buildExtracted(command, intent);
  if (fileName) extracted.fileName = fileName;
  if (sourceHint) extracted.sourceHint = sourceHint;

  const warnings = buildWarnings(command, { ...route, intent, confidence });
  const summary = INTENT_SUMMARIES[intent] ?? 'Unknown command.';

  // Guard: document_lookup/evidence_lookup without a key value → needs_clarification
  let status = routeStatus;
  let nextStep = route.nextStep;
  if (
    (intent === 'document_lookup' || intent === 'evidence_lookup') &&
    status === 'executable' &&
    !extracted.keyValue &&
    (!extracted.keyValues || extracted.keyValues.length === 0)
  ) {
    status = 'needs_clarification';
    nextStep = 'Please specify which key or identifier to search for (e.g. product ABC-123, license LIC-2025-88).';
  }

  // Guard: source_content_query without any file hint → needs_clarification
  if (
    intent === 'source_content_query' &&
    status === 'executable' &&
    !extracted.fileName &&
    !extracted.sourceHint
  ) {
    status = 'needs_clarification';
    nextStep = 'Please specify which file or document you would like explained (e.g. release_notes_ABC-123.pdf).';
  }

  return {
    commandId: generateCommandId(),
    originalCommand: command,
    intent,
    status,
    confidence,
    summary,
    extracted,
    requiredCapabilities: route.requiredCapabilities,
    warnings,
    nextStep,
  };
}

// ── Extracted data builder ──────────────────────────────────────────

function buildExtracted(command: string, intent: string): ExtractedCommandData {
  const extracted: ExtractedCommandData = {};

  const keyValues = extractPossibleKeyValues(command);
  if (keyValues.length > 0) {
    extracted.keyValues = keyValues;
  }

  if (intent === 'duplicate_key_query') {
    // Extract key type from phrases like "duplicate emails" → "email"
    const keyType = extractKeyType(command);
    if (keyType) {
      extracted.keyType = keyType;
    }

    const filters = extractFilterExpressions(command);
    if (filters.length > 0) {
      extracted.filters = filters;
    }
  }

  if (intent === 'table_aggregate_query') {
    const filters = extractFilterExpressions(command);
    if (filters.length > 0) {
      extracted.filters = filters;
    }

    const aggregations = extractAggregateFields(command);
    if (aggregations.length > 0) {
      extracted.aggregations = aggregations;
    }
  }

  // For document/evidence lookup, extract key value for routing
  if (intent === 'document_lookup' || intent === 'evidence_lookup') {
    const dateFilters = extractDates(command);
    if (dateFilters.length > 0) {
      extracted.filters = dateFilters;
    }

    // Use first extracted key value as the lookup target
    if (keyValues.length > 0) {
      extracted.keyValue = keyValues[0];
    }

    // Also try to detect key type
    const keyType = extractKeyType(command);
    if (keyType) {
      extracted.keyType = keyType;
    }
  }

  return extracted;
}

// ── Warnings builder ────────────────────────────────────────────────

function buildWarnings(
  command: string,
  route: { intent: string; confidence: string; status: string },
): string[] {
  const warnings: string[] = [];

  if (route.confidence === 'low') {
    warnings.push('Low confidence in intent detection. Consider rephrasing.');
  }

  if (command.trim().split(/\s+/).length < 3 && route.intent !== 'unknown') {
    warnings.push('Command is very short. Results may be broad.');
  }

  if (route.status === 'planned_only') {
    warnings.push(
      `This command requires capabilities not yet implemented: plan only.`,
    );
  }

  return warnings;
}
