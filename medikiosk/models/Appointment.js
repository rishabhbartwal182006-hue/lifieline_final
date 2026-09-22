const mongoose = require('mongoose');

const AppointmentSchema = new mongoose.Schema({
  patientName: { type: String, required: true },
  age: { type: Number, required: true },
  gender: { type: String },
  phone: { type: String },
  symptoms: { type: String },
  department: { type: String, required: true },
  requestedDate: { type: String, required: true },
  requestedTime: { type: String, required: true },
  arrivalTime: { type: String },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  tokenNumber: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('Appointment', AppointmentSchema);
