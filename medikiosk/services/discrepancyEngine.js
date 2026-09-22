/**
 * Module 5 — Clinical Discrepancy & Omission Checker Engine
 * Analyzes multi-modal input payloads (Voice, OCR, Vitals, Triage, AYUSH)
 * to detect unassessed parameters, clinical contradictions, and data completeness scores.
 */

function evaluateClinicalDiscrepancies(intakePayload) {
  const flags = [];
  const omissions = [];
  const { vitals, history, chiefComplaints, ayushParameters, ocrDocuments } = intakePayload || {};

  let assessedCount = 0;
  const totalExpectedFields = 10;

  // 1. OMISSION CHECKER
  if (vitals) {
    if (vitals.bloodPressure?.systolic?.value && vitals.bloodPressure?.diastolic?.value) {
      assessedCount++;
    } else {
      omissions.push({ parameter: "Blood Pressure (BP)", category: "Vital Signs" });
    }

    if (vitals.spo2?.value) {
      assessedCount++;
    } else {
      omissions.push({ parameter: "Oxygen Saturation (SpO₂)", category: "Vital Signs" });
    }

    if (vitals.heartRate?.value) {
      assessedCount++;
    } else {
      omissions.push({ parameter: "Heart Rate (HR)", category: "Vital Signs" });
    }

    if (vitals.bloodGlucose?.value) {
      assessedCount++;
    } else {
      omissions.push({ parameter: "Blood Glucose", category: "Vital Signs" });
    }
  } else {
    omissions.push({ parameter: "All Hardware Vitals", category: "Vital Signs" });
  }

  if (chiefComplaints && Array.isArray(chiefComplaints) && chiefComplaints.length > 0) {
    assessedCount++;
  } else {
    omissions.push({ parameter: "Chief Complaints", category: "Symptom Assessment" });
  }

  if (intakePayload?.hpi?.narrative) {
    assessedCount++;
  } else {
    omissions.push({ parameter: "History of Present Illness (HPI)", category: "Symptom Assessment" });
  }

  if (history?.currentMedications && history.currentMedications.length > 0) {
    assessedCount++;
  } else {
    omissions.push({ parameter: "Current Medication History", category: "Medical History" });
  }

  if (ayushParameters) {
    if (ayushParameters.agni) assessedCount++;
    else omissions.push({ parameter: "Agni (Digestive Fire)", category: "AYUSH Dashavidha" });

    if (ayushParameters.koshtha) assessedCount++;
    else omissions.push({ parameter: "Koshtha (Bowel Nature)", category: "AYUSH Dashavidha" });

    if (ayushParameters.mutra) assessedCount++;
    else omissions.push({ parameter: "Mutra (Urine Characteristics)", category: "AYUSH Dashavidha" });
  } else {
    omissions.push({ parameter: "AYUSH Dashavidha Pariksha", category: "AYUSH Assessment" });
  }

  // Calculate Data Completeness Score (0 - 100%)
  const completenessScore = Math.min(100, Math.round((assessedCount / totalExpectedFields) * 100));

  // 2. CLINICAL DISCREPANCY & CONTRADICTION CHECKER

  // Contradiction 1: High Blood Sugar (>200 mg/dL) vs Normal Reported Diet
  if (vitals?.bloodGlucose) {
    const glucoseVal = Number(vitals.bloodGlucose.value);
    if (glucoseVal > 200) {
      const isDiabeticInHistory = history?.pastDiagnoses?.some(d => d.condition && d.condition.toLowerCase().includes('diab'));
      if (!isDiabeticInHistory) {
        flags.push({
          flagId: `DISC_GLUCOSE_UNREPORTED_${Date.now()}`,
          category: "CONTRADICTION",
          field: "vitals.bloodGlucose",
          message: `Elevated Blood Glucose (${glucoseVal} mg/dL) captured by device, but patient history has no reported Diabetes mellitus diagnosis.`,
          severity: "HIGH"
        });
      }
    }
  }

  // Contradiction 2: Stage 2 Hypertension (BP > 160/100) vs Asymptomatic Voice Intake
  if (vitals?.bloodPressure) {
    const sys = Number(vitals.bloodPressure.systolic?.value);
    const dia = Number(vitals.bloodPressure.diastolic?.value);
    const hasHeadacheOrDizziness = chiefComplaints?.some(c => 
      c.symptom && (c.symptom.toLowerCase().includes('headache') || c.symptom.toLowerCase().includes('dizzy') || c.symptom.toLowerCase().includes('giddiness'))
    );

    if ((sys >= 160 || dia >= 100) && !hasHeadacheOrDizziness) {
      flags.push({
        flagId: `DISC_BP_ASYMPTOMATIC_${Date.now()}`,
        category: "CONTRADICTION",
        field: "vitals.bloodPressure",
        message: `Device captured Stage 2 Hypertension (${sys}/${dia} mmHg), but patient voice intake reported no headache or dizziness.`,
        severity: "HIGH"
      });
    }
  }

  // Contradiction 3: OCR Prescribed Medication Mismatch vs Spoken History
  if (ocrDocuments && Array.isArray(ocrDocuments)) {
    ocrDocuments.forEach((doc, idx) => {
      if (doc.extractedMedications && Array.isArray(doc.extractedMedications)) {
        doc.extractedMedications.forEach((ocrMed) => {
          const medName = ocrMed.name ? ocrMed.name.toLowerCase() : '';
          const spokenMeds = history?.currentMedications || [];
          const matchSpoken = spokenMeds.some(m => m.medicationName && m.medicationName.toLowerCase().includes(medName));
          
          if (medName && !matchSpoken && spokenMeds.length > 0) {
            flags.push({
              flagId: `DISC_OCR_MED_${idx}_${Date.now()}`,
              category: "OCR_MISMATCH",
              field: "history.currentMedications",
              message: `OCR Prescription extracted '${ocrMed.name}' which was omitted from patient spoken history.`,
              severity: "MEDIUM"
            });
          }
        });
      }
    });
  }

  // Contradiction 4: Severe Severity Rating with Completely Normal Measured Vitals
  const hasSevereRating = chiefComplaints?.some(c => c.severity === 'Severe');
  const hasMeasuredSys = vitals?.bloodPressure?.systolic?.value !== undefined && vitals.bloodPressure.systolic.value !== null;
  const hasMeasuredSpO2 = vitals?.spo2?.value !== undefined && vitals.spo2.value !== null;
  const hasMeasuredHR = vitals?.heartRate?.value !== undefined && vitals.heartRate.value !== null;

  if (hasSevereRating && hasMeasuredSys && hasMeasuredSpO2 && hasMeasuredHR) {
    const sys = Number(vitals.bloodPressure.systolic.value);
    const spo2 = Number(vitals.spo2.value);
    const hr = Number(vitals.heartRate.value);

    if (!isNaN(sys) && !isNaN(spo2) && !isNaN(hr)) {
      if (sys >= 110 && sys <= 130 && spo2 >= 97 && hr >= 60 && hr <= 90) {
        flags.push({
          flagId: `DISC_SEVERE_NORMAL_VITALS_${Date.now()}`,
          category: "CLINICAL_ALERT",
          field: "chiefComplaints.severity",
          message: `Patient reported 'Severe' complaint severity, but all hardware vitals (BP ${sys} mmHg, SpO₂ ${spo2}%, HR ${hr} bpm) are completely within normal range.`,
          severity: "MEDIUM"
        });
      }
    }
  }

  return {
    completenessScore,
    assessedCount,
    totalExpectedFields,
    omissions,
    discrepancies: flags
  };
}

module.exports = {
  evaluateClinicalDiscrepancies,
  analyzeDiscrepancies: (payload) => evaluateClinicalDiscrepancies(payload).discrepancies
};
