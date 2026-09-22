import { SessionState } from '../engine/sessionState.js';
import { TriageResult } from '../schemas/triageResult.js';
import { AuditLogEntry } from './auditLog.js';
export interface PersistedSession {
    sessionId: string;
    patientId?: string;
    status: 'ACTIVE' | 'TRIAGED' | 'DISCHARGED' | 'ESCALATED';
    startTime: string;
    lastUpdated: string;
    triageResult?: TriageResult;
    symptoms: SessionState['symptoms'];
    vitals: SessionState['vitals'];
    questionnaire: SessionState['questionnaire'];
    eventCount: number;
    events: SessionState['events'];
    auditTrail: AuditLogEntry[];
}
export declare function saveSessionSnapshot(session: SessionState, statusOverride?: PersistedSession['status']): Promise<PersistedSession>;
export declare function findSession(sessionId: string): Promise<PersistedSession | null>;
export declare function listAllSessions(filter?: {
    status?: string;
    triageLevel?: string;
}): Promise<PersistedSession[]>;
export declare function clearAllPersistedSessions(): Promise<void>;
