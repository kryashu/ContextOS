/**
 * User Consent Service for LLM Fallback
 * 
 * Provides user consent mechanism for AI model usage with:
 * - Non-intrusive prompt design
 * - Clear explanation of trade-offs
 * - Session/workspace preference management
 * - Transparent AI usage indicators
 */

export type ConsentOperation = 
  | 'classification'
  | 'extraction'
  | 'answer_composition'
  | 'analysis'
  | 'generation';

export interface ConsentRequest {
  operation: ConsentOperation;
  reason: string;
  context?: {
    fileName?: string;
    fileType?: string;
    queryType?: string;
  };
  estimatedTime?: string;
  fallbackAvailable: boolean;
  fallbackDescription?: string;
}

export interface ConsentResponse {
  approved: boolean;
  rememberChoice?: boolean;
  rememberScope?: 'session' | 'workspace' | 'global';
  timestamp: string;
}

export interface ConsentPreference {
  operation: ConsentOperation;
  approved: boolean;
  scope: 'session' | 'workspace' | 'global';
  createdAt: string;
  expiresAt?: string;
}

export interface ConsentPromptOptions {
  title: string;
  message: string;
  hint?: string;
  estimatedTime?: string;
  fallbackOption?: {
    label: string;
    description: string;
  };
  rememberOptions?: Array<{
    label: string;
    value: 'session' | 'workspace' | 'global';
    description: string;
  }>;
}

/**
 * User Consent Service
 * Manages user consent for LLM operations with preference storage
 */
export class UserConsentService {
  private preferences = new Map<string, ConsentPreference>();
  private sessionId: string;
  private workspaceId?: string;

  constructor(sessionId: string, workspaceId?: string) {
    this.sessionId = sessionId;
    this.workspaceId = workspaceId;
  }

  /**
   * Request user consent for LLM operation
   * Checks stored preferences first, prompts user if needed
   */
  async requestConsent(
    request: ConsentRequest,
    promptHandler: (options: ConsentPromptOptions) => Promise<ConsentResponse>
  ): Promise<ConsentResponse> {
    // Check for existing preference
    const existing = this.getPreference(request.operation);
    if (existing) {
      // Check if preference has expired
      if (existing.expiresAt && new Date(existing.expiresAt) < new Date()) {
        this.clearPreference(request.operation, existing.scope);
      } else {
        return {
          approved: existing.approved,
          timestamp: new Date().toISOString(),
        };
      }
    }

    // Build prompt options
    const promptOptions = this.buildPromptOptions(request);

    // Prompt user for consent
    const response = await promptHandler(promptOptions);

    // Store preference if requested
    if (response.rememberChoice && response.rememberScope) {
      this.storePreference({
        operation: request.operation,
        approved: response.approved,
        scope: response.rememberScope,
        createdAt: response.timestamp,
        expiresAt: this.calculateExpiration(response.rememberScope),
      });
    }

    return response;
  }

  /**
   * Build consent prompt options from request
   */
  private buildPromptOptions(request: ConsentRequest): ConsentPromptOptions {
    const operationLabels: Record<ConsentOperation, string> = {
      classification: 'Document Classification',
      extraction: 'Entity Extraction',
      answer_composition: 'Answer Composition',
      analysis: 'Content Analysis',
      generation: 'Content Generation',
    };

    const title = `AI Model Required: ${operationLabels[request.operation]}`;
    
    let message = `This request requires thorough analysis beyond our rule-based patterns.\n\n`;
    message += `**Reason:** ${request.reason}\n\n`;
    
    if (request.context) {
      if (request.context.fileName) {
        message += `**File:** ${request.context.fileName}\n`;
      }
      if (request.context.fileType) {
        message += `**Type:** ${request.context.fileType}\n`;
      }
      if (request.context.queryType) {
        message += `**Query:** ${request.context.queryType}\n`;
      }
      message += `\n`;
    }

    message += `Would you like me to perform a comprehensive analysis using an AI model?`;

    const hint = `🤖 An AI model will be used if you approve. ${request.estimatedTime ? `Estimated time: ${request.estimatedTime}.` : ''}`;

    const options: ConsentPromptOptions = {
      title,
      message,
      hint,
      estimatedTime: request.estimatedTime,
    };

    // Add fallback option if available
    if (request.fallbackAvailable) {
      options.fallbackOption = {
        label: 'Use Basic Results',
        description: request.fallbackDescription ?? 'Proceed with rule-based results only (faster, but may be less detailed)',
      };
    }

    // Add remember options
    options.rememberOptions = [
      {
        label: 'Remember for this session',
        value: 'session',
        description: 'Apply this choice for the current session only',
      },
      {
        label: 'Remember for this workspace',
        value: 'workspace',
        description: 'Apply this choice for all operations in this workspace',
      },
      {
        label: 'Remember globally',
        value: 'global',
        description: 'Apply this choice for all workspaces and sessions',
      },
    ];

    return options;
  }

  /**
   * Get stored preference for operation
   */
  private getPreference(operation: ConsentOperation): ConsentPreference | undefined {
    // Check in order: session -> workspace -> global
    const sessionKey = this.getPreferenceKey(operation, 'session');
    const workspaceKey = this.getPreferenceKey(operation, 'workspace');
    const globalKey = this.getPreferenceKey(operation, 'global');

    return (
      this.preferences.get(sessionKey) ??
      this.preferences.get(workspaceKey) ??
      this.preferences.get(globalKey)
    );
  }

  /**
   * Store consent preference
   */
  private storePreference(preference: ConsentPreference): void {
    const key = this.getPreferenceKey(preference.operation, preference.scope);
    this.preferences.set(key, preference);
  }

  /**
   * Clear preference for operation and scope
   */
  private clearPreference(operation: ConsentOperation, scope: 'session' | 'workspace' | 'global'): void {
    const key = this.getPreferenceKey(operation, scope);
    this.preferences.delete(key);
  }

  /**
   * Generate preference key
   */
  private getPreferenceKey(
    operation: ConsentOperation,
    scope: 'session' | 'workspace' | 'global'
  ): string {
    switch (scope) {
      case 'session':
        return `${this.sessionId}:${operation}`;
      case 'workspace':
        return `${this.workspaceId ?? 'default'}:${operation}`;
      case 'global':
        return `global:${operation}`;
    }
  }

  /**
   * Calculate expiration time based on scope
   */
  private calculateExpiration(scope: 'session' | 'workspace' | 'global'): string | undefined {
    const now = new Date();
    
    switch (scope) {
      case 'session':
        // Session preferences expire after 24 hours
        return new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
      case 'workspace':
        // Workspace preferences expire after 30 days
        return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
      case 'global':
        // Global preferences never expire (until manually cleared)
        return undefined;
    }
  }

  /**
   * Clear all preferences for a scope
   */
  clearPreferences(scope?: 'session' | 'workspace' | 'global'): void {
    if (!scope) {
      this.preferences.clear();
      return;
    }

    const keysToDelete: string[] = [];
    for (const [key, pref] of this.preferences.entries()) {
      if (pref.scope === scope) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.preferences.delete(key);
    }
  }

  /**
   * Get all stored preferences
   */
  getAllPreferences(): ConsentPreference[] {
    return Array.from(this.preferences.values());
  }

  /**
   * Export preferences for persistence
   */
  exportPreferences(): Record<string, ConsentPreference> {
    const exported: Record<string, ConsentPreference> = {};
    for (const [key, pref] of this.preferences.entries()) {
      exported[key] = pref;
    }
    return exported;
  }

  /**
   * Import preferences from storage
   */
  importPreferences(preferences: Record<string, ConsentPreference>): void {
    for (const [key, pref] of Object.entries(preferences)) {
      // Skip expired preferences
      if (pref.expiresAt && new Date(pref.expiresAt) < new Date()) {
        continue;
      }
      this.preferences.set(key, pref);
    }
  }
}

/**
 * Simple in-memory consent handler for testing/CLI
 */
export class SimpleConsentHandler {
  async prompt(options: ConsentPromptOptions): Promise<ConsentResponse> {
    console.log(`\n${'='.repeat(60)}`);
    console.log(options.title);
    console.log('='.repeat(60));
    console.log(options.message);
    
    if (options.hint) {
      console.log(`\n${options.hint}`);
    }

    if (options.fallbackOption) {
      console.log(`\nFallback: ${options.fallbackOption.label}`);
      console.log(`  ${options.fallbackOption.description}`);
    }

    console.log(`\nOptions:`);
    console.log(`  [Y] Approve AI model usage`);
    console.log(`  [N] Decline (use fallback if available)`);
    
    if (options.rememberOptions) {
      console.log(`\nRemember choice:`);
      for (const opt of options.rememberOptions) {
        console.log(`  ${opt.label}: ${opt.description}`);
      }
    }

    console.log('='.repeat(60));

    // For automated testing, default to approved
    return {
      approved: true,
      rememberChoice: false,
      timestamp: new Date().toISOString(),
    };
  }
}
