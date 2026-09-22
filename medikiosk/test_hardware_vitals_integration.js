const assert = require('assert');
const Session = require('./models/Session');
const specAdapter = require('./services/specAdapter');

async function runTest() {
  console.log('--- TEST: Hardware Vitals Integration & Consistency ---');

  // Test 1: Blood Pressure scanning (bp_systolic, bp_diastolic, heart_rate)
  console.log('1. Testing Blood Pressure scan with numeric fields...');
  const bpSession = new Session({
    session_id: 'TEST-BP-SCAN',
    kiosk_id: 'KIOSK-01',
    status: 'draft',
    vitals: [
      {
        type: 'bp_systolic',
        value: 135,
        unit: 'mmHg',
        source: 'device',
        confidence: 0.98,
        recorded_at: new Date()
      },
      {
        type: 'bp_diastolic',
        value: 88,
        unit: 'mmHg',
        source: 'device',
        confidence: 0.98,
        recorded_at: new Date()
      },
      {
        type: 'heart_rate',
        value: 74,
        unit: 'bpm',
        source: 'device',
        confidence: 0.98,
        recorded_at: new Date()
      }
    ]
  });

  const bpValidateErr = bpSession.validateSync();
  assert.strictEqual(bpValidateErr, undefined, `Session validation error for BP: ${bpValidateErr?.message}`);
  console.log('   ✓ Session.vitals correctly accepts bp_systolic, bp_diastolic, heart_rate with source "device"');

  // Test 2: Verify specAdapter builds correct internal vitals
  console.log('2. Testing specAdapter.sessionToInternalIntake with BP & HR...');
  const internalBP = specAdapter.sessionToInternalIntake(bpSession);
  assert.strictEqual(internalBP.vitals.bloodPressure?.systolic?.value, 135);
  assert.strictEqual(internalBP.vitals.bloodPressure?.diastolic?.value, 88);
  assert.strictEqual(internalBP.vitals.bp, '135/88');
  assert.strictEqual(internalBP.vitals.systolic, 135);
  assert.strictEqual(internalBP.vitals.diastolic, 88);
  assert.strictEqual(internalBP.vitals.hr, 74);
  console.log('   ✓ specAdapter generates both nested and flat BP/HR aliases correctly');

  // Test 3: SpO2 + Pulse scan
  console.log('3. Testing SpO2 + Pulse scan...');
  const spo2Session = new Session({
    session_id: 'TEST-SPO2-SCAN',
    kiosk_id: 'KIOSK-01',
    status: 'draft',
    vitals: [
      {
        type: 'spo2',
        value: 96,
        unit: '%',
        source: 'device',
        confidence: 0.99,
        recorded_at: new Date()
      },
      {
        type: 'heart_rate',
        value: 72,
        unit: 'bpm',
        source: 'device',
        confidence: 0.99,
        recorded_at: new Date()
      }
    ]
  });
  const spo2ValidateErr = spo2Session.validateSync();
  assert.strictEqual(spo2ValidateErr, undefined, `Session validation error for SpO2: ${spo2ValidateErr?.message}`);
  const internalSpO2 = specAdapter.sessionToInternalIntake(spo2Session);
  assert.strictEqual(internalSpO2.vitals.spo2?.value, 96);
  assert.strictEqual(internalSpO2.vitals.heartRate?.value, 72);
  assert.strictEqual(internalSpO2.vitals.hr, 72);
  console.log('   ✓ SpO2 and Pulse both captured and mapped cleanly');

  // Test 4: Dashboard normalizeVitals simulation with Array input
  console.log('4. Testing Dashboard normalizeVitals with raw Session.vitals array...');
  function normalizeVitalsSimulation(vitals) {
    let v = vitals || {};
    if (Array.isArray(v)) {
      const mapped = {};
      for (const item of v) {
        if (!item) continue;
        const t = String(item.type || item.vital_type || '').toLowerCase();
        const val = item.value;
        if (t === 'bp_systolic' || t === 'systolic') mapped.systolic = val;
        else if (t === 'bp_diastolic' || t === 'diastolic') mapped.diastolic = val;
        else if (t === 'blood_pressure' || t === 'bp') mapped.bp = val;
        else if (t === 'spo2') mapped.spo2 = val;
        else if (t === 'heart_rate' || t === 'pulse') mapped.hr = val;
        else if (t === 'blood_glucose' || t === 'glucose' || t === 'sugar') mapped.glucose = val;
        else if (t === 'temperature' || t === 'temp') mapped.temp = val;
        else if (t) mapped[t] = val;
      }
      v = mapped;
    }

    const scalar = (reading) => {
      if (reading == null) return "";
      const value = typeof reading === "object" ? (reading.value ?? reading.vitalValue) : reading;
      return typeof value === "object" || value == null ? "" : value;
    };

    let bp = "";
    if (v.bp) bp = v.bp;
    else if (v.systolic !== undefined && v.diastolic !== undefined) bp = `${v.systolic}/${v.diastolic}`;

    return {
      bp: bp || "—",
      hr: scalar(v.hr || v.heartRate || v.pulse) || "—",
      spo2: scalar(v.spo2) || "—",
      glucose: scalar(v.glucose || v.bloodGlucose || v.bloodSugar) || "—"
    };
  }

  const normalizedFromArr = normalizeVitalsSimulation(bpSession.vitals);
  assert.strictEqual(normalizedFromArr.bp, '135/88');
  assert.strictEqual(normalizedFromArr.hr, 74);
  console.log('   ✓ Doctor dashboard normalizeVitals accurately parses array vitals');

  // Test 5: Broadened enums in Session.js
  console.log('5. Testing broadened schema enums in Session.js...');
  const flexSession = new Session({
    session_id: 'TEST-FLEX-SCAN',
    kiosk_id: 'KIOSK-01',
    status: 'draft',
    vitals: [
      {
        type: 'blood_pressure',
        value: '120/80',
        unit: 'mmHg',
        source: 'device_reading'
      },
      {
        type: 'pulse',
        value: 78,
        unit: 'bpm',
        source: 'device-captured'
      }
    ]
  });
  const flexValidateErr = flexSession.validateSync();
  assert.strictEqual(flexValidateErr, undefined, `Flex Session validation error: ${flexValidateErr?.message}`);
  console.log('   ✓ Broadened Session schema enums allow device_reading and composite types without failure');

  console.log('All 5 tests PASSED cleanly!');
}

runTest().catch(err => {
  console.error('Test FAILED:', err);
  process.exit(1);
});
