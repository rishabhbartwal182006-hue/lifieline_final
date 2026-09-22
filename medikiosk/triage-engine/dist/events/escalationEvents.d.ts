import { Server } from 'socket.io';
import { TriageResult } from '../schemas/triageResult.js';
import { SessionState } from '../engine/sessionState.js';
/**
 * Broadcasts emergency escalation payloads to Doctor Dashboard and Patient Kiosk.
 */
export declare function broadcastEscalation(io: Server, sessionId: string, triageResult: TriageResult, session?: SessionState): void;
