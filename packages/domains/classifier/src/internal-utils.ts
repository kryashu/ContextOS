/**
 * Inline utilities used by the classifier. Previously sourced from
 * `@contextos/validation`, but that package does not yet expose them and
 * coupling the classifier to a shared package solely for these helpers is
 * not justified.
 */

// ── LRU cache with TTL ──────────────────────────────────────────────

interface CacheEntry<V> {
  value: V;
  expiresAt: number;
}

export interface LRUCacheStats {
  size: number;
  capacity: number;
  hits: number;
  misses: number;
}

export class LRUCache<K, V> {
  private readonly store = new Map<K, CacheEntry<V>>();
  private hits = 0;
  private misses = 0;

  constructor(
    private readonly capacity: number,
    private readonly ttlMs: number,
  ) {}

  get(key: K): V | undefined {
    const entry = this.store.get(key);
    if (!entry) {
      this.misses++;
      return undefined;
    }
    if (entry.expiresAt < Date.now()) {
      this.store.delete(key);
      this.misses++;
      return undefined;
    }
    // Refresh LRU order.
    this.store.delete(key);
    this.store.set(key, entry);
    this.hits++;
    return entry.value;
  }

  set(key: K, value: V): void {
    if (this.store.has(key)) this.store.delete(key);
    else if (this.store.size >= this.capacity) {
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) this.store.delete(oldest);
    }
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  getStats(): LRUCacheStats {
    return {
      size: this.store.size,
      capacity: this.capacity,
      hits: this.hits,
      misses: this.misses,
    };
  }
}

// ── Optimized pattern matcher (simple priority registry) ────────────

interface RegisteredPattern {
  name: string;
  regex: RegExp;
  priority: number;
  keywords: string[];
}

export interface PatternMatcherStats {
  patternCount: number;
  capacity: number;
}

export class OptimizedPatternMatcher {
  private readonly patterns: RegisteredPattern[] = [];

  constructor(private readonly capacity: number = 1000) {}

  registerPattern(
    name: string,
    regex: RegExp,
    priority: number,
    keywords: string[] = [],
  ): void {
    if (this.patterns.length >= this.capacity) return;
    this.patterns.push({ name, regex, priority, keywords });
  }

  getCacheStats(): PatternMatcherStats {
    return { patternCount: this.patterns.length, capacity: this.capacity };
  }
}

// ── Confidence aggregation ──────────────────────────────────────────

export interface ConfidenceFactors {
  exactMatch?: number;
  patternMatch?: number;
  fuzzyMatch?: number;
  contextMatch?: number;
  penalties?: number[];
}

export function calculateConfidence(factors: ConfidenceFactors): number {
  const scores: number[] = [];
  if (factors.exactMatch !== undefined) scores.push(factors.exactMatch);
  if (factors.patternMatch !== undefined) scores.push(factors.patternMatch);
  if (factors.fuzzyMatch !== undefined) scores.push(factors.fuzzyMatch);
  if (factors.contextMatch !== undefined) scores.push(factors.contextMatch);

  if (scores.length === 0) return 0.5;

  let confidence = Math.max(...scores);
  if (factors.penalties && factors.penalties.length > 0) {
    const totalPenalty = factors.penalties.reduce((sum, p) => sum + p, 0);
    confidence = Math.max(0, confidence - totalPenalty);
  }
  return Math.min(1.0, Math.max(0, confidence));
}
