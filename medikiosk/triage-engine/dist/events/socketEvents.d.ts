import { TriageResult, TriageLevel } from '../schemas/triageResult.js';
import { QuestionType, QuestionnaireCategory } from '../schemas/questionnaire.js';
/**
 * ============================================================================
 * SOCKET.IO REAL-TIME EVENT CONTRACTS
 * ============================================================================
 * Defines constant event names and typed payloads for bi-directional communication
 * between Kiosk Clients, Hardware Daemons, and Doctor Dashboards.
 */
export declare const SOCKET_EVENTS: {
    readonly CLIENT: {
        readonly PATIENT_EVENT_RECEIVED: "PATIENT_EVENT_RECEIVED";
        readonly VITAL_UPDATED: "VITAL_UPDATED";
        readonly JOIN_SESSION: "JOIN_SESSION";
        readonly LEAVE_SESSION: "LEAVE_SESSION";
        readonly JOIN_DASHBOARD: "JOIN_DASHBOARD";
        readonly GET_LATEST_TRIAGE: "GET_LATEST_TRIAGE";
    };
    readonly SERVER: {
        readonly TRIAGE_UPDATED: "TRIAGE_UPDATED";
        readonly RULE_TRIGGERED: "RULE_TRIGGERED";
        readonly RED_FLAG_DETECTED: "RED_FLAG_DETECTED";
        readonly ESCALATION_REQUIRED: "ESCALATION_REQUIRED";
        readonly NEXT_QUESTION: "NEXT_QUESTION";
        readonly QUESTIONNAIRE_INTERRUPTED: "QUESTIONNAIRE_INTERRUPTED";
        readonly ERROR_OCCURRED: "ERROR_OCCURRED";
        readonly SESSION_SYNC: "SESSION_SYNC";
    };
};
export interface DynamicQuestionOption {
    label: string;
    value: string | number | boolean;
}
export interface DynamicQuestion {
    questionId: string;
    questionText: string;
    category: QuestionnaireCategory;
    questionType: QuestionType;
    options?: DynamicQuestionOption[];
    helpText?: string;
    isRedFlagIndicator?: boolean;
}
export interface QuestionProgress {
    currentStep: number;
    totalEstimatedSteps: number;
    isComplete: boolean;
    category?: string;
}
export interface NextQuestionPayload {
    sessionId: string;
    question: DynamicQuestion | null;
    progress: QuestionProgress;
}
export interface QuestionnaireInterruptedPayload {
    sessionId: string;
    reason: string;
    triageLevel: TriageLevel;
    action: string;
    timestamp: string;
    triggeredRules: string[];
}
export interface EscalationRequiredPayload {
    sessionId: string;
    patientId?: string;
    triageLevel: 'EMERGENCY';
    triggeredRules: string[];
    action: string;
    reason: string;
    timestamp: string;
}
export interface TriageUpdatedPayload {
    sessionId: string;
    triageResult: TriageResult;
    previousTriageLevel?: TriageLevel;
}
export interface RuleTriggeredPayload {
    sessionId: string;
    newlyTriggeredRules: string[];
    allTriggeredRules: string[];
}
export interface RedFlagDetectedPayload {
    sessionId: string;
    previousLevel: TriageLevel;
    currentLevel: TriageLevel;
    triggeredRules: string[];
    reason: string;
    timestamp: string;
}
