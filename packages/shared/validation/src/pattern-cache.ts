/**
 * Pattern Cache for Rule-Based System Performance Optimization
 * 
 * Provides:
 * - LRU cache for frequently matched patterns
 * - Indexed lookup tables for fast pattern matching
 * - Early exit strategies for definitive matches
 * - Pattern compilation and optimization
 */

export interface CacheEntry<T> {
  value: T;
  timestamp: number;
  hitCount: number;
  lastAccess: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  hitRate: number;
}

/**
 * LRU Cache with hit counting and statistics
 */
export class LRUCache<K, V> {
  private cache = new Map<K, CacheEntry<V>>();
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
  };

  constructor(
    private readonly maxSize: number,
    private readonly ttlMs?: number,
  ) {}

  /**
   * Get value from cache
   */
  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return undefined;
    }

    // Check TTL
    if (this.ttlMs && Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      this.stats.misses++;
      return undefined;
    }

    // Update access stats
    entry.hitCount++;
    entry.lastAccess = Date.now();
    this.stats.hits++;

    return entry.value;
  }

  /**
   * Set value in cache
   */
  set(key: K, value: V): void {
    // Evict if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      hitCount: 0,
      lastAccess: Date.now(),
    });
  }

  /**
   * Check if key exists in cache
   */
  has(key: K): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    // Check TTL
    if (this.ttlMs && Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete key from cache
   */
  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0, evictions: 0 };
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      size: this.cache.size,
      hitRate: total > 0 ? this.stats.hits / total : 0,
    };
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    let oldestKey: K | undefined;
    let oldestAccess = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccess < oldestAccess) {
        oldestAccess = entry.lastAccess;
        oldestKey = key;
      }
    }

    if (oldestKey !== undefined) {
      this.cache.delete(oldestKey);
      this.stats.evictions++;
    }
  }
}

/**
 * Indexed pattern lookup for fast keyword matching
 */
export class PatternIndex {
  private index = new Map<string, Set<string>>();
  private patterns = new Map<string, RegExp>();

  /**
   * Add pattern to index
   */
  addPattern(id: string, pattern: RegExp, keywords: string[]): void {
    this.patterns.set(id, pattern);
    
    for (const keyword of keywords) {
      const normalized = keyword.toLowerCase();
      if (!this.index.has(normalized)) {
        this.index.set(normalized, new Set());
      }
      this.index.get(normalized)!.add(id);
    }
  }

  /**
   * Find candidate patterns based on keywords in text
   */
  findCandidates(text: string): string[] {
    const lowerText = text.toLowerCase();
    const candidates = new Set<string>();

    for (const [keyword, patternIds] of this.index.entries()) {
      if (lowerText.includes(keyword)) {
        for (const id of patternIds) {
          candidates.add(id);
        }
      }
    }

    return Array.from(candidates);
  }

  /**
   * Get pattern by ID
   */
  getPattern(id: string): RegExp | undefined {
    return this.patterns.get(id);
  }

  /**
   * Test text against indexed patterns
   * Returns first matching pattern ID or undefined
   */
  findFirstMatch(text: string): string | undefined {
    const candidates = this.findCandidates(text);
    
    for (const id of candidates) {
      const pattern = this.patterns.get(id);
      if (pattern?.test(text)) {
        return id;
      }
    }

    return undefined;
  }

  /**
   * Test text against indexed patterns
   * Returns all matching pattern IDs
   */
  findAllMatches(text: string): string[] {
    const candidates = this.findCandidates(text);
    const matches: string[] = [];
    
    for (const id of candidates) {
      const pattern = this.patterns.get(id);
      if (pattern?.test(text)) {
        matches.push(id);
      }
    }

    return matches;
  }

  /**
   * Clear index
   */
  clear(): void {
    this.index.clear();
    this.patterns.clear();
  }
}

/**
 * Optimized pattern matcher with caching and early exit
 */
export class OptimizedPatternMatcher {
  private cache: LRUCache<string, string | null>;
  private index: PatternIndex;
  private patterns: Array<{ id: string; regex: RegExp; priority: number }>;

  constructor(
    cacheSize = 1000,
    cacheTTL = 5 * 60 * 1000, // 5 minutes
  ) {
    this.cache = new LRUCache(cacheSize, cacheTTL);
    this.index = new PatternIndex();
    this.patterns = [];
  }

  /**
   * Register pattern with priority and keywords for indexing
   */
  registerPattern(
    id: string,
    regex: RegExp,
    priority: number,
    keywords: string[] = [],
  ): void {
    this.patterns.push({ id, regex, priority });
    // Sort by priority (descending)
    this.patterns.sort((a, b) => b.priority - a.priority);

    if (keywords.length > 0) {
      this.index.addPattern(id, regex, keywords);
    }
  }

  /**
   * Match text against registered patterns
   * Uses cache and indexed lookup for performance
   */
  match(text: string): string | null {
    // Check cache first
    const cached = this.cache.get(text);
    if (cached !== undefined) {
      return cached;
    }

    // Try indexed lookup (fast path)
    const indexMatch = this.index.findFirstMatch(text);
    if (indexMatch) {
      this.cache.set(text, indexMatch);
      return indexMatch;
    }

    // Fall back to sequential pattern matching (slow path)
    for (const { id, regex } of this.patterns) {
      if (regex.test(text)) {
        this.cache.set(text, id);
        return id;
      }
    }

    // No match found
    this.cache.set(text, null);
    return null;
  }

  /**
   * Match text and return all matching pattern IDs
   */
  matchAll(text: string): string[] {
    const matches: string[] = [];

    // Use indexed lookup for candidates
    const candidates = this.index.findAllMatches(text);
    const candidateSet = new Set(candidates);

    // Test all patterns (prioritized)
    for (const { id, regex } of this.patterns) {
      // Skip if not in candidates (unless no index keywords)
      if (candidateSet.size > 0 && !candidateSet.has(id)) {
        continue;
      }

      if (regex.test(text)) {
        matches.push(id);
      }
    }

    return matches;
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): CacheStats {
    return this.cache.getStats();
  }

  /**
   * Clear cache and index
   */
  clear(): void {
    this.cache.clear();
    this.index.clear();
    this.patterns = [];
  }
}

/**
 * Compile and optimize regex patterns
 */
export class PatternCompiler {
  /**
   * Compile multiple keyword alternatives into optimized regex
   */
  static compileKeywords(keywords: string[], flags = 'i'): RegExp {
    // Sort by length (descending) to match longer keywords first
    const sorted = [...keywords].sort((a, b) => b.length - a.length);
    
    // Escape special regex characters
    const escaped = sorted.map(kw => kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    
    // Create alternation pattern
    const pattern = `\\b(?:${escaped.join('|')})\\b`;
    return new RegExp(pattern, flags);
  }

  /**
   * Optimize regex by pre-compiling and caching
   */
  static optimize(pattern: string | RegExp, flags?: string): RegExp {
    if (pattern instanceof RegExp) {
      return pattern;
    }
    return new RegExp(pattern, flags);
  }

  /**
   * Create case-insensitive pattern from keywords
   */
  static caseInsensitive(keywords: string[]): RegExp {
    return this.compileKeywords(keywords, 'i');
  }

  /**
   * Create exact match pattern
   */
  static exactMatch(keywords: string[]): RegExp {
    return this.compileKeywords(keywords, '');
  }
}
