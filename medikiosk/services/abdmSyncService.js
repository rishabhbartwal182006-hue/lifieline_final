/**
 * ABDM Synchronization & Compliance Utility (M1, M2, M3 APIs)
 * Simulates ABDM Health Information Exchange & Consent Manager (HIE-CM) profile interactions.
 */

/**
 * Generates ABDM M2/M3 Health Document Push Notification Payload
 */
function createAbdmPushPayload(intake, fhirBundle) {
  const timestamp = new Date().toISOString();

  return {
    requestId: `REQ-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    timestamp: timestamp,
    notification: {
      consentId: `CONSENT-ABDM-${intake.abhaId.replace(/[^a-zA-Z0-9]/g, '')}`,
      transactionId: `TXN-${intake.intakeId}`,
      doneAt: timestamp,
      hipId: "HIP_MEDIKIOSK_HOSPITAL_01",
      careContexts: [
        {
          patientReference: intake.abhaId,
          careContextReference: `CARE-CTX-${intake.intakeId}`
        }
      ]
    },
    healthInformation: {
      hipId: "HIP_MEDIKIOSK_HOSPITAL_01",
      careContextReference: `CARE-CTX-${intake.intakeId}`,
      bundle: fhirBundle
    },
    signatureBlock: intake.hprSignatureBlock || null,
    abdmComplianceLevel: ["M1-ABHA", "M2-DISCOVERY", "M3-HIE-CM"]
  };
}

/**
 * Simulates sending the bundle to ABDM Gateway
 */
async function syncToAbdmNetwork(intake, fhirBundle) {
  const payload = createAbdmPushPayload(intake, fhirBundle);
  
  // Log ABDM Push execution
  console.log(`[ABDM Sync] Successfully generated M1/M2/M3 compliance broadcast for ABHA ID: ${intake.abhaId}`);
  console.log(`[ABDM Sync] Care Context Reference: CARE-CTX-${intake.intakeId}`);

  return {
    success: true,
    abdmTransactionId: payload.notification.transactionId,
    timestamp: payload.timestamp,
    payload: payload
  };
}

module.exports = {
  createAbdmPushPayload,
  syncToAbdmNetwork
};
