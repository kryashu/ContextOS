import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { createOllamaModel } from './providers/ollama-adapter.js';
import { createGeminiModel } from './providers/gemini-adapter.js';
import { createGroqModel } from './providers/groq-adapter.js';
import { createOpenAIModel } from './providers/openai-adapter.js';
import { createMockModel } from './providers/mock-adapter.js';
import { getConfig } from './config.js';

/**
 * Common model configuration options
 */
export interface ModelOptions {
  temperature?: number;
  apiKey?: string;
  modelName?: string;
  maxTokens?: number;
  streaming?: boolean;
  /** Used by mock provider to return task-appropriate responses */
  taskType?: string;
}

/**
 * Supported LLM providers
 */
export type Provider = 'ollama' | 'gemini' | 'groq' | 'openai' | 'mock';

/**
 * Model capability metadata
 */
export interface ModelCapabilities {
  maxContextTokens: number;
  supportsStructuredOutput: boolean;
  costTier: 'free' | 'low' | 'medium' | 'high';
  isLocal: boolean;
}

/**
 * Provider capabilities mapping
 */
const PROVIDER_CAPABILITIES: Record<Provider, ModelCapabilities> = {
  ollama: {
    maxContextTokens: 128000, // llama3.2 context window
    supportsStructuredOutput: true,
    costTier: 'free',
    isLocal: true,
  },
  gemini: {
    maxContextTokens: 1000000, // Gemini 1.5 context window
    supportsStructuredOutput: true,
    costTier: 'low',
    isLocal: false,
  },
  groq: {
    maxContextTokens: 32768, // Most Groq models
    supportsStructuredOutput: true,
    costTier: 'free',
    isLocal: false,
  },
  openai: {
    maxContextTokens: 128000, // GPT-4o context window
    supportsStructuredOutput: true,
    costTier: 'high',
    isLocal: false,
  },
  mock: {
    maxContextTokens: 100000,
    supportsStructuredOutput: true,
    costTier: 'free',
    isLocal: true,
  },
};

/**
 * Create a chat model instance for the specified provider
 * 
 * @param provider - LLM provider to use
 * @param options - Model configuration options
 * @returns Configured BaseChatModel instance
 */
const HOSTED_PROVIDERS = new Set<string>(['openai', 'gemini', 'groq']);

export function createChatModel(
  provider: Provider | string,
  options: ModelOptions = {}
): BaseChatModel {
  if (!provider) {
    throw new Error(
      'Provider is required. Set LLM_PROVIDER to a valid provider (ollama, gemini, groq, openai).'
    );
  }
  const normalizedProvider = provider.toLowerCase() as Provider;

  // Guard: when LLM_PROVIDER is not configured or is mock, refuse to create hosted adapters
  const config = getConfig();
  if (
    (!config.provider || config.provider === 'mock') &&
    HOSTED_PROVIDERS.has(normalizedProvider)
  ) {
    throw new Error(
      `Cannot create hosted provider "${normalizedProvider}" when LLM_PROVIDER is not configured. ` +
      `Set LLM_PROVIDER to a hosted provider or change requested provider.`
    );
  }

  switch (normalizedProvider) {
    case 'ollama':
      return createOllamaModel(options);
    
    case 'gemini':
      return createGeminiModel(options);
    
    case 'groq':
      return createGroqModel(options);
    
    case 'openai':
      return createOpenAIModel(options);
    
    case 'mock':
      if (process.env['NODE_ENV'] !== 'test' && process.env['ENABLE_TEST_MODEL'] !== 'true') {
        throw new Error(
          'Mock provider is only available in test environments. ' +
          'Set NODE_ENV=test or ENABLE_TEST_MODEL=true.'
        );
      }
      return createMockModel(options);
    
    default:
      throw new Error(
        `Unsupported provider: "${provider}". ` +
        `Valid providers: ollama, gemini, groq, openai, mock`
      );
  }
}

/**
 * Get model capabilities for a provider
 */
export function getProviderCapabilities(provider: Provider): ModelCapabilities {
  return PROVIDER_CAPABILITIES[provider];
}

/**
 * Check if a provider is available (has required API key or is running locally)
 */
export function isProviderAvailable(provider: Provider): boolean {
  switch (provider) {
    case 'ollama':
      // Checked separately with checkOllamaAvailability
      return true;
    
    case 'gemini':
      return !!process.env['GOOGLE_API_KEY'];
    
    case 'groq':
      return !!process.env['GROQ_API_KEY'];
    
    case 'openai':
      return !!process.env['OPENAI_API_KEY'];
    
    case 'mock':
      return true;
    
    default:
      return false;
  }
}
