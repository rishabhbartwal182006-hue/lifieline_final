import { SessionState } from '../engine/sessionState.js';
import { TriageResult } from '../schemas/triageResult.js';
import { getAuditTrail, AuditLogEntry } from './auditLog.js';

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

const persistedStore = new Map<string, PersistedSession>();

export async function saveSessionSnapshot(
  session: SessionState,
  statusOverride?: PersistedSession['status']
): Promise<PersistedSession> {
  const latestTriage = session.latestTriageResult;
  let computedStatus: PersistedSession['status'] = 'ACTIVE';

  if (statusOverride) {
    computedStatus = statusOverride;
  } else if (latestTriage?.triageLevel === 'EMERGENCY') {
    computedStatus = 'ESCALATED';
  } else if (latestTriage?.triageLevel === 'URGENT' || latestTriage?.triageLevel === 'ROUTINE') {
    computedStatus = 'TRIAGED';
  }

  const snapshot: PersistedSession = {
    sessionId: session.sessionId,
    patientId: session.patientId,
    status: computedStatus,
    startTime: session.createdAt,
    lastUpdated: session.lastUpdatedAt,
    triageResult: latestTriage,
    symptoms: JSON.parse(JSON.stringify(session.symptoms)),
    vitals: JSON.parse(JSON.stringify(session.vitals)),
    questionnaire: JSON.parse(JSON.stringify(session.questionnaire)),
    eventCount: session.eventCount,
    events: [...session.events],
    auditTrail: getAuditTrail(session.sessionId)
  };

  persistedStore.set(session.sessionId, snapshot);
  return snapshot;
}

export async function findSession(sessionId: string): Promise<PersistedSession | null> {
  const record = persistedStore.get(sessionId);
  return record ? JSON.parse(JSON.stringify(record)) : null;
}

export async function listAllSessions(filter?: {
  status?: string;
  triageLevel?: string;
}): Promise<PersistedSession[]> {
  let list = Array.from(persistedStore.values());

  if (filter?.status) {
    list = list.filter((s) => s.status.toUpperCase() === filter.status!.toUpperCase());
  }

  if (filter?.triageLevel) {
    list = list.filter(
      (s) => s.triageResult?.triageLevel.toUpperCase() === filter.triageLevel!.toUpperCase()
    );
  }

  return JSON.parse(JSON.stringify(list));
}

export async function clearAllPersistedSessions(): Promise<void> {
  persistedStore.clear();
}
