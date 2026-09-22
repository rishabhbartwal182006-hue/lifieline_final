import { TriggeredRule } from '../rules/types.js';
import { TriageResult, TriageLevel, TriageAction } from '../schemas/triageResult.js';
import { SessionState } from './sessionState.js';

/**
 * Triage Calculation Layer
 * 
 * Escalation Hierarchy:
 * 1. If ANY rule is 'EMERGENCY' -> Final Level = EMERGENCY
 * 2. Else if ANY rule is 'URGENT' -> Final Level = URGENT
 * 3. Else -> Final Level = ROUTINE
 */
export function calculateTriage(
  sessionId: string,
  triggeredRules: TriggeredRule[],
  sessionState?: SessionState
): TriageResult {
  const timestamp = new Date().toISOString();
  const resultId = `trg_${sessionId}_${Date.now()}`;

  const emergencyRules = triggeredRules.filter((r) => r.priority === 'EMERGENCY');
  const urgentRules = triggeredRules.filter((r) => r.priority === 'URGENT');

  let triageLevel: TriageLevel = 'ROUTINE';
  let action: TriageAction = 'STANDARD_QUEUE';
  let reason = '';

  if (emergencyRules.length > 0) {
    triageLevel = 'EMERGENCY';
    action = 'IMMEDIATE_DOCTOR_ALERT';
    
    const reasons = emergencyRules.map((r) => `• [${r.name}]: ${r.reason}`).join('\n');
    const urgentAddendum = urgentRules.length > 0
      ? `\nAdditional co-occurring urgent findings:\n` + urgentRules.map((r) => `• [${r.name}]: ${r.reason}`).join('\n')
      : '';
    
    reason = `EMERGENCY ESCALATION TRIGGERED:\n${reasons}${urgentAddendum}`;
  } else if (urgentRules.length > 0) {
    triageLevel = 'URGENT';
    action = 'PRIORITY_REVIEW';

    const reasons = urgentRules.map((r) => `• [${r.name}]: ${r.reason}`).join('\n');
    reason = `URGENT CLINICAL REVIEW REQUIRED:\n${reasons}`;
  } else {
    triageLevel = 'ROUTINE';
    action = 'STANDARD_QUEUE';
    
    const maxSeverity = sessionState?.symptoms.maxSeverity ?? 0;
    const symptomName = sessionState?.symptoms.primary?.symptomName;
    
    if (symptomName) {
      reason = `Patient presents with ${symptomName} (pain score ${maxSeverity}/10). Vitals and reported symptoms are within stable baseline limits with no active red flags detected. Assigned to standard queue.`;
    } else {
      reason = 'Patient vitals and intake responses are within normal clinical baseline limits. No red-flag criteria triggered. Assigned to standard queue.';
    }
  }

  const triggeredRuleIds = triggeredRules.map((r) => r.id);

  return {
    id: resultId,
    sessionId,
    patientId: sessionState?.patientId,
    triageLevel,
    triggeredRules: triggeredRuleIds,
    action,
    reason,
    timestamp,
    metadata: {
      redFlagCount: triggeredRules.length,
      contributingEventIds: sessionState?.events.map((e) => e.id)
    }
  };
}
