import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import type { ModelOptions } from '../model-factory.js';

/**
 * Create Google Gemini model instance
 * Recommended for production with excellent structured output support
 * Default model: gemini-1.5-flash (fast, cost-effective)
 */
export function createGeminiModel(options: ModelOptions = {}): ChatGoogleGenerativeAI {
  const apiKey = options.apiKey || process.env['GOOGLE_API_KEY'];
  
  if (!apiKey) {
    throw new Error(
      'Gemini API key not found. Set GOOGLE_API_KEY environment variable. ' +
      'Get your key at https://aistudio.google.com'
    );
  }
  
  const model = options.modelName || process.env['GEMINI_MODEL'] || 'gemini-1.5-flash';
  
  return new ChatGoogleGenerativeAI({
    apiKey,
    modelName: model,
    temperature: options.temperature ?? 0,
    maxOutputTokens: options.maxTokens,
    streaming: options.streaming ?? false,
  });
}
