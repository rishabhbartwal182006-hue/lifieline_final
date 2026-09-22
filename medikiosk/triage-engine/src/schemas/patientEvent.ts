import { z } from 'zod';
import { SymptomPayloadSchema } from './symptom.js';
import { VitalPayloadSchema } from './vitalEvent.js';
import { QuestionnairePayloadSchema } from './questionnaire.js';

/**
 * Patient Event Envelope Schema & Validation Layer
 * 
 * Encapsulates event metadata (session tracking, idempotency, event routing)
 * separate from the clinical payload.
 */

export const EventTypeEnum = z.enum([
  'NEW_SYMPTOM_ADDED',
  'SYMPTOM_SEVERITY_UPDATED',
  'ASSOCIATED_SYMPTOM_DETECTED',
  'NEW_QUESTIONNAIRE_ANSWER',
  'NEW_VITAL_READING'
]);

export type EventType = z.infer<typeof EventTypeEnum>;

export const EventSourceEnum = z.enum([
  'KIOSK_TOUCHSCREEN',
  'KIOSK_VOICE_ASSISTANT',
  'HARDWARE_DAEMON',
  'MANUAL_STAFF_OVERRIDE'
]);

const BaseEnvelopeSchema = z.object({
  id: z.string().min(1, 'Event id is required'),
  timestamp: z.string().datetime({ message: 'Timestamp must be a valid ISO 8601 date string' }),
  sessionId: z.string().min(1, 'Session ID is required'),
  patientId: z.string().optional(),
  source: EventSourceEnum.default('KIOSK_TOUCHSCREEN')
});

export const SymptomAddedEventSchema = BaseEnvelopeSchema.extend({
  eventType: z.literal('NEW_SYMPTOM_ADDED'),
  payload: SymptomPayloadSchema
}).strict();

export const SymptomSeverityUpdatedEventSchema = BaseEnvelopeSchema.extend({
  eventType: z.literal('SYMPTOM_SEVERITY_UPDATED'),
  payload: SymptomPayloadSchema
}).strict();

export const AssociatedSymptomDetectedEventSchema = BaseEnvelopeSchema.extend({
  eventType: z.literal('ASSOCIATED_SYMPTOM_DETECTED'),
  payload: SymptomPayloadSchema
}).strict();

export const QuestionnaireAnswerEventSchema = BaseEnvelopeSchema.extend({
  eventType: z.literal('NEW_QUESTIONNAIRE_ANSWER'),
  payload: QuestionnairePayloadSchema
}).strict();

export const VitalReadingEventSchema = BaseEnvelopeSchema.extend({
  eventType: z.literal('NEW_VITAL_READING'),
  payload: VitalPayloadSchema
}).strict();

export const PatientEventSchema = z.discriminatedUnion('eventType', [
  SymptomAddedEventSchema,
  SymptomSeverityUpdatedEventSchema,
  AssociatedSymptomDetectedEventSchema,
  QuestionnaireAnswerEventSchema,
  VitalReadingEventSchema
]);

export type PatientEvent = z.infer<typeof PatientEventSchema>;
export type SymptomAddedEvent = z.infer<typeof SymptomAddedEventSchema>;
export type VitalReadingEvent = z.infer<typeof VitalReadingEventSchema>;
export type QuestionnaireAnswerEvent = z.infer<typeof QuestionnaireAnswerEventSchema>;

export interface ValidationErrorDetail {
  path: string;
  message: string;
  code: string;
  expected?: string;
  received?: string;
}

export type ValidationResult<T> =
  | { success: true; data: T; error?: never }
  | { success: false; errors: ValidationErrorDetail[]; rawEventType?: string; error: string };

/**
 * Validates raw event payloads before they enter the triage pipeline.
 */
export function validatePatientEvent(rawInput: unknown): ValidationResult<PatientEvent> {
  if (!rawInput || typeof rawInput !== 'object') {
    return {
      success: false,
      error: 'Invalid event payload: expected a non-null JSON object',
      errors: [
        {
          path: '',
          message: 'Expected a non-null JSON object',
          code: 'invalid_type'
        }
      ]
    };
  }

  const parsed = PatientEventSchema.safeParse(rawInput);

  if (parsed.success) {
    return {
      success: true,
      data: parsed.data
    };
  }

  const rawEventType = (rawInput as Record<string, unknown>).eventType as string | undefined;
  
  const formattedErrors: ValidationErrorDetail[] = parsed.error.issues.map((issue) => {
    const errorDetail: ValidationErrorDetail = {
      path: issue.path.join('.') || 'root',
      message: issue.message,
      code: issue.code
    };

    if ('expected' in issue && typeof issue.expected === 'string') {
      errorDetail.expected = issue.expected;
    }
    if ('received' in issue && typeof issue.received === 'string') {
      errorDetail.received = issue.received;
    }

    return errorDetail;
  });

  const summaryMessage = `Validation failed for event [type: ${rawEventType ?? 'UNKNOWN'}]: ${formattedErrors
    .map((e) => `(${e.path}: ${e.message})`)
    .join(', ')}`;

  return {
    success: false,
    error: summaryMessage,
    rawEventType,
    errors: formattedErrors
  };
}
