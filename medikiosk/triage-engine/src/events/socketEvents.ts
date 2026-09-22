import { TriageResult, TriageLevel } from '../schemas/triageResult.js';
import { QuestionType, QuestionnaireCategory } from '../schemas/questionnaire.js';

/**
 * ============================================================================
 * SOCKET.IO REAL-TIME EVENT CONTRACTS
 * ============================================================================
 * Defines constant event names and typed payloads for bi-directional communication
 * between Kiosk Clients, Hardware Daemons, and Doctor Dashboards.
 */

export const SOCKET_EVENTS = {
  // Client -> Server
  CLIENT: {
    PATIENT_EVENT_RECEIVED: 'PATIENT_EVENT_RECEIVED',
    VITAL_UPDATED: 'VITAL_UPDATED',
    JOIN_SESSION: 'JOIN_SESSION',
    LEAVE_SESSION: 'LEAVE_SESSION',
    JOIN_DASHBOARD: 'JOIN_DASHBOARD',
    GET_LATEST_TRIAGE: 'GET_LATEST_TRIAGE'
  },
  // Server -> Client
  SERVER: {
    TRIAGE_UPDATED: 'TRIAGE_UPDATED',
    RULE_TRIGGERED: 'RULE_TRIGGERED',
    RED_FLAG_DETECTED: 'RED_FLAG_DETECTED',
    ESCALATION_REQUIRED: 'ESCALATION_REQUIRED',
    NEXT_QUESTION: 'NEXT_QUESTION',
    QUESTIONNAIRE_INTERRUPTED: 'QUESTIONNAIRE_INTERRUPTED',
    ERROR_OCCURRED: 'ERROR_OCCURRED',
    SESSION_SYNC: 'SESSION_SYNC'
  }
} as const;

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
