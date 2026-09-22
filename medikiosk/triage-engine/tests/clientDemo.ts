import { io as Client } from 'socket.io-client';
import { createServerInstance } from '../src/server/httpServer.js';
import { SOCKET_EVENTS } from '../src/events/socketEvents.js';

async function runDemo(): Promise<void> {
  const PORT = 4000;
  const server = createServerInstance();
  await server.start(PORT);

  const serverUrl = `http://localhost:${PORT}`;
  console.log('\n======================================================================');
  console.log('🩺 MEDIKIOSK REAL-TIME CLIENT DEMO (SOCKET.IO)');
  console.log('======================================================================\n');

  // Doctor Dashboard Client
  const doctorSocket = Client(serverUrl, { transports: ['websocket'] });
  doctorSocket.on('connect', () => {
    console.log('👨‍⚕️ [Doctor Dashboard] Connected -> Joining "dashboard" room');
    doctorSocket.emit(SOCKET_EVENTS.CLIENT.JOIN_DASHBOARD);
  });

  doctorSocket.on(SOCKET_EVENTS.SERVER.TRIAGE_UPDATED, (payload) => {
    console.log(`\n👨‍⚕️ [Doctor Dashboard] 📋 TRIAGE_UPDATED: Session "${payload.sessionId}" -> [${payload.triageResult.triageLevel}] (Action: ${payload.triageResult.action})`);
  });

  doctorSocket.on(SOCKET_EVENTS.SERVER.RED_FLAG_DETECTED, (payload) => {
    console.log(`\n👨‍⚕️ [Doctor Dashboard] ⚠️ RED_FLAG_DETECTED: Priority changed from ${payload.previousLevel} to ${payload.currentLevel}!`);
  });

  doctorSocket.on(SOCKET_EVENTS.SERVER.ESCALATION_REQUIRED, (payload) => {
    console.log(`\n🚨🚨🚨 [Doctor Dashboard] CRITICAL ALERT: ESCALATION_REQUIRED 🚨🚨🚨`);
    console.log(`  Patient / Session: ${payload.sessionId}`);
    console.log(`  Level: ${payload.triageLevel}`);
    console.log(`  Action: ${payload.action}`);
    console.log(`  Triggered Rules: ${payload.triggeredRules.join(', ')}`);
    console.log(`  Reason:\n  ${payload.reason.replace(/\n/g, '\n  ')}`);
    console.log(`----------------------------------------------------------------------`);
  });

  // Kiosk Patient Client
  const kioskSessionId = 'kiosk_patient_encounter_999';
  const kioskSocket = Client(serverUrl, { transports: ['websocket'] });

  kioskSocket.on('connect', () => {
    console.log(`🖥️  [Kiosk UI] Connected -> Joining session "${kioskSessionId}"`);
    kioskSocket.emit(SOCKET_EVENTS.CLIENT.JOIN_SESSION, { sessionId: kioskSessionId });
  });

  kioskSocket.on(SOCKET_EVENTS.SERVER.NEXT_QUESTION, (payload) => {
    if (payload.question) {
      console.log(`\n🖥️  [Kiosk UI] ❓ NEXT_QUESTION (Step ${payload.progress.currentStep}/${payload.progress.totalEstimatedSteps}):`);
      console.log(`    "${payload.question.questionText}" [${payload.question.questionType}]`);
      if (payload.question.options) {
        console.log(`    Options:`, payload.question.options.map((o: any) => o.label).join(' | '));
      }
    }
  });

  kioskSocket.on(SOCKET_EVENTS.SERVER.QUESTIONNAIRE_INTERRUPTED, (payload) => {
    console.log(`\n🛑 [Kiosk UI] ⚡ QUESTIONNAIRE_INTERRUPTED!`);
    console.log(`    Clinical Priority: ${payload.triageLevel}`);
    console.log(`    Action: ${payload.action}`);
    console.log(`    Message: "Please remain seated at the kiosk. Medical staff have been notified for immediate review."`);
  });

  await new Promise((r) => setTimeout(r, 600));

  // Step 1: Initial symptom selection
  console.log('\n--- Step 1: Patient taps "Chest Discomfort" (Severity 6) on Touchscreen ---');
  kioskSocket.emit(SOCKET_EVENTS.CLIENT.PATIENT_EVENT_RECEIVED, {
    id: 'evt_demo_01',
    timestamp: new Date().toISOString(),
    sessionId: kioskSessionId,
    source: 'KIOSK_TOUCHSCREEN',
    eventType: 'NEW_SYMPTOM_ADDED',
    payload: {
      symptomName: 'CHEST_DISCOMFORT',
      severity: 6,
      site: 'CHEST',
      onset: 'ACUTE'
    }
  });

  await new Promise((r) => setTimeout(r, 800));

  // Step 2: Vital reading from peripheral
  console.log('\n--- Step 2: Kiosk BP Sensor Records Blood Pressure (122/78 mmHg) ---');
  kioskSocket.emit(SOCKET_EVENTS.CLIENT.VITAL_UPDATED, {
    id: 'evt_demo_02',
    timestamp: new Date().toISOString(),
    sessionId: kioskSessionId,
    source: 'HARDWARE_DAEMON',
    eventType: 'NEW_VITAL_READING',
    payload: {
      vitalType: 'BLOOD_PRESSURE',
      value: { systolic: 122, diastolic: 78 },
      unit: 'mmHg',
      deviceSource: 'BLE_BP_CUFF'
    }
  });

  await new Promise((r) => setTimeout(r, 800));

  // Step 3: ACS red flag symptom detection
  console.log('\n--- Step 3: Patient checks "Left Arm Radiation" & "Cold Sweating" ---');
  kioskSocket.emit(SOCKET_EVENTS.CLIENT.PATIENT_EVENT_RECEIVED, {
    id: 'evt_demo_03',
    timestamp: new Date().toISOString(),
    sessionId: kioskSessionId,
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

  await new Promise((r) => setTimeout(r, 1200));

  console.log('\n======================================================================');
  console.log('✅ DEMO RUN COMPLETE: Sockets cleanly disconnected.');
  console.log('======================================================================\n');

  kioskSocket.disconnect();
  doctorSocket.disconnect();
  await server.stop();
}

runDemo();
