const express = require("express");
const fetch = require("node-fetch");

const router = express.Router();

const TTS_PROVIDER = (process.env.TTS_PROVIDER || "elevenlabs").toLowerCase();
const TTS_API_KEY = process.env.TTS_API_KEY;
const TTS_VOICE_ID = process.env.TTS_VOICE_ID;

/**
 * POST /api/tts
 * body: { text: string }
 * Streams back audio bytes (audio/mpeg) so the frontend can start playback
 * with minimum possible delay. Provider is swappable via TTS_PROVIDER env var
 * without changing the frontend or the pipeline shape.
 */
router.post("/", async (req, res) => {
  const { text } = req.body;
  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "text is required" });
  }

  try {
    if (TTS_PROVIDER === "elevenlabs") {
      return await streamElevenLabs(text, res);
    }
    if (TTS_PROVIDER === "azure") {
      return await streamAzure(text, res);
    }
    if (TTS_PROVIDER === "cartesia") {
      return await streamCartesia(text, res);
    }
    return res.status(500).json({ error: `unsupported TTS_PROVIDER: ${TTS_PROVIDER}` });
  } catch (err) {
    console.error("[/api/tts] error:", err);
    if (!res.headersSent) res.status(500).json({ error: "tts_failed" });
  }
});

async function streamElevenLabs(text, res) {
  if (!TTS_VOICE_ID) {
    throw new Error("TTS_VOICE_ID is not set (required for ElevenLabs)");
  }

  const upstream = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${TTS_VOICE_ID}/stream`,
    {
      method: "POST",
      headers: {
        "xi-api-key": TTS_API_KEY,
        "Content-Type": "application/json",
        Accept: "audio/mpeg"
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_turbo_v2_5",
        voice_settings: { stability: 0.5, similarity_boost: 0.75 }
      })
    }
  );

  if (!upstream.ok || !upstream.body) {
    const errText = await upstream.text().catch(() => "");
    throw new Error(`ElevenLabs TTS failed: ${upstream.status} ${errText}`);
  }

  res.setHeader("Content-Type", "audio/mpeg");
  upstream.body.pipe(res);
}

async function streamCartesia(text, res) {
  if (!TTS_VOICE_ID) {
    throw new Error("TTS_VOICE_ID is not set (required for Cartesia)");
  }

  const upstream = await fetch("https://api.cartesia.ai/tts/bytes", {
    method: "POST",
    headers: {
      "X-API-Key": TTS_API_KEY,
      // 2024-11-13 stopped being able to serve sonic-3.5 requests reliably;
      // 2026-03-01 is Cartesia's current version as of this writing. Bump
      // this if Cartesia ships a newer one and things start failing again.
      "Cartesia-Version": process.env.CARTESIA_API_VERSION || "2026-03-01",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      // sonic-2 was sunsetted by Cartesia (June 2026) — sonic-3.5 is the
      // current recommended model and supports Hindi. Override via
      // CARTESIA_MODEL_ID if Cartesia ships something newer later.
      model_id: process.env.CARTESIA_MODEL_ID || "sonic-3.5",
      transcript: text,
      voice: { mode: "id", id: TTS_VOICE_ID },
      // Tells Cartesia which language the voice should speak the transcript
      // in (ISO-639-1). Defaults to Hindi for this patient assistant —
      // override with TTS_LANGUAGE if you switch languages.
      language: process.env.TTS_LANGUAGE || "hi",
      // Raw PCM instead of mp3 on purpose: every independently-encoded mp3
      // chunk carries a few tens of ms of encoder silence padding at its
      // edges (this is inherent to how mp3/LAME-style encoders work, not a
      // bug). Since we synthesize each sentence as a separate request and
      // play them back to back, that padding was audible as small
      // clicks/gaps between sentences. Raw PCM has no such padding, so the
      // frontend can schedule sentences sample-accurately with zero gap —
      // see TTS_SAMPLE_RATE in public/js/conversation.js, which MUST match
      // this sample_rate.
      output_format: {
        container: "raw",
        encoding: "pcm_s16le",
        sample_rate: 22050
      }
    })
  });

  if (!upstream.ok || !upstream.body) {
    const errText = await upstream.text().catch(() => "");
    throw new Error(`Cartesia TTS failed: ${upstream.status} ${errText}`);
  }

  res.setHeader("Content-Type", "application/octet-stream");
  upstream.body.pipe(res);
}

async function streamAzure(text, res) {
  // Stub: fill in your Azure Speech region/endpoint here if you switch providers.
  // Kept as a placeholder to show the pipeline stays identical across providers.
  throw new Error("Azure TTS not yet configured — set TTS_PROVIDER=elevenlabs or implement this.");
}

module.exports = router;
