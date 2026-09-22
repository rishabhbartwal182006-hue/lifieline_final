/**
 * ============================================================================
 * UNIT TEST SUITE: DYNAMIC QUESTIONING & SOCRATES FLOW
 * ============================================================================
 * Tests symptomRouter, socratesFlow, and questionSelector in isolation.
 */

import { routeSymptomToQuestionSet } from '../src/questionnaire/symptomRouter.js';
import { getSocratesQuestionSequence } from '../src/questionnaire/socratesFlow.js';
import { getNextQuestion, isQuestionAnswered, shouldInterruptQuestionnaire } from '../src/questionnaire/questionSelector.js';
import { clearAllSessions, applyEventToSession, updateSessionTriage, getOrCreateSession } from '../src/engine/sessionState.js';

export function runDynamicQuestioningTests(): boolean {
  console.log('\n======================================================================');
  console.log('📋 TEST SUITE: DYNAMIC QUESTIONING & CLINICAL ROUTING (UNIT TESTS)');
  console.log('======================================================================\n');

  clearAllSessions();
  let allPassed = true;

  // --------------------------------------------------------------------------
  // TEST 1: Symptom Router - Chest Pain Question Set
  // --------------------------------------------------------------------------
  console.log('[TEST 1] Routing Chest Pain Presentation...');
  const chestQuestions = routeSymptomToQuestionSet('CHEST_PAIN', 'CHEST');
  const chestQIds = chestQuestions.map((q) => q.questionId);

  console.log(`  Routed ${chestQuestions.length} questions: [${chestQIds.join(', ')}]`);

  const hasCardiacMeds = chestQIds.includes('MED_ON_BLOOD_THINNERS');
  const hasRadiation = chestQIds.includes('SOCRATES_RADIATION');
  const hasAssociated = chestQIds.includes('SOCRATES_ASSOCIATED');

  if (hasCardiacMeds && hasRadiation && hasAssociated) {
    console.log('  \x1b[32m✔ PASS: Correctly routed cardiac screening + SOCRATES questions for chest pain.\x1b[0m');
  } else {
    console.log('  \x1b[31m✘ FAIL: Missing mandatory cardiac screening questions.\x1b[0m');
    allPassed = false;
  }

  // --------------------------------------------------------------------------
  // TEST 2: SOCRATES Branching - Extremity Site skips Radiation
  // --------------------------------------------------------------------------
  console.log('\n[TEST 2] SOCRATES Branching (Isolated Finger / Extremity Sprain)...');
  const fingerQuestions = getSocratesQuestionSequence('FINGER_SPRAIN', 'RIGHT_ARM');
  const fingerQIds = fingerQuestions.map((q) => q.questionId);

  console.log(`  Extremity Question Sequence: [${fingerQIds.join(', ')}]`);
  const fingerHasRadiation = fingerQIds.includes('SOCRATES_RADIATION');

  if (!fingerHasRadiation) {
    console.log('  \x1b[32m✔ PASS: Correctly skipped radiation question for isolated peripheral extremity.\x1b[0m');
  } else {
    console.log('  \x1b[31m✘ FAIL: Radiation question was not branched out for peripheral site.\x1b[0m');
    allPassed = false;
  }

  // --------------------------------------------------------------------------
  // TEST 3: Question Selector - Never Re-Ask Pre-Populated Attributes
  // --------------------------------------------------------------------------
  console.log('\n[TEST 3] Question Selector (Skipping Pre-Populated Attributes)...');
  const sessId = 'test_sess_selector_001';

  // Ingest an event with site='HEAD', onset='ACUTE', severity=5 already provided
  applyEventToSession({
    id: 'evt_test_01',
    timestamp: new Date().toISOString(),
    sessionId: sessId,
    source: 'KIOSK_TOUCHSCREEN',
    eventType: 'NEW_SYMPTOM_ADDED',
    payload: {
      symptomName: 'HEADACHE',
      severity: 5,
      site: 'HEAD',
      onset: 'ACUTE'
    }
  });

  const nextQ1 = getNextQuestion(sessId);
  console.log(`  Initial Next Question: ${nextQ1.question?.questionId} ("${nextQ1.question?.questionText}")`);
  console.log(`  Progress: Step ${nextQ1.progress.currentStep}/${nextQ1.progress.totalEstimatedSteps}`);

  // The next question should NOT be SOCRATES_SITE, SOCRATES_ONSET, or SOCRATES_SEVERITY
  const skippedPrePopulated =
    nextQ1.question?.questionId !== 'SOCRATES_SITE' &&
    nextQ1.question?.questionId !== 'SOCRATES_ONSET' &&
    nextQ1.question?.questionId !== 'SOCRATES_SEVERITY';

  if (skippedPrePopulated && nextQ1.question !== null) {
    console.log('  \x1b[32m✔ PASS: Successfully skipped pre-populated site, onset, and severity questions.\x1b[0m');
  } else {
    console.log('  \x1b[31m✘ FAIL: Re-asked an already-known symptom attribute.\x1b[0m');
    allPassed = false;
  }

  // --------------------------------------------------------------------------
  // TEST 4: Answering a question advances to the next distinct question
  // --------------------------------------------------------------------------
  console.log('\n[TEST 4] Answering Question Advances Sequence...');
  const currentQId = nextQ1.question!.questionId;

  // Patient answers the current question
  applyEventToSession({
    id: 'evt_test_02',
    timestamp: new Date().toISOString(),
    sessionId: sessId,
    source: 'KIOSK_TOUCHSCREEN',
    eventType: 'NEW_QUESTIONNAIRE_ANSWER',
    payload: {
      questionId: currentQId,
      questionText: nextQ1.question!.questionText,
      category: nextQ1.question!.category,
      questionType: nextQ1.question!.questionType,
      answerValue: 'THROBBING'
    }
  });

  const nextQ2 = getNextQuestion(sessId);
  console.log(`  Next Question after answering ${currentQId}: ${nextQ2.question?.questionId}`);

  if (nextQ2.question?.questionId !== currentQId) {
    console.log('  \x1b[32m✔ PASS: Questionnaire advanced to the next unanswered question.\x1b[0m');
  } else {
    console.log('  \x1b[31m✘ FAIL: Question selector repeated the same question.\x1b[0m');
    allPassed = false;
  }

  // --------------------------------------------------------------------------
  // TEST 5: Questionnaire Interruption upon EMERGENCY Triage
  // --------------------------------------------------------------------------
  console.log('\n[TEST 5] Emergency Questionnaire Interruption Checking...');
  
  // Update session triage to EMERGENCY
  updateSessionTriage(sessId, {
    id: 'trg_test_emerg',
    sessionId: sessId,
    triageLevel: 'EMERGENCY',
    triggeredRules: ['RULE_CARDIAC_ACS_RED_FLAG'],
    action: 'IMMEDIATE_DOCTOR_ALERT',
    reason: 'Possible Acute Coronary Syndrome detected',
    timestamp: new Date().toISOString()
  });

  const interruption = shouldInterruptQuestionnaire(sessId);
  console.log(`  Interruption Status: ${interruption.interrupted}`);
  console.log(`  Interruption Reason: ${interruption.reason}`);

  if (interruption.interrupted && interruption.triageLevel === 'EMERGENCY') {
    console.log('  \x1b[32m✔ PASS: Emergency escalation correctly triggers questionnaire interruption.\x1b[0m');
  } else {
    console.log('  \x1b[31m✘ FAIL: Interruption check failed for emergency state.\x1b[0m');
    allPassed = false;
  }

  return allPassed;
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  const ok = runDynamicQuestioningTests();
  process.exit(ok ? 0 : 1);
}
