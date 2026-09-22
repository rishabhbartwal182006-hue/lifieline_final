import { PatientEvent } from '../schemas/patientEvent.js';
import { SymptomPayload } from '../schemas/symptom.js';
import { VitalPayload } from '../schemas/vitalEvent.js';
import { QuestionnairePayload } from '../schemas/questionnaire.js';
import { TriageResult } from '../schemas/triageResult.js';

export interface AccumulatedVitals {
  HEART_RATE?: VitalPayload & { recordedAt: string };
  BLOOD_PRESSURE?: VitalPayload & { recordedAt: string };
  SPO2?: VitalPayload & { recordedAt: string };
  TEMPERATURE?: VitalPayload & { recordedAt: string };
  RESPIRATORY_RATE?: VitalPayload & { recordedAt: string };
  BLOOD_GLUCOSE?: VitalPayload & { recordedAt: string };
  [key: string]: (VitalPayload & { recordedAt: string }) | undefined;
}

export interface AccumulatedSymptoms {
  primary?: SymptomPayload;
  list: SymptomPayload[];
  allRadiations: string[];
  allAssociatedSymptoms: string[];
  maxSeverity: number;
}

export interface SessionState {
  sessionId: string;
  patientId?: string;
  createdAt: string;
  lastUpdatedAt: string;
  eventCount: number;

  vitals: AccumulatedVitals;
  symptoms: AccumulatedSymptoms;
  questionnaire: Record<string, QuestionnairePayload>;
  events: PatientEvent[];

  previousTriageResult?: TriageResult;
  latestTriageResult?: TriageResult;
}

const sessionStore = new Map<string, SessionState>();

export function createInitialSessionState(sessionId: string, patientId?: string): SessionState {
  const now = new Date().toISOString();
  return {
    sessionId,
    patientId,
    createdAt: now,
    lastUpdatedAt: now,
    eventCount: 0,
    vitals: {},
    symptoms: {
      list: [],
      allRadiations: [],
      allAssociatedSymptoms: [],
      maxSeverity: 0
    },
    questionnaire: {},
    events: []
  };
}

export function getOrCreateSession(sessionId: string, patientId?: string): SessionState {
  let session = sessionStore.get(sessionId);
  if (!session) {
    session = createInitialSessionState(sessionId, patientId);
    sessionStore.set(sessionId, session);
  }
  if (patientId && !session.patientId) {
    session.patientId = patientId;
  }
  return session;
}

export function applyEventToSession(event: PatientEvent): SessionState {
  const session = getOrCreateSession(event.sessionId, event.patientId);
  session.lastUpdatedAt = event.timestamp;
  session.eventCount += 1;
  session.events.push(event);

  switch (event.eventType) {
    case 'NEW_SYMPTOM_ADDED':
    case 'SYMPTOM_SEVERITY_UPDATED':
    case 'ASSOCIATED_SYMPTOM_DETECTED': {
      const symptomPayload = event.payload;
      session.symptoms.primary = symptomPayload;
      
      const existingIdx = session.symptoms.list.findIndex(
        (s) => s.symptomName.toUpperCase() === symptomPayload.symptomName.toUpperCase()
      );
      if (existingIdx >= 0) {
        session.symptoms.list[existingIdx] = symptomPayload;
      } else {
        session.symptoms.list.push(symptomPayload);
      }

      session.symptoms.maxSeverity = Math.max(
        ...session.symptoms.list.map((s) => s.severity),
        symptomPayload.severity
      );

      const allRads = new Set(session.symptoms.allRadiations);
      (symptomPayload.radiation || []).forEach((r) => allRads.add(r.toUpperCase()));
      session.symptoms.allRadiations = Array.from(allRads);

      const allAssoc = new Set(session.symptoms.allAssociatedSymptoms);
      (symptomPayload.associatedSymptoms || []).forEach((a) => allAssoc.add(a.toUpperCase()));
      session.symptoms.allAssociatedSymptoms = Array.from(allAssoc);
      break;
    }

    case 'NEW_VITAL_READING': {
      const vitalPayload = event.payload;
      session.vitals[vitalPayload.vitalType] = {
        ...vitalPayload,
        recordedAt: event.timestamp
      };
      break;
    }

    case 'NEW_QUESTIONNAIRE_ANSWER': {
      const questPayload = event.payload;
      session.questionnaire[questPayload.questionId] = questPayload;
      break;
    }
  }

  return session;
}

export function getSession(sessionId: string): SessionState | undefined {
  return sessionStore.get(sessionId);
}

export function updateSessionTriage(sessionId: string, triageResult: TriageResult): void {
  const session = getOrCreateSession(sessionId);
  session.previousTriageResult = session.latestTriageResult;
  session.latestTriageResult = triageResult;
}

export function getLatestTriage(sessionId: string): TriageResult | undefined {
  return sessionStore.get(sessionId)?.latestTriageResult;
}

export function clearSession(sessionId: string): boolean {
  return sessionStore.delete(sessionId);
}

export function clearAllSessions(): void {
  sessionStore.clear();
}
