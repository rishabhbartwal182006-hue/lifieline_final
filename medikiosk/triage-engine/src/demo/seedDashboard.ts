import { getSession } from '../engine/sessionState.js';
import { processPatientEvent } from '../engine/index.js';
import { saveSessionSnapshot, listAllSessions } from '../persistence/sessionRepository.js';

/**
 * Pre-populates the persistence layer with mock historical patient encounters
 * for Doctor Dashboard queue display.
 */
export async function seedDashboard(): Promise<void> {
  console.log('\n🌱 Seeding Doctor Dashboard with historical patient encounters...');

  // Encounter 1: Routine Follow-up
  const p1 = 'ABHA_8812_ROUTINE_1';
  const sess1 = 'kiosk_sess_seed_01';
  processPatientEvent({
    id: 'seed_evt_1_1',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    sessionId: sess1,
    patientId: p1,
    source: 'KIOSK_TOUCHSCREEN',
    eventType: 'NEW_SYMPTOM_ADDED',
    payload: {
      symptomName: 'MILD_SEASONAL_ALLERGIES',
      severity: 2,
      site: 'EARS_NOSE_THROAT',
      onset: 'CHRONIC'
    }
  });
  const s1 = getSession(sess1);
  if (s1) await saveSessionSnapshot(s1, 'TRIAGED');

  // Encounter 2: Urgent Tachycardia Patient
  const p2 = 'ABHA_7721_URGENT_1';
  const sess2 = 'kiosk_sess_seed_02';
  processPatientEvent({
    id: 'seed_evt_2_1',
    timestamp: new Date(Date.now() - 1800000).toISOString(),
    sessionId: sess2,
    patientId: p2,
    source: 'HARDWARE_DAEMON',
    eventType: 'NEW_VITAL_READING',
    payload: {
      vitalType: 'HEART_RATE',
      value: 154,
      unit: 'bpm',
      deviceSource: 'BLE_PULSE_OXIMETER'
    }
  });
  const s2 = getSession(sess2);
  if (s2) await saveSessionSnapshot(s2, 'TRIAGED');

  // Encounter 3: Routine Minor Ailment
  const p3 = 'ABHA_3391_ROUTINE_2';
  const sess3 = 'kiosk_sess_seed_03';
  processPatientEvent({
    id: 'seed_evt_3_1',
    timestamp: new Date(Date.now() - 900000).toISOString(),
    sessionId: sess3,
    patientId: p3,
    source: 'KIOSK_TOUCHSCREEN',
    eventType: 'NEW_SYMPTOM_ADDED',
    payload: {
      symptomName: 'SKIN_RASH_LOCALIZED',
      severity: 3,
      site: 'LEFT_ARM',
      onset: 'ACUTE'
    }
  });
  const s3 = getSession(sess3);
  if (s3) await saveSessionSnapshot(s3, 'TRIAGED');

  const all = await listAllSessions();
  console.log(`✅ Seeded ${all.length} patient encounters into repository:`);
  for (const s of all) {
    console.log(`   • [${s.triageResult?.triageLevel ?? 'PENDING'}] ${s.sessionId} (Patient: ${s.patientId ?? 'Anonymous'})`);
  }
}

if (import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, '/')}`) {
  seedDashboard().then(() => process.exit(0));
}
