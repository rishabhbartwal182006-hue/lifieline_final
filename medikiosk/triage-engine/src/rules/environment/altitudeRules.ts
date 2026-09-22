/**
 * triage-engine/src/rules/environment/altitudeRules.ts
 * 
 * Decision-support MVP. Illustrative altitude profiles. Raw values preserved.
 * Clinician sign-off required. Pilot validation needed.
 */

import { Rule, TriggeredRule } from '../types.js';

// Environment rules are evaluated by the pure evaluator below because each
// condition needs the current vital, symptom, and altitude context together.
export const ENVIRONMENT_RULES: Rule[] = [];

const DANGER_SYMPTOMS = [
  'chest pain',
  'chest discomfort',
  'chest tightness',
  'breathlessness at rest',
  'shortness of breath at rest',
  'shortness of breath',
  'confusion',
  'altered mental status',
  'cyanosis',
  'inability to walk',
  'ataxia',
  'fainting',
  'syncope'
];

/**
 * Direct evaluator for altitude rules given vitals, environment, and reported symptoms.
 */
export function evaluateAltitudeRules(
  vitals: any,
  environment?: { altitudeMeters?: number; [key: string]: any },
  symptoms?: string[] | string | any
): TriggeredRule[] {
  const flags: TriggeredRule[] = [];
  const altitudeMeters = environment?.altitudeMeters ?? 2438;

  // Extract flat vitals
  let spo2: number | undefined;
  let sysBP: number | undefined;
  let diaBP: number | undefined;
  let glucose: number | undefined;

  if (vitals) {
    if (Array.isArray(vitals)) {
      const spo2Item = vitals.find((v: any) => v.type === 'spo2');
      if (spo2Item) spo2 = Number(spo2Item.value);

      const sysItem = vitals.find((v: any) => v.type === 'bp_systolic');
      if (sysItem) sysBP = Number(sysItem.value);

      const diaItem = vitals.find((v: any) => v.type === 'bp_diastolic');
      if (diaItem) diaBP = Number(diaItem.value);
      const glucoseItem = vitals.find((v: any) => v.type === 'blood_glucose');
      if (glucoseItem) glucose = Number(glucoseItem.value);
    } else {
      if (vitals.SPO2?.value !== undefined) spo2 = Number(vitals.SPO2.value);
      else if (vitals.spo2?.value !== undefined) spo2 = Number(vitals.spo2.value);
      else if (typeof vitals.spo2 === 'number') spo2 = vitals.spo2;

      if (vitals.bloodPressure?.systolic?.value !== undefined) sysBP = Number(vitals.bloodPressure.systolic.value);
      else if (typeof vitals.systolic === 'number') sysBP = vitals.systolic;

      if (vitals.bloodPressure?.diastolic?.value !== undefined) diaBP = Number(vitals.bloodPressure.diastolic.value);
      else if (typeof vitals.diastolic === 'number') diaBP = vitals.diastolic;
      if (vitals.bloodGlucose?.value !== undefined) glucose = Number(vitals.bloodGlucose.value);
      else if (vitals.BLOOD_GLUCOSE?.value !== undefined) glucose = Number(vitals.BLOOD_GLUCOSE.value);
      else if (typeof vitals.blood_glucose === 'number') glucose = vitals.blood_glucose;
    }
  }

  // Symptoms extraction
  const symptomList: string[] = [];
  if (typeof symptoms === 'string') symptomList.push(symptoms.toLowerCase());
  else if (Array.isArray(symptoms)) {
    symptoms.forEach(s => {
      if (typeof s === 'string') symptomList.push(s.toLowerCase());
      else if (s?.symptom) symptomList.push(String(s.symptom).toLowerCase());
      else if (s?.name) symptomList.push(String(s.name).toLowerCase());
      else if (s?.chief_complaint) symptomList.push(String(s.chief_complaint).toLowerCase());
      else if (s?.symptomName) symptomList.push(String(s.symptomName).toLowerCase());
    });
  }

  const hasDanger = symptomList.some(s => DANGER_SYMPTOMS.some(d => s.includes(d)));

  // Lookup expected SpO2 for altitude
  let expectedMin = 95;
  if (altitudeMeters < 500) expectedMin = 95;
  else if (altitudeMeters < 1500) expectedMin = 94;
  else if (altitudeMeters < 2500) expectedMin = 92;
  else if (altitudeMeters < 3500) expectedMin = 90;
  else expectedMin = 85;

  // 1. SpO2 < expectedMin - 5 -> Critical even without symptoms
  if (spo2 !== undefined && spo2 < expectedMin - 5) {
    flags.push({
      id: 'RULE_ALTITUDE_SEVERE_HYPOXEMIA',
      name: 'Severe hypoxemia at altitude',
      category: 'environment',
      priority: 'EMERGENCY',
      action: 'IMMEDIATE_DOCTOR_ALERT',
      reason: `SpO2 (${spo2}%) is more than 5% below critical threshold for ${altitudeMeters}m (< ${expectedMin}%). Severe hypoxemia risk.`,
      matchedConditions: []
    });
  }
  // 2. SpO2 < expectedMin AND danger symptoms -> Critical
  else if (spo2 !== undefined && spo2 < expectedMin && hasDanger) {
    flags.push({
      id: 'RULE_ALTITUDE_HYPOXEMIA_DANGER_SYMPTOMS',
      name: 'Hypoxemia at altitude with danger symptoms',
      category: 'environment',
      priority: 'EMERGENCY',
      action: 'IMMEDIATE_DOCTOR_ALERT',
      reason: `SpO2 (${spo2}%) is below expected range for altitude (${expectedMin}%) with high-risk danger symptoms present.`,
      matchedConditions: []
    });
  }

  // 3. Hypertensive crisis -> Critical regardless of altitude
  if ((sysBP !== undefined && sysBP >= 180) || (diaBP !== undefined && diaBP >= 120)) {
    flags.push({
      id: 'RULE_ALTITUDE_HYPERTENSIVE_CRISIS',
      name: 'Hypertensive crisis',
      category: 'environment',
      priority: 'EMERGENCY',
      action: 'IMMEDIATE_DOCTOR_ALERT',
      reason: `Hypertensive crisis: Systolic BP >= 180 mmHg or Diastolic BP >= 120 mmHg regardless of altitude (${altitudeMeters}m).`,
      matchedConditions: []
    });
  }

  // 4. Yellow flag: Possible AMS if headache + nausea/dizziness/poor sleep at > 2500m
  const hasHeadache = symptomList.some(s => s.includes('headache'));
  const hasNausea = symptomList.some(s => s.includes('nausea') || s.includes('vomit'));
  const hasDizziness = symptomList.some(s => s.includes('dizzy') || s.includes('dizziness') || s.includes('giddiness'));
  const hasPoorSleep = symptomList.some(s => s.includes('sleep') || s.includes('insomnia'));

  if (altitudeMeters > 2500 && hasHeadache && (hasNausea || hasDizziness || hasPoorSleep)) {
    flags.push({
      id: 'RULE_ALTITUDE_ACUTE_MOUNTAIN_SICKNESS',
      name: 'Possible acute mountain sickness',
      category: 'environment',
      priority: 'URGENT',
      action: 'PRIORITY_REVIEW',
      reason: `Patient exhibits symptoms consistent with Acute Mountain Sickness (AMS) at elevation ${altitudeMeters}m.`,
      matchedConditions: []
    });
  }

  if (altitudeMeters > 2500 && glucose !== undefined && glucose >= 70 && glucose <= 140) {
    flags.push({
      id: 'RULE_ALTITUDE_GLUCOSE_CAUTION',
      name: 'Glucose reading at altitude — interpret with caution',
      category: 'environment',
      priority: 'URGENT',
      action: 'PRIORITY_REVIEW',
      reason: 'Interpret with caution at altitude: dehydration and glucometer strip sensitivity may affect reading. Confirm clinically.',
      matchedConditions: []
    });
  }

  return flags;
}
