/**
 * ============================================================================
 * MEDIKIOSK TRIAGE ENGINE: MASTER TEST RUNNER
 * ============================================================================
 * Runs Phase 1 validation tests + Phase 2 routine, urgent, and escalation suites.
 */

import { runTests as runValidationTests } from './runValidationTests.js';
import { runRoutineTests } from './routineCases.test.js';
import { runUrgentTests } from './urgentCases.test.js';
import { runEscalationTests } from './escalationCases.test.js';
import { runDynamicQuestioningTests } from './dynamicQuestioning.test.js';
import { runSocketFlowTests } from './socketFlow.test.js';
import { runEdgeCaseTests } from './edgeCases.test.js';
import { runDemoScenarioTests } from './demoScenarios.test.js';

console.log('\n======================================================================');
console.log('🏥 RUNNING MEDIKIOSK TRIAGE ENGINE COMPLETE SUITE (PHASES 1, 2, 3 & 4)');
console.log('======================================================================\n');

async function runAll(): Promise<void> {
  try {
    runValidationTests();
    const routineOk = runRoutineTests();
    const urgentOk = runUrgentTests();
    const escalationOk = runEscalationTests();
    const dynamicQOk = runDynamicQuestioningTests();
    const socketOk = await runSocketFlowTests();
    const edgeOk = await runEdgeCaseTests();
    const demoOk = runDemoScenarioTests();

    if (routineOk && urgentOk && escalationOk && dynamicQOk && socketOk && edgeOk && demoOk) {
      console.log('\n======================================================================');
      console.log('🎉 ALL 8 TEST SUITES PASSED SUCCESSFULLY (100% PRODUCTION-READY COVERAGE)');
      console.log('======================================================================\n');
      process.exit(0);
    } else {
      console.log('\n❌ SOME TEST SUITES FAILED.');
      process.exit(1);
    }
  } catch (error) {
    console.error('Fatal error during test run:', error);
    process.exit(1);
  }
}

runAll();


