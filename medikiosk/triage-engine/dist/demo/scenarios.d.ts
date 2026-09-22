import { PatientEvent } from '../schemas/patientEvent.js';
export interface DemoStep {
    stepNumber: number;
    label: string;
    delayMs: number;
    event: PatientEvent;
    expectedTriageLevel: 'ROUTINE' | 'URGENT' | 'EMERGENCY';
    expectedTriggeredRules?: string[];
    notes: string;
}
export interface DemoScenario {
    caseId: 1 | 2 | 3;
    title: string;
    patientName: string;
    abhaId: string;
    sessionId: string;
    clinicalSummary: string;
    steps: DemoStep[];
}
export declare const DEMO_SCENARIOS: Record<1 | 2 | 3, DemoScenario>;
