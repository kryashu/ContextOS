import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getConfig, printConfig } from '../config.js';
import { createChatModel } from '../model-factory.js';
import { createMockModel } from '../providers/mock-adapter.js';

/**
 * Save and restore environment variables around each test.
 */
function withEnv(overrides: Record<string, string | undefined>, fn: () => void) {
  const saved: Record<string, string | undefined> = {};
  for (const key of Object.keys(overrides)) {
    saved[key] = process.env[key];
  }
  for (const [key, val] of Object.entries(overrides)) {
    if (val === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = val;
    }
  }
  try {
    fn();
  } finally {
    for (const [key, val] of Object.entries(saved)) {
      if (val === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = val;
      }
    }
  }
}

describe('config', () => {
  // Clear LLM_PROVIDER before each test so defaults apply
  const origProvider = process.env['LLM_PROVIDER'];

  afterEach(() => {
    if (origProvider === undefined) {
      delete process.env['LLM_PROVIDER'];
    } else {
      process.env['LLM_PROVIDER'] = origProvider;
    }
  });

  it('defaults to mock when LLM_PROVIDER is not set', () => {
    withEnv({ LLM_PROVIDER: undefined }, () => {
      const cfg = getConfig();
      expect(cfg.provider).toBe('mock');
    });
  });

  it('resolves LLM_PROVIDER=mock', () => {
    withEnv({ LLM_PROVIDER: 'mock' }, () => {
      const cfg = getConfig();
      expect(cfg.provider).toBe('mock');
    });
  });

  it('resolves LLM_PROVIDER=groq', () => {
    withEnv({ LLM_PROVIDER: 'groq' }, () => {
      const cfg = getConfig();
      expect(cfg.provider).toBe('groq');
    });
  });

  it('throws on unsupported provider', () => {
    withEnv({ LLM_PROVIDER: 'gpt5' }, () => {
      expect(() => getConfig()).toThrow('Unsupported LLM provider: "gpt5"');
    });
  });

  it('is case-insensitive', () => {
    withEnv({ LLM_PROVIDER: 'Mock' }, () => {
      expect(getConfig().provider).toBe('mock');
    });
  });

  it('shell env overrides .env value (process.env has priority)', () => {
    // Simulate: .env has LLM_PROVIDER=mock but shell sets groq.
    // Since getConfig reads process.env directly, setting it here
    // proves that whatever dotenv wrote is irrelevant once the
    // shell variable is present.
    withEnv({ LLM_PROVIDER: 'groq' }, () => {
      const cfg = getConfig();
      expect(cfg.provider).toBe('groq');
    });
  });
});

describe('printConfig', () => {
  it('redacts API keys', () => {
    withEnv(
      { LLM_PROVIDER: 'mock', GROQ_API_KEY: 'gsk_abcdefghijklmnop' },
      () => {
        const out = printConfig();
        expect(out['GROQ_API_KEY']).toMatch(/^gsk_\*\*\*\*mnop$/);
        expect(out['LLM_PROVIDER']).toBe('mock');
      }
    );
  });
});

describe('model-factory guard', () => {
  it('allows createChatModel("mock") in mock mode', () => {
    withEnv({ LLM_PROVIDER: 'mock' }, () => {
      const model = createChatModel('mock');
      expect(model).toBeDefined();
    });
  });

  it('blocks hosted providers in mock mode', () => {
    withEnv({ LLM_PROVIDER: 'mock' }, () => {
      expect(() => createChatModel('openai')).toThrow(
        /Cannot create hosted provider/
      );
      expect(() => createChatModel('gemini')).toThrow(
        /Cannot create hosted provider/
      );
      expect(() => createChatModel('groq')).toThrow(
        /Cannot create hosted provider/
      );
    });
  });

  it('throws on unknown provider', () => {
    withEnv({ LLM_PROVIDER: 'groq', GROQ_API_KEY: 'test' }, () => {
      expect(() => createChatModel('gpt5')).toThrow(/Unsupported provider/);
    });
  });
});

describe('mock-adapter task-aware responses', () => {
  it('extraction returns >= 5 entities and >= 5 relationships', async () => {
    const model = createMockModel({ taskType: 'extraction' });
    const result = await model.invoke('extract entities');
    const parsed = JSON.parse(result.content as string);
    expect(parsed.entities.length).toBeGreaterThanOrEqual(5);
    expect(parsed.relationships.length).toBeGreaterThanOrEqual(5);
  });

  it('classification returns valid category and relevanceScore', async () => {
    const model = createMockModel({ taskType: 'classification' });
    const result = await model.invoke('classify this');
    const parsed = JSON.parse(result.content as string);
    expect(parsed.category).toBe('api_documentation');
    expect(parsed.relevanceScore).toBeGreaterThan(0);
    expect(parsed.relevanceScore).toBeLessThanOrEqual(1);
  });

  it('extraction response is deterministic across calls', async () => {
    const model = createMockModel({ taskType: 'extraction' });
    const r1 = await model.invoke('call 1');
    const r2 = await model.invoke('call 2');
    expect(r1.content).toBe(r2.content);
  });

  it('default/health returns status working', async () => {
    const model = createMockModel({});
    const result = await model.invoke('health');
    const parsed = JSON.parse(result.content as string);
    expect(parsed.status).toBe('working');
  });
});
