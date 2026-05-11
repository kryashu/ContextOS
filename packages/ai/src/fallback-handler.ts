import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { TaskType, getFallbackModel, canFallbackForTask } from './task-router.js';
import { calculateDocumentSizeKB } from './utils.js';
import type { ModelOptions } from './model-factory.js';

/**
 * Error types that trigger fallback
 */
const FALLBACK_ERROR_CODES = [
  'insufficient_quota',
  'rate_limit_exceeded',
  'quota_exceeded',
  'model_overloaded',
];

const FALLBACK_HTTP_CODES = [429, 529]; // Rate limit, overloaded

/**
 * Check if an error should trigger fallback to local model
 */
export function shouldFallback(error: any): boolean {
  // Check HTTP status codes
  if (error.status && FALLBACK_HTTP_CODES.includes(error.status)) {
    return true;
  }
  
  // Check error codes/types
  if (error.code && FALLBACK_ERROR_CODES.includes(error.code)) {
    return true;
  }
  
  // Check error message patterns
  const errorMessage = error.message?.toLowerCase() || '';
  return FALLBACK_ERROR_CODES.some(code => errorMessage.includes(code.replace(/_/g, ' ')));
}

/**
 * Attempt to execute a task with fallback support
 * 
 * @param task - Task type being executed
 * @param primaryModel - Primary model to use
 * @param executeFunction - Function that executes the task with the model
 * @param content - Content being processed (for size checks)
 * @param options - Model options for fallback
 * @returns Result from primary or fallback model
 */
export async function executeWithFallback<T>(
  task: TaskType,
  primaryModel: BaseChatModel,
  executeFunction: (model: BaseChatModel) => Promise<T>,
  content: string,
  options: ModelOptions = {}
): Promise<T> {
  try {
    // Try primary model first
    return await executeFunction(primaryModel);
  } catch (error) {
    // Check if we should attempt fallback
    if (!shouldFallback(error)) {
      throw error;
    }
    
    // Check if fallback is allowed for this task and document size
    const documentSizeKB = calculateDocumentSizeKB(content);
    
    if (!canFallbackForTask(task, documentSizeKB)) {
      if (documentSizeKB >= 50) {
        throw new Error(
          `Primary provider failed and document is too large (${documentSizeKB.toFixed(1)}KB) ` +
          `for local fallback. Consider using a smaller document or upgrading your API plan.`
        );
      }
      
      throw new Error(
        `Primary provider failed for ${task}. Local fallback is not available for this task type. ` +
        `Please check your API key and quota, or enable ENABLE_LOCAL_FALLBACK=true.`
      );
    }
    
    // Get fallback model
    const fallbackModel = await getFallbackModel(task, options);
    
    if (!fallbackModel) {
      throw new Error(
        `Primary provider failed and local Ollama fallback is not available. ` +
        `Install Ollama and run 'ollama pull llama3.2:3b' to enable fallback support.`
      );
    }
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(
      `\n⚠️  Primary provider failed with error: ${errorMessage}\n` +
      `   Falling back to local Ollama (llama3.2:3b)\n` +
      `   Note: Fallback results may have 10-20% lower accuracy\n` +
      `   Document size: ${documentSizeKB.toFixed(1)}KB\n`
    );
    
    try {
      // Attempt with fallback model
      return await executeFunction(fallbackModel);
    } catch (fallbackError) {
      const primaryError = error instanceof Error ? error.message : String(error);
      const fallbackErr = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
      throw new Error(
        `Both primary provider and local fallback failed.\n` +
        `Primary error: ${primaryError}\n` +
        `Fallback error: ${fallbackErr}`
      );
    }
  }
}

/**
 * Log fallback metrics for observability
 */
export function logFallbackMetrics(
  task: TaskType,
  documentSizeKB: number,
  success: boolean
): void {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    task,
    documentSizeKB,
    fallbackUsed: true,
    success,
  };
  
  // In production, this would send to monitoring service
  console.log('[FallbackMetrics]', JSON.stringify(logEntry));
}
