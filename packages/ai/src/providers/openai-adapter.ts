import { ChatOpenAI } from '@langchain/openai';
import type { ModelOptions } from '../model-factory.js';

/**
 * Create OpenAI model instance
 * Kept for backward compatibility
 * Note: OpenAI is expensive and has quota issues - consider Groq or Gemini instead
 */
export function createOpenAIModel(options: ModelOptions = {}): ChatOpenAI {
  const apiKey = options.apiKey || process.env['OPENAI_API_KEY'];
  
  if (!apiKey) {
    throw new Error(
      'OpenAI API key not found. Set OPENAI_API_KEY environment variable. ' +
      'Note: Consider using Groq (free tier) or Gemini instead for lower costs.'
    );
  }
  
  const model = options.modelName || process.env['OPENAI_MODEL'] || 'gpt-4o-mini';
  
  return new ChatOpenAI({
    apiKey,
    modelName: model,
    temperature: options.temperature ?? 0,
    maxTokens: options.maxTokens,
    streaming: options.streaming ?? false,
  });
}
