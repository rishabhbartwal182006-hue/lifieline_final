const express = require('express');
const router = express.Router();
const Appointment = require('../models/Appointment');
const { isMongoConnected, memoryStore } = require('../config/db');

// In-memory array fallback if memoryStore is used
const memAppointments = [];

// Create a new appointment from kiosk
router.post('/', async (req, res) => {
  try {
    const {
      patientName, age, gender, phone, symptoms,
      department, requestedDate, requestedTime, arrivalTime, tokenNumber
    } = req.body;

    let responseDoc = null;
    if (isMongoConnected()) {
      const newAppointment = new Appointment({
        patientName, age, gender, phone, symptoms,
        department, requestedDate, requestedTime, arrivalTime, tokenNumber,
        status: 'pending'
      });
      await newAppointment.save();
      responseDoc = newAppointment;
    } else {
      // Fallback: in-memory store
      const doc = {
        _id: `appt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        patientName: patientName || 'Anonymous',
        age: Number(age) || 30,
        gender: gender || 'Other',
        phone: phone || '',
        symptoms: symptoms || '',
        department: department || 'General Medicine',
        requestedDate: requestedDate || new Date().toISOString().split('T')[0],
        requestedTime: requestedTime || '10:00 AM',
        arrivalTime: arrivalTime || '09:45 AM',
        tokenNumber: tokenNumber || `T-${Math.floor(100 + Math.random() * 900)}`,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      memAppointments.unshift(doc);
      responseDoc = doc;
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('appointment:new', responseDoc);
    }

    return res.status(201).json(responseDoc);
  } catch (err) {
    console.error('Error creating appointment:', err);
    res.status(500).json({ error: 'Failed to create appointment' });
  }
});

// Doctor Dashboard: List all pending and recent appointments
router.get('/doctor', async (req, res) => {
  try {
    if (isMongoConnected()) {
      const appointments = await Appointment.find()
        .sort({ createdAt: -1 })
        .limit(50);
      return res.json(appointments);
    }
    // Fallback: in-memory store
    res.json(memAppointments.slice(0, 50));
  } catch (err) {
    console.error('Error fetching appointments:', err);
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

// Doctor updates status
router.put('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    let updatedDoc = null;
    if (isMongoConnected()) {
      const updated = await Appointment.findByIdAndUpdate(
        req.params.id,
        { status },
        { new: true }
      );
      if (!updated) {
        return res.status(404).json({ error: 'Appointment not found' });
      }
      updatedDoc = updated;
    } else {
      // Fallback: in-memory store
      const item = memAppointments.find(a => a._id === req.params.id);
      if (!item) {
        return res.status(404).json({ error: 'Appointment not found' });
      }
      item.status = status;
      item.updatedAt = new Date();
      updatedDoc = item;
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('appointment:updated', updatedDoc);
    }

    return res.json(updatedDoc);
  } catch (err) {
    console.error('Error updating appointment:', err);
    res.status(500).json({ error: 'Failed to update appointment' });
  }
});

// Patient gets live status
router.get('/:id', async (req, res) => {
  try {
    if (isMongoConnected()) {
      const appointment = await Appointment.findById(req.params.id);
      if (!appointment) {
        return res.status(404).json({ error: 'Appointment not found' });
      }
      return res.json(appointment);
    }

    // Fallback: in-memory store
    const item = memAppointments.find(a => a._id === req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Appointment not found' });
    }
    res.json(item);
  } catch (err) {
    console.error('Error fetching appointment:', err);
    res.status(500).json({ error: 'Failed to fetch appointment' });
  }
});

module.exports = router;
