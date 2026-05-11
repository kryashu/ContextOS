import { ChatGroq } from '@langchain/groq';
import type { ModelOptions } from '../model-factory.js';

/**
 * Create Groq model instance
 * Recommended for production with generous free tier and fast inference
 * Default model: llama-3.3-70b-versatile (high quality, free tier: 14.4K requests/day)
 */
export function createGroqModel(options: ModelOptions = {}): ChatGroq {
  const apiKey = options.apiKey || process.env['GROQ_API_KEY'];
  
  if (!apiKey) {
    throw new Error(
      'Groq API key not found. Set GROQ_API_KEY environment variable. ' +
      'Get your free key at https://console.groq.com'
    );
  }
  
  const model = options.modelName || process.env['GROQ_MODEL'] || 'llama-3.3-70b-versatile';
  
  return new ChatGroq({
    apiKey,
    modelName: model,
    temperature: options.temperature ?? 0,
    maxTokens: options.maxTokens,
    streaming: options.streaming ?? false,
  });
}
