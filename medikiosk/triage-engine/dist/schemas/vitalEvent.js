import { z } from 'zod';
/**
 * Vital Reading Event Schema & Physiological Bounds
 *
 * Enforces biological/physical plausibility bounds to catch hardware artifacts
 * or disconnected sensors before readings enter the triage rule engine.
 */
export const VitalTypeEnum = z.enum([
    'HEART_RATE',
    'BLOOD_PRESSURE',
    'SPO2',
    'TEMPERATURE',
    'RESPIRATORY_RATE',
    'BLOOD_GLUCOSE'
]);
export const VitalUnitEnum = z.enum([
    'bpm', // Heart Rate (beats per minute)
    'mmHg', // Blood Pressure (millimeters of mercury)
    '%', // SpO2 (percentage)
    'degC', // Temperature in Celsius
    'degF', // Temperature in Fahrenheit
    'breaths_min', // Respiratory rate
    'mg_dL', // Blood Glucose
    'mmol_L' // Blood Glucose
]);
export const DeviceSourceEnum = z.enum([
    'BLE_PULSE_OXIMETER',
    'BLE_BP_CUFF',
    'BLE_THERMOMETER',
    'BLE_GLUCOMETER',
    'INTEGRATED_KIOSK_SENSOR',
    'MANUAL_KIOSK_ENTRY',
    'CAMERA_PHOTOPLETHYSMOGRAPHY',
    'OTHER'
]);
export const MeasurementQualityEnum = z.enum([
    'HIGH',
    'ACCEPTABLE',
    'LOW_CONFIDENCE',
    'MOTION_ARTIFACT_DETECTED'
]);
export const BloodPressureValueSchema = z.object({
    systolic: z.number()
        .min(30, 'Systolic BP must be >= 30 mmHg (biological lower bound)')
        .max(300, 'Systolic BP must be <= 300 mmHg (biological upper bound)'),
    diastolic: z.number()
        .min(10, 'Diastolic BP must be >= 10 mmHg (biological lower bound)')
        .max(200, 'Diastolic BP must be <= 200 mmHg (biological upper bound)')
}).refine((data) => data.systolic > data.diastolic, {
    message: 'Systolic blood pressure must be greater than diastolic blood pressure',
    path: ['systolic']
});
export const ScalarVitalValueSchema = z.number();
export const VitalPayloadSchema = z.object({
    vitalType: VitalTypeEnum,
    value: z.union([ScalarVitalValueSchema, BloodPressureValueSchema]),
    unit: VitalUnitEnum,
    deviceSource: DeviceSourceEnum.default('INTEGRATED_KIOSK_SENSOR'),
    measurementQuality: MeasurementQualityEnum.default('HIGH'),
    deviceId: z.string().optional(),
    sampledAt: z.string().datetime().optional()
}).superRefine((data, ctx) => {
    switch (data.vitalType) {
        case 'HEART_RATE':
            if (typeof data.value !== 'number') {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'Heart rate value must be a number',
                    path: ['value']
                });
            }
            else if (data.value < 20 || data.value > 300) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: `Heart rate of ${data.value} bpm is outside physically possible biological limits (20-300 bpm)`,
                    path: ['value']
                });
            }
            if (data.unit !== 'bpm') {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: `Invalid unit '${data.unit}' for HEART_RATE (expected 'bpm')`,
                    path: ['unit']
                });
            }
            break;
        case 'SPO2':
            if (typeof data.value !== 'number') {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'SpO2 value must be a number',
                    path: ['value']
                });
            }
            else if (data.value < 0 || data.value > 100) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: `SpO2 saturation of ${data.value}% is outside valid physical range (0-100%)`,
                    path: ['value']
                });
            }
            if (data.unit !== '%') {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: `Invalid unit '${data.unit}' for SPO2 (expected '%')`,
                    path: ['unit']
                });
            }
            break;
        case 'TEMPERATURE':
            if (typeof data.value !== 'number') {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'Temperature value must be a number',
                    path: ['value']
                });
            }
            else {
                if (data.unit === 'degC') {
                    if (data.value < 25 || data.value > 45) {
                        ctx.addIssue({
                            code: z.ZodIssueCode.custom,
                            message: `Temperature of ${data.value}°C is outside human survival/biological limits (25°C - 45°C)`,
                            path: ['value']
                        });
                    }
                }
                else if (data.unit === 'degF') {
                    if (data.value < 77 || data.value > 113) {
                        ctx.addIssue({
                            code: z.ZodIssueCode.custom,
                            message: `Temperature of ${data.value}°F is outside human survival/biological limits (77°F - 113°F)`,
                            path: ['value']
                        });
                    }
                }
                else {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: `Invalid unit '${data.unit}' for TEMPERATURE (expected 'degC' or 'degF')`,
                        path: ['unit']
                    });
                }
            }
            break;
        case 'BLOOD_PRESSURE':
            if (typeof data.value !== 'object' || data.value === null || !('systolic' in data.value)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'Blood pressure value must be an object with { systolic: number, diastolic: number }',
                    path: ['value']
                });
            }
            if (data.unit !== 'mmHg') {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: `Invalid unit '${data.unit}' for BLOOD_PRESSURE (expected 'mmHg')`,
                    path: ['unit']
                });
            }
            break;
        case 'RESPIRATORY_RATE':
            if (typeof data.value !== 'number') {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'Respiratory rate value must be a number',
                    path: ['value']
                });
            }
            else if (data.value < 0 || data.value > 100) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: `Respiratory rate of ${data.value} breaths/min is outside plausible range (0-100)`,
                    path: ['value']
                });
            }
            if (data.unit !== 'breaths_min') {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: `Invalid unit '${data.unit}' for RESPIRATORY_RATE (expected 'breaths_min')`,
                    path: ['unit']
                });
            }
            break;
        case 'BLOOD_GLUCOSE':
            if (typeof data.value !== 'number') {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'Blood glucose value must be a number',
                    path: ['value']
                });
            }
            else if (data.value <= 0 || data.value > 1200) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: `Blood glucose of ${data.value} is outside plausible measurement range`,
                    path: ['value']
                });
            }
            if (data.unit !== 'mg_dL' && data.unit !== 'mmol_L') {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: `Invalid unit '${data.unit}' for BLOOD_GLUCOSE (expected 'mg_dL' or 'mmol_L')`,
                    path: ['unit']
                });
            }
            break;
    }
});
