const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const HprAuthToken = require('../models/HprAuthToken');
const { isMongoConnected, memoryStore } = require('../config/db');

/**
 * Provision / Login Doctor HPR Token: POST /api/v1/hpr/login
 * Helper endpoint for testing HPR biometric write-lock authentication
 */
router.post('/login', async (req, res) => {
  try {
    const { hprId, doctorName, registrationNumber, stateCouncil, role } = req.body;

    const docHprId = hprId || "HPR-IN-9876543210";
    const docName = doctorName || "Dr. Rajesh Sharma, MD";
    const docReg = registrationNumber || "MCI-2018-883921";
    const docCouncil = stateCouncil || "Karnataka Medical Council";
    const docRole = role || "DOCTOR";

    // Generate random secure token
    const token = `HPR_BEARER_${crypto.randomBytes(24).toString('hex')}`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 Hours

    const tokenDoc = {
      hprId: docHprId,
      doctorName: docName,
      registrationNumber: docReg,
      stateCouncil: docCouncil,
      role: docRole,
      token: token,
      biometricVerified: true,
      status: 'ACTIVE',
      expiresAt: expiresAt,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    if (isMongoConnected()) {
      await HprAuthToken.findOneAndUpdate(
        { hprId: docHprId },
        tokenDoc,
        { upsert: true, new: true }
      );
    } else {
      await memoryStore.save('HprAuthToken', tokenDoc);
    }

    return res.status(200).json({
      success: true,
      message: "HPR Doctor Session initialized & biometric write-lock token issued.",
      data: {
        hprId: docHprId,
        doctorName: docName,
        registrationNumber: docReg,
        role: docRole,
        hprToken: token,
        expiresAt: expiresAt,
        usage: "Pass 'Authorization: Bearer <hprToken>' or 'x-hpr-token: <hprToken>' header when committing clinical records."
      }
    });

  } catch (err) {
    console.error(`[HPR Login Error]: ${err.message}`);
    return res.status(500).json({
      success: false,
      error: "HPR_LOGIN_FAILED",
      message: err.message
    });
  }
});

/**
 * List Active HPR Doctors: GET /api/v1/hpr/doctors
 */
router.get('/doctors', async (req, res) => {
  try {
    let doctors = [];
    if (isMongoConnected()) {
      doctors = await HprAuthToken.find({ status: 'ACTIVE' });
    } else {
      doctors = await memoryStore.find('HprAuthToken', { status: 'ACTIVE' });
    }

    return res.status(200).json({
      success: true,
      count: doctors.length,
      doctors: doctors.map(d => ({
        hprId: d.hprId,
        doctorName: d.doctorName,
        registrationNumber: d.registrationNumber,
        role: d.role,
        token: d.token
      }))
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
