import type { ValidProvider } from './config.js';

export interface ModelPolicy {
  costTier: 'none' | 'low' | 'medium' | 'high';
  modelMode: 'none' | 'optional' | 'required';
  preferredProviders: ValidProvider[];
  maxInputTokens: number;
}

/**
 * Per-task cost/routing policy.
 * Keys are TaskType string values — uses strings to avoid circular imports
 * with task-router.ts.
 */
const TASK_POLICIES: Record<string, ModelPolicy> = {
  classification: {
    costTier: 'none',
    modelMode: 'optional',
    preferredProviders: ['ollama'],
    maxInputTokens: 2000,
  },
  summarization: {
    costTier: 'low',
    modelMode: 'optional',
    preferredProviders: ['ollama'],
    maxInputTokens: 4000,
  },
  qa: {
    costTier: 'low',
    modelMode: 'required',
    preferredProviders: ['groq', 'gemini'],
    maxInputTokens: 8000,
  },
  extraction: {
    costTier: 'medium',
    modelMode: 'required',
    preferredProviders: ['gemini', 'groq'],
    maxInputTokens: 8000,
  },
  relationship_mapping: {
    costTier: 'high',
    modelMode: 'required',
    preferredProviders: ['gemini', 'openai'],
    maxInputTokens: 16000,
  },
  artifact_generation: {
    costTier: 'high',
    modelMode: 'required',
    preferredProviders: ['gemini', 'openai'],
    maxInputTokens: 16000,
  },
};

const DEFAULT_POLICY: ModelPolicy = {
  costTier: 'medium',
  modelMode: 'required',
  preferredProviders: ['gemini'],
  maxInputTokens: 8000,
};

export function getModelPolicy(task: string): ModelPolicy {
  return TASK_POLICIES[task] ?? DEFAULT_POLICY;
}
