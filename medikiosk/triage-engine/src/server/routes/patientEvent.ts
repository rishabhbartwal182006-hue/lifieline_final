import { Router, Request, Response } from 'express';
import { processPatientEvent, EventValidationError, getSession, getLatestTriage } from '../../engine/index.js';
import { getNextQuestion } from '../../questionnaire/questionSelector.js';
import { getAuditTrail, formatAuditTrailMarkdown, logAuditEvent } from '../../persistence/auditLog.js';
import { saveSessionSnapshot, findSession, listAllSessions } from '../../persistence/sessionRepository.js';

const router = Router();

/**
 * POST /api/events
 * REST fallback endpoint for ingesting PatientEvent payloads
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const rawEvent = req.body;
    const triageResult = processPatientEvent(rawEvent);
    const sessionId = triageResult.sessionId;
    const nextQuestion = getNextQuestion(sessionId);
    const session = getSession(sessionId);

    logAuditEvent({
      sessionId,
      patientId: session?.patientId,
      eventType: triageResult.triageLevel === 'EMERGENCY' ? 'ESCALATION_REQUIRED' : 'EVENT_INGESTED',
      previousLevel: session?.previousTriageResult?.triageLevel ?? 'ROUTINE',
      currentLevel: triageResult.triageLevel,
      triggeredRules: triageResult.triggeredRules,
      action: triageResult.action,
      reason: triageResult.reason
    });

    if (session) {
      await saveSessionSnapshot(session);
    }

    return res.status(200).json({
      success: true,
      triageResult,
      nextQuestion,
      sessionEventCount: session?.eventCount ?? 1
    });
  } catch (err: any) {
    if (err instanceof EventValidationError) {
      return res.status(400).json({
        success: false,
        error: err.message,
        errors: err.errors,
        rawEventType: err.rawEventType
      });
    }

    return res.status(500).json({
      success: false,
      error: err.message || 'Internal triage engine error'
    });
  }
});

/**
 * GET /api/events/session/:sessionId/triage
 * Retrieves latest computed triage result for a session
 */
router.get('/session/:sessionId/triage', (req: Request, res: Response) => {
  const sessionId = Array.isArray(req.params.sessionId) ? req.params.sessionId[0] : req.params.sessionId;
  const triage = getLatestTriage(sessionId);
  const session = getSession(sessionId);

  if (!session) {
    return res.status(404).json({
      success: false,
      error: `No active encounter found for sessionId '${sessionId}'`
    });
  }

  return res.status(200).json({
    success: true,
    sessionId,
    triageResult: triage ?? null,
    eventCount: session.eventCount,
    nextQuestion: getNextQuestion(sessionId)
  });
});

/**
 * GET /api/events/session/:sessionId/audit
 * Retrieves complete explainability audit trail for a session
 */
router.get('/session/:sessionId/audit', (req: Request, res: Response) => {
  const sessionId = Array.isArray(req.params.sessionId) ? req.params.sessionId[0] : req.params.sessionId;
  const auditTrail = getAuditTrail(sessionId);
  const markdown = formatAuditTrailMarkdown(sessionId);

  return res.status(200).json({
    success: true,
    sessionId,
    count: auditTrail.length,
    auditTrail,
    markdown
  });
});

/**
 * GET /api/events/sessions
 * Lists all persisted sessions for Doctor Dashboard overview
 */
router.get('/sessions', async (req: Request, res: Response) => {
  const { status, triageLevel } = req.query;
  const sessions = await listAllSessions({
    status: typeof status === 'string' ? status : undefined,
    triageLevel: typeof triageLevel === 'string' ? triageLevel : undefined
  });

  return res.status(200).json({
    success: true,
    count: sessions.length,
    sessions
  });
});

/**
 * GET /api/events/session/:sessionId
 * Retrieves full persisted encounter record
 */
router.get('/session/:sessionId', async (req: Request, res: Response) => {
  const sessionId = Array.isArray(req.params.sessionId) ? req.params.sessionId[0] : req.params.sessionId;
  const record = await findSession(sessionId);

  if (!record) {
    return res.status(404).json({
      success: false,
      error: `Persisted session '${sessionId}' not found`
    });
  }

  return res.status(200).json({
    success: true,
    session: record
  });
});

export default router;
