import { getSession, SessionState } from '../engine/sessionState.js';
import { DynamicQuestion, NextQuestionPayload } from '../events/socketEvents.js';
import { routeSymptomToQuestionSet } from './symptomRouter.js';
import { SOCRATES_QUESTION_DEFINITIONS } from './socratesFlow.js';

/**
 * Dynamic Question Selector
 * 
 * Analyzes session state, skips pre-populated or answered attributes,
 * and selects the next most pertinent clinical question.
 */

export function isQuestionAnswered(question: DynamicQuestion, session: SessionState): boolean {
  if (session.questionnaire[question.questionId] !== undefined) {
    return true;
  }

  const primarySymptom = session.symptoms.primary;

  switch (question.questionId) {
    case 'SOCRATES_SITE':
      return Boolean(primarySymptom?.site);

    case 'SOCRATES_ONSET':
      return Boolean(primarySymptom?.onset);

    case 'SOCRATES_CHARACTER':
      return Boolean(primarySymptom?.character);

    case 'SOCRATES_RADIATION':
      return session.symptoms.allRadiations.length > 0;

    case 'SOCRATES_ASSOCIATED':
      return session.symptoms.allAssociatedSymptoms.length > 0;

    case 'SOCRATES_TIMING':
      return Boolean(primarySymptom?.timeCourse);

    case 'SOCRATES_EXACERBATING':
      return (primarySymptom?.exacerbatingFactors && primarySymptom.exacerbatingFactors.length > 0) || false;

    case 'SOCRATES_SEVERITY':
      return session.symptoms.maxSeverity > 0 || (primarySymptom && primarySymptom.severity > 0) || false;

    default:
      return false;
  }
}

export function getNextQuestion(sessionId: string): NextQuestionPayload {
  const session = getSession(sessionId);

  if (!session) {
    return {
      sessionId,
      question: SOCRATES_QUESTION_DEFINITIONS.SITE(),
      progress: {
        currentStep: 1,
        totalEstimatedSteps: 8,
        isComplete: false,
        category: 'GENERAL'
      }
    };
  }

  const primarySymptom = session.symptoms.primary;
  if (!primarySymptom) {
    return {
      sessionId,
      question: SOCRATES_QUESTION_DEFINITIONS.SITE(),
      progress: {
        currentStep: 1,
        totalEstimatedSteps: 8,
        isComplete: false,
        category: 'GENERAL'
      }
    };
  }

  const questionBattery = routeSymptomToQuestionSet(
    primarySymptom.symptomName,
    primarySymptom.site
  );

  const unansweredQuestions: DynamicQuestion[] = [];
  let answeredCount = 0;

  for (const question of questionBattery) {
    if (isQuestionAnswered(question, session)) {
      answeredCount += 1;
    } else {
      unansweredQuestions.push(question);
    }
  }

  const totalSteps = questionBattery.length;
  const currentStep = Math.min(answeredCount + 1, totalSteps);
  const nextQuestion = unansweredQuestions.length > 0 ? unansweredQuestions[0] : null;
  const isComplete = nextQuestion === null;

  return {
    sessionId,
    question: nextQuestion,
    progress: {
      currentStep,
      totalEstimatedSteps: totalSteps,
      isComplete,
      category: nextQuestion?.category ?? 'COMPLETED'
    }
  };
}

export function shouldInterruptQuestionnaire(sessionId: string): {
  interrupted: boolean;
  reason?: string;
  triageLevel?: string;
  action?: string;
  triggeredRules?: string[];
} {
  const session = getSession(sessionId);
  if (!session || !session.latestTriageResult) {
    return { interrupted: false };
  }

  const latest = session.latestTriageResult;

  if (latest.triageLevel === 'EMERGENCY') {
    return {
      interrupted: true,
      reason: latest.reason,
      triageLevel: latest.triageLevel,
      action: latest.action,
      triggeredRules: latest.triggeredRules
    };
  }

  return { interrupted: false };
}
