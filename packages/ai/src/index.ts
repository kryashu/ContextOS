/**
 * @contextos/ai - Multi-provider AI/LLM abstraction layer
 * 
 * Provides intelligent task-based routing between hosted LLMs (Gemini/Groq)
 * and local Ollama models with graceful fallback support.
 */

// Main exports
export {
  TaskType,
  getModelForTask,
  getFallbackModel,
  canFallbackForTask,
} from './task-router.js';

export {
  createChatModel,
  getProviderCapabilities,
  isProviderAvailable,
  type ModelOptions,
  type Provider,
  type ModelCapabilities,
} from './model-factory.js';

export {
  executeWithFallback,
  shouldFallback,
  logFallbackMetrics,
} from './fallback-handler.js';

export {
  checkOllamaAvailability,
  calculateDocumentSizeKB,
  truncateContent,
} from './utils.js';

export {
  getConfig,
  printConfig,
  type AIConfig,
  type ValidProvider,
} from './config.js';

export {
  getModelPolicy,
  type ModelPolicy,
} from './model-policy.js';

export {
  estimateTokens,
  logModelCall,
} from './model-logger.js';

// Provider adapters (for advanced usage)
export { createOllamaModel } from './providers/ollama-adapter.js';
export { createGeminiModel } from './providers/gemini-adapter.js';
export { createGroqModel } from './providers/groq-adapter.js';
export { createOpenAIModel } from './providers/openai-adapter.js';
export { createMockModel, createTestModel } from './providers/mock-adapter.js';
