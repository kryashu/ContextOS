/**
 * Transparency Metadata for Hybrid System Results
 * 
 * Provides clear indication of processing method, AI usage, and confidence levels
 */

export type ProcessingMethod = 'rule-based' | 'llm-assisted' | 'hybrid';

export interface TransparencyMetadata {
  method: ProcessingMethod;
  confidence: number; // 0.0 - 1.0
  llmModel?: string;
  processingTime?: number; // milliseconds
  fallbackUsed?: boolean;
  rulesCoverage?: number; // 0.0 - 1.0 for hybrid approach
  userConsent?: {
    requested: boolean;
    approved: boolean;
    timestamp: string;
  };
  warnings?: string[];
}

export interface TransparentResult<T> {
  data: T;
  metadata: TransparencyMetadata;
  timestamp: string;
}

/**
 * Result presentation with transparency indicators
 */
export interface PresentationOptions {
  showMethod: boolean;
  showConfidence: boolean;
  showProcessingTime: boolean;
  showWarnings: boolean;
  highlightAIContent: boolean;
}

/**
 * Format transparency metadata for display
 */
export function formatTransparencyInfo(
  metadata: TransparencyMetadata,
  options: Partial<PresentationOptions> = {}
): string {
  const opts: PresentationOptions = {
    showMethod: true,
    showConfidence: true,
    showProcessingTime: true,
    showWarnings: true,
    highlightAIContent: true,
    ...options,
  };

  const parts: string[] = [];

  // Method indicator
  if (opts.showMethod) {
    const methodLabels: Record<ProcessingMethod, string> = {
      'rule-based': '✅ Rule-Based',
      'llm-assisted': '🤖 AI-Assisted',
      'hybrid': '🔄 Hybrid (Rules + AI)',
    };
    parts.push(`**Method:** ${methodLabels[metadata.method]}`);
  }

  // Confidence indicator
  if (opts.showConfidence) {
    const confidencePercent = (metadata.confidence * 100).toFixed(0);
    const confidenceEmoji = metadata.confidence >= 0.8 ? '🟢' : metadata.confidence >= 0.5 ? '🟡' : '🔴';
    parts.push(`**Confidence:** ${confidenceEmoji} ${confidencePercent}%`);
  }

  // Processing time
  if (opts.showProcessingTime && metadata.processingTime) {
    parts.push(`**Time:** ${metadata.processingTime}ms`);
  }

  // LLM model info
  if (metadata.llmModel) {
    parts.push(`**AI Model:** ${metadata.llmModel}`);
  }

  // Hybrid approach details
  if (metadata.method === 'hybrid' && metadata.rulesCoverage !== undefined) {
    const rulePercent = (metadata.rulesCoverage * 100).toFixed(0);
    parts.push(`**Rules Coverage:** ${rulePercent}%`);
  }

  // Fallback indicator
  if (metadata.fallbackUsed) {
    parts.push(`⚠️ **Fallback Used:** LLM was unavailable, using rule-based results`);
  }

  // User consent info
  if (metadata.userConsent) {
    if (metadata.userConsent.requested) {
      const status = metadata.userConsent.approved ? '✅ Approved' : '❌ Declined';
      parts.push(`**User Consent:** ${status}`);
    }
  }

  // Warnings
  if (opts.showWarnings && metadata.warnings && metadata.warnings.length > 0) {
    parts.push(`\n**Warnings:**`);
    for (const warning of metadata.warnings) {
      parts.push(`  ⚠️ ${warning}`);
    }
  }

  return parts.join('\n');
}

/**
 * Create transparency badge for UI display
 */
export interface TransparencyBadge {
  label: string;
  color: 'green' | 'blue' | 'yellow' | 'red';
  icon: string;
  tooltip: string;
}

export function createTransparencyBadge(metadata: TransparencyMetadata): TransparencyBadge {
  const badges: Record<ProcessingMethod, TransparencyBadge> = {
    'rule-based': {
      label: 'Rule-Based',
      color: 'green',
      icon: '✅',
      tooltip: 'Result generated using deterministic rules (no AI)',
    },
    'llm-assisted': {
      label: 'AI-Assisted',
      color: 'blue',
      icon: '🤖',
      tooltip: `Result generated using AI model${metadata.llmModel ? ` (${metadata.llmModel})` : ''}`,
    },
    'hybrid': {
      label: 'Hybrid',
      color: 'yellow',
      icon: '🔄',
      tooltip: `Result combines rule-based (${((metadata.rulesCoverage ?? 0) * 100).toFixed(0)}%) and AI analysis`,
    },
  };

  return badges[metadata.method];
}
