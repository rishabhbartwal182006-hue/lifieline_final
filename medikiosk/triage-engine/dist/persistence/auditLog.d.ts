/**
 * Explainable Append-Only Audit Log
 *
 * Records every clinical rule trigger, state transition, and emergency
 * escalation with precise timestamps, input triggers, and clinical rationales.
 */
export interface AuditLogEntry {
    id: string;
    sessionId: string;
    patientId?: string;
    timestamp: string;
    eventType: 'EVENT_INGESTED' | 'RULE_TRIGGERED' | 'TRIAGE_UPDATED' | 'RED_FLAG_DETECTED' | 'ESCALATION_REQUIRED' | 'QUESTIONNAIRE_INTERRUPTED';
    previousLevel?: string;
    currentLevel: string;
    triggeredRules: string[];
    action: string;
    reason: string;
    details?: Record<string, unknown>;
}
export declare function logAuditEvent(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): AuditLogEntry;
export declare function getAuditTrail(sessionId: string): AuditLogEntry[];
export declare function getAllAuditLogs(): AuditLogEntry[];
export declare function clearAuditLogs(): void;
/**
 * Formats an explainable markdown report of the audit trail for clinician review.
 */
export declare function formatAuditTrailMarkdown(sessionId: string): string;
