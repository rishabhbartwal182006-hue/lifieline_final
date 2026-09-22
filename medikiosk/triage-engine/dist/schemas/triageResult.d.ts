import { z } from 'zod';
/**
 * Triage Result Output Data Contract
 *
 * Immutable output contract consumed by:
 * 1. Doctor Clinical Dashboard (real-time alerts & queue management)
 * 2. Kiosk Patient UI (empathetic next-step guidance)
 * 3. Hospital Emergency Escalation & Staff Pagers
 */
export declare const TriageLevelEnum: z.ZodEnum<["EMERGENCY", "URGENT", "ROUTINE"]>;
export declare const TriageActionEnum: z.ZodEnum<["IMMEDIATE_DOCTOR_ALERT", "PRIORITY_REVIEW", "STANDARD_QUEUE", "EMERGENCY_SERVICES_NOTIFIED", "REPEAT_MEASUREMENT_REQUIRED"]>;
export declare const TriageResultSchema: z.ZodObject<{
    /** Unique triage result identifier */
    id: z.ZodString;
    /** Associated patient kiosk session ID */
    sessionId: z.ZodString;
    /** Optional patient identifier */
    patientId: z.ZodOptional<z.ZodString>;
    /** Primary classification level: EMERGENCY, URGENT, ROUTINE */
    triageLevel: z.ZodEnum<["EMERGENCY", "URGENT", "ROUTINE"]>;
    /** List of triggered clinical rule identifiers */
    triggeredRules: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    /** Recommended clinical action */
    action: z.ZodUnion<[z.ZodEnum<["IMMEDIATE_DOCTOR_ALERT", "PRIORITY_REVIEW", "STANDARD_QUEUE", "EMERGENCY_SERVICES_NOTIFIED", "REPEAT_MEASUREMENT_REQUIRED"]>, z.ZodString]>;
    /** Explainable clinical rationale for assigned level */
    reason: z.ZodString;
    /** ISO 8601 UTC timestamp of decision */
    timestamp: z.ZodString;
    /** Optional calculated clinical metadata and contributing event IDs */
    metadata: z.ZodOptional<z.ZodObject<{
        news2Score: z.ZodOptional<z.ZodNumber>;
        redFlagCount: z.ZodOptional<z.ZodNumber>;
        evaluationLatencyMs: z.ZodOptional<z.ZodNumber>;
        contributingEventIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        news2Score?: number | undefined;
        redFlagCount?: number | undefined;
        evaluationLatencyMs?: number | undefined;
        contributingEventIds?: string[] | undefined;
    }, {
        news2Score?: number | undefined;
        redFlagCount?: number | undefined;
        evaluationLatencyMs?: number | undefined;
        contributingEventIds?: string[] | undefined;
    }>>;
}, "strict", z.ZodTypeAny, {
    id: string;
    timestamp: string;
    sessionId: string;
    triageLevel: "EMERGENCY" | "URGENT" | "ROUTINE";
    triggeredRules: string[];
    action: string;
    reason: string;
    patientId?: string | undefined;
    metadata?: {
        news2Score?: number | undefined;
        redFlagCount?: number | undefined;
        evaluationLatencyMs?: number | undefined;
        contributingEventIds?: string[] | undefined;
    } | undefined;
}, {
    id: string;
    timestamp: string;
    sessionId: string;
    triageLevel: "EMERGENCY" | "URGENT" | "ROUTINE";
    action: string;
    reason: string;
    patientId?: string | undefined;
    triggeredRules?: string[] | undefined;
    metadata?: {
        news2Score?: number | undefined;
        redFlagCount?: number | undefined;
        evaluationLatencyMs?: number | undefined;
        contributingEventIds?: string[] | undefined;
    } | undefined;
}>;
export type TriageResult = z.infer<typeof TriageResultSchema>;
export type TriageLevel = z.infer<typeof TriageLevelEnum>;
export type TriageAction = z.infer<typeof TriageActionEnum>;
