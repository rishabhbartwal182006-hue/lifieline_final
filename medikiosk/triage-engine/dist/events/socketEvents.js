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
};
