import { PatientEvent } from '../schemas/patientEvent.js';
import { SymptomPayload } from '../schemas/symptom.js';
import { VitalPayload } from '../schemas/vitalEvent.js';
import { QuestionnairePayload } from '../schemas/questionnaire.js';
import { TriageResult } from '../schemas/triageResult.js';
export interface AccumulatedVitals {
    HEART_RATE?: VitalPayload & {
        recordedAt: string;
    };
    BLOOD_PRESSURE?: VitalPayload & {
        recordedAt: string;
    };
    SPO2?: VitalPayload & {
        recordedAt: string;
    };
    TEMPERATURE?: VitalPayload & {
        recordedAt: string;
    };
    RESPIRATORY_RATE?: VitalPayload & {
        recordedAt: string;
    };
    BLOOD_GLUCOSE?: VitalPayload & {
        recordedAt: string;
    };
    [key: string]: (VitalPayload & {
        recordedAt: string;
    }) | undefined;
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
export declare function createInitialSessionState(sessionId: string, patientId?: string): SessionState;
export declare function getOrCreateSession(sessionId: string, patientId?: string): SessionState;
export declare function applyEventToSession(event: PatientEvent): SessionState;
export declare function getSession(sessionId: string): SessionState | undefined;
export declare function updateSessionTriage(sessionId: string, triageResult: TriageResult): void;
export declare function getLatestTriage(sessionId: string): TriageResult | undefined;
export declare function clearSession(sessionId: string): boolean;
export declare function clearAllSessions(): void;
