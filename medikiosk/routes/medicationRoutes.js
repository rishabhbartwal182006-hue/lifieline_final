// ============================================================
//  routes/medicationRoutes.js
//  LifeLine 360 — Remote Patient Medication & Adherence Tracker
// ============================================================

const express = require('express');
const router = express.Router();

// In-memory store for medication schedules with live state
const medicationStore = new Map();

// Default medications for patient — starts untaken (clean state)
function getInitialMedications(patientId) {
  return [
    {
      id: 'MED-01',
      patientId: patientId,
      name: 'Metformin HCl',
      dosage: '500 mg',
      slot: 'Morning',
      timeLabel: '08:00 AM',
      instructions: 'Take with or right after breakfast',
      purpose: 'Blood Sugar Control',
      taken: false,
      lastTakenTime: null
    },
    {
      id: 'MED-02',
      patientId: patientId,
      name: 'Telmisartan',
      dosage: '40 mg',
      slot: 'Morning',
      timeLabel: '08:30 AM',
      instructions: 'Take 30 minutes after breakfast with water',
      purpose: 'Blood Pressure Regulation',
      taken: false,
      lastTakenTime: null
    },
    {
      id: 'MED-03',
      patientId: patientId,
      name: 'Glimepiride',
      dosage: '1 mg',
      slot: 'Afternoon',
      timeLabel: '01:30 PM',
      instructions: 'Take immediately before lunch',
      purpose: 'Insulin Secretion',
      taken: false,
      lastTakenTime: null
    },
    {
      id: 'MED-04',
      patientId: patientId,
      name: 'Atorvastatin',
      dosage: '10 mg',
      slot: 'Night',
      timeLabel: '09:00 PM',
      instructions: 'Take at bedtime',
      purpose: 'Cholesterol & Heart Health',
      taken: false,
      lastTakenTime: null
    }
  ];
}

// GET /api/v1/patient/:patientId/medications
router.get('/:patientId/medications', (req, res) => {
  const { patientId } = req.params;
  let meds = medicationStore.get(patientId);
  if (!meds) {
    meds = getInitialMedications(patientId);
    medicationStore.set(patientId, meds);
  }

  // Calculate adherence metrics
  const total = meds.length;
  const takenCount = meds.filter(m => m.taken).length;
  const complianceRate = total > 0 ? Math.round((takenCount / total) * 100) : 0;

  return res.json({
    success: true,
    patientId,
    totalMeds: total,
    takenCount,
    complianceRate,
    medications: meds
  });
});

// POST /api/v1/patient/:patientId/medications/:medId/toggle
router.post('/:patientId/medications/:medId/toggle', (req, res) => {
  const { patientId, medId } = req.params;
  let meds = medicationStore.get(patientId);
  if (!meds) {
    meds = getInitialMedications(patientId);
    medicationStore.set(patientId, meds);
  }

  const med = meds.find(m => m.id === medId);
  if (!med) {
    return res.status(404).json({ success: false, error: 'Medication not found' });
  }

  med.taken = !med.taken;
  med.lastTakenTime = med.taken
    ? new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  const total = meds.length;
  const takenCount = meds.filter(m => m.taken).length;
  const complianceRate = total > 0 ? Math.round((takenCount / total) * 100) : 0;

  return res.json({
    success: true,
    message: med.taken ? `${med.name} marked as taken` : `${med.name} marked as pending`,
    medication: med,
    complianceRate,
    takenCount,
    totalMeds: total
  });
});

// POST /api/v1/patient/:patientId/medications (Add prescription)
router.post('/:patientId/medications', (req, res) => {
  const { patientId } = req.params;
  const { name, dosage, slot, timeLabel, instructions, purpose } = req.body || {};

  if (!name || !dosage) {
    return res.status(400).json({ success: false, error: 'Name and dosage required' });
  }

  let meds = medicationStore.get(patientId);
  if (!meds) {
    meds = getInitialMedications(patientId);
    medicationStore.set(patientId, meds);
  }

  const newMed = {
    id: `MED-${Date.now().toString().slice(-4)}`,
    patientId,
    name,
    dosage,
    slot: slot || 'Morning',
    timeLabel: timeLabel || '08:00 AM',
    instructions: instructions || 'Take with water',
    purpose: purpose || 'General treatment',
    taken: false,
    lastTakenTime: null
  };

  meds.push(newMed);
  return res.status(201).json({ success: true, medication: newMed });
});

module.exports = {
  router,
  medicationStore,
  getInitialMedications
};
