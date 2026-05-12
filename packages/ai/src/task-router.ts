import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { createChatModel, type ModelOptions } from './model-factory.js';
import { checkOllamaAvailability } from './utils.js';
import { getConfig } from './config.js';
import { getModelPolicy } from './model-policy.js';
import { logModelCall } from './model-logger.js';

/**
 * Task types for intelligent model routing
 */
export enum TaskType {
  CLASSIFICATION = 'classification',
  SUMMARIZATION = 'summarization',
  EXTRACTION = 'extraction',
  RELATIONSHIP_MAPPING = 'relationship_mapping',
  ARTIFACT_GENERATION = 'artifact_generation',
  QA = 'qa',
}

/**
 * Task routing configuration
 */
interface TaskConfig {
  preferLocal: boolean; // Prefer local Ollama for this task
  allowFallback: boolean; // Allow fallback to Ollama if primary fails
  complexityLevel: 'low' | 'medium' | 'high'; // Task complexity
  maxContextSize?: number; // Max context size for Ollama fallback (in tokens)
}

const TASK_CONFIGS: Record<TaskType, TaskConfig> = {
  [TaskType.CLASSIFICATION]: {
    preferLocal: true,
    allowFallback: false, // Already using local
    complexityLevel: 'low',
  },
  [TaskType.SUMMARIZATION]: {
    preferLocal: true,
    allowFallback: false, // Already using local
    complexityLevel: 'low',
  },
  [TaskType.EXTRACTION]: {
    preferLocal: false,
    allowFallback: true, // Can fallback for extraction
    complexityLevel: 'medium',
    maxContextSize: 8000,
  },
  [TaskType.RELATIONSHIP_MAPPING]: {
    preferLocal: false,
    allowFallback: false, // Too complex for small models
    complexityLevel: 'high',
  },
  [TaskType.ARTIFACT_GENERATION]: {
    preferLocal: false,
    allowFallback: false, // Requires structured reasoning
    complexityLevel: 'high',
  },
  [TaskType.QA]: {
    preferLocal: false,
    allowFallback: true,
    complexityLevel: 'medium',
    maxContextSize: 8000,
  },
};

/**
 * Get the appropriate model for a specific task
 * Implements intelligent routing based on task complexity and provider availability
 *
 * Returns null when the task can proceed without an LLM (e.g. classification
 * with no provider configured and Ollama unavailable).
 * Throws when the task requires an LLM but none is configured.
 */
export async function getModelForTask(
  task: TaskType,
  options: Partial<ModelOptions> = {}
): Promise<BaseChatModel | null> {
  const config = getConfig();
  const policy = getModelPolicy(task);

  // Short-circuit: mock mode (test environments only — guarded by config)
  if (config.provider === 'mock') {
    console.log(`[TaskRouter] Using test model for ${task}`);
    logModelCall({ task, provider: 'mock', model: 'fake-list', estimatedInputTokens: 0, timestamp: new Date().toISOString() });
    return createChatModel('mock', { ...options, taskType: task });
  }

  const taskConfig = TASK_CONFIGS[task];
  const localProvider = config.localProvider;
  
  // For simple tasks (classification, summarization), prefer local Ollama if available
  if (taskConfig.preferLocal) {
    const ollamaAvailable = await checkOllamaAvailability();
    
    if (ollamaAvailable) {
      console.log(`[TaskRouter] Using ${localProvider} for ${task} (local, fast)`);
      logModelCall({ task, provider: localProvider, model: config.models.ollama, estimatedInputTokens: 0, timestamp: new Date().toISOString() });
      return createChatModel(localProvider, {
        ...options,
        modelName: config.models.ollama,
      });
    }
    
    // Ollama not available — fall back to hosted provider if configured
    if (!config.provider) {
      if (policy.modelMode === 'required') {
        throw new Error(
          `[TaskRouter] Task "${task}" requires an LLM provider but LLM_PROVIDER is not configured.`
        );
      }
      console.log(`[TaskRouter] No LLM provider configured and Ollama unavailable — skipping ${task}`);
      return null;
    }

    console.log(`[TaskRouter] Ollama not available, using ${config.provider} for ${task}`);
    logModelCall({ task, provider: config.provider, model: config.models[config.provider as keyof typeof config.models] ?? config.provider, estimatedInputTokens: 0, timestamp: new Date().toISOString() });
    return createChatModel(config.provider, options);
  }
  
  // For complex tasks (extraction, relationship mapping, artifact generation, QA)
  // Require a hosted provider
  if (!config.provider) {
    if (policy.modelMode === 'optional') {
      console.log(`[TaskRouter] No LLM provider configured — skipping optional ${task}`);
      return null;
    }
    throw new Error(
      `[TaskRouter] Task "${task}" requires an LLM provider but LLM_PROVIDER is not configured. ` +
      `Set LLM_PROVIDER to a hosted provider (gemini, groq, openai).`
    );
  }

  console.log(`[TaskRouter] Using ${config.provider} for ${task} (hosted, high quality)`);
  logModelCall({ task, provider: config.provider, model: config.models[config.provider as keyof typeof config.models] ?? config.provider, estimatedInputTokens: 0, timestamp: new Date().toISOString() });
  return createChatModel(config.provider, options);
}

/**
 * Check if fallback is allowed for a given task and document size
 */
export function canFallbackForTask(
  task: TaskType,
  documentSizeKB: number
): boolean {
  const config = getConfig();

  // No fallback in mock mode — mock never fails.
  // No fallback when provider is unset — nothing to fall back from.
  if (!config.provider || config.provider === 'mock') return false;

  const taskCfg = TASK_CONFIGS[task];
  return (
    config.enableLocalFallback &&
    taskCfg.allowFallback &&
    documentSizeKB < config.localFallbackMaxSizeKB
  );
}

/**
 * Get fallback model for a task (always Ollama)
 */
export async function getFallbackModel(
  task: TaskType,
  options: Partial<ModelOptions> = {}
): Promise<BaseChatModel | null> {
  const config = getConfig();

  // No fallback in mock mode or when provider is unset
  if (!config.provider || config.provider === 'mock') return null;

  const taskCfg = TASK_CONFIGS[task];
  
  if (!taskCfg.allowFallback) {
    return null;
  }
  
  const ollamaAvailable = await checkOllamaAvailability();
  
  if (!ollamaAvailable) {
    return null;
  }
  
  console.warn(
    `[TaskRouter] Using local ${config.localProvider} fallback for ${task} - results may be lower quality`
  );
  
  return createChatModel(config.localProvider, {
    ...options,
    modelName: config.models.ollama,
    maxTokens: config.localFallbackMaxTokens,
  });
}
