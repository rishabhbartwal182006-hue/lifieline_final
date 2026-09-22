import { SOCKET_EVENTS } from './socketEvents.js';
/**
 * Broadcasts emergency escalation payloads to Doctor Dashboard and Patient Kiosk.
 */
export function broadcastEscalation(io, sessionId, triageResult, session) {
    const sessionRoom = `session:${sessionId}`;
    const dashboardRoom = 'dashboard';
    const escalationPayload = {
        sessionId,
        patientId: session?.patientId ?? triageResult.patientId,
        triageLevel: 'EMERGENCY',
        triggeredRules: triageResult.triggeredRules,
        action: triageResult.action,
        reason: triageResult.reason,
        timestamp: triageResult.timestamp
    };
    const interruptPayload = {
        sessionId,
        reason: triageResult.reason,
        triageLevel: triageResult.triageLevel,
        action: triageResult.action,
        timestamp: triageResult.timestamp,
        triggeredRules: triageResult.triggeredRules
    };
    io.to(dashboardRoom).to(sessionRoom).emit(SOCKET_EVENTS.SERVER.ESCALATION_REQUIRED, escalationPayload);
    io.to(sessionRoom).emit(SOCKET_EVENTS.SERVER.QUESTIONNAIRE_INTERRUPTED, interruptPayload);
    const previousLevel = session?.previousTriageResult?.triageLevel ?? 'ROUTINE';
    if (previousLevel !== 'EMERGENCY') {
        const redFlagPayload = {
            sessionId,
            previousLevel,
            currentLevel: 'EMERGENCY',
            triggeredRules: triageResult.triggeredRules,
            reason: triageResult.reason,
            timestamp: triageResult.timestamp
        };
        io.to(dashboardRoom).to(sessionRoom).emit(SOCKET_EVENTS.SERVER.RED_FLAG_DETECTED, redFlagPayload);
    }
    const triageUpdatePayload = {
        sessionId,
        triageResult,
        previousTriageLevel: previousLevel
    };
    io.to(dashboardRoom).to(sessionRoom).emit(SOCKET_EVENTS.SERVER.TRIAGE_UPDATED, triageUpdatePayload);
}
