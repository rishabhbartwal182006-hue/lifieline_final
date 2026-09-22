const mongoose = require('mongoose');

const ProvenanceMetaSchema = new mongoose.Schema({
  provenance: {
    type: String,
    enum: ['device-captured', 'patient-spoken', 'touch-selected', 'scanned-document'],
    required: true
  },
  confidence: {
    type: Number,
    min: 0.0,
    max: 1.0,
    default: 1.0
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const VitalValueSchema = new mongoose.Schema({
  value: { type: mongoose.Schema.Types.Mixed, required: true },
  unit: { type: String, required: true },
  provenanceMeta: ProvenanceMetaSchema,
  altitudeContext: {
    type: new mongoose.Schema({
      altitudeMeters: Number,
      expectedRange: [Number],
      status: {
        type: String,
        enum: ['normal', 'borderline', 'critical', 'below-expected', 'above-expected', 'caution']
      },
      reason: String,
      adjustedForAltitude: { type: Boolean, default: false },
      algorithmVersion: { type: String, default: 'altitude-mvp-v1' },
      cautionNote: { type: String, default: null }
    }, { _id: false }),
    default: null
  }
}, { _id: false });

const ChiefComplaintSchema = new mongoose.Schema({
  symptom: { type: String, required: true },
  duration: { type: String },
  severity: { type: String, enum: ['Mild', 'Moderate', 'Severe'] },
  provenanceMeta: ProvenanceMetaSchema
}, { _id: false });

const DocumentRefSchema = new mongoose.Schema({
  documentId: { type: String, required: true },
  documentType: { type: String, enum: ['Prescription', 'LabReport', 'DischargeSummary', 'Other'], required: true },
  extractedDate: { type: String },
  practitionerName: { type: String },
  extractedText: { type: String },
  extractedMedications: [{
    name: String,
    dosage: String,
    frequency: String
  }],
  extractedLabs: [{
    testName: String,
    resultValue: String,
    unit: String,
    referenceRange: String
  }],
  fileUrl: { type: String },
  provenanceMeta: ProvenanceMetaSchema
}, { _id: false });

const AyushParametersSchema = new mongoose.Schema({
  nadi: { type: String, description: 'Pulse examination (Vata/Pitta/Kapha dominance)' },
  jihva: { type: String, description: 'Tongue examination' },
  mala: { type: String, description: 'Stool characteristics' },
  mutra: { type: String, description: 'Urine characteristics' },
  agni: { type: String, description: 'Digestive fire state' },
  koshtha: { type: String, description: 'Bowel habit state' },
  sparsha: { type: String, description: 'Tactile evaluation' },
  drik: { type: String, description: 'Ocular/Vision state' },
  akriti: { type: String, description: 'Physical posture/constitution' },
  vaya: { type: String, description: 'Age classification' },
  provenanceMeta: ProvenanceMetaSchema
}, { _id: false });

const DiscrepancyFlagSchema = new mongoose.Schema({
  flagId: { type: String, required: true },
  category: { type: String, required: true },
  field: { type: String, required: true },
  message: { type: String, required: true },
  valueSourceA: { type: String },
  sourceA: { type: String },
  valueSourceB: { type: String },
  sourceB: { type: String },
  severity: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], default: 'MEDIUM' }
}, { _id: false });

const HprSignatureBlockSchema = new mongoose.Schema({
  hprId: { type: String, required: true },
  doctorName: { type: String, required: true },
  registrationNumber: { type: String, required: true },
  stateCouncil: { type: String },
  role: { type: String },
  committedAt: { type: Date, required: true, default: Date.now },
  digitalSignature: { type: String, required: true },
  doctorNotes: { type: String }
}, { _id: false });

const ProvisionalIntakeSchema = new mongoose.Schema({
  intakeId: {
    type: String,
    required: true,
    unique: true
  },
  abhaId: {
    type: String,
    required: true,
    index: true
  },
  patientDemographics: {
    fullName: { type: String, required: true },
    gender: { type: String, enum: ['M', 'F', 'O'], required: true },
    age: { type: Number, required: true },
    dob: { type: String },
    phone: { type: String },
    address: { type: String },
    provenanceMeta: ProvenanceMetaSchema
  },
  environment: {
    altitudeMeters: { type: Number, default: 2438 },
    altitudeFeet: { type: Number, default: 8000 },
    altitudeSource: { type: String, enum: ['facility_config', 'staff_manual'], default: 'facility_config' },
    altitudeConfidence: { type: Number, min: 0, max: 1, default: 1.0 },
    timeAtAltitudeHours: { type: Number },
    residenceAltitudeMeters: { type: Number },
    acclimatizationStatus: {
      type: String,
      enum: ['unacclimatized', 'partial', 'acclimatized', 'native'],
      default: 'unacclimatized'
    }
  },
  vitals: {
    bloodPressure: {
      systolic: VitalValueSchema,
      diastolic: VitalValueSchema
    },
    spo2: VitalValueSchema,
    heartRate: VitalValueSchema,
    temperature: VitalValueSchema,
    bloodGlucose: VitalValueSchema
  },
  chiefComplaints: [ChiefComplaintSchema],
  hpi: {
    narrative: { type: String },
    onset: { type: String },
    associatedSymptoms: [String],
    provenanceMeta: ProvenanceMetaSchema
  },
  history: {
    pastDiagnoses: [{
      condition: String,
      diagnosedYear: String,
      provenanceMeta: ProvenanceMetaSchema
    }],
    allergies: [{
      allergen: String,
      reaction: String,
      provenanceMeta: ProvenanceMetaSchema
    }],
    currentMedications: [{
      medicationName: String,
      dosage: String,
      provenanceMeta: ProvenanceMetaSchema
    }],
    familyHistory: [{
      relation: String,
      condition: String,
      provenanceMeta: ProvenanceMetaSchema
    }]
  },
  ayushParameters: AyushParametersSchema,
  ocrDocuments: [DocumentRefSchema],
  triage: {
    triageLevel: { type: String, enum: ['EMERGENCY', 'PRIORITY', 'ROUTINE'] },
    urgencyScore: { type: Number, min: 1, max: 10 },
    recommendedDepartment: { type: String },
    protocolNotes: { type: String },
    provenanceMeta: ProvenanceMetaSchema
  },
  discrepancyFlags: [DiscrepancyFlagSchema],
  status: {
    type: String,
    enum: ['PROVISIONAL', 'VERIFIED_COMMITTED', 'REJECTED'],
    default: 'PROVISIONAL',
    index: true
  },
  hprSignatureBlock: HprSignatureBlockSchema,
  fhirBundle: { type: Object }
}, {
  timestamps: true
});

module.exports = mongoose.model('ProvisionalIntake', ProvisionalIntakeSchema);
