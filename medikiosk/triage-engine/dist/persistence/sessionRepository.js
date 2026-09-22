import { getAuditTrail } from './auditLog.js';
const persistedStore = new Map();
export async function saveSessionSnapshot(session, statusOverride) {
    const latestTriage = session.latestTriageResult;
    let computedStatus = 'ACTIVE';
    if (statusOverride) {
        computedStatus = statusOverride;
    }
    else if (latestTriage?.triageLevel === 'EMERGENCY') {
        computedStatus = 'ESCALATED';
    }
    else if (latestTriage?.triageLevel === 'URGENT' || latestTriage?.triageLevel === 'ROUTINE') {
        computedStatus = 'TRIAGED';
    }
    const snapshot = {
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
export async function findSession(sessionId) {
    const record = persistedStore.get(sessionId);
    return record ? JSON.parse(JSON.stringify(record)) : null;
}
export async function listAllSessions(filter) {
    let list = Array.from(persistedStore.values());
    if (filter?.status) {
        list = list.filter((s) => s.status.toUpperCase() === filter.status.toUpperCase());
    }
    if (filter?.triageLevel) {
        list = list.filter((s) => s.triageResult?.triageLevel.toUpperCase() === filter.triageLevel.toUpperCase());
    }
    return JSON.parse(JSON.stringify(list));
}
export async function clearAllPersistedSessions() {
    persistedStore.clear();
}
