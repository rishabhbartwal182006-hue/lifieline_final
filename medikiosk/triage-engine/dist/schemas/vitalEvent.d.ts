import { z } from 'zod';
/**
 * Vital Reading Event Schema & Physiological Bounds
 *
 * Enforces biological/physical plausibility bounds to catch hardware artifacts
 * or disconnected sensors before readings enter the triage rule engine.
 */
export declare const VitalTypeEnum: z.ZodEnum<["HEART_RATE", "BLOOD_PRESSURE", "SPO2", "TEMPERATURE", "RESPIRATORY_RATE", "BLOOD_GLUCOSE"]>;
export declare const VitalUnitEnum: z.ZodEnum<["bpm", "mmHg", "%", "degC", "degF", "breaths_min", "mg_dL", "mmol_L"]>;
export declare const DeviceSourceEnum: z.ZodEnum<["BLE_PULSE_OXIMETER", "BLE_BP_CUFF", "BLE_THERMOMETER", "BLE_GLUCOMETER", "INTEGRATED_KIOSK_SENSOR", "MANUAL_KIOSK_ENTRY", "CAMERA_PHOTOPLETHYSMOGRAPHY", "OTHER"]>;
export declare const MeasurementQualityEnum: z.ZodEnum<["HIGH", "ACCEPTABLE", "LOW_CONFIDENCE", "MOTION_ARTIFACT_DETECTED"]>;
export declare const BloodPressureValueSchema: z.ZodEffects<z.ZodObject<{
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
}>;
export declare const ScalarVitalValueSchema: z.ZodNumber;
export declare const VitalPayloadSchema: z.ZodEffects<z.ZodObject<{
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
export type VitalPayload = z.infer<typeof VitalPayloadSchema>;
export type VitalType = z.infer<typeof VitalTypeEnum>;
export type VitalUnit = z.infer<typeof VitalUnitEnum>;
export type DeviceSource = z.infer<typeof DeviceSourceEnum>;
export type MeasurementQuality = z.infer<typeof MeasurementQualityEnum>;
export type BloodPressureValue = z.infer<typeof BloodPressureValueSchema>;
