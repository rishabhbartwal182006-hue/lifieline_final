import { z } from 'zod';
/**
 * Symptom Event Schema (SOCRATES Clinical Assessment Framework)
 *
 * Implements the clinical SOCRATES pain/symptom characterization standard:
 * Site, Onset, Character, Radiation, Associated symptoms, Timing, Exacerbating/relieving, Severity.
 */
export declare const SymptomSiteEnum: z.ZodEnum<["HEAD", "EYES", "EARS_NOSE_THROAT", "NECK", "CHEST", "ABDOMEN_UPPER", "ABDOMEN_LOWER", "BACK_UPPER", "BACK_LOWER", "PELVIS_GROIN", "LEFT_ARM", "RIGHT_ARM", "LEFT_LEG", "RIGHT_LEG", "GENERALIZED_BODY", "SKIN", "OTHER"]>;
export declare const PainCharacterEnum: z.ZodEnum<["SHARP_STABBING", "DULL_ACHING", "BURNING", "CRUSHING_HEAVY", "THROBBING", "CRAMPING_COLICKY", "ELECTRIC_TINGLING", "PRESSURE_TIGHTNESS", "OTHER"]>;
export declare const OnsetPatternEnum: z.ZodEnum<["SUDDEN_THUNDERCLAP", "ACUTE", "GRADUAL_SUBACUTE", "CHRONIC", "RECURRENT_EPISODIC"]>;
export declare const TimeCourseEnum: z.ZodEnum<["CONSTANT_PERSISTENT", "WORSENING_PROGRESSIVE", "INTERMITTENT_FLUCTUATING", "IMPROVING", "RESOLVED"]>;
export declare const SymptomPayloadSchema: z.ZodObject<{
    /** Primary symptom name (e.g. "CHEST_PAIN", "SHORTNESS_OF_BREATH", "HEADACHE") */
    symptomName: z.ZodString;
    /** Numeric pain/distress severity scale: 0 (none) to 10 (worst imaginable) */
    severity: z.ZodNumber;
    /** Anatomical site of the primary symptom */
    site: z.ZodUnion<[z.ZodEnum<["HEAD", "EYES", "EARS_NOSE_THROAT", "NECK", "CHEST", "ABDOMEN_UPPER", "ABDOMEN_LOWER", "BACK_UPPER", "BACK_LOWER", "PELVIS_GROIN", "LEFT_ARM", "RIGHT_ARM", "LEFT_LEG", "RIGHT_LEG", "GENERALIZED_BODY", "SKIN", "OTHER"]>, z.ZodString]>;
    /** Onset pattern (e.g., SUDDEN_THUNDERCLAP, ACUTE, CHRONIC) */
    onset: z.ZodUnion<[z.ZodEnum<["SUDDEN_THUNDERCLAP", "ACUTE", "GRADUAL_SUBACUTE", "CHRONIC", "RECURRENT_EPISODIC"]>, z.ZodString]>;
    /** Duration in minutes since symptom began */
    durationMinutes: z.ZodOptional<z.ZodNumber>;
    /** Quality of pain or sensation */
    character: z.ZodOptional<z.ZodUnion<[z.ZodEnum<["SHARP_STABBING", "DULL_ACHING", "BURNING", "CRUSHING_HEAVY", "THROBBING", "CRAMPING_COLICKY", "ELECTRIC_TINGLING", "PRESSURE_TIGHTNESS", "OTHER"]>, z.ZodString]>>;
    /** Radiation of pain to other body regions */
    radiation: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    /** Co-occurring symptoms (e.g., ["SWEATING", "DYSPNEA"]) */
    associatedSymptoms: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    /** Factors aggravating symptom (e.g., ["PHYSICAL_EXERTION"]) */
    exacerbatingFactors: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    /** Factors relieving symptom (e.g., ["REST"]) */
    relievingFactors: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    /** Temporal progression */
    timeCourse: z.ZodOptional<z.ZodUnion<[z.ZodEnum<["CONSTANT_PERSISTENT", "WORSENING_PROGRESSIVE", "INTERMITTENT_FLUCTUATING", "IMPROVING", "RESOLVED"]>, z.ZodString]>>;
    /** Patient remarks from kiosk intake prompt */
    patientRemarks: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    symptomName: string;
    severity: number;
    site: string;
    onset: string;
    radiation: string[];
    associatedSymptoms: string[];
    exacerbatingFactors: string[];
    relievingFactors: string[];
    durationMinutes?: number | undefined;
    character?: string | undefined;
    timeCourse?: string | undefined;
    patientRemarks?: string | undefined;
}, {
    symptomName: string;
    severity: number;
    site: string;
    onset: string;
    durationMinutes?: number | undefined;
    character?: string | undefined;
    radiation?: string[] | undefined;
    associatedSymptoms?: string[] | undefined;
    exacerbatingFactors?: string[] | undefined;
    relievingFactors?: string[] | undefined;
    timeCourse?: string | undefined;
    patientRemarks?: string | undefined;
}>;
export type SymptomPayload = z.infer<typeof SymptomPayloadSchema>;
export type SymptomSite = z.infer<typeof SymptomSiteEnum>;
export type PainCharacter = z.infer<typeof PainCharacterEnum>;
export type OnsetPattern = z.infer<typeof OnsetPatternEnum>;
export type TimeCourse = z.infer<typeof TimeCourseEnum>;
