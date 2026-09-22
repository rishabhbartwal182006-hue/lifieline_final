import { z } from 'zod';
/**
 * Patient Event Envelope Schema & Validation Layer
 *
 * Encapsulates event metadata (session tracking, idempotency, event routing)
 * separate from the clinical payload.
 */
export declare const EventTypeEnum: z.ZodEnum<["NEW_SYMPTOM_ADDED", "SYMPTOM_SEVERITY_UPDATED", "ASSOCIATED_SYMPTOM_DETECTED", "NEW_QUESTIONNAIRE_ANSWER", "NEW_VITAL_READING"]>;
export type EventType = z.infer<typeof EventTypeEnum>;
export declare const EventSourceEnum: z.ZodEnum<["KIOSK_TOUCHSCREEN", "KIOSK_VOICE_ASSISTANT", "HARDWARE_DAEMON", "MANUAL_STAFF_OVERRIDE"]>;
export declare const SymptomAddedEventSchema: z.ZodObject<{
    id: z.ZodString;
    timestamp: z.ZodString;
    sessionId: z.ZodString;
    patientId: z.ZodOptional<z.ZodString>;
    source: z.ZodDefault<z.ZodEnum<["KIOSK_TOUCHSCREEN", "KIOSK_VOICE_ASSISTANT", "HARDWARE_DAEMON", "MANUAL_STAFF_OVERRIDE"]>>;
} & {
    eventType: z.ZodLiteral<"NEW_SYMPTOM_ADDED">;
    payload: z.ZodObject<{
        symptomName: z.ZodString;
        severity: z.ZodNumber;
        site: z.ZodUnion<[z.ZodEnum<["HEAD", "EYES", "EARS_NOSE_THROAT", "NECK", "CHEST", "ABDOMEN_UPPER", "ABDOMEN_LOWER", "BACK_UPPER", "BACK_LOWER", "PELVIS_GROIN", "LEFT_ARM", "RIGHT_ARM", "LEFT_LEG", "RIGHT_LEG", "GENERALIZED_BODY", "SKIN", "OTHER"]>, z.ZodString]>;
        onset: z.ZodUnion<[z.ZodEnum<["SUDDEN_THUNDERCLAP", "ACUTE", "GRADUAL_SUBACUTE", "CHRONIC", "RECURRENT_EPISODIC"]>, z.ZodString]>;
        durationMinutes: z.ZodOptional<z.ZodNumber>;
        character: z.ZodOptional<z.ZodUnion<[z.ZodEnum<["SHARP_STABBING", "DULL_ACHING", "BURNING", "CRUSHING_HEAVY", "THROBBING", "CRAMPING_COLICKY", "ELECTRIC_TINGLING", "PRESSURE_TIGHTNESS", "OTHER"]>, z.ZodString]>>;
        radiation: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        associatedSymptoms: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        exacerbatingFactors: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        relievingFactors: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        timeCourse: z.ZodOptional<z.ZodUnion<[z.ZodEnum<["CONSTANT_PERSISTENT", "WORSENING_PROGRESSIVE", "INTERMITTENT_FLUCTUATING", "IMPROVING", "RESOLVED"]>, z.ZodString]>>;
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
}, "strict", z.ZodTypeAny, {
    id: string;
    timestamp: string;
    sessionId: string;
    source: "KIOSK_TOUCHSCREEN" | "KIOSK_VOICE_ASSISTANT" | "HARDWARE_DAEMON" | "MANUAL_STAFF_OVERRIDE";
    eventType: "NEW_SYMPTOM_ADDED";
    payload: {
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
    };
    patientId?: string | undefined;
}, {
    id: string;
    timestamp: string;
    sessionId: string;
    eventType: "NEW_SYMPTOM_ADDED";
    payload: {
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
    };
    patientId?: string | undefined;
    source?: "KIOSK_TOUCHSCREEN" | "KIOSK_VOICE_ASSISTANT" | "HARDWARE_DAEMON" | "MANUAL_STAFF_OVERRIDE" | undefined;
}>;
export declare const SymptomSeverityUpdatedEventSchema: z.ZodObject<{
    id: z.ZodString;
    timestamp: z.ZodString;
    sessionId: z.ZodString;
    patientId: z.ZodOptional<z.ZodString>;
    source: z.ZodDefault<z.ZodEnum<["KIOSK_TOUCHSCREEN", "KIOSK_VOICE_ASSISTANT", "HARDWARE_DAEMON", "MANUAL_STAFF_OVERRIDE"]>>;
} & {
    eventType: z.ZodLiteral<"SYMPTOM_SEVERITY_UPDATED">;
    payload: z.ZodObject<{
        symptomName: z.ZodString;
        severity: z.ZodNumber;
        site: z.ZodUnion<[z.ZodEnum<["HEAD", "EYES", "EARS_NOSE_THROAT", "NECK", "CHEST", "ABDOMEN_UPPER", "ABDOMEN_LOWER", "BACK_UPPER", "BACK_LOWER", "PELVIS_GROIN", "LEFT_ARM", "RIGHT_ARM", "LEFT_LEG", "RIGHT_LEG", "GENERALIZED_BODY", "SKIN", "OTHER"]>, z.ZodString]>;
        onset: z.ZodUnion<[z.ZodEnum<["SUDDEN_THUNDERCLAP", "ACUTE", "GRADUAL_SUBACUTE", "CHRONIC", "RECURRENT_EPISODIC"]>, z.ZodString]>;
        durationMinutes: z.ZodOptional<z.ZodNumber>;
        character: z.ZodOptional<z.ZodUnion<[z.ZodEnum<["SHARP_STABBING", "DULL_ACHING", "BURNING", "CRUSHING_HEAVY", "THROBBING", "CRAMPING_COLICKY", "ELECTRIC_TINGLING", "PRESSURE_TIGHTNESS", "OTHER"]>, z.ZodString]>>;
        radiation: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        associatedSymptoms: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        exacerbatingFactors: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        relievingFactors: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        timeCourse: z.ZodOptional<z.ZodUnion<[z.ZodEnum<["CONSTANT_PERSISTENT", "WORSENING_PROGRESSIVE", "INTERMITTENT_FLUCTUATING", "IMPROVING", "RESOLVED"]>, z.ZodString]>>;
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
}, "strict", z.ZodTypeAny, {
    id: string;
    timestamp: string;
    sessionId: string;
    source: "KIOSK_TOUCHSCREEN" | "KIOSK_VOICE_ASSISTANT" | "HARDWARE_DAEMON" | "MANUAL_STAFF_OVERRIDE";
    eventType: "SYMPTOM_SEVERITY_UPDATED";
    payload: {
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
    };
    patientId?: string | undefined;
}, {
    id: string;
    timestamp: string;
    sessionId: string;
    eventType: "SYMPTOM_SEVERITY_UPDATED";
    payload: {
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
    };
    patientId?: string | undefined;
    source?: "KIOSK_TOUCHSCREEN" | "KIOSK_VOICE_ASSISTANT" | "HARDWARE_DAEMON" | "MANUAL_STAFF_OVERRIDE" | undefined;
}>;
export declare const AssociatedSymptomDetectedEventSchema: z.ZodObject<{
    id: z.ZodString;
    timestamp: z.ZodString;
    sessionId: z.ZodString;
    patientId: z.ZodOptional<z.ZodString>;
    source: z.ZodDefault<z.ZodEnum<["KIOSK_TOUCHSCREEN", "KIOSK_VOICE_ASSISTANT", "HARDWARE_DAEMON", "MANUAL_STAFF_OVERRIDE"]>>;
} & {
    eventType: z.ZodLiteral<"ASSOCIATED_SYMPTOM_DETECTED">;
    payload: z.ZodObject<{
        symptomName: z.ZodString;
        severity: z.ZodNumber;
        site: z.ZodUnion<[z.ZodEnum<["HEAD", "EYES", "EARS_NOSE_THROAT", "NECK", "CHEST", "ABDOMEN_UPPER", "ABDOMEN_LOWER", "BACK_UPPER", "BACK_LOWER", "PELVIS_GROIN", "LEFT_ARM", "RIGHT_ARM", "LEFT_LEG", "RIGHT_LEG", "GENERALIZED_BODY", "SKIN", "OTHER"]>, z.ZodString]>;
        onset: z.ZodUnion<[z.ZodEnum<["SUDDEN_THUNDERCLAP", "ACUTE", "GRADUAL_SUBACUTE", "CHRONIC", "RECURRENT_EPISODIC"]>, z.ZodString]>;
        durationMinutes: z.ZodOptional<z.ZodNumber>;
        character: z.ZodOptional<z.ZodUnion<[z.ZodEnum<["SHARP_STABBING", "DULL_ACHING", "BURNING", "CRUSHING_HEAVY", "THROBBING", "CRAMPING_COLICKY", "ELECTRIC_TINGLING", "PRESSURE_TIGHTNESS", "OTHER"]>, z.ZodString]>>;
        radiation: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        associatedSymptoms: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        exacerbatingFactors: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        relievingFactors: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        timeCourse: z.ZodOptional<z.ZodUnion<[z.ZodEnum<["CONSTANT_PERSISTENT", "WORSENING_PROGRESSIVE", "INTERMITTENT_FLUCTUATING", "IMPROVING", "RESOLVED"]>, z.ZodString]>>;
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
}, "strict", z.ZodTypeAny, {
    id: string;
    timestamp: string;
    sessionId: string;
    source: "KIOSK_TOUCHSCREEN" | "KIOSK_VOICE_ASSISTANT" | "HARDWARE_DAEMON" | "MANUAL_STAFF_OVERRIDE";
    eventType: "ASSOCIATED_SYMPTOM_DETECTED";
    payload: {
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
    };
    patientId?: string | undefined;
}, {
    id: string;
    timestamp: string;
    sessionId: string;
    eventType: "ASSOCIATED_SYMPTOM_DETECTED";
    payload: {
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
    };
    patientId?: string | undefined;
    source?: "KIOSK_TOUCHSCREEN" | "KIOSK_VOICE_ASSISTANT" | "HARDWARE_DAEMON" | "MANUAL_STAFF_OVERRIDE" | undefined;
}>;
export declare const QuestionnaireAnswerEventSchema: z.ZodObject<{
    id: z.ZodString;
    timestamp: z.ZodString;
    sessionId: z.ZodString;
    patientId: z.ZodOptional<z.ZodString>;
    source: z.ZodDefault<z.ZodEnum<["KIOSK_TOUCHSCREEN", "KIOSK_VOICE_ASSISTANT", "HARDWARE_DAEMON", "MANUAL_STAFF_OVERRIDE"]>>;
} & {
    eventType: z.ZodLiteral<"NEW_QUESTIONNAIRE_ANSWER">;
    payload: z.ZodEffects<z.ZodObject<{
        questionId: z.ZodString;
        questionText: z.ZodString;
        category: z.ZodDefault<z.ZodEnum<["RED_FLAG_SCREENING", "CARDIOVASCULAR", "RESPIRATORY", "NEUROLOGICAL", "TRAUMA_INJURY", "MEDICATION_HISTORY", "PAST_MEDICAL_HISTORY", "PREGNANCY_OBSTETRIC", "GENERAL"]>>;
        questionType: z.ZodEnum<["BOOLEAN", "SINGLE_CHOICE", "MULTI_CHOICE", "NUMERIC", "FREE_TEXT"]>;
        answerValue: z.ZodUnion<[z.ZodBoolean, z.ZodString, z.ZodNumber, z.ZodArray<z.ZodString, "many">]>;
        responseLatencySeconds: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        questionId: string;
        questionText: string;
        category: "RED_FLAG_SCREENING" | "CARDIOVASCULAR" | "RESPIRATORY" | "NEUROLOGICAL" | "TRAUMA_INJURY" | "MEDICATION_HISTORY" | "PAST_MEDICAL_HISTORY" | "PREGNANCY_OBSTETRIC" | "GENERAL";
        questionType: "BOOLEAN" | "SINGLE_CHOICE" | "MULTI_CHOICE" | "NUMERIC" | "FREE_TEXT";
        answerValue: string | number | boolean | string[];
        responseLatencySeconds?: number | undefined;
    }, {
        questionId: string;
        questionText: string;
        questionType: "BOOLEAN" | "SINGLE_CHOICE" | "MULTI_CHOICE" | "NUMERIC" | "FREE_TEXT";
        answerValue: string | number | boolean | string[];
        category?: "RED_FLAG_SCREENING" | "CARDIOVASCULAR" | "RESPIRATORY" | "NEUROLOGICAL" | "TRAUMA_INJURY" | "MEDICATION_HISTORY" | "PAST_MEDICAL_HISTORY" | "PREGNANCY_OBSTETRIC" | "GENERAL" | undefined;
        responseLatencySeconds?: number | undefined;
    }>, {
        questionId: string;
        questionText: string;
        category: "RED_FLAG_SCREENING" | "CARDIOVASCULAR" | "RESPIRATORY" | "NEUROLOGICAL" | "TRAUMA_INJURY" | "MEDICATION_HISTORY" | "PAST_MEDICAL_HISTORY" | "PREGNANCY_OBSTETRIC" | "GENERAL";
        questionType: "BOOLEAN" | "SINGLE_CHOICE" | "MULTI_CHOICE" | "NUMERIC" | "FREE_TEXT";
        answerValue: string | number | boolean | string[];
        responseLatencySeconds?: number | undefined;
    }, {
        questionId: string;
        questionText: string;
        questionType: "BOOLEAN" | "SINGLE_CHOICE" | "MULTI_CHOICE" | "NUMERIC" | "FREE_TEXT";
        answerValue: string | number | boolean | string[];
        category?: "RED_FLAG_SCREENING" | "CARDIOVASCULAR" | "RESPIRATORY" | "NEUROLOGICAL" | "TRAUMA_INJURY" | "MEDICATION_HISTORY" | "PAST_MEDICAL_HISTORY" | "PREGNANCY_OBSTETRIC" | "GENERAL" | undefined;
        responseLatencySeconds?: number | undefined;
    }>;
}, "strict", z.ZodTypeAny, {
    id: string;
    timestamp: string;
    sessionId: string;
    source: "KIOSK_TOUCHSCREEN" | "KIOSK_VOICE_ASSISTANT" | "HARDWARE_DAEMON" | "MANUAL_STAFF_OVERRIDE";
    eventType: "NEW_QUESTIONNAIRE_ANSWER";
    payload: {
        questionId: string;
        questionText: string;
        category: "RED_FLAG_SCREENING" | "CARDIOVASCULAR" | "RESPIRATORY" | "NEUROLOGICAL" | "TRAUMA_INJURY" | "MEDICATION_HISTORY" | "PAST_MEDICAL_HISTORY" | "PREGNANCY_OBSTETRIC" | "GENERAL";
        questionType: "BOOLEAN" | "SINGLE_CHOICE" | "MULTI_CHOICE" | "NUMERIC" | "FREE_TEXT";
        answerValue: string | number | boolean | string[];
        responseLatencySeconds?: number | undefined;
    };
    patientId?: string | undefined;
}, {
    id: string;
    timestamp: string;
    sessionId: string;
    eventType: "NEW_QUESTIONNAIRE_ANSWER";
    payload: {
        questionId: string;
        questionText: string;
        questionType: "BOOLEAN" | "SINGLE_CHOICE" | "MULTI_CHOICE" | "NUMERIC" | "FREE_TEXT";
        answerValue: string | number | boolean | string[];
        category?: "RED_FLAG_SCREENING" | "CARDIOVASCULAR" | "RESPIRATORY" | "NEUROLOGICAL" | "TRAUMA_INJURY" | "MEDICATION_HISTORY" | "PAST_MEDICAL_HISTORY" | "PREGNANCY_OBSTETRIC" | "GENERAL" | undefined;
        responseLatencySeconds?: number | undefined;
    };
    patientId?: string | undefined;
    source?: "KIOSK_TOUCHSCREEN" | "KIOSK_VOICE_ASSISTANT" | "HARDWARE_DAEMON" | "MANUAL_STAFF_OVERRIDE" | undefined;
}>;
export declare const VitalReadingEventSchema: z.ZodObject<{
    id: z.ZodString;
    timestamp: z.ZodString;
    sessionId: z.ZodString;
    patientId: z.ZodOptional<z.ZodString>;
    source: z.ZodDefault<z.ZodEnum<["KIOSK_TOUCHSCREEN", "KIOSK_VOICE_ASSISTANT", "HARDWARE_DAEMON", "MANUAL_STAFF_OVERRIDE"]>>;
} & {
    eventType: z.ZodLiteral<"NEW_VITAL_READING">;
    payload: z.ZodEffects<z.ZodObject<{
        vitalType: z.ZodEnum<["HEART_RATE", "BLOOD_PRESSURE", "SPO2", "TEMPERATURE", "RESPIRATORY_RATE", "BLOOD_GLUCOSE"]>;
        value: z.ZodUnion<[z.ZodNumber, z.ZodEffects<z.ZodObject<{
            systolic: z.ZodNumber;
            diastolic: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            systolic: number;
            diastolic: number;
        }, {
            systolic: number;
            diastolic: number;
        }>, {
            systolic: number;
            diastolic: number;
        }, {
            systolic: number;
            diastolic: number;
        }>]>;
        unit: z.ZodEnum<["bpm", "mmHg", "%", "degC", "degF", "breaths_min", "mg_dL", "mmol_L"]>;
        deviceSource: z.ZodDefault<z.ZodEnum<["BLE_PULSE_OXIMETER", "BLE_BP_CUFF", "BLE_THERMOMETER", "BLE_GLUCOMETER", "INTEGRATED_KIOSK_SENSOR", "MANUAL_KIOSK_ENTRY", "CAMERA_PHOTOPLETHYSMOGRAPHY", "OTHER"]>>;
        measurementQuality: z.ZodDefault<z.ZodEnum<["HIGH", "ACCEPTABLE", "LOW_CONFIDENCE", "MOTION_ARTIFACT_DETECTED"]>>;
        deviceId: z.ZodOptional<z.ZodString>;
        sampledAt: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        value: number | {
            systolic: number;
            diastolic: number;
        };
        vitalType: "HEART_RATE" | "BLOOD_PRESSURE" | "SPO2" | "TEMPERATURE" | "RESPIRATORY_RATE" | "BLOOD_GLUCOSE";
        unit: "bpm" | "mmHg" | "%" | "degC" | "degF" | "breaths_min" | "mg_dL" | "mmol_L";
        deviceSource: "OTHER" | "BLE_PULSE_OXIMETER" | "BLE_BP_CUFF" | "BLE_THERMOMETER" | "BLE_GLUCOMETER" | "INTEGRATED_KIOSK_SENSOR" | "MANUAL_KIOSK_ENTRY" | "CAMERA_PHOTOPLETHYSMOGRAPHY";
        measurementQuality: "HIGH" | "ACCEPTABLE" | "LOW_CONFIDENCE" | "MOTION_ARTIFACT_DETECTED";
        deviceId?: string | undefined;
        sampledAt?: string | undefined;
    }, {
        value: number | {
            systolic: number;
            diastolic: number;
        };
        vitalType: "HEART_RATE" | "BLOOD_PRESSURE" | "SPO2" | "TEMPERATURE" | "RESPIRATORY_RATE" | "BLOOD_GLUCOSE";
        unit: "bpm" | "mmHg" | "%" | "degC" | "degF" | "breaths_min" | "mg_dL" | "mmol_L";
        deviceSource?: "OTHER" | "BLE_PULSE_OXIMETER" | "BLE_BP_CUFF" | "BLE_THERMOMETER" | "BLE_GLUCOMETER" | "INTEGRATED_KIOSK_SENSOR" | "MANUAL_KIOSK_ENTRY" | "CAMERA_PHOTOPLETHYSMOGRAPHY" | undefined;
        measurementQuality?: "HIGH" | "ACCEPTABLE" | "LOW_CONFIDENCE" | "MOTION_ARTIFACT_DETECTED" | undefined;
        deviceId?: string | undefined;
        sampledAt?: string | undefined;
    }>, {
        value: number | {
            systolic: number;
            diastolic: number;
        };
        vitalType: "HEART_RATE" | "BLOOD_PRESSURE" | "SPO2" | "TEMPERATURE" | "RESPIRATORY_RATE" | "BLOOD_GLUCOSE";
        unit: "bpm" | "mmHg" | "%" | "degC" | "degF" | "breaths_min" | "mg_dL" | "mmol_L";
        deviceSource: "OTHER" | "BLE_PULSE_OXIMETER" | "BLE_BP_CUFF" | "BLE_THERMOMETER" | "BLE_GLUCOMETER" | "INTEGRATED_KIOSK_SENSOR" | "MANUAL_KIOSK_ENTRY" | "CAMERA_PHOTOPLETHYSMOGRAPHY";
        measurementQuality: "HIGH" | "ACCEPTABLE" | "LOW_CONFIDENCE" | "MOTION_ARTIFACT_DETECTED";
        deviceId?: string | undefined;
        sampledAt?: string | undefined;
    }, {
        value: number | {
            systolic: number;
            diastolic: number;
        };
        vitalType: "HEART_RATE" | "BLOOD_PRESSURE" | "SPO2" | "TEMPERATURE" | "RESPIRATORY_RATE" | "BLOOD_GLUCOSE";
        unit: "bpm" | "mmHg" | "%" | "degC" | "degF" | "breaths_min" | "mg_dL" | "mmol_L";
        deviceSource?: "OTHER" | "BLE_PULSE_OXIMETER" | "BLE_BP_CUFF" | "BLE_THERMOMETER" | "BLE_GLUCOMETER" | "INTEGRATED_KIOSK_SENSOR" | "MANUAL_KIOSK_ENTRY" | "CAMERA_PHOTOPLETHYSMOGRAPHY" | undefined;
        measurementQuality?: "HIGH" | "ACCEPTABLE" | "LOW_CONFIDENCE" | "MOTION_ARTIFACT_DETECTED" | undefined;
        deviceId?: string | undefined;
        sampledAt?: string | undefined;
    }>;
}, "strict", z.ZodTypeAny, {
    id: string;
    timestamp: string;
    sessionId: string;
    source: "KIOSK_TOUCHSCREEN" | "KIOSK_VOICE_ASSISTANT" | "HARDWARE_DAEMON" | "MANUAL_STAFF_OVERRIDE";
    eventType: "NEW_VITAL_READING";
    payload: {
        value: number | {
            systolic: number;
            diastolic: number;
        };
        vitalType: "HEART_RATE" | "BLOOD_PRESSURE" | "SPO2" | "TEMPERATURE" | "RESPIRATORY_RATE" | "BLOOD_GLUCOSE";
        unit: "bpm" | "mmHg" | "%" | "degC" | "degF" | "breaths_min" | "mg_dL" | "mmol_L";
        deviceSource: "OTHER" | "BLE_PULSE_OXIMETER" | "BLE_BP_CUFF" | "BLE_THERMOMETER" | "BLE_GLUCOMETER" | "INTEGRATED_KIOSK_SENSOR" | "MANUAL_KIOSK_ENTRY" | "CAMERA_PHOTOPLETHYSMOGRAPHY";
        measurementQuality: "HIGH" | "ACCEPTABLE" | "LOW_CONFIDENCE" | "MOTION_ARTIFACT_DETECTED";
        deviceId?: string | undefined;
        sampledAt?: string | undefined;
    };
    patientId?: string | undefined;
}, {
    id: string;
    timestamp: string;
    sessionId: string;
    eventType: "NEW_VITAL_READING";
    payload: {
        value: number | {
            systolic: number;
            diastolic: number;
        };
        vitalType: "HEART_RATE" | "BLOOD_PRESSURE" | "SPO2" | "TEMPERATURE" | "RESPIRATORY_RATE" | "BLOOD_GLUCOSE";
        unit: "bpm" | "mmHg" | "%" | "degC" | "degF" | "breaths_min" | "mg_dL" | "mmol_L";
        deviceSource?: "OTHER" | "BLE_PULSE_OXIMETER" | "BLE_BP_CUFF" | "BLE_THERMOMETER" | "BLE_GLUCOMETER" | "INTEGRATED_KIOSK_SENSOR" | "MANUAL_KIOSK_ENTRY" | "CAMERA_PHOTOPLETHYSMOGRAPHY" | undefined;
        measurementQuality?: "HIGH" | "ACCEPTABLE" | "LOW_CONFIDENCE" | "MOTION_ARTIFACT_DETECTED" | undefined;
        deviceId?: string | undefined;
        sampledAt?: string | undefined;
    };
    patientId?: string | undefined;
    source?: "KIOSK_TOUCHSCREEN" | "KIOSK_VOICE_ASSISTANT" | "HARDWARE_DAEMON" | "MANUAL_STAFF_OVERRIDE" | undefined;
}>;
export declare const PatientEventSchema: z.ZodDiscriminatedUnion<"eventType", [z.ZodObject<{
    id: z.ZodString;
    timestamp: z.ZodString;
    sessionId: z.ZodString;
    patientId: z.ZodOptional<z.ZodString>;
    source: z.ZodDefault<z.ZodEnum<["KIOSK_TOUCHSCREEN", "KIOSK_VOICE_ASSISTANT", "HARDWARE_DAEMON", "MANUAL_STAFF_OVERRIDE"]>>;
} & {
    eventType: z.ZodLiteral<"NEW_SYMPTOM_ADDED">;
    payload: z.ZodObject<{
        symptomName: z.ZodString;
        severity: z.ZodNumber;
        site: z.ZodUnion<[z.ZodEnum<["HEAD", "EYES", "EARS_NOSE_THROAT", "NECK", "CHEST", "ABDOMEN_UPPER", "ABDOMEN_LOWER", "BACK_UPPER", "BACK_LOWER", "PELVIS_GROIN", "LEFT_ARM", "RIGHT_ARM", "LEFT_LEG", "RIGHT_LEG", "GENERALIZED_BODY", "SKIN", "OTHER"]>, z.ZodString]>;
        onset: z.ZodUnion<[z.ZodEnum<["SUDDEN_THUNDERCLAP", "ACUTE", "GRADUAL_SUBACUTE", "CHRONIC", "RECURRENT_EPISODIC"]>, z.ZodString]>;
        durationMinutes: z.ZodOptional<z.ZodNumber>;
        character: z.ZodOptional<z.ZodUnion<[z.ZodEnum<["SHARP_STABBING", "DULL_ACHING", "BURNING", "CRUSHING_HEAVY", "THROBBING", "CRAMPING_COLICKY", "ELECTRIC_TINGLING", "PRESSURE_TIGHTNESS", "OTHER"]>, z.ZodString]>>;
        radiation: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        associatedSymptoms: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        exacerbatingFactors: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        relievingFactors: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        timeCourse: z.ZodOptional<z.ZodUnion<[z.ZodEnum<["CONSTANT_PERSISTENT", "WORSENING_PROGRESSIVE", "INTERMITTENT_FLUCTUATING", "IMPROVING", "RESOLVED"]>, z.ZodString]>>;
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
}, "strict", z.ZodTypeAny, {
    id: string;
    timestamp: string;
    sessionId: string;
    source: "KIOSK_TOUCHSCREEN" | "KIOSK_VOICE_ASSISTANT" | "HARDWARE_DAEMON" | "MANUAL_STAFF_OVERRIDE";
    eventType: "NEW_SYMPTOM_ADDED";
    payload: {
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
    };
    patientId?: string | undefined;
}, {
    id: string;
    timestamp: string;
    sessionId: string;
    eventType: "NEW_SYMPTOM_ADDED";
    payload: {
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
    };
    patientId?: string | undefined;
    source?: "KIOSK_TOUCHSCREEN" | "KIOSK_VOICE_ASSISTANT" | "HARDWARE_DAEMON" | "MANUAL_STAFF_OVERRIDE" | undefined;
}>, z.ZodObject<{
    id: z.ZodString;
    timestamp: z.ZodString;
    sessionId: z.ZodString;
    patientId: z.ZodOptional<z.ZodString>;
    source: z.ZodDefault<z.ZodEnum<["KIOSK_TOUCHSCREEN", "KIOSK_VOICE_ASSISTANT", "HARDWARE_DAEMON", "MANUAL_STAFF_OVERRIDE"]>>;
} & {
    eventType: z.ZodLiteral<"SYMPTOM_SEVERITY_UPDATED">;
    payload: z.ZodObject<{
        symptomName: z.ZodString;
        severity: z.ZodNumber;
        site: z.ZodUnion<[z.ZodEnum<["HEAD", "EYES", "EARS_NOSE_THROAT", "NECK", "CHEST", "ABDOMEN_UPPER", "ABDOMEN_LOWER", "BACK_UPPER", "BACK_LOWER", "PELVIS_GROIN", "LEFT_ARM", "RIGHT_ARM", "LEFT_LEG", "RIGHT_LEG", "GENERALIZED_BODY", "SKIN", "OTHER"]>, z.ZodString]>;
        onset: z.ZodUnion<[z.ZodEnum<["SUDDEN_THUNDERCLAP", "ACUTE", "GRADUAL_SUBACUTE", "CHRONIC", "RECURRENT_EPISODIC"]>, z.ZodString]>;
        durationMinutes: z.ZodOptional<z.ZodNumber>;
        character: z.ZodOptional<z.ZodUnion<[z.ZodEnum<["SHARP_STABBING", "DULL_ACHING", "BURNING", "CRUSHING_HEAVY", "THROBBING", "CRAMPING_COLICKY", "ELECTRIC_TINGLING", "PRESSURE_TIGHTNESS", "OTHER"]>, z.ZodString]>>;
        radiation: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        associatedSymptoms: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        exacerbatingFactors: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        relievingFactors: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        timeCourse: z.ZodOptional<z.ZodUnion<[z.ZodEnum<["CONSTANT_PERSISTENT", "WORSENING_PROGRESSIVE", "INTERMITTENT_FLUCTUATING", "IMPROVING", "RESOLVED"]>, z.ZodString]>>;
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
}, "strict", z.ZodTypeAny, {
    id: string;
    timestamp: string;
    sessionId: string;
    source: "KIOSK_TOUCHSCREEN" | "KIOSK_VOICE_ASSISTANT" | "HARDWARE_DAEMON" | "MANUAL_STAFF_OVERRIDE";
    eventType: "SYMPTOM_SEVERITY_UPDATED";
    payload: {
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
    };
    patientId?: string | undefined;
}, {
    id: string;
    timestamp: string;
    sessionId: string;
    eventType: "SYMPTOM_SEVERITY_UPDATED";
    payload: {
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
    };
    patientId?: string | undefined;
    source?: "KIOSK_TOUCHSCREEN" | "KIOSK_VOICE_ASSISTANT" | "HARDWARE_DAEMON" | "MANUAL_STAFF_OVERRIDE" | undefined;
}>, z.ZodObject<{
    id: z.ZodString;
    timestamp: z.ZodString;
    sessionId: z.ZodString;
    patientId: z.ZodOptional<z.ZodString>;
    source: z.ZodDefault<z.ZodEnum<["KIOSK_TOUCHSCREEN", "KIOSK_VOICE_ASSISTANT", "HARDWARE_DAEMON", "MANUAL_STAFF_OVERRIDE"]>>;
} & {
    eventType: z.ZodLiteral<"ASSOCIATED_SYMPTOM_DETECTED">;
    payload: z.ZodObject<{
        symptomName: z.ZodString;
        severity: z.ZodNumber;
        site: z.ZodUnion<[z.ZodEnum<["HEAD", "EYES", "EARS_NOSE_THROAT", "NECK", "CHEST", "ABDOMEN_UPPER", "ABDOMEN_LOWER", "BACK_UPPER", "BACK_LOWER", "PELVIS_GROIN", "LEFT_ARM", "RIGHT_ARM", "LEFT_LEG", "RIGHT_LEG", "GENERALIZED_BODY", "SKIN", "OTHER"]>, z.ZodString]>;
        onset: z.ZodUnion<[z.ZodEnum<["SUDDEN_THUNDERCLAP", "ACUTE", "GRADUAL_SUBACUTE", "CHRONIC", "RECURRENT_EPISODIC"]>, z.ZodString]>;
        durationMinutes: z.ZodOptional<z.ZodNumber>;
        character: z.ZodOptional<z.ZodUnion<[z.ZodEnum<["SHARP_STABBING", "DULL_ACHING", "BURNING", "CRUSHING_HEAVY", "THROBBING", "CRAMPING_COLICKY", "ELECTRIC_TINGLING", "PRESSURE_TIGHTNESS", "OTHER"]>, z.ZodString]>>;
        radiation: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        associatedSymptoms: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        exacerbatingFactors: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        relievingFactors: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        timeCourse: z.ZodOptional<z.ZodUnion<[z.ZodEnum<["CONSTANT_PERSISTENT", "WORSENING_PROGRESSIVE", "INTERMITTENT_FLUCTUATING", "IMPROVING", "RESOLVED"]>, z.ZodString]>>;
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
}, "strict", z.ZodTypeAny, {
    id: string;
    timestamp: string;
    sessionId: string;
    source: "KIOSK_TOUCHSCREEN" | "KIOSK_VOICE_ASSISTANT" | "HARDWARE_DAEMON" | "MANUAL_STAFF_OVERRIDE";
    eventType: "ASSOCIATED_SYMPTOM_DETECTED";
    payload: {
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
    };
    patientId?: string | undefined;
}, {
    id: string;
    timestamp: string;
    sessionId: string;
    eventType: "ASSOCIATED_SYMPTOM_DETECTED";
    payload: {
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
    };
    patientId?: string | undefined;
    source?: "KIOSK_TOUCHSCREEN" | "KIOSK_VOICE_ASSISTANT" | "HARDWARE_DAEMON" | "MANUAL_STAFF_OVERRIDE" | undefined;
}>, z.ZodObject<{
    id: z.ZodString;
    timestamp: z.ZodString;
    sessionId: z.ZodString;
    patientId: z.ZodOptional<z.ZodString>;
    source: z.ZodDefault<z.ZodEnum<["KIOSK_TOUCHSCREEN", "KIOSK_VOICE_ASSISTANT", "HARDWARE_DAEMON", "MANUAL_STAFF_OVERRIDE"]>>;
} & {
    eventType: z.ZodLiteral<"NEW_QUESTIONNAIRE_ANSWER">;
    payload: z.ZodEffects<z.ZodObject<{
        questionId: z.ZodString;
        questionText: z.ZodString;
        category: z.ZodDefault<z.ZodEnum<["RED_FLAG_SCREENING", "CARDIOVASCULAR", "RESPIRATORY", "NEUROLOGICAL", "TRAUMA_INJURY", "MEDICATION_HISTORY", "PAST_MEDICAL_HISTORY", "PREGNANCY_OBSTETRIC", "GENERAL"]>>;
        questionType: z.ZodEnum<["BOOLEAN", "SINGLE_CHOICE", "MULTI_CHOICE", "NUMERIC", "FREE_TEXT"]>;
        answerValue: z.ZodUnion<[z.ZodBoolean, z.ZodString, z.ZodNumber, z.ZodArray<z.ZodString, "many">]>;
        responseLatencySeconds: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        questionId: string;
        questionText: string;
        category: "RED_FLAG_SCREENING" | "CARDIOVASCULAR" | "RESPIRATORY" | "NEUROLOGICAL" | "TRAUMA_INJURY" | "MEDICATION_HISTORY" | "PAST_MEDICAL_HISTORY" | "PREGNANCY_OBSTETRIC" | "GENERAL";
        questionType: "BOOLEAN" | "SINGLE_CHOICE" | "MULTI_CHOICE" | "NUMERIC" | "FREE_TEXT";
        answerValue: string | number | boolean | string[];
        responseLatencySeconds?: number | undefined;
    }, {
        questionId: string;
        questionText: string;
        questionType: "BOOLEAN" | "SINGLE_CHOICE" | "MULTI_CHOICE" | "NUMERIC" | "FREE_TEXT";
        answerValue: string | number | boolean | string[];
        category?: "RED_FLAG_SCREENING" | "CARDIOVASCULAR" | "RESPIRATORY" | "NEUROLOGICAL" | "TRAUMA_INJURY" | "MEDICATION_HISTORY" | "PAST_MEDICAL_HISTORY" | "PREGNANCY_OBSTETRIC" | "GENERAL" | undefined;
        responseLatencySeconds?: number | undefined;
    }>, {
        questionId: string;
        questionText: string;
        category: "RED_FLAG_SCREENING" | "CARDIOVASCULAR" | "RESPIRATORY" | "NEUROLOGICAL" | "TRAUMA_INJURY" | "MEDICATION_HISTORY" | "PAST_MEDICAL_HISTORY" | "PREGNANCY_OBSTETRIC" | "GENERAL";
        questionType: "BOOLEAN" | "SINGLE_CHOICE" | "MULTI_CHOICE" | "NUMERIC" | "FREE_TEXT";
        answerValue: string | number | boolean | string[];
        responseLatencySeconds?: number | undefined;
    }, {
        questionId: string;
        questionText: string;
        questionType: "BOOLEAN" | "SINGLE_CHOICE" | "MULTI_CHOICE" | "NUMERIC" | "FREE_TEXT";
        answerValue: string | number | boolean | string[];
        category?: "RED_FLAG_SCREENING" | "CARDIOVASCULAR" | "RESPIRATORY" | "NEUROLOGICAL" | "TRAUMA_INJURY" | "MEDICATION_HISTORY" | "PAST_MEDICAL_HISTORY" | "PREGNANCY_OBSTETRIC" | "GENERAL" | undefined;
        responseLatencySeconds?: number | undefined;
    }>;
}, "strict", z.ZodTypeAny, {
    id: string;
    timestamp: string;
    sessionId: string;
    source: "KIOSK_TOUCHSCREEN" | "KIOSK_VOICE_ASSISTANT" | "HARDWARE_DAEMON" | "MANUAL_STAFF_OVERRIDE";
    eventType: "NEW_QUESTIONNAIRE_ANSWER";
    payload: {
        questionId: string;
        questionText: string;
        category: "RED_FLAG_SCREENING" | "CARDIOVASCULAR" | "RESPIRATORY" | "NEUROLOGICAL" | "TRAUMA_INJURY" | "MEDICATION_HISTORY" | "PAST_MEDICAL_HISTORY" | "PREGNANCY_OBSTETRIC" | "GENERAL";
        questionType: "BOOLEAN" | "SINGLE_CHOICE" | "MULTI_CHOICE" | "NUMERIC" | "FREE_TEXT";
        answerValue: string | number | boolean | string[];
        responseLatencySeconds?: number | undefined;
    };
    patientId?: string | undefined;
}, {
    id: string;
    timestamp: string;
    sessionId: string;
    eventType: "NEW_QUESTIONNAIRE_ANSWER";
    payload: {
        questionId: string;
        questionText: string;
        questionType: "BOOLEAN" | "SINGLE_CHOICE" | "MULTI_CHOICE" | "NUMERIC" | "FREE_TEXT";
        answerValue: string | number | boolean | string[];
        category?: "RED_FLAG_SCREENING" | "CARDIOVASCULAR" | "RESPIRATORY" | "NEUROLOGICAL" | "TRAUMA_INJURY" | "MEDICATION_HISTORY" | "PAST_MEDICAL_HISTORY" | "PREGNANCY_OBSTETRIC" | "GENERAL" | undefined;
        responseLatencySeconds?: number | undefined;
    };
    patientId?: string | undefined;
    source?: "KIOSK_TOUCHSCREEN" | "KIOSK_VOICE_ASSISTANT" | "HARDWARE_DAEMON" | "MANUAL_STAFF_OVERRIDE" | undefined;
}>, z.ZodObject<{
    id: z.ZodString;
    timestamp: z.ZodString;
    sessionId: z.ZodString;
    patientId: z.ZodOptional<z.ZodString>;
    source: z.ZodDefault<z.ZodEnum<["KIOSK_TOUCHSCREEN", "KIOSK_VOICE_ASSISTANT", "HARDWARE_DAEMON", "MANUAL_STAFF_OVERRIDE"]>>;
} & {
    eventType: z.ZodLiteral<"NEW_VITAL_READING">;
    payload: z.ZodEffects<z.ZodObject<{
        vitalType: z.ZodEnum<["HEART_RATE", "BLOOD_PRESSURE", "SPO2", "TEMPERATURE", "RESPIRATORY_RATE", "BLOOD_GLUCOSE"]>;
        value: z.ZodUnion<[z.ZodNumber, z.ZodEffects<z.ZodObject<{
            systolic: z.ZodNumber;
            diastolic: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            systolic: number;
            diastolic: number;
        }, {
            systolic: number;
            diastolic: number;
        }>, {
            systolic: number;
            diastolic: number;
        }, {
            systolic: number;
            diastolic: number;
        }>]>;
        unit: z.ZodEnum<["bpm", "mmHg", "%", "degC", "degF", "breaths_min", "mg_dL", "mmol_L"]>;
        deviceSource: z.ZodDefault<z.ZodEnum<["BLE_PULSE_OXIMETER", "BLE_BP_CUFF", "BLE_THERMOMETER", "BLE_GLUCOMETER", "INTEGRATED_KIOSK_SENSOR", "MANUAL_KIOSK_ENTRY", "CAMERA_PHOTOPLETHYSMOGRAPHY", "OTHER"]>>;
        measurementQuality: z.ZodDefault<z.ZodEnum<["HIGH", "ACCEPTABLE", "LOW_CONFIDENCE", "MOTION_ARTIFACT_DETECTED"]>>;
        deviceId: z.ZodOptional<z.ZodString>;
        sampledAt: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        value: number | {
            systolic: number;
            diastolic: number;
        };
        vitalType: "HEART_RATE" | "BLOOD_PRESSURE" | "SPO2" | "TEMPERATURE" | "RESPIRATORY_RATE" | "BLOOD_GLUCOSE";
        unit: "bpm" | "mmHg" | "%" | "degC" | "degF" | "breaths_min" | "mg_dL" | "mmol_L";
        deviceSource: "OTHER" | "BLE_PULSE_OXIMETER" | "BLE_BP_CUFF" | "BLE_THERMOMETER" | "BLE_GLUCOMETER" | "INTEGRATED_KIOSK_SENSOR" | "MANUAL_KIOSK_ENTRY" | "CAMERA_PHOTOPLETHYSMOGRAPHY";
        measurementQuality: "HIGH" | "ACCEPTABLE" | "LOW_CONFIDENCE" | "MOTION_ARTIFACT_DETECTED";
        deviceId?: string | undefined;
        sampledAt?: string | undefined;
    }, {
        value: number | {
            systolic: number;
            diastolic: number;
        };
        vitalType: "HEART_RATE" | "BLOOD_PRESSURE" | "SPO2" | "TEMPERATURE" | "RESPIRATORY_RATE" | "BLOOD_GLUCOSE";
        unit: "bpm" | "mmHg" | "%" | "degC" | "degF" | "breaths_min" | "mg_dL" | "mmol_L";
        deviceSource?: "OTHER" | "BLE_PULSE_OXIMETER" | "BLE_BP_CUFF" | "BLE_THERMOMETER" | "BLE_GLUCOMETER" | "INTEGRATED_KIOSK_SENSOR" | "MANUAL_KIOSK_ENTRY" | "CAMERA_PHOTOPLETHYSMOGRAPHY" | undefined;
        measurementQuality?: "HIGH" | "ACCEPTABLE" | "LOW_CONFIDENCE" | "MOTION_ARTIFACT_DETECTED" | undefined;
        deviceId?: string | undefined;
        sampledAt?: string | undefined;
    }>, {
        value: number | {
            systolic: number;
            diastolic: number;
        };
        vitalType: "HEART_RATE" | "BLOOD_PRESSURE" | "SPO2" | "TEMPERATURE" | "RESPIRATORY_RATE" | "BLOOD_GLUCOSE";
        unit: "bpm" | "mmHg" | "%" | "degC" | "degF" | "breaths_min" | "mg_dL" | "mmol_L";
        deviceSource: "OTHER" | "BLE_PULSE_OXIMETER" | "BLE_BP_CUFF" | "BLE_THERMOMETER" | "BLE_GLUCOMETER" | "INTEGRATED_KIOSK_SENSOR" | "MANUAL_KIOSK_ENTRY" | "CAMERA_PHOTOPLETHYSMOGRAPHY";
        measurementQuality: "HIGH" | "ACCEPTABLE" | "LOW_CONFIDENCE" | "MOTION_ARTIFACT_DETECTED";
        deviceId?: string | undefined;
        sampledAt?: string | undefined;
    }, {
        value: number | {
            systolic: number;
            diastolic: number;
        };
        vitalType: "HEART_RATE" | "BLOOD_PRESSURE" | "SPO2" | "TEMPERATURE" | "RESPIRATORY_RATE" | "BLOOD_GLUCOSE";
        unit: "bpm" | "mmHg" | "%" | "degC" | "degF" | "breaths_min" | "mg_dL" | "mmol_L";
        deviceSource?: "OTHER" | "BLE_PULSE_OXIMETER" | "BLE_BP_CUFF" | "BLE_THERMOMETER" | "BLE_GLUCOMETER" | "INTEGRATED_KIOSK_SENSOR" | "MANUAL_KIOSK_ENTRY" | "CAMERA_PHOTOPLETHYSMOGRAPHY" | undefined;
        measurementQuality?: "HIGH" | "ACCEPTABLE" | "LOW_CONFIDENCE" | "MOTION_ARTIFACT_DETECTED" | undefined;
        deviceId?: string | undefined;
        sampledAt?: string | undefined;
    }>;
}, "strict", z.ZodTypeAny, {
    id: string;
    timestamp: string;
    sessionId: string;
    source: "KIOSK_TOUCHSCREEN" | "KIOSK_VOICE_ASSISTANT" | "HARDWARE_DAEMON" | "MANUAL_STAFF_OVERRIDE";
    eventType: "NEW_VITAL_READING";
    payload: {
        value: number | {
            systolic: number;
            diastolic: number;
        };
        vitalType: "HEART_RATE" | "BLOOD_PRESSURE" | "SPO2" | "TEMPERATURE" | "RESPIRATORY_RATE" | "BLOOD_GLUCOSE";
        unit: "bpm" | "mmHg" | "%" | "degC" | "degF" | "breaths_min" | "mg_dL" | "mmol_L";
        deviceSource: "OTHER" | "BLE_PULSE_OXIMETER" | "BLE_BP_CUFF" | "BLE_THERMOMETER" | "BLE_GLUCOMETER" | "INTEGRATED_KIOSK_SENSOR" | "MANUAL_KIOSK_ENTRY" | "CAMERA_PHOTOPLETHYSMOGRAPHY";
        measurementQuality: "HIGH" | "ACCEPTABLE" | "LOW_CONFIDENCE" | "MOTION_ARTIFACT_DETECTED";
        deviceId?: string | undefined;
        sampledAt?: string | undefined;
    };
    patientId?: string | undefined;
}, {
    id: string;
    timestamp: string;
    sessionId: string;
    eventType: "NEW_VITAL_READING";
    payload: {
        value: number | {
            systolic: number;
            diastolic: number;
        };
        vitalType: "HEART_RATE" | "BLOOD_PRESSURE" | "SPO2" | "TEMPERATURE" | "RESPIRATORY_RATE" | "BLOOD_GLUCOSE";
        unit: "bpm" | "mmHg" | "%" | "degC" | "degF" | "breaths_min" | "mg_dL" | "mmol_L";
        deviceSource?: "OTHER" | "BLE_PULSE_OXIMETER" | "BLE_BP_CUFF" | "BLE_THERMOMETER" | "BLE_GLUCOMETER" | "INTEGRATED_KIOSK_SENSOR" | "MANUAL_KIOSK_ENTRY" | "CAMERA_PHOTOPLETHYSMOGRAPHY" | undefined;
        measurementQuality?: "HIGH" | "ACCEPTABLE" | "LOW_CONFIDENCE" | "MOTION_ARTIFACT_DETECTED" | undefined;
        deviceId?: string | undefined;
        sampledAt?: string | undefined;
    };
    patientId?: string | undefined;
    source?: "KIOSK_TOUCHSCREEN" | "KIOSK_VOICE_ASSISTANT" | "HARDWARE_DAEMON" | "MANUAL_STAFF_OVERRIDE" | undefined;
}>]>;
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
export type ValidationResult<T> = {
    success: true;
    data: T;
    error?: never;
} | {
    success: false;
    errors: ValidationErrorDetail[];
    rawEventType?: string;
    error: string;
};
/**
 * Validates raw event payloads before they enter the triage pipeline.
 */
export declare function validatePatientEvent(rawInput: unknown): ValidationResult<PatientEvent>;
