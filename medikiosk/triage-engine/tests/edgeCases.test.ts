/**
 * ============================================================================
 * EDGE CASE & ROBUSTNESS TEST SUITE
 * ============================================================================
 * Tests critical edge cases and stress conditions:
 * 1. Rapid-fire synchronous/asynchronous events (race-condition resistance).
 * 2. Conflicting / updated symptom reports (deduplication & in-place update).
 * 3. Mid-session socket disconnect & reconnection state restoration.
 * 4. Malformed / garbage event injection mid-session (fail-safe guarding).
 * 5. Concurrent multi-patient session isolation (zero cross-contamination).
 */

import { io as Client } from 'socket.io-client';
import { processPatientEvent, clearAllSessions, getSession, getLatestTriage } from '../src/engine/index.js';
import { createServerInstance, ServerInstance } from '../src/server/httpServer.js';
import { SOCKET_EVENTS } from '../src/events/socketEvents.js';

export async function runEdgeCaseTests(): Promise<boolean> {
  console.log('\n======================================================================');
  console.log('🛡️  TEST SUITE: EDGE CASES & STRESS HARDENING');
  console.log('======================================================================\n');

  clearAllSessions();
  let allPassed = true;

  // --------------------------------------------------------------------------
  // EDGE CASE 1: Rapid-Fire Events (Concurrency / Millisecond Burst)
  // --------------------------------------------------------------------------
  console.log('[EDGE CASE 1] Rapid-Fire Events (Burst of 10 events within milliseconds)...');
  const rapidSessionId = 'kiosk_edge_rapid_001';

  const rapidEvents = Array.from({ length: 10 }).map((_, i) => ({
    id: `evt_rapid_${i}`,
    timestamp: new Date().toISOString(),
    sessionId: rapidSessionId,
    source: 'HARDWARE_DAEMON' as const,
    eventType: 'NEW_VITAL_READING' as const,
    payload: {
      vitalType: 'HEART_RATE' as const,
      value: 70 + i, // HR goes from 70 to 79
      unit: 'bpm' as const,
      deviceSource: 'BLE_PULSE_OXIMETER' as const
    }
  }));

  // Fire all events concurrently
  const rapidResults = rapidEvents.map((evt) => processPatientEvent(evt));

  const rapidSession = getSession(rapidSessionId);
  const finalHR = rapidSession?.vitals.HEART_RATE?.value;

  console.log(`  Processed ${rapidResults.length} rapid events.`);
  console.log(`  Accumulated Event Count: ${rapidSession?.eventCount}`);
  console.log(`  Final Recorded HR: ${finalHR} bpm`);

  if (rapidSession?.eventCount === 10 && finalHR === 79) {
    console.log('  \x1b[32m✔ PASS: Rapid-fire burst processed with zero state corruption.\x1b[0m');
  } else {
    console.log('  \x1b[31m✘ FAIL: Rapid-fire events corrupted session state.\x1b[0m');
    allPassed = false;
  }

  // --------------------------------------------------------------------------
  // EDGE CASE 2: Conflicting / Updated Symptom Reports (In-Place Update)
  // --------------------------------------------------------------------------
  console.log('\n[EDGE CASE 2] Conflicting Symptom Updates (Patient updates severity 3 -> 9)...');
  const updateSessionId = 'kiosk_edge_update_002';

  // Step 1: Initial mild headache (severity 3)
  processPatientEvent({
    id: 'evt_upd_01',
    timestamp: new Date().toISOString(),
    sessionId: updateSessionId,
    source: 'KIOSK_TOUCHSCREEN',
    eventType: 'NEW_SYMPTOM_ADDED',
    payload: {
      symptomName: 'HEADACHE',
      severity: 3,
      site: 'HEAD',
      onset: 'GRADUAL_SUBACUTE'
    }
  });

  const sessionStep1 = getSession(updateSessionId);
  const symptomCount1 = sessionStep1?.symptoms.list.length;

  // Step 2: Patient corrects severity to severe (9)
  const resultStep2 = processPatientEvent({
    id: 'evt_upd_02',
    timestamp: new Date().toISOString(),
    sessionId: updateSessionId,
    source: 'KIOSK_TOUCHSCREEN',
    eventType: 'SYMPTOM_SEVERITY_UPDATED',
    payload: {
      symptomName: 'HEADACHE',
      severity: 9,
      site: 'HEAD',
      onset: 'GRADUAL_SUBACUTE'
    }
  });

  const sessionStep2 = getSession(updateSessionId);
  const symptomCount2 = sessionStep2?.symptoms.list.length;
  const updatedSeverity = sessionStep2?.symptoms.primary?.severity;

  console.log(`  Symptom Count Step 1: ${symptomCount1} | Step 2: ${symptomCount2}`);
  console.log(`  Updated Primary Severity: ${updatedSeverity}/10`);
  console.log(`  New Triage Level: ${resultStep2.triageLevel} (Triggered: ${resultStep2.triggeredRules.join(', ')})`);

  if (symptomCount2 === 1 && updatedSeverity === 9 && resultStep2.triageLevel === 'URGENT') {
    console.log('  \x1b[32m✔ PASS: Symptom updated in-place without duplication and triggered priority escalation.\x1b[0m');
  } else {
    console.log('  \x1b[31m✘ FAIL: Duplicate symptom entries or failure to update severity.\x1b[0m');
    allPassed = false;
  }

  // --------------------------------------------------------------------------
  // EDGE CASE 3: Malformed / Garbage Event Ingestion Mid-Session
  // --------------------------------------------------------------------------
  console.log('\n[EDGE CASE 3] Malformed Event Rejection Mid-Session...');
  const garbageSessionId = 'kiosk_edge_garbage_003';

  // Valid Event 1
  processPatientEvent({
    id: 'evt_valid_01',
    timestamp: new Date().toISOString(),
    sessionId: garbageSessionId,
    source: 'KIOSK_TOUCHSCREEN',
    eventType: 'NEW_SYMPTOM_ADDED',
    payload: {
      symptomName: 'SORE_THROAT',
      severity: 2,
      site: 'NECK',
      onset: 'ACUTE'
    }
  });

  // Invalid Event 2 (Missing required payload field + wrong type)
  let caughtError = false;
  try {
    processPatientEvent({
      id: 'evt_invalid_02',
      timestamp: 'invalid-date',
      sessionId: garbageSessionId,
      eventType: 'NEW_VITAL_READING',
      payload: {
        vitalType: 'HEART_RATE',
        value: 'NOT_A_NUMBER' // Invalid!
      }
    });
  } catch (err: any) {
    caughtError = true;
    console.log(`  Captured Expected Validation Error: "${err.message.substring(0, 80)}..."`);
  }

  const sessionAfterGarbage = getSession(garbageSessionId);
  console.log(`  Session Event Count (Should remain 1): ${sessionAfterGarbage?.eventCount}`);

  if (caughtError && sessionAfterGarbage?.eventCount === 1) {
    console.log('  \x1b[32m✔ PASS: Malformed event safely rejected without corrupting active encounter.\x1b[0m');
  } else {
    console.log('  \x1b[31m✘ FAIL: Malformed event was not properly rejected.\x1b[0m');
    allPassed = false;
  }

  // --------------------------------------------------------------------------
  // EDGE CASE 4: Concurrent Multi-Patient Isolation (Zero Cross-Talk)
  // --------------------------------------------------------------------------
  console.log('\n[EDGE CASE 4] Multi-Patient Session Isolation...');
  const patientA = 'kiosk_patient_alpha';
  const patientB = 'kiosk_patient_beta';

  // Patient A: Critical Hypoxemia (SpO2 = 85%) -> EMERGENCY
  processPatientEvent({
    id: 'evt_a_01',
    timestamp: new Date().toISOString(),
    sessionId: patientA,
    source: 'HARDWARE_DAEMON',
    eventType: 'NEW_VITAL_READING',
    payload: {
      vitalType: 'SPO2',
      value: 85,
      unit: '%',
      deviceSource: 'BLE_PULSE_OXIMETER'
    }
  });

  // Patient B: Normal Mild Sprain -> ROUTINE
  processPatientEvent({
    id: 'evt_b_01',
    timestamp: new Date().toISOString(),
    sessionId: patientB,
    source: 'KIOSK_TOUCHSCREEN',
    eventType: 'NEW_SYMPTOM_ADDED',
    payload: {
      symptomName: 'ANKLE_SPRAIN',
      severity: 3,
      site: 'LEFT_LEG',
      onset: 'ACUTE'
    }
  });

  const triageA = getLatestTriage(patientA);
  const triageB = getLatestTriage(patientB);

  console.log(`  Patient Alpha Triage: ${triageA?.triageLevel}`);
  console.log(`  Patient Beta Triage: ${triageB?.triageLevel}`);

  if (triageA?.triageLevel === 'EMERGENCY' && triageB?.triageLevel === 'ROUTINE') {
    console.log('  \x1b[32m✔ PASS: Strict isolation maintained between concurrent patient encounters.\x1b[0m');
  } else {
    console.log('  \x1b[31m✘ FAIL: Cross-contamination detected between patient sessions.\x1b[0m');
    allPassed = false;
  }

  // --------------------------------------------------------------------------
  // EDGE CASE 5: Socket Mid-Session Reconnection State Recovery
  // --------------------------------------------------------------------------
  console.log('\n[EDGE CASE 5] Socket Mid-Session Reconnect & State Recovery...');
  const TEST_PORT = 5088;
  const server: ServerInstance = createServerInstance();
  await server.start(TEST_PORT);

  const serverUrl = `http://localhost:${TEST_PORT}`;
  const reconnectSessId = 'kiosk_edge_reconnect_005';

  // 1. Initial connect & ingest event
  const sock1 = Client(serverUrl, { transports: ['websocket'] });
  await new Promise<void>((resolve) => {
    sock1.on('connect', () => {
      sock1.emit(SOCKET_EVENTS.CLIENT.JOIN_SESSION, { sessionId: reconnectSessId });
      sock1.emit(SOCKET_EVENTS.CLIENT.PATIENT_EVENT_RECEIVED, {
        id: 'evt_recon_01',
        timestamp: new Date().toISOString(),
        sessionId: reconnectSessId,
        source: 'KIOSK_TOUCHSCREEN',
        eventType: 'NEW_SYMPTOM_ADDED',
        payload: {
          symptomName: 'BACK_PAIN',
          severity: 9, // Triggers URGENT
          site: 'BACK_LOWER',
          onset: 'ACUTE'
        }
      });
      setTimeout(resolve, 200);
    });
  });

  // 2. Disconnect socket 1 abruptly
  sock1.disconnect();

  // 3. Connect socket 2 simulating kiosk reboot/reconnect
  const sock2 = Client(serverUrl, { transports: ['websocket'] });
  let recoveredSync: any = null;

  await new Promise<void>((resolve) => {
    sock2.on('connect', () => {
      sock2.on(SOCKET_EVENTS.SERVER.SESSION_SYNC, (data) => {
        recoveredSync = data;
        resolve();
      });
      sock2.emit(SOCKET_EVENTS.CLIENT.JOIN_SESSION, { sessionId: reconnectSessId });
    });
  });

  console.log(`  Recovered Triage Level on Reconnect: ${recoveredSync?.latestTriage?.triageLevel}`);
  console.log(`  Recovered Event Count: ${recoveredSync?.eventCount}`);

  if (
    recoveredSync &&
    recoveredSync.sessionId === reconnectSessId &&
    recoveredSync.latestTriage?.triageLevel === 'URGENT' &&
    recoveredSync.eventCount === 1
  ) {
    console.log('  \x1b[32m✔ PASS: Reconnected socket cleanly recovered entire session state.\x1b[0m');
  } else {
    console.log('  \x1b[31m✘ FAIL: Reconnect state recovery failed.\x1b[0m');
    allPassed = false;
  }

  sock2.disconnect();
  await server.stop();

  return allPassed;
}

if (import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, '/')}`) {
  runEdgeCaseTests().then((ok) => process.exit(ok ? 0 : 1));
}
