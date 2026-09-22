/**
 * Altitude MVP — End-to-End FHIR Smoke Test
 * Validates the 10-step sequence without bypassing write-lock or using shortcuts.
 */

const http = require('http');
const app = require('./server');

const PORT = 4010;
let server = null;

function request(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve({ status: res.statusCode, headers: res.headers, body: json });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, rawBody: body });
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runSmokeTest() {
  console.log('=======================================================');
  console.log('  ALTITUDE MVP — FHIR SMOKE TEST (10 STEPS)            ');
  console.log('=======================================================\n');

  server = app.listen(PORT);
  await new Promise(r => setTimeout(r, 600));

  const steps = [];
  function recordStep(num, name, passed, details = '') {
    steps.push({ num, name, passed, details });
    const mark = passed ? '✓ PASS' : '✗ FAIL';
    console.log(`[STEP ${num}] [${mark}] ${name}${details ? ' - ' + details : ''}`);
  }

  let sessionId = null;
  let hprToken = null;

  try {
    // STEP 1: POST /api/v1/sessions
    const s1Res = await request({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/v1/sessions',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      kiosk_id: 'KIOSK-HIGH-ALT-01',
      facility_id: 'FACILITY-LEH-2600M',
      language: 'en',
      input_mode: 'touch',
      patient: { name: 'Tenzin Norbu', age: 42, gender: 'male' }
    });

    if (s1Res.status === 201 && s1Res.body?.session_id) {
      sessionId = s1Res.body.session_id;
      recordStep(1, 'POST /api/v1/sessions', true, `Session ID: ${sessionId}`);
    } else {
      recordStep(1, 'POST /api/v1/sessions', false, `Status ${s1Res.status}`);
      throw new Error('Step 1 failed');
    }

    // STEP 2: POST /api/v1/sessions/:id/environment (2600 m, facility_config)
    const s2Res = await request({
      hostname: '127.0.0.1',
      port: PORT,
      path: `/api/v1/sessions/${sessionId}/environment`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      altitudeMeters: 2600,
      altitudeFeet: 8530,
      altitudeSource: 'facility_config',
      altitudeConfidence: 1.0,
      timeAtAltitudeHours: 2,
      residenceAltitudeMeters: 200,
      acclimatizationStatus: 'unacclimatized'
    });

    if (s2Res.status === 200 && s2Res.body?.environment?.altitudeMeters === 2600) {
      recordStep(2, 'POST /api/v1/sessions/:id/environment', true, '2600m facility_config applied');
    } else {
      recordStep(2, 'POST /api/v1/sessions/:id/environment', false, `Status ${s2Res.status}`);
    }

    // STEP 3: POST existing vitals route (BP 120/80, SpO2 88, HR 110, glucose 110)
    const vitalsPayload = [
      { type: 'bp_systolic', value: 120, unit: 'mmHg' },
      { type: 'bp_diastolic', value: 80, unit: 'mmHg' },
      { type: 'spo2', value: 88, unit: '%' },
      { type: 'heart_rate', value: 110, unit: 'bpm' },
      { type: 'blood_glucose', value: 110, unit: 'mg/dL' }
    ];

    const s3Res = await request({
      hostname: '127.0.0.1',
      port: PORT,
      path: `/api/v1/sessions/${sessionId}/vitals`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, vitalsPayload);

    if (s3Res.status === 201) {
      recordStep(3, 'POST /api/v1/sessions/:id/vitals', true, '5 vitals ingested (BP, SpO2, HR, Glucose)');
    } else {
      recordStep(3, 'POST /api/v1/sessions/:id/vitals', false, `Status ${s3Res.status}`);
    }

    // STEP 4: GET /api/v1/sessions/:id/vitals/interpreted
    const s4Res = await request({
      hostname: '127.0.0.1',
      port: PORT,
      path: `/api/v1/sessions/${sessionId}/vitals/interpreted`,
      method: 'GET'
    });

    if (s4Res.status === 200 && Array.isArray(s4Res.body?.interpretedVitals)) {
      const spo2 = s4Res.body.interpretedVitals.find(v => v.type === 'spo2');
      const glucose = s4Res.body.interpretedVitals.find(v => v.type === 'blood_glucose');
      const hasCaution = glucose && glucose.status === 'caution' && glucose.cautionNote;
      recordStep(4, 'GET /api/v1/sessions/:id/vitals/interpreted', true, `SpO2 status: ${spo2?.status}, Glucose caution: ${!!hasCaution}`);
    } else {
      recordStep(4, 'GET /api/v1/sessions/:id/vitals/interpreted', false, `Status ${s4Res.status}`);
    }

    // STEP 5: GET /api/v1/sessions/:id/red-flags
    const s5Res = await request({
      hostname: '127.0.0.1',
      port: PORT,
      path: `/api/v1/sessions/${sessionId}/red-flags`,
      method: 'GET'
    });

    if (s5Res.status === 200 && Array.isArray(s5Res.body)) {
      recordStep(5, 'GET /api/v1/sessions/:id/red-flags', true, `Flags count: ${s5Res.body.length}`);
    } else {
      recordStep(5, 'GET /api/v1/sessions/:id/red-flags', false, `Status ${s5Res.status}`);
    }

    // STEP 6: POST /api/v1/hpr/login (HPR bearer token)
    const s6Res = await request({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/v1/hpr/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      hprId: 'HPR-IN-9876543210',
      doctorName: 'Dr. Ananya Roy, MD',
      registrationNumber: 'KMC-2016-99381',
      role: 'DOCTOR'
    });

    if (s6Res.status === 200 && s6Res.body?.data?.hprToken) {
      hprToken = s6Res.body.data.hprToken;
      recordStep(6, 'POST /api/v1/hpr/login', true, `Token issued for ${s6Res.body.data.doctorName}`);
    } else {
      recordStep(6, 'POST /api/v1/hpr/login', false, `Status ${s6Res.status}`);
    }

    // STEP 7: POST /api/v1/sessions/:id/staff-verification
    const s7Res = await request({
      hostname: '127.0.0.1',
      port: PORT,
      path: `/api/v1/sessions/${sessionId}/staff-verification`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${hprToken}`
      }
    }, {
      staff_hpr_id: 'HPR-IN-9876543210',
      verification_method: 'hpr_credential_login',
      doctor_notes: 'Verified altitude vitals, patient stable.'
    });

    if (s7Res.status === 200 && s7Res.body?.verified === true) {
      recordStep(7, 'POST /api/v1/sessions/:id/staff-verification', true, 'Staff verified and write-lock satisfied');
    } else {
      recordStep(7, 'POST /api/v1/sessions/:id/staff-verification', false, `Status ${s7Res.status}`);
    }

    // STEP 8: POST /api/v1/sessions/:id/fhir-sync
    const s8Res = await request({
      hostname: '127.0.0.1',
      port: PORT,
      path: `/api/v1/sessions/${sessionId}/fhir-sync`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${hprToken}`
      }
    });

    if (s8Res.status === 202) {
      recordStep(8, 'POST /api/v1/sessions/:id/fhir-sync', true, 'Synced to FHIR ABDM pipeline');
    } else {
      recordStep(8, 'POST /api/v1/sessions/:id/fhir-sync', false, `Status ${s8Res.status}`);
    }

    // STEP 9: GET /api/v1/clinical/fhir/bundle/:intakeId (must now return 200)
    const s9Res = await request({
      hostname: '127.0.0.1',
      port: PORT,
      path: `/api/v1/clinical/fhir/bundle/${sessionId}`,
      method: 'GET'
    });

    if (s9Res.status === 200 && (s9Res.body?.resourceType === 'Bundle' || s9Res.rawBody?.includes('resourceType'))) {
      const entryCount = s9Res.body?.entry?.length || 0;
      recordStep(9, 'GET /api/v1/clinical/fhir/bundle/:intakeId', true, `HTTP 200 returned, entries: ${entryCount}`);
    } else {
      recordStep(9, 'GET /api/v1/clinical/fhir/bundle/:intakeId', false, `Status ${s9Res.status}`);
    }

    // STEP 10: GET audit endpoint for this session (confirm ALTITUDE_CONTEXT_APPLIED)
    const s10Res = await request({
      hostname: '127.0.0.1',
      port: PORT,
      path: `/api/v1/clinical/session/${sessionId}/audit`,
      method: 'GET'
    });

    const hasAltContext = s10Res.status === 200 && (s10Res.body?.auditTrail || []).some(
      a => a.eventType === 'ALTITUDE_CONTEXT_APPLIED' || a.action === 'ALTITUDE_CONTEXT_APPLIED'
    );

    // Also test by sessionId via sessionRoutes /sessions/:sessionId/audit
    const s10AltRes = await request({
      hostname: '127.0.0.1',
      port: PORT,
      path: `/api/v1/sessions/${sessionId}/audit`,
      method: 'GET'
    });

    const hasAltContextAlt = s10AltRes.status === 200 && (s10AltRes.body?.auditTrail || []).some(
      a => a.eventType === 'ALTITUDE_CONTEXT_APPLIED' || a.action === 'ALTITUDE_CONTEXT_APPLIED'
    );

    if (hasAltContext && hasAltContextAlt) {
      recordStep(10, 'GET audit endpoint for this session', true, 'ALTITUDE_CONTEXT_APPLIED confirmed across both endpoints');
    } else if (hasAltContext) {
      recordStep(10, 'GET audit endpoint for this session', true, 'ALTITUDE_CONTEXT_APPLIED confirmed');
    } else {
      recordStep(10, 'GET audit endpoint for this session', false, `Status ${s10Res.status}`);
    }

  } catch (err) {
    console.error('Smoke test runtime error:', err);
  } finally {
    if (server) server.close();
    const passedCount = steps.filter(s => s.passed).length;
    console.log('\n=======================================================');
    console.log(`  SMOKE TEST SUMMARY: ${passedCount} / ${steps.length} STEPS PASSED`);
    console.log('=======================================================\n');
    process.exit(passedCount === 10 ? 0 : 1);
  }
}

runSmokeTest();
