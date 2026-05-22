/**
 * Analytics Service for Hybrid System Monitoring
 * 
 * Provides:
 * - Rule coverage effectiveness tracking
 * - LLM fallback usage pattern monitoring
 * - User satisfaction measurement
 * - Performance metrics collection
 * - Opportunity identification for rule expansion
 */

export interface RuleCoverageMetrics {
  totalClassifications: number;
  ruleBasedSuccesses: number;
  llmFallbacks: number;
  hybridApproaches: number;
  coverageRate: number; // Percentage of rule-based successes
  avgConfidence: number;
  byCategory: Record<string, {
    total: number;
    ruleBased: number;
    llmFallback: number;
    hybrid: number;
  }>;
}

export interface LLMUsageMetrics {
  totalRequests: number;
  byOperation: Record<string, number>;
  avgProcessingTime: number;
  successRate: number;
  costEstimate?: number;
  userConsentRate: number;
}

export interface PerformanceMetrics {
  avgRuleBasedTime: number;
  avgLLMTime: number;
  avgHybridTime: number;
  cacheHitRate: number;
  patternMatchEfficiency: number;
}

export interface UserSatisfactionMetrics {
  totalFeedback: number;
  positiveRate: number;
  negativeRate: number;
  neutralRate: number;
  byMethod: Record<string, {
    positive: number;
    negative: number;
    neutral: number;
  }>;
}

export interface AnalyticsEvent {
  timestamp: string;
  eventType: 'classification' | 'extraction' | 'answer_composition' | 'user_feedback';
  method: 'rule-based' | 'llm-assisted' | 'hybrid';
  operation: string;
  duration: number;
  confidence: number;
  success: boolean;
  category?: string;
  userConsent?: boolean;
  feedback?: 'positive' | 'negative' | 'neutral';
  metadata?: Record<string, unknown>;
}

/**
 * Analytics Service for monitoring hybrid system performance
 */
export class AnalyticsService {
  private events: AnalyticsEvent[] = [];
  private maxEvents = 50000;

  /**
   * Track an analytics event
   */
  track(event: AnalyticsEvent): void {
    this.events.push(event);

    // Trim old events if exceeding max
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }
  }

  /**
   * Get rule coverage metrics
   */
  getRuleCoverageMetrics(timeRange?: { start: string; end: string }): RuleCoverageMetrics {
    const events = this.filterByTimeRange(this.events, timeRange);
    const classificationEvents = events.filter(e => 
      e.eventType === 'classification' || e.eventType === 'extraction'
    );

    const ruleBasedSuccesses = classificationEvents.filter(e => e.method === 'rule-based' && e.success).length;
    const llmFallbacks = classificationEvents.filter(e => e.method === 'llm-assisted').length;
    const hybridApproaches = classificationEvents.filter(e => e.method === 'hybrid').length;

    const byCategory: Record<string, { total: number; ruleBased: number; llmFallback: number; hybrid: number }> = {};
    for (const event of classificationEvents) {
      const category = event.category ?? 'unknown';
      if (!byCategory[category]) {
        byCategory[category] = { total: 0, ruleBased: 0, llmFallback: 0, hybrid: 0 };
      }
      byCategory[category].total++;
      if (event.method === 'rule-based') byCategory[category].ruleBased++;
      if (event.method === 'llm-assisted') byCategory[category].llmFallback++;
      if (event.method === 'hybrid') byCategory[category].hybrid++;
    }

    const avgConfidence = classificationEvents.length > 0
      ? classificationEvents.reduce((sum, e) => sum + e.confidence, 0) / classificationEvents.length
      : 0;

    return {
      totalClassifications: classificationEvents.length,
      ruleBasedSuccesses,
      llmFallbacks,
      hybridApproaches,
      coverageRate: classificationEvents.length > 0 ? ruleBasedSuccesses / classificationEvents.length : 0,
      avgConfidence,
      byCategory,
    };
  }

  /**
   * Get LLM usage metrics
   */
  getLLMUsageMetrics(timeRange?: { start: string; end: string }): LLMUsageMetrics {
    const events = this.filterByTimeRange(this.events, timeRange);
    const llmEvents = events.filter(e => e.method === 'llm-assisted' || e.method === 'hybrid');

    const byOperation: Record<string, number> = {};
    for (const event of llmEvents) {
      byOperation[event.operation] = (byOperation[event.operation] ?? 0) + 1;
    }

    const avgProcessingTime = llmEvents.length > 0
      ? llmEvents.reduce((sum, e) => sum + e.duration, 0) / llmEvents.length
      : 0;

    const successfulEvents = llmEvents.filter(e => e.success).length;
    const eventsWithConsent = llmEvents.filter(e => e.userConsent !== undefined);
    const approvedConsent = eventsWithConsent.filter(e => e.userConsent === true).length;

    return {
      totalRequests: llmEvents.length,
      byOperation,
      avgProcessingTime,
      successRate: llmEvents.length > 0 ? successfulEvents / llmEvents.length : 0,
      userConsentRate: eventsWithConsent.length > 0 ? approvedConsent / eventsWithConsent.length : 0,
    };
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(timeRange?: { start: string; end: string }): PerformanceMetrics {
    const events = this.filterByTimeRange(this.events, timeRange);

    const ruleBasedEvents = events.filter(e => e.method === 'rule-based');
    const llmEvents = events.filter(e => e.method === 'llm-assisted');
    const hybridEvents = events.filter(e => e.method === 'hybrid');

    const avgRuleBasedTime = ruleBasedEvents.length > 0
      ? ruleBasedEvents.reduce((sum, e) => sum + e.duration, 0) / ruleBasedEvents.length
      : 0;

    const avgLLMTime = llmEvents.length > 0
      ? llmEvents.reduce((sum, e) => sum + e.duration, 0) / llmEvents.length
      : 0;

    const avgHybridTime = hybridEvents.length > 0
      ? hybridEvents.reduce((sum, e) => sum + e.duration, 0) / hybridEvents.length
      : 0;

    // Estimate cache hit rate (rule-based with very low duration)
    const fastRuleBasedEvents = ruleBasedEvents.filter(e => e.duration < 10).length;
    const cacheHitRate = ruleBasedEvents.length > 0
      ? fastRuleBasedEvents / ruleBasedEvents.length
      : 0;

    // Pattern match efficiency (successful rule-based / total)
    const patternMatchEfficiency = events.length > 0
      ? ruleBasedEvents.filter(e => e.success).length / events.length
      : 0;

    return {
      avgRuleBasedTime,
      avgLLMTime,
      avgHybridTime,
      cacheHitRate,
      patternMatchEfficiency,
    };
  }

  /**
   * Get user satisfaction metrics
   */
  getUserSatisfactionMetrics(timeRange?: { start: string; end: string }): UserSatisfactionMetrics {
    const events = this.filterByTimeRange(this.events, timeRange);
    const feedbackEvents = events.filter(e => e.feedback !== undefined);

    const positive = feedbackEvents.filter(e => e.feedback === 'positive').length;
    const negative = feedbackEvents.filter(e => e.feedback === 'negative').length;
    const neutral = feedbackEvents.filter(e => e.feedback === 'neutral').length;

    const byMethod: Record<string, { positive: number; negative: number; neutral: number }> = {
      'rule-based': { positive: 0, negative: 0, neutral: 0 },
      'llm-assisted': { positive: 0, negative: 0, neutral: 0 },
      'hybrid': { positive: 0, negative: 0, neutral: 0 },
    };

    for (const event of feedbackEvents) {
      if (event.feedback === 'positive') byMethod[event.method].positive++;
      if (event.feedback === 'negative') byMethod[event.method].negative++;
      if (event.feedback === 'neutral') byMethod[event.method].neutral++;
    }

    return {
      totalFeedback: feedbackEvents.length,
      positiveRate: feedbackEvents.length > 0 ? positive / feedbackEvents.length : 0,
      negativeRate: feedbackEvents.length > 0 ? negative / feedbackEvents.length : 0,
      neutralRate: feedbackEvents.length > 0 ? neutral / feedbackEvents.length : 0,
      byMethod,
    };
  }

  /**
   * Identify opportunities for rule expansion
   * Returns categories/operations that frequently fall back to LLM
   */
  identifyRuleExpansionOpportunities(threshold = 0.3): Array<{
    category: string;
    operation: string;
    llmFallbackRate: number;
    totalOccurrences: number;
    suggestedAction: string;
  }> {
    const opportunities: Array<{
      category: string;
      operation: string;
      llmFallbackRate: number;
      totalOccurrences: number;
      suggestedAction: string;
    }> = [];

    // Group by category and operation
    const groups = new Map<string, { total: number; llmFallback: number }>();
    
    for (const event of this.events) {
      const key = `${event.category ?? 'unknown'}:${event.operation}`;
      if (!groups.has(key)) {
        groups.set(key, { total: 0, llmFallback: 0 });
      }
      const group = groups.get(key)!;
      group.total++;
      if (event.method === 'llm-assisted') {
        group.llmFallback++;
      }
    }

    // Find groups with high LLM fallback rate
    for (const [key, stats] of groups.entries()) {
      const fallbackRate = stats.llmFallback / stats.total;
      if (fallbackRate >= threshold && stats.total >= 5) {
        const [category, operation] = key.split(':');
        opportunities.push({
          category: category ?? 'unknown',
          operation: operation ?? 'unknown',
          llmFallbackRate: fallbackRate,
          totalOccurrences: stats.total,
          suggestedAction: `Add rule-based patterns for ${category} ${operation} (${(fallbackRate * 100).toFixed(0)}% LLM fallback)`,
        });
      }
    }

    // Sort by fallback rate (descending)
    return opportunities.sort((a, b) => b.llmFallbackRate - a.llmFallbackRate);
  }

  /**
   * Generate analytics report
   */
  generateReport(timeRange?: { start: string; end: string }): {
    ruleCoverage: RuleCoverageMetrics;
    llmUsage: LLMUsageMetrics;
    performance: PerformanceMetrics;
    userSatisfaction: UserSatisfactionMetrics;
    expansionOpportunities: ReturnType<typeof this.identifyRuleExpansionOpportunities>;
  } {
    return {
      ruleCoverage: this.getRuleCoverageMetrics(timeRange),
      llmUsage: this.getLLMUsageMetrics(timeRange),
      performance: this.getPerformanceMetrics(timeRange),
      userSatisfaction: this.getUserSatisfactionMetrics(timeRange),
      expansionOpportunities: this.identifyRuleExpansionOpportunities(),
    };
  }

  /**
   * Export analytics data
   */
  export(): AnalyticsEvent[] {
    return [...this.events];
  }

  /**
   * Clear analytics data
   */
  clear(): void {
    this.events = [];
  }

  /**
   * Filter events by time range
   */
  private filterByTimeRange(
    events: AnalyticsEvent[],
    timeRange?: { start: string; end: string }
  ): AnalyticsEvent[] {
    if (!timeRange) return events;

    return events.filter(e => {
      const timestamp = new Date(e.timestamp);
      const start = new Date(timeRange.start);
      const end = new Date(timeRange.end);
      return timestamp >= start && timestamp <= end;
    });
  }
}

/**
 * Global analytics service instance
 */
export const globalAnalyticsService = new AnalyticsService();
