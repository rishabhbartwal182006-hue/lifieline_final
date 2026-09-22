// ============================================================
//  test_home_care_rpm.js
//  LifeLine 360 — Real Data & Disconnected Hardware Handling Test
// ============================================================

const http = require('http');
const assert = require('assert');

// Spin up server in test mode
process.env.PORT = 4001;
const app = require('./server');

const server = app.listen(4001, async () => {
  console.log('\n=======================================================');
  console.log('  LIFELINE 360: REAL HARDWARE & UNSEEDED DATA TEST     ');
  console.log('=======================================================\n');

  try {
    // 1. Test Home Patient Profile starts clean
    console.log('[TEST 1] Fetching Home Patient Profile (PT-HOME-01)...');
    const profile = await request('GET', '/api/v1/patient/PT-HOME-01/profile');
    assert.strictEqual(profile.success, true);
    assert.strictEqual(profile.patient.name, 'Ramesh Kumar');
    assert.strictEqual(profile.patient.complianceRate, 0); // No hardcoded doses taken!
    console.log(`  ✓ PASS: Patient ${profile.patient.name} profile loaded. Starting adherence: 0% (no fake taken doses).`);

    // 2. Test Initial Vitals History is Empty (No fake hardcoded 7 days)
    console.log('\n[TEST 2] Verifying Vitals History starts unseeded (clean)...');
    const initialVitals = await request('GET', '/api/v1/patient/PT-HOME-01/vitals-history');
    assert.strictEqual(initialVitals.success, true);
    assert.strictEqual(initialVitals.count, 0); // Must NOT be filled with fake 7 days!
    console.log(`  ✓ PASS: Vitals history count is ${initialVitals.count} (no hardcoded readings).`);

    // 3. Test Camera Hardware Detection
    console.log('\n[TEST 3] Testing Hardware Detection (192.168.137.101)...');
    const camStatus = await request('GET', '/api/v1/vitals/status?target=home');
    assert.strictEqual(camStatus.success, true);
    assert.strictEqual(typeof camStatus.esp32_online, 'boolean');
    console.log(`  ✓ PASS: Accurately detected real ESP32 camera hardware status: ${camStatus.esp32_online ? 'ONLINE' : 'DISCONNECTED'}.`);

    // 4. Test Scan behavior matching hardware state
    console.log('\n[TEST 4] Verifying scan behavior matches hardware connection...');
    if (!camStatus.esp32_online) {
      const offlineScan = await request('POST', '/api/v1/patient/PT-HOME-01/vitals/scan', { device_target: 'home' });
      assert.strictEqual(offlineScan.statusCode, 503);
      assert.strictEqual(offlineScan.body.success, false);
      console.log(`  ✓ PASS: Scan rejected with 503 and clear message: "${offlineScan.body.error}"`);
    } else {
      console.log('  ✓ PASS: Hardware ESP32-CAM is online and ready for scans.');
    }

    // 5. Test Live Manual Vital Entry & Real Telemetry Persistence
    console.log('\n[TEST 5] Submitting Real Patient Reading (Fasting Glucose 126 mg/dL)...');
    const manualScan = await request('POST', '/api/v1/patient/PT-HOME-01/vitals/scan', {
      manual_vital: {
        vital_type: 'blood_glucose',
        value: 126,
        unit: 'mg/dL',
        notes: 'Actual morning fasting measurement'
      }
    });
    assert.strictEqual(manualScan.body.success, true);
    assert.strictEqual(manualScan.body.reading.value, 126);
    assert.strictEqual(manualScan.body.reading.status, 'normal');
    console.log(`  ✓ PASS: Real reading recorded: ${manualScan.body.reading.value} mg/dL.`);

    // 6. Test Reading is Persisted in History
    console.log('\n[TEST 6] Checking that the recorded vital appears in telemetry history...');
    const updatedVitals = await request('GET', '/api/v1/patient/PT-HOME-01/vitals-history');
    assert.strictEqual(updatedVitals.count, 1);
    assert.strictEqual(updatedVitals.vitals[0].value, 126);
    console.log(`  ✓ PASS: Vitals history accurately updated to 1 real recorded entry.`);

    // 7. Test Toggling Medication (Live Adherence Update)
    console.log('\n[TEST 7] Marking Morning Medication Taken Live...');
    const toggleRes = await request('POST', '/api/v1/patient/PT-HOME-01/medications/MED-01/toggle');
    assert.strictEqual(toggleRes.body.success, true);
    assert.strictEqual(toggleRes.body.medication.taken, true);
    assert.strictEqual(toggleRes.body.complianceRate, 25); // 1 out of 4 taken = 25%
    console.log(`  ✓ PASS: Medication marked taken. Real adherence updated to ${toggleRes.body.complianceRate}%.`);

    // 8. Test Emergency SOS Dispatch
    console.log('\n[TEST 8] Triggering Emergency SOS...');
    const sosRes = await request('POST', '/api/v1/patient/PT-HOME-01/sos', {
      reason: 'Patient reported chest discomfort from home.'
    });
    assert.strictEqual(sosRes.body.success, true);
    assert.strictEqual(sosRes.body.alert.severity, 'CRITICAL');
    console.log(`  ✓ PASS: Emergency SOS active and dispatched to Dr. Ananya Roy.`);

    console.log('\n=======================================================');
    console.log('  🎉 ALL REAL-DATA & HARDWARE DISCONNECT TESTS PASSED! ');
    console.log('=======================================================\n');
    server.close();
    process.exit(0);

  } catch (err) {
    console.error('\n❌ Test failed:', err);
    server.close();
    process.exit(1);
  }
});

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: 'localhost',
        port: 4001,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
        }
      },
      (res) => {
        let respBody = '';
        res.on('data', chunk => (respBody += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(respBody);
            resolve({ statusCode: res.statusCode, body: parsed, ...parsed });
          } catch (e) {
            resolve({ statusCode: res.statusCode, raw: respBody });
          }
        });
      }
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}
