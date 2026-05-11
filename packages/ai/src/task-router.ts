import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { createChatModel, type ModelOptions } from './model-factory.js';
import { checkOllamaAvailability } from './utils.js';
import { getConfig } from './config.js';

/**
 * Task types for intelligent model routing
 */
export enum TaskType {
  CLASSIFICATION = 'classification',
  SUMMARIZATION = 'summarization',
  EXTRACTION = 'extraction',
  RELATIONSHIP_MAPPING = 'relationship_mapping',
  ARTIFACT_GENERATION = 'artifact_generation',
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
};

/**
 * Get the appropriate model for a specific task
 * Implements intelligent routing based on task complexity and provider availability
 */
export async function getModelForTask(
  task: TaskType,
  options: Partial<ModelOptions> = {}
): Promise<BaseChatModel> {
  const config = getConfig();

  // Short-circuit: mock mode bypasses all routing
  if (config.provider === 'mock') {
    console.log(`[TaskRouter] Using mock provider for ${task}`);
    return createChatModel('mock', { ...options, taskType: task });
  }

  const taskConfig = TASK_CONFIGS[task];
  const localProvider = config.localProvider;
  const hostedProvider = config.provider;
  
  // For simple tasks (classification, summarization), prefer local Ollama if available
  if (taskConfig.preferLocal) {
    const ollamaAvailable = await checkOllamaAvailability();
    
    if (ollamaAvailable) {
      console.log(`[TaskRouter] Using ${localProvider} for ${task} (local, fast)`);
      return createChatModel(localProvider, {
        ...options,
        modelName: config.models.ollama,
      });
    }
    
    // If Ollama not available, fall back to hosted provider for simple tasks
    console.log(`[TaskRouter] Ollama not available, using ${hostedProvider} for ${task}`);
    return createChatModel(hostedProvider, options);
  }
  
  // For complex tasks (extraction, relationship mapping, artifact generation)
  // Always use hosted provider (Gemini/Groq)
  console.log(`[TaskRouter] Using ${hostedProvider} for ${task} (hosted, high quality)`);
  return createChatModel(hostedProvider, options);
}

/**
 * Check if fallback is allowed for a given task and document size
 */
export function canFallbackForTask(
  task: TaskType,
  documentSizeKB: number
): boolean {
  const config = getConfig();

  // No fallback in mock mode — mock never fails
  if (config.provider === 'mock') return false;

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

  // No fallback in mock mode
  if (config.provider === 'mock') return null;

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
