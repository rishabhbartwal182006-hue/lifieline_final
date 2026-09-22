/**
 * ============================================================================
 * INTEGRATION TEST SUITE: REAL-TIME SOCKET.IO FLOW & INTERRUPTIONS
 * ============================================================================
 * End-to-end integration test using real Socket.IO server and client instances.
 * Tests:
 * 1. Room-based broadcasting (Kiosk session room vs Doctor Dashboard room).
 * 2. Routine questioning progression (NEXT_QUESTION emissions).
 * 3. Immediate real-time QUESTIONNAIRE_INTERRUPTED + ESCALATION_REQUIRED.
 * 4. Reconnection and state recovery (SESSION_SYNC / GET_LATEST_TRIAGE).
 */

import { io as Client, Socket } from 'socket.io-client';
import { createServerInstance, ServerInstance } from '../src/server/httpServer.js';
import { SOCKET_EVENTS } from '../src/events/socketEvents.js';
import { clearAllSessions } from '../src/engine/sessionState.js';

export async function runSocketFlowTests(): Promise<boolean> {
  console.log('\n======================================================================');
  console.log('📡 TEST SUITE: REAL-TIME SOCKET.IO INTEGRATION & ESCALATION FLOW');
  console.log('======================================================================\n');

  clearAllSessions();
  let allPassed = true;
  const TEST_PORT = 5099;

  const server: ServerInstance = createServerInstance();
  await server.start(TEST_PORT);

  const serverUrl = `http://localhost:${TEST_PORT}`;

  let kioskSocket: Socket | null = null;
  let doctorSocket: Socket | null = null;

  try {
    // ------------------------------------------------------------------------
    // SETUP: Connect Kiosk and Doctor Dashboard Clients
    // ------------------------------------------------------------------------
    console.log('[SETUP] Connecting Kiosk and Doctor Dashboard Sockets...');

    kioskSocket = Client(serverUrl, { reconnectionDelay: 0, forceNew: true, transports: ['websocket'] });
    doctorSocket = Client(serverUrl, { reconnectionDelay: 0, forceNew: true, transports: ['websocket'] });

    await new Promise<void>((resolve) => {
      let count = 0;
      const check = () => {
        count++;
        if (count === 2) resolve();
      };
      kioskSocket!.on('connect', check);
      doctorSocket!.on('connect', check);
    });

    console.log('  Connected Kiosk Socket ID:', kioskSocket.id);
    console.log('  Connected Doctor Socket ID:', doctorSocket.id);

    // Join rooms
    await new Promise<void>((resolve) => {
      doctorSocket!.emit(SOCKET_EVENTS.CLIENT.JOIN_DASHBOARD, {}, () => resolve());
    });

    const routineSessionId = 'kiosk_socket_routine_101';
    await new Promise<void>((resolve) => {
      kioskSocket!.emit(SOCKET_EVENTS.CLIENT.JOIN_SESSION, { sessionId: routineSessionId }, () => resolve());
    });

    console.log('  \x1b[32m✔ PASS: Sockets successfully connected and joined rooms.\x1b[0m');

    // ------------------------------------------------------------------------
    // SCENARIO 1: Routine Patient Intake Flow (Step-by-Step Questions)
    // ------------------------------------------------------------------------
    console.log('\n[SCENARIO 1] Routine Intake Progression over Sockets...');
    
    let receivedNextQuestion: any = null;
    let receivedTriageUpdate: any = null;

    kioskSocket.on(SOCKET_EVENTS.SERVER.NEXT_QUESTION, (payload) => {
      receivedNextQuestion = payload;
    });

    kioskSocket.on(SOCKET_EVENTS.SERVER.TRIAGE_UPDATED, (payload) => {
      receivedTriageUpdate = payload;
    });

    // Send Step 1: Ingesting initial mild symptom
    const step1Event = {
      id: 'evt_sock_rt_01',
      timestamp: new Date().toISOString(),
      sessionId: routineSessionId,
      source: 'KIOSK_TOUCHSCREEN',
      eventType: 'NEW_SYMPTOM_ADDED',
      payload: {
        symptomName: 'MILD_ANKLE_SPRAIN',
        severity: 2,
        site: 'LEFT_LEG',
        onset: 'ACUTE'
      }
    };

    kioskSocket.emit(SOCKET_EVENTS.CLIENT.PATIENT_EVENT_RECEIVED, step1Event);

    // Wait for server emission
    await new Promise((r) => setTimeout(r, 200));

    if (
      receivedTriageUpdate &&
      receivedTriageUpdate.triageResult.triageLevel === 'ROUTINE' &&
      receivedNextQuestion &&
      receivedNextQuestion.question !== null
    ) {
      console.log('  \x1b[32m✔ PASS: Ingested Step 1 -> Received ROUTINE triage update and NEXT_QUESTION:\x1b[0m');
      console.log(`    Next Question ID: ${receivedNextQuestion.question.questionId}`);
      console.log(`    Question Text: "${receivedNextQuestion.question.questionText}"`);
    } else {
      console.log('  \x1b[31m✘ FAIL: Did not receive expected NEXT_QUESTION on Step 1.\x1b[0m');
      allPassed = false;
    }

    // ------------------------------------------------------------------------
    // SCENARIO 2: Emergency Interruption (Instant Red-Flag Escalation)
    // ------------------------------------------------------------------------
    console.log('\n[SCENARIO 2] Emergency Red-Flag Interruption & High-Priority Broadcast...');
    const emergSessionId = 'kiosk_socket_emerg_202';

    // Switch kiosk to new emergency session
    await new Promise<void>((resolve) => {
      kioskSocket!.emit(SOCKET_EVENTS.CLIENT.JOIN_SESSION, { sessionId: emergSessionId }, () => resolve());
    });

    let kioskInterruptedPayload: any = null;
    let doctorEscalationPayload: any = null;
    let doctorRedFlagPayload: any = null;

    kioskSocket.on(SOCKET_EVENTS.SERVER.QUESTIONNAIRE_INTERRUPTED, (payload) => {
      kioskInterruptedPayload = payload;
    });

    doctorSocket.on(SOCKET_EVENTS.SERVER.ESCALATION_REQUIRED, (payload) => {
      doctorEscalationPayload = payload;
    });

    doctorSocket.on(SOCKET_EVENTS.SERVER.RED_FLAG_DETECTED, (payload) => {
      doctorRedFlagPayload = payload;
    });

    // Step A: Patient reports initial chest discomfort (no red flags yet)
    kioskSocket.emit(SOCKET_EVENTS.CLIENT.PATIENT_EVENT_RECEIVED, {
      id: 'evt_sock_em_01',
      timestamp: new Date().toISOString(),
      sessionId: emergSessionId,
      source: 'KIOSK_TOUCHSCREEN',
      eventType: 'NEW_SYMPTOM_ADDED',
      payload: {
        symptomName: 'CHEST_DISCOMFORT',
        severity: 5,
        site: 'CHEST',
        onset: 'ACUTE'
      }
    });

    await new Promise((r) => setTimeout(r, 150));

    // Reset markers before sending critical event
    kioskInterruptedPayload = null;
    doctorEscalationPayload = null;

    // Step B: Touchscreen reveals Left Arm Radiation + Cold Sweating (ACS Red Flag)
    console.log('  -> Sending ACS red-flag symptom payload (Radiation to Left Arm + Sweating)...');
    kioskSocket.emit(SOCKET_EVENTS.CLIENT.PATIENT_EVENT_RECEIVED, {
      id: 'evt_sock_em_02',
      timestamp: new Date().toISOString(),
      sessionId: emergSessionId,
      source: 'KIOSK_TOUCHSCREEN',
      eventType: 'ASSOCIATED_SYMPTOM_DETECTED',
      payload: {
        symptomName: 'CHEST_DISCOMFORT',
        severity: 8,
        site: 'CHEST',
        onset: 'ACUTE',
        radiation: ['LEFT_ARM'],
        associatedSymptoms: ['SWEATING']
      }
    });

    await new Promise((r) => setTimeout(r, 250));

    if (
      kioskInterruptedPayload &&
      kioskInterruptedPayload.triageLevel === 'EMERGENCY' &&
      doctorEscalationPayload &&
      doctorEscalationPayload.triageLevel === 'EMERGENCY' &&
      doctorEscalationPayload.action === 'IMMEDIATE_DOCTOR_ALERT'
    ) {
      console.log('  \x1b[32m✔ PASS: Immediate Real-Time Interruption & Escalation Broadcast Verified!\x1b[0m');
      console.log(`    Kiosk received QUESTIONNAIRE_INTERRUPTED: "${kioskInterruptedPayload.reason.split('\n')[0]}"`);
      console.log(`    Doctor Dashboard received ESCALATION_REQUIRED for session "${doctorEscalationPayload.sessionId}"`);
      console.log(`    Triggered Rules: [${doctorEscalationPayload.triggeredRules.join(', ')}]`);
    } else {
      console.log('  \x1b[31m✘ FAIL: Emergency interruption payloads not received as expected.\x1b[0m');
      console.log('    Kiosk payload:', kioskInterruptedPayload);
      console.log('    Doctor payload:', doctorEscalationPayload);
      allPassed = false;
    }

    // ------------------------------------------------------------------------
    // SCENARIO 3: Reconnection & Session Synchronization
    // ------------------------------------------------------------------------
    console.log('\n[SCENARIO 3] Kiosk Disconnection & Reconnection Sync...');

    // Disconnect kiosk socket
    kioskSocket.disconnect();

    // Reconnect new socket
    const reconnectSocket = Client(serverUrl, { reconnectionDelay: 0, forceNew: true, transports: ['websocket'] });
    
    let syncPayload: any = null;
    await new Promise<void>((resolve) => {
      reconnectSocket.on('connect', () => {
        reconnectSocket.on(SOCKET_EVENTS.SERVER.SESSION_SYNC, (data) => {
          syncPayload = data;
          resolve();
        });
        reconnectSocket.emit(SOCKET_EVENTS.CLIENT.JOIN_SESSION, { sessionId: emergSessionId });
      });
    });

    if (
      syncPayload &&
      syncPayload.sessionId === emergSessionId &&
      syncPayload.latestTriage?.triageLevel === 'EMERGENCY'
    ) {
      console.log('  \x1b[32m✔ PASS: Reconnected Kiosk successfully synchronized latest triage state.\x1b[0m');
      console.log(`    Restored Triage Level: ${syncPayload.latestTriage.triageLevel}`);
      console.log(`    Restored Event Count: ${syncPayload.eventCount}`);
    } else {
      console.log('  \x1b[31m✘ FAIL: Reconnection sync failed.\x1b[0m');
      allPassed = false;
    }

    reconnectSocket.disconnect();

  } catch (error) {
    console.error('Socket integration test error:', error);
    allPassed = false;
  } finally {
    if (kioskSocket && kioskSocket.connected) kioskSocket.disconnect();
    if (doctorSocket && doctorSocket.connected) doctorSocket.disconnect();
    await server.stop();
  }

  return allPassed;
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  runSocketFlowTests().then((ok) => process.exit(ok ? 0 : 1));
}
