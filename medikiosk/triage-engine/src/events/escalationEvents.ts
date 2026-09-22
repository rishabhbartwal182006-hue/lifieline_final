import { Server } from 'socket.io';
import { TriageResult } from '../schemas/triageResult.js';
import { SessionState } from '../engine/sessionState.js';
import {
  SOCKET_EVENTS,
  EscalationRequiredPayload,
  QuestionnaireInterruptedPayload,
  RedFlagDetectedPayload,
  TriageUpdatedPayload
} from './socketEvents.js';

/**
 * Broadcasts emergency escalation payloads to Doctor Dashboard and Patient Kiosk.
 */
export function broadcastEscalation(
  io: Server,
  sessionId: string,
  triageResult: TriageResult,
  session?: SessionState
): void {
  const sessionRoom = `session:${sessionId}`;
  const dashboardRoom = 'dashboard';

  const escalationPayload: EscalationRequiredPayload = {
    sessionId,
    patientId: session?.patientId ?? triageResult.patientId,
    triageLevel: 'EMERGENCY',
    triggeredRules: triageResult.triggeredRules,
    action: triageResult.action,
    reason: triageResult.reason,
    timestamp: triageResult.timestamp
  };

  const interruptPayload: QuestionnaireInterruptedPayload = {
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
    const redFlagPayload: RedFlagDetectedPayload = {
      sessionId,
      previousLevel,
      currentLevel: 'EMERGENCY',
      triggeredRules: triageResult.triggeredRules,
      reason: triageResult.reason,
      timestamp: triageResult.timestamp
    };
    io.to(dashboardRoom).to(sessionRoom).emit(SOCKET_EVENTS.SERVER.RED_FLAG_DETECTED, redFlagPayload);
  }

  const triageUpdatePayload: TriageUpdatedPayload = {
    sessionId,
    triageResult,
    previousTriageLevel: previousLevel
  };
  io.to(dashboardRoom).to(sessionRoom).emit(SOCKET_EVENTS.SERVER.TRIAGE_UPDATED, triageUpdatePayload);
}
