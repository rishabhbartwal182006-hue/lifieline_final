/**
 * ============================================================================
 * AUTOMATED DEMO SCENARIOS PRE-FLIGHT TEST
 * ============================================================================
 * Runs all 3 canonical demo scenarios (Routine, Urgent, Emergency) end-to-end
 * as an automated smoke test before the SIH presentation.
 */

import { processPatientEvent, clearAllSessions } from '../src/engine/index.js';
import { DEMO_SCENARIOS } from '../src/demo/scenarios.js';
import { getAuditTrail, logAuditEvent } from '../src/persistence/auditLog.js';

export function runDemoScenarioTests(): boolean {
  console.log('\n======================================================================');
  console.log('🧪 TEST SUITE: AUTOMATED DEMO SCENARIOS SMOKE TEST');
  console.log('======================================================================\n');

  clearAllSessions();
  let allPassed = true;

  // --------------------------------------------------------------------------
  // TEST SCENARIO 1: Routine Case
  // --------------------------------------------------------------------------
  console.log('[SCENARIO 1] Executing Case 1 (Routine Musculoskeletal Sprain)...');
  const sc1 = DEMO_SCENARIOS[1];
  let res1: any = null;

  for (const step of sc1.steps) {
    res1 = processPatientEvent(step.event);
    logAuditEvent({
      sessionId: sc1.sessionId,
      eventType: 'EVENT_INGESTED',
      currentLevel: res1.triageLevel,
      triggeredRules: res1.triggeredRules,
      action: res1.action,
      reason: res1.reason
    });
  }

  const auditTrail1 = getAuditTrail(sc1.sessionId);
  console.log(`  Case 1 Final Level: ${res1.triageLevel} | Triggered Rules: [${res1.triggeredRules.join(', ')}]`);
  console.log(`  Case 1 Audit Records Count: ${auditTrail1.length}`);

  if (res1.triageLevel === 'ROUTINE' && res1.triggeredRules.length === 0 && auditTrail1.length === 4) {
    console.log('  \x1b[32m✔ PASS: Case 1 correctly evaluated as ROUTINE with complete audit trail.\x1b[0m');
  } else {
    console.log('  \x1b[31m✘ FAIL: Case 1 did not match expected outcome.\x1b[0m');
    allPassed = false;
  }

  // --------------------------------------------------------------------------
  // TEST SCENARIO 2: Urgent Case (Moderate Hypoxemia)
  // --------------------------------------------------------------------------
  console.log('\n[SCENARIO 2] Executing Case 2 (Urgent Cough + SpO2 92%)...');
  const sc2 = DEMO_SCENARIOS[2];
  let res2: any = null;

  for (const step of sc2.steps) {
    res2 = processPatientEvent(step.event);
    logAuditEvent({
      sessionId: sc2.sessionId,
      eventType: res2.triageLevel === 'URGENT' ? 'RED_FLAG_DETECTED' : 'EVENT_INGESTED',
      currentLevel: res2.triageLevel,
      triggeredRules: res2.triggeredRules,
      action: res2.action,
      reason: res2.reason
    });
  }

  const auditTrail2 = getAuditTrail(sc2.sessionId);
  console.log(`  Case 2 Final Level: ${res2.triageLevel} | Triggered Rules: [${res2.triggeredRules.join(', ')}]`);

  if (
    res2.triageLevel === 'URGENT' &&
    res2.triggeredRules.includes('RULE_RESPIRATORY_MODERATE_HYPOXEMIA') &&
    auditTrail2.length === 3
  ) {
    console.log('  \x1b[32m✔ PASS: Case 2 correctly escalated to URGENT with moderate hypoxemia trigger.\x1b[0m');
  } else {
    console.log('  \x1b[31m✘ FAIL: Case 2 did not match expected outcome.\x1b[0m');
    allPassed = false;
  }

  // --------------------------------------------------------------------------
  // TEST SCENARIO 3: Emergency Case (Suspected ACS)
  // --------------------------------------------------------------------------
  console.log('\n[SCENARIO 3] Executing Case 3 (Critical ACS Red-Flag Escalation)...');
  const sc3 = DEMO_SCENARIOS[3];
  let res3: any = null;

  for (const step of sc3.steps) {
    res3 = processPatientEvent(step.event);
    logAuditEvent({
      sessionId: sc3.sessionId,
      eventType: res3.triageLevel === 'EMERGENCY' ? 'ESCALATION_REQUIRED' : 'EVENT_INGESTED',
      currentLevel: res3.triageLevel,
      triggeredRules: res3.triggeredRules,
      action: res3.action,
      reason: res3.reason
    });
  }

  const auditTrail3 = getAuditTrail(sc3.sessionId);
  console.log(`  Case 3 Final Level: ${res3.triageLevel} | Triggered Rules: [${res3.triggeredRules.join(', ')}]`);

  if (
    res3.triageLevel === 'EMERGENCY' &&
    res3.triggeredRules.includes('RULE_CARDIAC_ACS_RED_FLAG') &&
    auditTrail3.length === 3
  ) {
    console.log('  \x1b[32m✔ PASS: Case 3 correctly escalated to EMERGENCY on step 3 with ACS red flag.\x1b[0m');
  } else {
    console.log('  \x1b[31m✘ FAIL: Case 3 did not match expected outcome.\x1b[0m');
    allPassed = false;
  }

  return allPassed;
}

if (import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, '/')}`) {
  const ok = runDemoScenarioTests();
  process.exit(ok ? 0 : 1);
}
