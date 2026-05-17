import type { WorkspaceCommandPlan, ExtractedCommandData } from './types.js';
import { routeCommand } from './command-router.js';
import {
  extractDates,
  extractPossibleKeyValues,
  extractAggregateFields,
  extractFilterExpressions,
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
  unknown: 'Could not determine what to do.',
};

// ── Plan builder ────────────────────────────────────────────────────

export function createWorkspaceCommandPlan(command: string): WorkspaceCommandPlan {
  const route = routeCommand(command);

  const extracted = buildExtracted(command, route.intent);
  const warnings = buildWarnings(command, route);
  const summary = INTENT_SUMMARIES[route.intent] ?? 'Unknown command.';

  return {
    commandId: generateCommandId(),
    originalCommand: command,
    intent: route.intent,
    status: route.status,
    confidence: route.confidence,
    summary,
    extracted,
    requiredCapabilities: route.requiredCapabilities,
    warnings,
    nextStep: route.nextStep,
  };
}

// ── Extracted data builder ──────────────────────────────────────────

function buildExtracted(command: string, intent: string): ExtractedCommandData {
  const extracted: ExtractedCommandData = {};

  const keyValues = extractPossibleKeyValues(command);
  if (keyValues.length > 0) {
    extracted.keyValues = keyValues;
  }

  if (
    intent === 'table_aggregate_query' ||
    intent === 'duplicate_key_query'
  ) {
    const filters = extractFilterExpressions(command);
    if (filters.length > 0) {
      extracted.filters = filters;
    }

    const aggregations = extractAggregateFields(command);
    if (aggregations.length > 0) {
      extracted.aggregations = aggregations;
    }
  }

  // Date filters for evidence/document lookups too
  if (intent === 'evidence_lookup' || intent === 'document_lookup') {
    const dateFilters = extractDates(command);
    if (dateFilters.length > 0) {
      extracted.filters = dateFilters;
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
