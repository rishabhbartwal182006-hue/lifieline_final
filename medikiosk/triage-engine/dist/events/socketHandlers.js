import { processPatientEvent, EventValidationError } from '../engine/index.js';
import { getSession, getLatestTriage } from '../engine/sessionState.js';
import { getNextQuestion } from '../questionnaire/questionSelector.js';
import { broadcastEscalation } from './escalationEvents.js';
import { logAuditEvent } from '../persistence/auditLog.js';
import { saveSessionSnapshot } from '../persistence/sessionRepository.js';
import { SOCKET_EVENTS } from './socketEvents.js';
export function registerSocketHandlers(io, socket) {
    // Session & Dashboard Room Management
    socket.on(SOCKET_EVENTS.CLIENT.JOIN_SESSION, (data, ack) => {
        if (!data?.sessionId) {
            if (ack)
                ack({ success: false, error: 'sessionId is required to join session' });
            return;
        }
        const room = `session:${data.sessionId}`;
        socket.join(room);
        const latestTriage = getLatestTriage(data.sessionId);
        const session = getSession(data.sessionId);
        const nextQ = getNextQuestion(data.sessionId);
        socket.emit(SOCKET_EVENTS.SERVER.SESSION_SYNC, {
            sessionId: data.sessionId,
            latestTriage: latestTriage ?? null,
            eventCount: session?.eventCount ?? 0,
            nextQuestion: nextQ
        });
        if (ack) {
            ack({
                success: true,
                room,
                latestTriage: latestTriage ?? null
            });
        }
    });
    socket.on(SOCKET_EVENTS.CLIENT.LEAVE_SESSION, (data) => {
        if (data?.sessionId) {
            socket.leave(`session:${data.sessionId}`);
        }
    });
    socket.on(SOCKET_EVENTS.CLIENT.JOIN_DASHBOARD, (_data, ack) => {
        socket.join('dashboard');
        if (ack)
            ack({ success: true, room: 'dashboard' });
    });
    socket.on(SOCKET_EVENTS.CLIENT.GET_LATEST_TRIAGE, (data, ack) => {
        if (!data?.sessionId) {
            if (ack)
                ack({ success: false, error: 'sessionId is required' });
            return;
        }
        const triage = getLatestTriage(data.sessionId);
        if (ack)
            ack({ success: true, triageResult: triage ?? null });
    });
    // Primary Event Ingestion Handler
    async function handleIncomingEvent(rawEvent, ack) {
        try {
            const triageResult = processPatientEvent(rawEvent);
            const sessionId = triageResult.sessionId;
            const session = getSession(sessionId);
            const sessionRoom = `session:${sessionId}`;
            const dashboardRoom = 'dashboard';
            const prevResult = session?.previousTriageResult;
            const prevLevel = prevResult?.triageLevel ?? 'ROUTINE';
            const prevRules = prevResult?.triggeredRules ?? [];
            const newlyTriggeredRules = triageResult.triggeredRules.filter((r) => !prevRules.includes(r));
            if (newlyTriggeredRules.length > 0) {
                const rulePayload = {
                    sessionId,
                    newlyTriggeredRules,
                    allTriggeredRules: triageResult.triggeredRules
                };
                io.to(dashboardRoom).to(sessionRoom).emit(SOCKET_EVENTS.SERVER.RULE_TRIGGERED, rulePayload);
                logAuditEvent({
                    sessionId,
                    patientId: session?.patientId,
                    eventType: 'RULE_TRIGGERED',
                    previousLevel: prevLevel,
                    currentLevel: triageResult.triageLevel,
                    triggeredRules: newlyTriggeredRules,
                    action: triageResult.action,
                    reason: triageResult.reason
                });
            }
            if (triageResult.triageLevel === 'EMERGENCY') {
                broadcastEscalation(io, sessionId, triageResult, session);
                logAuditEvent({
                    sessionId,
                    patientId: session?.patientId,
                    eventType: 'ESCALATION_REQUIRED',
                    previousLevel: prevLevel,
                    currentLevel: 'EMERGENCY',
                    triggeredRules: triageResult.triggeredRules,
                    action: triageResult.action,
                    reason: triageResult.reason
                });
            }
            else {
                if (prevLevel === 'ROUTINE' && triageResult.triageLevel === 'URGENT') {
                    const redFlagPayload = {
                        sessionId,
                        previousLevel: 'ROUTINE',
                        currentLevel: 'URGENT',
                        triggeredRules: triageResult.triggeredRules,
                        reason: triageResult.reason,
                        timestamp: triageResult.timestamp
                    };
                    io.to(dashboardRoom).to(sessionRoom).emit(SOCKET_EVENTS.SERVER.RED_FLAG_DETECTED, redFlagPayload);
                    logAuditEvent({
                        sessionId,
                        patientId: session?.patientId,
                        eventType: 'RED_FLAG_DETECTED',
                        previousLevel: 'ROUTINE',
                        currentLevel: 'URGENT',
                        triggeredRules: triageResult.triggeredRules,
                        action: triageResult.action,
                        reason: triageResult.reason
                    });
                }
                const triagePayload = {
                    sessionId,
                    triageResult,
                    previousTriageLevel: prevLevel
                };
                io.to(dashboardRoom).to(sessionRoom).emit(SOCKET_EVENTS.SERVER.TRIAGE_UPDATED, triagePayload);
                logAuditEvent({
                    sessionId,
                    patientId: session?.patientId,
                    eventType: 'TRIAGE_UPDATED',
                    previousLevel: prevLevel,
                    currentLevel: triageResult.triageLevel,
                    triggeredRules: triageResult.triggeredRules,
                    action: triageResult.action,
                    reason: triageResult.reason
                });
                const nextQuestionPayload = getNextQuestion(sessionId);
                io.to(sessionRoom).emit(SOCKET_EVENTS.SERVER.NEXT_QUESTION, nextQuestionPayload);
            }
            if (session) {
                await saveSessionSnapshot(session);
            }
            if (ack) {
                ack({
                    success: true,
                    triageResult
                });
            }
        }
        catch (err) {
            if (err instanceof EventValidationError) {
                socket.emit(SOCKET_EVENTS.SERVER.ERROR_OCCURRED, {
                    error: err.message,
                    errors: err.errors,
                    rawEventType: err.rawEventType
                });
                if (ack)
                    ack({ success: false, error: err.message, errors: err.errors });
            }
            else {
                socket.emit(SOCKET_EVENTS.SERVER.ERROR_OCCURRED, {
                    error: err.message || 'Internal triage engine error'
                });
                if (ack)
                    ack({ success: false, error: err.message || 'Internal triage engine error' });
            }
        }
    }
    socket.on(SOCKET_EVENTS.CLIENT.PATIENT_EVENT_RECEIVED, (event, ack) => {
        handleIncomingEvent(event, ack);
    });
    socket.on(SOCKET_EVENTS.CLIENT.VITAL_UPDATED, (event, ack) => {
        handleIncomingEvent(event, ack);
    });
}
