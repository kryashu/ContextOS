import { ChatOllama } from '@langchain/ollama';
import type { ModelOptions } from '../model-factory.js';

/**
 * Create Ollama model instance
 * Optimized for local lightweight tasks (classification, summarization)
 * Default model: llama3.2:3b (only 4GB RAM required)
 */
export function createOllamaModel(options: ModelOptions = {}): ChatOllama {
  const baseUrl = process.env['OLLAMA_BASE_URL'] || 'http://localhost:11434';
  const model = options.modelName || process.env['OLLAMA_MODEL'] || 'llama3.2:3b';
  
  return new ChatOllama({
    baseUrl,
    model,
    temperature: options.temperature ?? 0.1,
    numCtx: options.maxTokens,
    // Ollama-specific optimizations
    numPredict: -1, // No limit on output length
    repeatPenalty: 1.1,
    topK: 40,
    topP: 0.9,
  });
}
