import { z } from 'zod';
/**
 * Triage Result Output Data Contract
 *
 * Immutable output contract consumed by:
 * 1. Doctor Clinical Dashboard (real-time alerts & queue management)
 * 2. Kiosk Patient UI (empathetic next-step guidance)
 * 3. Hospital Emergency Escalation & Staff Pagers
 */
export const TriageLevelEnum = z.enum([
    'EMERGENCY',
    'URGENT',
    'ROUTINE'
]);
export const TriageActionEnum = z.enum([
    'IMMEDIATE_DOCTOR_ALERT', // Immediate alert on doctor workstation & emergency nurse pager
    'PRIORITY_REVIEW', // Expedited clinician evaluation
    'STANDARD_QUEUE', // Normal triage queue position
    'EMERGENCY_SERVICES_NOTIFIED', // Escalation to rapid response team
    'REPEAT_MEASUREMENT_REQUIRED' // Sensor anomaly requiring guided re-test
]);
export const TriageResultSchema = z.object({
    /** Unique triage result identifier */
    id: z.string().min(1, 'Triage result ID is required'),
    /** Associated patient kiosk session ID */
    sessionId: z.string().min(1, 'Session ID is required'),
    /** Optional patient identifier */
    patientId: z.string().optional(),
    /** Primary classification level: EMERGENCY, URGENT, ROUTINE */
    triageLevel: TriageLevelEnum,
    /** List of triggered clinical rule identifiers */
    triggeredRules: z.array(z.string()).default([]),
    /** Recommended clinical action */
    action: TriageActionEnum.or(z.string().min(1)),
    /** Explainable clinical rationale for assigned level */
    reason: z.string().min(1, 'Reason for triage decision is required'),
    /** ISO 8601 UTC timestamp of decision */
    timestamp: z.string().datetime({ message: 'Timestamp must be a valid ISO 8601 string' }),
    /** Optional calculated clinical metadata and contributing event IDs */
    metadata: z.object({
        news2Score: z.number().int().nonnegative().optional(),
        redFlagCount: z.number().int().nonnegative().optional(),
        evaluationLatencyMs: z.number().nonnegative().optional(),
        contributingEventIds: z.array(z.string()).optional()
    }).optional()
}).strict();
