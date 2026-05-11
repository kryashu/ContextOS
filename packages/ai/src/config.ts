/**
 * Runtime configuration module for ContextOS AI layer.
 *
 * All provider resolution is lazy (via function calls) to allow
 * dotenv / env vars to be loaded before first access.
 */

const VALID_PROVIDERS = ['mock', 'ollama', 'gemini', 'groq', 'openai'] as const;
export type ValidProvider = (typeof VALID_PROVIDERS)[number];

export interface AIConfig {
  provider: ValidProvider;
  localProvider: string;
  enableLocalFallback: boolean;
  localFallbackMaxSizeKB: number;
  localFallbackMaxTokens: number;
  models: {
    ollama: string;
    gemini: string;
    groq: string;
    openai: string;
  };
  keys: {
    groq: string | undefined;
    gemini: string | undefined;
    openai: string | undefined;
  };
}

function validateProvider(value: string): ValidProvider {
  const normalized = value.toLowerCase();
  if (!VALID_PROVIDERS.includes(normalized as ValidProvider)) {
    throw new Error(
      `Unsupported LLM provider: "${value}". ` +
        `Valid providers: ${VALID_PROVIDERS.join(', ')}`
    );
  }
  return normalized as ValidProvider;
}

/**
 * Resolve the full AI configuration from process.env.
 * Called lazily at runtime — never at module-load time.
 */
export function getConfig(): AIConfig {
  const raw = process.env['LLM_PROVIDER'] || 'mock';
  const provider = validateProvider(raw);

  return {
    provider,
    localProvider: process.env['LOCAL_LLM_PROVIDER'] || 'ollama',
    enableLocalFallback: process.env['ENABLE_LOCAL_FALLBACK'] === 'true',
    localFallbackMaxSizeKB: parseInt(
      process.env['LOCAL_FALLBACK_MAX_SIZE_KB'] || '50',
      10
    ),
    localFallbackMaxTokens: parseInt(
      process.env['LOCAL_FALLBACK_MAX_TOKENS'] || '8000',
      10
    ),
    models: {
      ollama: process.env['OLLAMA_MODEL'] || 'llama3.2:3b',
      gemini: process.env['GEMINI_MODEL'] || 'gemini-1.5-flash',
      groq: process.env['GROQ_MODEL'] || 'llama-3.3-70b-versatile',
      openai: process.env['OPENAI_MODEL'] || 'gpt-4o-mini',
    },
    keys: {
      groq: process.env['GROQ_API_KEY'],
      gemini: process.env['GOOGLE_API_KEY'] || process.env['GEMINI_API_KEY'],
      openai: process.env['OPENAI_API_KEY'],
    },
  };
}

function redact(value: string | undefined): string {
  if (!value) return '(not set)';
  if (value.length <= 8) return '****';
  return value.slice(0, 4) + '****' + value.slice(-4);
}

/**
 * Return a human-readable config summary with secrets redacted.
 */
export function printConfig(): Record<string, string> {
  const cfg = getConfig();
  return {
    LLM_PROVIDER: cfg.provider,
    LOCAL_LLM_PROVIDER: cfg.localProvider,
    ENABLE_LOCAL_FALLBACK: String(cfg.enableLocalFallback),
    LOCAL_FALLBACK_MAX_SIZE_KB: String(cfg.localFallbackMaxSizeKB),
    LOCAL_FALLBACK_MAX_TOKENS: String(cfg.localFallbackMaxTokens),
    OLLAMA_MODEL: cfg.models.ollama,
    GEMINI_MODEL: cfg.models.gemini,
    GROQ_MODEL: cfg.models.groq,
    OPENAI_MODEL: cfg.models.openai,
    GROQ_API_KEY: redact(cfg.keys.groq),
    GOOGLE_API_KEY: redact(cfg.keys.gemini),
    OPENAI_API_KEY: redact(cfg.keys.openai),
  };
}
