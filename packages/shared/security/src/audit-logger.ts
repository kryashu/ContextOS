/**
 * Audit Logger for Hybrid System Security
 * 
 * Provides:
 * - Comprehensive audit logging for LLM usage
 * - Data minimization tracking
 * - User consent audit trail
 * - Security event monitoring
 */

export type AuditEventType =
  | 'llm_request'
  | 'llm_response'
  | 'user_consent_requested'
  | 'user_consent_granted'
  | 'user_consent_denied'
  | 'data_minimization'
  | 'fallback_triggered'
  | 'security_warning'
  | 'preference_updated';

export interface AuditEvent {
  id: string;
  type: AuditEventType;
  timestamp: string;
  sessionId: string;
  workspaceId?: string;
  userId?: string;
  operation: string;
  details: Record<string, unknown>;
  metadata?: {
    ipAddress?: string;
    userAgent?: string;
    duration?: number;
  };
}

export interface AuditLogQuery {
  startDate?: string;
  endDate?: string;
  eventTypes?: AuditEventType[];
  sessionId?: string;
  workspaceId?: string;
  userId?: string;
  limit?: number;
}

/**
 * Audit Logger for security and compliance
 */
export class AuditLogger {
  private events: AuditEvent[] = [];
  private maxEvents = 10000;

  /**
   * Log an audit event
   */
  log(event: Omit<AuditEvent, 'id' | 'timestamp'>): void {
    const auditEvent: AuditEvent = {
      ...event,
      id: this.generateEventId(),
      timestamp: new Date().toISOString(),
    };

    this.events.push(auditEvent);

    // Trim old events if exceeding max
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log('[AUDIT]', auditEvent.type, auditEvent.operation, auditEvent.details);
    }
  }

  /**
   * Log LLM request
   */
  logLLMRequest(params: {
    sessionId: string;
    workspaceId?: string;
    operation: string;
    model?: string;
    inputLength: number;
    userConsent: boolean;
  }): void {
    this.log({
      type: 'llm_request',
      sessionId: params.sessionId,
      workspaceId: params.workspaceId,
      operation: params.operation,
      details: {
        model: params.model,
        inputLength: params.inputLength,
        userConsent: params.userConsent,
      },
    });
  }

  /**
   * Log LLM response
   */
  logLLMResponse(params: {
    sessionId: string;
    workspaceId?: string;
    operation: string;
    model?: string;
    outputLength: number;
    duration: number;
    success: boolean;
  }): void {
    this.log({
      type: 'llm_response',
      sessionId: params.sessionId,
      workspaceId: params.workspaceId,
      operation: params.operation,
      details: {
        model: params.model,
        outputLength: params.outputLength,
        success: params.success,
      },
      metadata: {
        duration: params.duration,
      },
    });
  }

  /**
   * Log user consent request
   */
  logConsentRequest(params: {
    sessionId: string;
    workspaceId?: string;
    operation: string;
    reason: string;
  }): void {
    this.log({
      type: 'user_consent_requested',
      sessionId: params.sessionId,
      workspaceId: params.workspaceId,
      operation: params.operation,
      details: {
        reason: params.reason,
      },
    });
  }

  /**
   * Log user consent response
   */
  logConsentResponse(params: {
    sessionId: string;
    workspaceId?: string;
    operation: string;
    approved: boolean;
    rememberChoice?: boolean;
    scope?: string;
  }): void {
    this.log({
      type: params.approved ? 'user_consent_granted' : 'user_consent_denied',
      sessionId: params.sessionId,
      workspaceId: params.workspaceId,
      operation: params.operation,
      details: {
        approved: params.approved,
        rememberChoice: params.rememberChoice,
        scope: params.scope,
      },
    });
  }

  /**
   * Query audit events
   */
  query(query: AuditLogQuery): AuditEvent[] {
    let filtered = this.events;

    if (query.startDate) {
      filtered = filtered.filter(e => e.timestamp >= query.startDate!);
    }

    if (query.endDate) {
      filtered = filtered.filter(e => e.timestamp <= query.endDate!);
    }

    if (query.eventTypes && query.eventTypes.length > 0) {
      filtered = filtered.filter(e => query.eventTypes!.includes(e.type));
    }

    if (query.sessionId) {
      filtered = filtered.filter(e => e.sessionId === query.sessionId);
    }

    if (query.workspaceId) {
      filtered = filtered.filter(e => e.workspaceId === query.workspaceId);
    }

    if (query.userId) {
      filtered = filtered.filter(e => e.userId === query.userId);
    }

    if (query.limit) {
      filtered = filtered.slice(-query.limit);
    }

    return filtered;
  }

  /**
   * Get audit statistics
   */
  getStats(): {
    totalEvents: number;
    eventsByType: Record<AuditEventType, number>;
    llmUsage: {
      totalRequests: number;
      successRate: number;
      avgDuration: number;
    };
    consent: {
      requested: number;
      approved: number;
      denied: number;
      approvalRate: number;
    };
  } {
    const eventsByType = this.events.reduce((acc, event) => {
      acc[event.type] = (acc[event.type] ?? 0) + 1;
      return acc;
    }, {} as Record<AuditEventType, number>);

    const llmRequests = this.events.filter(e => e.type === 'llm_request');
    const llmResponses = this.events.filter(e => e.type === 'llm_response');
    const successfulResponses = llmResponses.filter(e => e.details.success === true);
    const avgDuration = llmResponses.length > 0
      ? llmResponses.reduce((sum, e) => sum + (e.metadata?.duration ?? 0), 0) / llmResponses.length
      : 0;

    const consentRequested = this.events.filter(e => e.type === 'user_consent_requested').length;
    const consentApproved = this.events.filter(e => e.type === 'user_consent_granted').length;
    const consentDenied = this.events.filter(e => e.type === 'user_consent_denied').length;

    return {
      totalEvents: this.events.length,
      eventsByType,
      llmUsage: {
        totalRequests: llmRequests.length,
        successRate: llmRequests.length > 0 ? successfulResponses.length / llmRequests.length : 0,
        avgDuration,
      },
      consent: {
        requested: consentRequested,
        approved: consentApproved,
        denied: consentDenied,
        approvalRate: consentRequested > 0 ? consentApproved / consentRequested : 0,
      },
    };
  }

  /**
   * Export audit log
   */
  export(): AuditEvent[] {
    return [...this.events];
  }

  /**
   * Clear audit log
   */
  clear(): void {
    this.events = [];
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

/**
 * Global audit logger instance
 */
export const globalAuditLogger = new AuditLogger();
