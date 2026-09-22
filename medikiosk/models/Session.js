const mongoose = require('mongoose');

/**
 * Session model — stores kiosk sessions in the SAME snake_case shape defined
 * by medikiosk-openapi.yaml / medikiosk_schema.json (see example-session.json).
 *
 * This is deliberately a SEPARATE collection/model from ProvisionalIntake.
 * The two backends (the original camelCase one-shot intake pipeline, and this
 * spec-shaped session lifecycle) coexist: services/specAdapter.js translates
 * a Session doc into the shape discrepancyEngine.js / fhirMapper.js already
 * understand, so both can share the same discrepancy + FHIR logic without
 * either one having to be rewritten.
 */

const SourcedValueSchema = new mongoose.Schema({
  value: { type: String, required: true },
  source: {
    type: String,
    enum: ['patient_spoken', 'patient_touch_selection', 'patient_scanned_document', 'staff_entered', 'device_reading'],
    required: true
  },
  confidence: { type: Number, min: 0, max: 1, default: 1.0 },
  captured_at: { type: Date, required: true, default: Date.now },
  language: { type: String }
}, { _id: false });

const IntakeSchema = new mongoose.Schema({
  chief_complaint: SourcedValueSchema,
  hpi: {
    site: SourcedValueSchema,
    onset: SourcedValueSchema,
    character: SourcedValueSchema,
    radiation: SourcedValueSchema,
    associated_symptoms: [SourcedValueSchema],
    timing: SourcedValueSchema,
    exacerbating_relieving_factors: SourcedValueSchema,
    severity: SourcedValueSchema
  },
  past_history: [SourcedValueSchema],
  drug_allergy_history: [SourcedValueSchema],
  family_history: [SourcedValueSchema],
  personal_history: [SourcedValueSchema],
  review_of_systems: [SourcedValueSchema],
  ayush_module: {
    type: new mongoose.Schema({
      agni: SourcedValueSchema,
      koshtha: SourcedValueSchema,
      ahara_vihara: SourcedValueSchema,
      vyayama_shakti: SourcedValueSchema,
      notes: { type: String },
      unassessed_parameters: [String]
    }, { _id: false }),
    default: null
  }
}, { _id: false });

const VitalReadingSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['bp_systolic', 'bp_diastolic', 'blood_pressure', 'spo2', 'blood_glucose', 'heart_rate', 'pulse', 'temperature', 'weight', 'height', 'respiratory_rate'],
    required: true
  },
  value: { type: mongoose.Schema.Types.Mixed, required: true },
  unit: { type: String, required: true },
  source: {
    type: String,
    enum: ['staff_manual_entry', 'patient_reported', 'device', 'device_reading', 'device-captured', 'manual-entry', 'manual_entry', 'staff_entered'],
    required: true
  },
  device_id: { type: String, default: null },
  device_model: { type: String, default: null },
  captured_by_staff_id: { type: String, default: null },
  captured_at: { type: Date, required: true, default: Date.now },
  confidence: { type: Number, min: 0, max: 1, default: 1.0 },
  flagged_abnormal: { type: Boolean, default: false },
  altitudeContext: {
    type: new mongoose.Schema({
      altitudeMeters: { type: Number },
      expectedRange: [{ type: Number }],
      status: {
        type: String,
        enum: ['normal', 'borderline', 'critical', 'below-expected', 'above-expected', 'caution']
      },
      reason: { type: String },
      adjustedForAltitude: { type: Boolean, default: false },
      algorithmVersion: { type: String, default: 'altitude-mvp-v1' },
      cautionNote: { type: String, default: null }
    }, { _id: false }),
    default: null
  }
});

const DocumentRecordSchema = new mongoose.Schema({
  document_id: { type: String, required: true },
  document_type: {
    type: String,
    enum: ['prescription', 'lab_report', 'discharge_summary', 'imaging_report', 'other'],
    required: true
  },
  scan_method: {
    type: String,
    enum: ['kiosk_camera', 'patient_smartphone_upload'],
    required: true
  },
  uploaded_at: { type: Date, required: true, default: Date.now },
  document_date: { type: String, default: null },
  raw_image_ref: { type: String },
  ocr_engine: { type: String },
  extracted_fields: [{
    field: { type: String, required: true },
    value: { type: String, required: true },
    confidence: { type: Number, min: 0, max: 1, required: true },
    _id: false
  }],
  fhir_resource_ref: { type: String, default: null }
});

const DiscrepancySchema = new mongoose.Schema({
  discrepancy_id: { type: String, required: true },
  description: { type: String, required: true },
  source_a_ref: { type: String },
  source_b_ref: { type: String },
  detected_at: { type: Date, required: true, default: Date.now },
  status: {
    type: String,
    enum: ['unresolved', 'physician_acknowledged', 'dismissed'],
    default: 'unresolved'
  }
}, { _id: false });

const RedFlagSchema = new mongoose.Schema({
  flag_id: { type: String, required: true },
  flag_type: { type: String, required: true },
  triggered_by_refs: [String],
  urgency_tier: {
    type: String,
    enum: ['critical', 'urgent', 'monitor'],
    required: true
  },
  detected_at: { type: Date, required: true, default: Date.now },
  alert_sent_to: [String],
  status: {
    type: String,
    enum: ['active', 'acknowledged', 'resolved'],
    default: 'active'
  }
}, { _id: false });

const SessionSchema = new mongoose.Schema({
  schema_version: { type: String, default: '1.0.0' },
  session_id: { type: String, required: true, unique: true, index: true },
  kiosk_id: { type: String, required: true, default: 'KIOSK-01' },
  facility_id: { type: String, required: true, default: 'FACILITY-01' },
  status: {
    type: String,
    enum: ['draft', 'in_progress', 'red_flagged', 'staff_verified', 'physician_reviewed', 'synced_to_abdm', 'abandoned'],
    default: 'draft'
  },
  language: { type: String, default: 'en' },
  input_mode: {
    type: String,
    enum: ['voice', 'touch', 'voice_and_touch', 'staff_assisted'],
    default: 'touch'
  },
  patient: {
    abha_id: { type: String, default: null },
    abha_address: { type: String, default: null },
    identification_method: {
      type: String,
      enum: ['abha_qr', 'abha_number', 'aadhaar', 'staff_assigned_temp_id', 'none'],
      default: 'none'
    },
    name: { type: String, default: null },
    age: { type: Number, default: null },
    gender: { type: String, default: null },
    phone: { type: String, default: null },
    opd_department: { type: String },
    visit_type: { type: String, enum: ['first_visit', 'follow_up'] }
  },
  consent: {
    consent_artifacts: [{
      purpose: {
        type: String,
        enum: ['intake_capture', 'document_scan_storage', 'vitals_capture', 'abdm_hie_cm_share', 'ai_processing', 'post_consultation_reminders'],
        required: true
      },
      granted: { type: Boolean, required: true },
      granted_at: { type: Date, required: true },
      revoked_at: { type: Date, default: null },
      hie_cm_consent_id: { type: String, default: null },
      _id: false
    }]
  },
  environment: {
    type: new mongoose.Schema({
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
    }, { _id: false }),
    default: () => ({ altitudeMeters: 2438, altitudeFeet: 8000, altitudeSource: 'facility_config', acclimatizationStatus: 'unacclimatized' })
  },
  intake: { type: IntakeSchema, default: () => ({}) },
  vitals: [VitalReadingSchema],
  documents: [DocumentRecordSchema],
  cross_check_discrepancies: [DiscrepancySchema],
  red_flags: [RedFlagSchema],
  staff_verification: {
    verified: { type: Boolean, default: false },
    staff_hpr_id: { type: String, default: null },
    verification_method: { type: String, enum: ['biometric', 'hpr_credential_login'], default: null },
    verified_at: { type: Date, default: null }
  },
  clinical_summary: {
    subjective: { type: String, default: '' },
    objective: { type: String, default: '' },
    assessment: { type: String, default: '' },
    plan: { type: String, default: '' },
    physician_edited: { type: Boolean, default: false },
    signed_by_hpr_id: { type: String, default: null },
    signed_at: { type: Date, default: null }
  },
  fhir_sync: {
    fhir_bundle_id: { type: String, default: null },
    synced_to_his: { type: Boolean, default: false },
    synced_to_abha: { type: Boolean, default: false },
    synced_at: { type: Date, default: null },
    sync_status: { type: String, enum: ['pending', 'success', 'failed', 'not_applicable'], default: 'not_applicable' }
  },
  post_consultation: {
    type: new mongoose.Schema({
      prescription_ref: { type: String, default: null },
      dosage_schedule: [{
        medicine_name: String,
        icon_id: String,
        schedule_times: [String],
        confirmations: [{
          scheduled_at: Date,
          confirmed: { type: Boolean, default: null },
          channel: { type: String, enum: ['sms', 'whatsapp', 'voice_call'] },
          _id: false
        }],
        _id: false
      }],
      no_show_prediction: {
        probability: { type: Number, min: 0, max: 1 },
        model_version: String,
        computed_at: Date
      },
      health_worker_alert_sent: { type: Boolean, default: false }
    }, { _id: false }),
    default: null
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

module.exports = mongoose.model('Session', SessionSchema);
