import { z } from 'zod';

/**
 * Symptom Event Schema (SOCRATES Clinical Assessment Framework)
 * 
 * Implements the clinical SOCRATES pain/symptom characterization standard:
 * Site, Onset, Character, Radiation, Associated symptoms, Timing, Exacerbating/relieving, Severity.
 */

export const SymptomSiteEnum = z.enum([
  'HEAD',
  'EYES',
  'EARS_NOSE_THROAT',
  'NECK',
  'CHEST',
  'ABDOMEN_UPPER',
  'ABDOMEN_LOWER',
  'BACK_UPPER',
  'BACK_LOWER',
  'PELVIS_GROIN',
  'LEFT_ARM',
  'RIGHT_ARM',
  'LEFT_LEG',
  'RIGHT_LEG',
  'GENERALIZED_BODY',
  'SKIN',
  'OTHER'
]);

export const PainCharacterEnum = z.enum([
  'SHARP_STABBING',
  'DULL_ACHING',
  'BURNING',
  'CRUSHING_HEAVY',
  'THROBBING',
  'CRAMPING_COLICKY',
  'ELECTRIC_TINGLING',
  'PRESSURE_TIGHTNESS',
  'OTHER'
]);

export const OnsetPatternEnum = z.enum([
  'SUDDEN_THUNDERCLAP', // Instantaneous peak (< 1 min) - red flag for SAH / aortic dissection
  'ACUTE',              // Developed over hours (< 24h)
  'GRADUAL_SUBACUTE',   // Developed over days (1-7 days)
  'CHRONIC',            // Persistent for > 2-4 weeks
  'RECURRENT_EPISODIC'  // Episodic / recurring presentation
]);

export const TimeCourseEnum = z.enum([
  'CONSTANT_PERSISTENT',
  'WORSENING_PROGRESSIVE',
  'INTERMITTENT_FLUCTUATING',
  'IMPROVING',
  'RESOLVED'
]);

export const SymptomPayloadSchema = z.object({
  /** Primary symptom name (e.g. "CHEST_PAIN", "SHORTNESS_OF_BREATH", "HEADACHE") */
  symptomName: z.string().min(1, 'Symptom name is required').trim(),

  /** Numeric pain/distress severity scale: 0 (none) to 10 (worst imaginable) */
  severity: z.number().int().min(0, 'Severity must be at least 0').max(10, 'Severity must be at most 10'),

  /** Anatomical site of the primary symptom */
  site: SymptomSiteEnum.or(z.string().min(1)),

  /** Onset pattern (e.g., SUDDEN_THUNDERCLAP, ACUTE, CHRONIC) */
  onset: OnsetPatternEnum.or(z.string().min(1)),

  /** Duration in minutes since symptom began */
  durationMinutes: z.number().nonnegative().optional(),

  /** Quality of pain or sensation */
  character: PainCharacterEnum.or(z.string().min(1)).optional(),

  /** Radiation of pain to other body regions */
  radiation: z.array(z.string().trim()).default([]),

  /** Co-occurring symptoms (e.g., ["SWEATING", "DYSPNEA"]) */
  associatedSymptoms: z.array(z.string().trim()).default([]),

  /** Factors aggravating symptom (e.g., ["PHYSICAL_EXERTION"]) */
  exacerbatingFactors: z.array(z.string().trim()).default([]),

  /** Factors relieving symptom (e.g., ["REST"]) */
  relievingFactors: z.array(z.string().trim()).default([]),

  /** Temporal progression */
  timeCourse: TimeCourseEnum.or(z.string().min(1)).optional(),

  /** Patient remarks from kiosk intake prompt */
  patientRemarks: z.string().max(1000).optional()
}).strict();

export type SymptomPayload = z.infer<typeof SymptomPayloadSchema>;
export type SymptomSite = z.infer<typeof SymptomSiteEnum>;
export type PainCharacter = z.infer<typeof PainCharacterEnum>;
export type OnsetPattern = z.infer<typeof OnsetPatternEnum>;
export type TimeCourse = z.infer<typeof TimeCourseEnum>;
