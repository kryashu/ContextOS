import { describe, it, expect } from 'vitest';
import { getModelPolicy } from '../model-policy.js';

describe('model-policy', () => {
  it('classification has modelMode optional', () => {
    const policy = getModelPolicy('classification');
    expect(policy.modelMode).toBe('optional');
    expect(policy.costTier).toBe('none');
  });

  it('extraction has modelMode required with medium cost', () => {
    const policy = getModelPolicy('extraction');
    expect(policy.modelMode).toBe('required');
    expect(policy.costTier).toBe('medium');
  });

  it('qa has modelMode required', () => {
    const policy = getModelPolicy('qa');
    expect(policy.modelMode).toBe('required');
  });

  it('all TaskType values have a valid policy', () => {
    const taskTypes = [
      'classification',
      'summarization',
      'extraction',
      'relationship_mapping',
      'artifact_generation',
      'qa',
    ];
    for (const task of taskTypes) {
      const policy = getModelPolicy(task);
      expect(policy).toBeDefined();
      expect(['none', 'optional', 'required']).toContain(policy.modelMode);
      expect(['none', 'low', 'medium', 'high']).toContain(policy.costTier);
      expect(policy.maxInputTokens).toBeGreaterThan(0);
      expect(policy.preferredProviders.length).toBeGreaterThan(0);
    }
  });

  it('returns default policy for unknown task', () => {
    const policy = getModelPolicy('unknown_task');
    expect(policy).toBeDefined();
    expect(policy.modelMode).toBe('required');
  });
});
