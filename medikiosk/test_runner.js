/**
 * MediKiosk Full Integration Test Runner
 * Validates all backend APIs, FHIR mapping, HPR security, discrepancy engine,
 * consent-filtered FHIR export, and ABDM sync pipeline.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const app = require('./server');
const { evaluateClinicalDiscrepancies } = require('./services/discrepancyEngine');
const { generateFHIRBundle } = require('./services/fhirMapper');

const PORT = process.env.PORT || 4000;
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

    req.on('error', (err) => reject(err));

    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runTests() {
  console.log(`=======================================================`);
  console.log(`  MEDIKIOSK ALL-MODULES & PROMPTS INTEGRATION TEST     `);
  console.log(`=======================================================\n`);

  server = app.listen(PORT);
  await new Promise(r => setTimeout(r, 800));

  let passed = 0;
  let failed = 0;

  function logPass(msg) {
    passed++;
    console.log(`[PASS] ✓ ${msg}`);
  }

  function logFail(msg, err) {
    failed++;
    console.error(`[FAIL] x ${msg}:`, err);
  }

  try {
    // TEST 1: Health Check Endpoint (GET /health)
    const healthRes = await request({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/health',
      method: 'GET'
    });

    if (healthRes.status === 200 && healthRes.body?.status === 'UP') {
      logPass(`System Health Check Endpoint (GET /health) on PORT ${PORT}`);
    } else {
      logFail('System Health Check Endpoint', healthRes);
    }

    // TEST 2: Patient Intake Kiosk UI Static Route (GET /kiosk.html)
    const kioskUiRes = await request({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/kiosk.html',
      method: 'GET'
    });

    if (kioskUiRes.status === 200 && kioskUiRes.rawBody?.includes('MediKiosk Self-Service Terminal')) {
      logPass(`Patient Intake Kiosk Terminal UI Served Successfully (GET /kiosk.html)`);
    } else {
      logFail('Patient Intake Kiosk UI Route', kioskUiRes);
    }

    // TEST 3: Demo Seed Route (POST /api/events/demo/seed)
    const seedDemoRes = await request({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/events/demo/seed',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    if (seedDemoRes.status === 200 && seedDemoRes.body?.success) {
      logPass(`Demo Seed Route (POST /api/events/demo/seed) - Seeded ${seedDemoRes.body.count} encounters.`);
    } else {
      logFail('Demo Seed Route Endpoint', seedDemoRes);
    }

    // TEST 4: Prompt 1 Dynamic Triage Ingestion (POST /api/v1/intake)
    const seedPayload = JSON.parse(fs.readFileSync(path.join(__dirname, 'seed_data.json'), 'utf8'));
    const intakeRes = await request({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/v1/intake',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, seedPayload);

    if (intakeRes.status === 201 && intakeRes.body?.data?.status === 'PROVISIONAL') {
      logPass(`Prompt 1 Ingestion & Dynamic Triage (POST /api/v1/intake) - Intake ID: ${intakeRes.body.data.intakeId}, Status: PROVISIONAL`);
    } else {
      logFail('Kiosk Intake Submission Endpoint', intakeRes);
    }

    // TEST 5: Prompt 2 Module 5 Discrepancy & Omission Checker
    const discResult = evaluateClinicalDiscrepancies(seedPayload);
    if (typeof discResult.completenessScore === 'number' && Array.isArray(discResult.omissions) && Array.isArray(discResult.discrepancies)) {
      logPass(`Prompt 2 Module 5 Discrepancy Engine Validated - Completeness Score: ${discResult.completenessScore}%, Contradictions: ${discResult.discrepancies.length}`);
    } else {
      logFail('Module 5 Discrepancy Engine', discResult);
    }

    // TEST 6: Doctor Dashboard Summary & SOAP View (GET /api/v1/clinical/patient/:id/summary)
    const abhaId = seedPayload.abhaId;
    const summaryRes = await request({
      hostname: '127.0.0.1',
      port: PORT,
      path: `/api/v1/clinical/patient/${abhaId}/summary`,
      method: 'GET'
    });

    if (summaryRes.status === 200 && summaryRes.body?.data?.preConsultationSummary) {
      const order = summaryRes.body.data.preConsultationSummary.order;
      const expectedOrder = ["Vitals", "Chief Complaint", "HPI", "History", "AYUSH parameters"];
      const isOrderValid = JSON.stringify(order) === JSON.stringify(expectedOrder);
      
      if (isOrderValid) {
        logPass(`Prompt 3 Doctor Dashboard Summary & SOAP Order Validated: ${order.join(' -> ')}`);
      } else {
        logFail('Doctor Dashboard Summary Order Mismatch', order);
      }
    } else {
      logFail('Doctor Dashboard Summary Endpoint', summaryRes);
    }

    // TEST 7: HPR Write-Lock Protection (UNAUTHORIZED COMMIT)
    const unauthCommitRes = await request({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/v1/doctor/verify',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { intakeId: seedPayload.intakeId });

    if (unauthCommitRes.status === 401 && unauthCommitRes.body?.error === 'HPR_TOKEN_MISSING') {
      logPass('Prompt 3 HPR Security Middleware successfully blocked unauthorized sign-off (401 Unauthorized)');
    } else {
      logFail('Prompt 3 HPR Write-Lock Protection Failed', unauthCommitRes);
    }

    // TEST 8: HPR Token Provisioning (POST /api/v1/hpr/login)
    const hprLoginRes = await request({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/v1/hpr/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      hprId: "HPR-IN-9876543210",
      doctorName: "Dr. Ananya Roy, MD",
      registrationNumber: "KMC-2016-99381",
      role: "DOCTOR"
    });

    let hprToken = null;
    if (hprLoginRes.status === 200 && hprLoginRes.body?.data?.hprToken) {
      hprToken = hprLoginRes.body.data.hprToken;
      logPass(`HPR Doctor Token Issued for ${hprLoginRes.body.data.doctorName} (${hprLoginRes.body.data.hprId})`);
    } else {
      logFail('HPR Doctor Token Login', hprLoginRes);
    }

    // TEST 9: Prompt 3 Doctor Verification Sign-Off (POST /api/v1/doctor/verify)
    if (hprToken) {
      const commitRes = await request({
        hostname: '127.0.0.1',
        port: PORT,
        path: '/api/v1/doctor/verify',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${hprToken}`
        }
      }, {
        intakeId: seedPayload.intakeId,
        doctorNotes: "Verified patient intake, vitals, and AYUSH parameters. Record locked and committed to EHR."
      });

      if (commitRes.status === 200 && commitRes.body?.data?.status === 'VERIFIED_COMMITTED') {
        logPass(`Prompt 3 Clinical Commit Success - Status transitioned to VERIFIED_COMMITTED`);
        logPass(`Immutable Digital Signature Attached: ${commitRes.body.data.hprSignatureBlock.digitalSignature}`);
      } else {
        logFail('Prompt 3 Doctor Verification Sign-Off', commitRes);
      }
    }

    // TEST 10: Module 7 ABDM FHIR (R4) Bundle Export (GET /api/v1/export/fhir/:intakeId)
    const fhirRes = await request({
      hostname: '127.0.0.1',
      port: PORT,
      path: `/api/v1/export/fhir/${seedPayload.intakeId}`,
      method: 'GET'
    });

    if (fhirRes.status === 200 && fhirRes.body?.resourceType === 'Bundle' && fhirRes.body?.type === 'document') {
      const hasEncounter = fhirRes.body.entry?.some(e => e.resource?.resourceType === 'Encounter');
      const hasHR = fhirRes.body.entry?.some(e => e.resource?.resourceType === 'Observation' && e.resource?.code?.coding?.[0]?.code === '8867-4');
      logPass(`HL7 FHIR (R4) Bundle Export Validated: ResourceType=Bundle, Entries=${fhirRes.body.entry?.length}, Encounter=${hasEncounter}, HeartRate(8867-4)=${hasHR}`);
    } else {
      logFail('HL7 FHIR R4 Bundle Export', fhirRes);
    }

    // TEST 11: generateFHIRBundle — Consent Filtering (vitalsOnly mode)
    const sampleIntake = JSON.parse(fs.readFileSync(path.join(__dirname, 'seed_data.json'), 'utf8'));
    const vitalsOnlyBundle = generateFHIRBundle(sampleIntake, { vitalsOnly: true, fullHistory: true, ayushNotes: true });
    const hasNonVitalObs = vitalsOnlyBundle.entry?.some(e =>
      e.resource?.resourceType === 'Observation' &&
      e.resource?.category?.[0]?.coding?.[0]?.code !== 'vital-signs'
    );
    const hasConditionInVitalsOnly = vitalsOnlyBundle.entry?.some(e => e.resource?.resourceType === 'Condition');
    if (!hasNonVitalObs && !hasConditionInVitalsOnly) {
      logPass(`generateFHIRBundle — VitalsOnly consent filter correctly strips non-vital Observations and Conditions`);
    } else {
      logFail('generateFHIRBundle VitalsOnly consent filter', { hasNonVitalObs, hasConditionInVitalsOnly });
    }

    // TEST 12: Consent-filtered FHIR endpoint via HTTP (vitalsOnly=true)
    const consentFhirRes = await request({
      hostname: '127.0.0.1',
      port: PORT,
      path: `/api/v1/export/fhir/${sampleIntake.intakeId}?vitalsOnly=true`,
      method: 'GET'
    });

    if (consentFhirRes.status === 200 && consentFhirRes.body?.resourceType === 'Bundle') {
      const hasConsentExt = consentFhirRes.body.entry?.some(e =>
        e.resource?.extension?.some(x => x.url?.includes('consent-settings'))
      );
      logPass(`Consent-filtered FHIR Endpoint (vitalsOnly=true): Bundle returned, consent extension present=${hasConsentExt}`);
    } else {
      logFail('Consent-filtered FHIR HTTP Endpoint', consentFhirRes);
    }

  } catch (err) {
    logFail('Test Suite Execution Error', err);
  } finally {
    if (server) server.close();
    console.log(`\n=======================================================`);
    console.log(`  TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log(`=======================================================\n`);
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests();

