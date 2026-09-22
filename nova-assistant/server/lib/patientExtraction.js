const Groq = require("groq-sdk");

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
// A small/fast model is plenty for structured extraction — this runs after
// every turn, in parallel with nothing user-facing waiting on it, but no
// reason to spend the bigger conversational model's budget on it.
// llama-3.1-8b-instant was deprecated/shut down by Groq on 08/16/2026.
// openai/gpt-oss-20b is Groq's recommended replacement.
const EXTRACTION_MODEL = process.env.GROQ_EXTRACTION_MODEL || "openai/gpt-oss-20b";

// The exact shape the host app (your main project) receives from
// POST /api/patient/extract. Keep this in sync with README's "Integration"
// section if you change it, since the frontend just forwards this object
// verbatim via postMessage.
const EMPTY_RECORD = {
  name: null,
  age: null,
  gender: null,
  symptoms: [],
  vitals: {
    blood_glucose_mg_dl: null,
    blood_glucose_timing: null, // "fasting" | "post_meal" | "random" | null
    systolic_bp: null,
    diastolic_bp: null,
    pulse_bpm: null,
    temperature_c: null,
    spo2_percent: null
  },
  notes: null,
  urgent_flag: false,
  ready_for_review: false
};

const EXTRACTION_SYSTEM_PROMPT = `You read a transcript of a voice conversation between an AI health
assistant (NOVA) and a patient, and output ONLY a single JSON object — no
markdown, no commentary, no code fences — capturing what has been said so
far. Use this exact shape (all fields present, use null/[]/false when
something has not been mentioned yet — never invent values):

${JSON.stringify(EMPTY_RECORD, null, 2)}

Rules:
- Only fill a field if the patient or guardian (or the assistant confirming on their behalf) actually stated it in the transcript.
- If a guardian, family member, or attendant is speaking on behalf of the patient, extract the PATIENT's name, age, and gender (not the guardian's). Mention the guardian relationship in "notes" (e.g. "Reported by patient's son/guardian").
- "symptoms" is a short list of what was described in their own words (translate to concise English phrases), not a diagnosis.
- "urgent_flag" is true only if the symptoms sound like an emergency (chest pain, breathing difficulty, fainting, severe bleeding, severe hypoglycemia symptoms, etc.).
- "ready_for_review" is true once name, age, and symptoms have been captured, and either the glucometer/sugar test has been instructed or completed, or the conversation mentions reviewing the final report, or the guardian's report has been recorded and staff alerted.
- Numbers should be plain numbers (no units in the value itself).
- Output valid JSON matching the shape above exactly, nothing else.`;

/**
 * Runs a structured-extraction pass over the conversation so far.
 * Independent from the conversational reply (server/routes/chat.js) on
 * purpose — keeps the spoken persona free-form/natural while this stays a
 * strict, swallow-errors-quietly background job that never blocks or
 * breaks the voice flow if it fails.
 */
async function extractPatientRecord(messages) {
  const transcriptText = (messages || [])
    .map((m) => `${m.role === "user" ? "Patient" : "NOVA"}: ${m.content}`)
    .join("\n");

  const completion = await groq.chat.completions.create({
    model: EXTRACTION_MODEL,
    temperature: 0,
    max_tokens: 500,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
      { role: "user", content: transcriptText || "(no conversation yet)" }
    ]
  });

  const raw = completion.choices?.[0]?.message?.content?.trim() || "{}";
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`extraction returned invalid JSON: ${err.message}`);
  }

  // Shallow-merge onto EMPTY_RECORD so a partial/malformed model response
  // never drops fields the host app expects to always be present.
  return {
    ...EMPTY_RECORD,
    ...parsed,
    vitals: { ...EMPTY_RECORD.vitals, ...(parsed.vitals || {}) }
  };
}

module.exports = { extractPatientRecord, EMPTY_RECORD };
