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
  eventType:
    | 'EVENT_INGESTED'
    | 'RULE_TRIGGERED'
    | 'TRIAGE_UPDATED'
    | 'RED_FLAG_DETECTED'
    | 'ESCALATION_REQUIRED'
    | 'QUESTIONNAIRE_INTERRUPTED';
  previousLevel?: string;
  currentLevel: string;
  triggeredRules: string[];
  action: string;
  reason: string;
  details?: Record<string, unknown>;
}

const auditStore: AuditLogEntry[] = [];

export function logAuditEvent(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): AuditLogEntry {
  const auditRecord: AuditLogEntry = {
    id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    ...entry
  };

  auditStore.push(auditRecord);
  return auditRecord;
}

export function getAuditTrail(sessionId: string): AuditLogEntry[] {
  return auditStore.filter((log) => log.sessionId === sessionId);
}

export function getAllAuditLogs(): AuditLogEntry[] {
  return [...auditStore];
}

export function clearAuditLogs(): void {
  auditStore.length = 0;
}

/**
 * Formats an explainable markdown report of the audit trail for clinician review.
 */
export function formatAuditTrailMarkdown(sessionId: string): string {
  const trail = getAuditTrail(sessionId);
  if (trail.length === 0) {
    return `No audit records found for session "${sessionId}".`;
  }

  let md = `### Clinical Decision Audit Trail for Session: \`${sessionId}\`\n\n`;
  md += `| Timestamp | Event Type | Level | Triggered Rules | Action | Rationale |\n`;
  md += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;

  for (const log of trail) {
    const rules = log.triggeredRules.length > 0 ? log.triggeredRules.join('<br>') : 'None';
    const cleanReason = log.reason.replace(/\n/g, ' ').replace(/\|/g, '\\|');
    md += `| ${log.timestamp} | \`${log.eventType}\` | **${log.currentLevel}** | ${rules} | \`${log.action}\` | ${cleanReason} |\n`;
  }

  return md;
}
