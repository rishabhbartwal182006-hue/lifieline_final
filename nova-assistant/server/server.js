require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const chatRoute = require("./routes/chat");
const ttsRoute = require("./routes/tts");
const sttRoute = require("./routes/stt");
const patientRoute = require("./routes/patient");
const { hasAnyRealData } = require("./lib/knowledgeBase");

const app = express();
const PORT = process.env.PORT || 3000;

// Allows this to be embedded as an <iframe> or opened as a popup from your
// main project's own origin and still talk to this server's API. If you
// deploy the two projects on different origins, restrict this instead of
// leaving it wide open (see README "Integration" section).
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.use("/api/chat", chatRoute);
app.use("/api/tts", ttsRoute);
app.use("/api/stt", sttRoute);
app.use("/api/patient", patientRoute);

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.get("/favicon.ico", (req, res) => res.status(204).end());

// Serve the frontend (Chromium kiosk points here) with no-cache headers to ensure live code updates
app.use(express.static(path.join(__dirname, "..", "public"), {
  etag: false,
  maxAge: 0,
  setHeaders: (res) => {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
  }
}));

const https = require("https");
const fs = require("fs");

app.listen(PORT, '0.0.0.0', () => {
  console.log(`NOVA HTTP server running on port ${PORT} (Network: http://192.168.137.1:${PORT})`);
  if (!process.env.GROQ_API_KEY) {
    console.warn("WARNING: GROQ_API_KEY is not set.");
  }
  if (!process.env.TTS_API_KEY) {
    console.warn("WARNING: TTS_API_KEY is not set.");
  }
  try {
    if (!hasAnyRealData()) {
      console.warn(
        "WARNING: knowledge.json still contains REPLACE_ME placeholders — " +
        "check the glucometer/BP-monitor step lists match your actual device models before deploying."
      );
    }
  } catch (e) {
    console.warn("WARNING: could not read knowledge.json:", e.message);
  }
});
