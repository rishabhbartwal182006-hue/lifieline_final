const mongoose = require('mongoose');

const HprAuthTokenSchema = new mongoose.Schema({
  hprId: {
    type: String,
    required: true,
    unique: true
  },
  doctorName: {
    type: String,
    required: true
  },
  registrationNumber: {
    type: String,
    required: true
  },
  stateCouncil: {
    type: String,
    default: 'National Medical Commission'
  },
  role: {
    type: String,
    enum: ['DOCTOR', 'CLINICIAN', 'SPECIALIST'],
    default: 'DOCTOR'
  },
  token: {
    type: String,
    required: true,
    unique: true
  },
  biometricVerified: {
    type: Boolean,
    default: true
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'REVOKED', 'EXPIRED'],
    default: 'ACTIVE'
  },
  expiresAt: {
    type: Date,
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('HprAuthToken', HprAuthTokenSchema);
