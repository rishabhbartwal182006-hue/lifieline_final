const express = require("express");
const multer = require("multer");
const fs = require("fs");
const os = require("os");
const Groq = require("groq-sdk");
const { toFile } = require("groq-sdk");

const router = express.Router();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const STT_MODEL = process.env.GROQ_STT_MODEL || "whisper-large-v3-turbo";

const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB — plenty for a few seconds of speech
});

/**
 * POST /api/stt
 * multipart/form-data, field name "audio" — a short recorded clip
 * (webm/opus from MediaRecorder, or any format Whisper accepts).
 * Returns: { transcript: string, noSpeechProb: number }
 *
 * Replaces the browser's built-in SpeechRecognition — see
 * public/js/micCapture.js for the full reasoning (Chromium builds
 * without Google's private API key, e.g. Raspberry Pi OS's default
 * Chromium, can't use SpeechRecognition at all; this works identically
 * everywhere since it's our own Groq key doing the transcription).
 */
router.post("/", upload.single("audio"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "audio file is required" });
  }

  try {
    // multer's disk storage saves the upload under a random hash with NO
    // file extension — fs.createReadStream(req.file.path) alone gives
    // Groq no way to tell what audio format it is, so it rejects it.
    // toFile() explicitly attaches a real filename/extension to the
    // stream for the upload, regardless of the temp file's actual name
    // on disk.
    const filename = req.file.originalname || "audio.webm";
    const file = await toFile(fs.createReadStream(req.file.path), filename);

    // verbose_json (not plain "text") on purpose: Whisper models are
    // known to hallucinate plausible-sounding text — random languages,
    // stock phrases like "Hello." or "Thank you." — when fed very short
    // or near-silent audio, rather than returning nothing. verbose_json
    // includes a per-segment no_speech_prob we can use to detect and
    // discard exactly that case, instead of blindly trusting whatever
    // text comes back.
    const transcription = await groq.audio.transcriptions.create({
      file,
      model: STT_MODEL,
      response_format: "verbose_json",
      temperature: 0,
      prompt: "नमस्ते, स्वास्थ्य जांच, मरीज बातचीत, नाम, उम्र, बुखार, सिरदर्द, खांसी, ब्लड शुगर।",
      ...(process.env.GROQ_STT_LANGUAGE ? { language: process.env.GROQ_STT_LANGUAGE } : {})
    });

    const segments = transcription?.segments || [];
    const noSpeechProb = segments.length
      ? segments.reduce((sum, s) => sum + (s.no_speech_prob || 0), 0) / segments.length
      : 0;

    let transcript = (transcription?.text || "").trim();

    // Filter out common Whisper hallucination tokens produced on silence/background noise
    const HALLUCINATIONS = [
      "thank you", "thank you.", "thanks for watching", "thanks for watching.",
      "bye", "bye.", "goodbye", "goodbye.", "subtitles by", "translated by",
      "amara.org", "mbc", "लाइक करें", "सब्सक्राइब करें", "चैनल को सब्सक्राइब करें",
      "subscribe", "you", "you.", ".", "..."
    ];

    if (HALLUCINATIONS.includes(transcript.toLowerCase()) || noSpeechProb > 0.75) {
      transcript = "";
    }

    res.json({
      transcript,
      noSpeechProb
    });
  } catch (err) {
    console.error("[/api/stt] error:", err);
    res.status(500).json({ error: "stt_failed" });
  } finally {
    fs.unlink(req.file.path, () => {}); // best-effort cleanup, don't block the response on it
  }
});

module.exports = router;
