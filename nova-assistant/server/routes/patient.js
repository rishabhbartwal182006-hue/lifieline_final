const express = require("express");
const { extractPatientRecord } = require("../lib/patientExtraction");

const router = express.Router();

/**
 * POST /api/patient/extract
 * body: { messages: [{ role, content }, ...] }  (same shape as /api/chat)
 * returns: the structured patient record (see patientExtraction.js)
 *
 * Called by the frontend after each assistant turn. Deliberately separate
 * from /api/chat/stream so a slow or failed extraction never delays or
 * breaks the spoken reply — the frontend fires this in the background and
 * just forwards whatever comes back to the host app via postMessage.
 */
router.post("/extract", async (req, res) => {
  const { messages } = req.body;

  if (!Array.isArray(messages)) {
    return res.status(400).json({ error: "messages array is required" });
  }

  try {
    const record = await extractPatientRecord(messages);
    res.json({ record });
  } catch (err) {
    console.error("[/api/patient/extract] error:", err);
    res.status(500).json({ error: "extraction_failed" });
  }
});

module.exports = router;
