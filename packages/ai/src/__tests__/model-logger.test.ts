import { describe, it, expect, vi } from 'vitest';
import { estimateTokens, logModelCall } from '../model-logger.js';

describe('model-logger', () => {
  it('estimateTokens returns ~chars/4', () => {
    expect(estimateTokens('')).toBe(0);
    expect(estimateTokens('abcd')).toBe(1);
    expect(estimateTokens('a'.repeat(100))).toBe(25);
    expect(estimateTokens('hello world')).toBe(3); // 11 chars / 4 = 2.75 → 3
  });

  it('logModelCall outputs structured JSON', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logModelCall({
      task: 'extraction',
      provider: 'gemini',
      model: 'gemini-1.5-flash',
      estimatedInputTokens: 500,
      timestamp: '2025-01-01T00:00:00.000Z',
    });
    expect(spy).toHaveBeenCalledOnce();
    const logged = JSON.parse(spy.mock.calls[0]![0] as string);
    expect(logged.type).toBe('model_call');
    expect(logged.task).toBe('extraction');
    expect(logged.provider).toBe('gemini');
    expect(logged.estimatedInputTokens).toBe(500);
    spy.mockRestore();
  });
});
