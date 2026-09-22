# NOVA — AI Health Checkup Assistant (patient-facing)

Same scaffold as the original NOVA kiosk (Node/Express + Groq LLM + TTS +
voice pipeline), retargeted from a university-info bot into a patient
health-checkup assistant: it talks to a patient in Hindi, takes their name/
age, guides them through a glucometer (or BP/thermometer) reading step by
step, and records what they report as structured data your main project can
pick up.

It's built to run as its **own small app**, connected to your main
project only through the `postMessage` contract described below — so you
can embed it as an `<iframe>` or open it as a popup from a "Talk to AI
Assistant" button, without merging the codebases.

## 1. What's here

```
nova-assistant/
  server/
    server.js                 Express app entrypoint
    routes/chat.js             POST /api/chat(/stream) -> Groq LLM, spoken reply
    routes/tts.js               POST /api/tts             -> Cartesia, streams audio back
    routes/stt.js               POST /api/stt              -> Groq Whisper, Hindi-tuned
    routes/patient.js           POST /api/patient/extract -> structured patient record
    lib/systemPrompt.js        NOVA persona + medical-safety scope rules
    lib/knowledgeBase.js       loads knowledge.json, simple keyword retrieval
    lib/patientExtraction.js   turns the transcript into a JSON patient record
    data/knowledge.json        glucometer/BP/thermometer steps — REPLACE_ME placeholders to check
    .env.example
  public/
    index.html
    style.css
    js/videoController.js     double-video crossfade (rest.mp4 <-> talking.mp4)
    js/wakeword.js             "Hey Nova" detection — disabled by default now, see below
    js/micCapture.js           local VAD + Groq Whisper STT capture
    js/conversation.js         STT capture, chat/tts calls, session history
    js/patientBridge.js        <-- the postMessage contract with your main project
    js/app.js                  state machine: sleeping / listening / speaking
    assets/                    <-- put rest.mp4 and talking.mp4 here
```

## 2. Setup

```bash
cd server
npm install
cp .env.example .env
# then edit .env — see below for what matters for this version
npm start
```

Open `http://localhost:3000` in a browser (or point your `<iframe>` at it).
Grant microphone permission when prompted.

Drop `rest.mp4` / `talking.mp4` into `public/assets/` (unchanged from the
original scaffold).

### `.env` — what to set

- `GROQ_API_KEY` — for the LLM, STT, and patient-data extraction, all via Groq.
- `TTS_PROVIDER=cartesia`, `TTS_API_KEY`, `TTS_VOICE_ID` — your voice ID
  (`4459a9a5-69d6-4680-b970-e13dc51845b6`) is already wired in as the
  example — it's a Cartesia voice ID, so the provider must be Cartesia, not
  ElevenLabs.
- `TTS_LANGUAGE=hi` / `GROQ_STT_LANGUAGE=hi` — default the whole pipeline to
  Hindi. Unset `GROQ_STT_LANGUAGE` if patients regularly switch between
  Hindi and English and you'd rather Whisper auto-detect per utterance.
- `HOST_APP_ORIGIN` — leave blank locally; set once you know your main
  project's real deployed origin (see integration section).

> **Model names drift.** Both Groq and Cartesia sunset model IDs on their
> own schedule — this scaffold was tested with `openai/gpt-oss-120b` /
> `openai/gpt-oss-20b` (Groq) and `sonic-3.5` (Cartesia, `Cartesia-Version:
> 2026-03-01`) after their predecessors (`llama-3.3-70b-versatile`,
> `llama-3.1-8b-instant`, `sonic-2`) were shut down. If you start seeing
> `model_not_found` or `model_sunsetted` errors in the server console later,
> check console.groq.com/docs/deprecations and
> docs.cartesia.ai/build-with-cartesia/tts-models/api-changes for current
> replacements and update `GROQ_MODEL` / `GROQ_EXTRACTION_MODEL` /
> `CARTESIA_MODEL_ID` / `CARTESIA_API_VERSION` in `.env` — no code changes
> needed, they're all env-driven.

### `server/data/knowledge.json` — check before deploying

This holds the spoken step-by-step instructions for the glucometer/BP/
thermometer, in Hindi. **Check the `glucometer_procedure` and
`bp_monitor_procedure` steps against the actual device model(s) you're
using** — strip insertion, wait time, and beep behavior vary by model. Two
fields are still marked `REPLACE_ME` for exactly this reason; the server
logs a startup warning until they're filled in.

## 3. What changed from the university version

- **Persona** (`server/lib/systemPrompt.js`): NOVA now greets the patient,
  collects name/age, asks how they're feeling, and guides device readings
  one step at a time — in simple spoken Hindi. It's hard-blocked from ever
  diagnosing, interpreting a reading as normal/abnormal, or suggesting
  medicine/treatment — that always gets deferred to the health worker/
  doctor. It also has an explicit "urgent symptoms -> tell them to alert
  staff immediately" instruction.
- **Voice**: Cartesia, Hindi, your voice ID.
- **STT**: Groq Whisper switched to `whisper-large-v3` (not `-turbo`) and
  given an explicit `hi` language hint — noticeably more accurate on
  spoken numbers (vitals readings) than the university version needed.
- **New: structured patient-data extraction** (`routes/patient.js` +
  `lib/patientExtraction.js`). After every assistant turn, the frontend
  fires a background call that reads the conversation so far and returns a
  JSON record — name, age, symptoms, vitals, an urgent flag, whether the
  conversation looks ready for review — independent of the spoken reply.
- **New: `patientBridge.js`** — the file that actually connects this app to
  your main project. See below.
- **Wake word disabled by default** (`SKIP_WAKE_WORD = true` in `app.js`).
  Since your main project's own button is the "wake" trigger, listening for
  "Hey Nova" is unnecessary latency once the patient's already been handed
  to this screen. Flip it back to `false` in `app.js` if you want a kiosk
  left running between patients to still respond to "Hey Nova" instead of
  needing a tap.

## 4. Integration with your main project

This is intentionally a **separate page that talks to your main project
only via `window.postMessage`** — embed it as an `<iframe>` inside your
"Talk to AI Assistant" panel, or `window.open()` it as a popup. Full
message contract lives in `public/js/patientBridge.js`; short version:

**This widget sends** (`{ source: "nova-health-assistant", type, payload }`):

| type              | when                                   | payload                                  |
|-------------------|----------------------------------------|-------------------------------------------|
| `ready`           | page loaded                            | `null`                                    |
| `session-started` | patient conversation begins            | `null`                                    |
| `patient-data`    | after every assistant turn             | the structured record (name/age/vitals/…) |
| `urgent`          | once, if `urgent_flag` turns true      | the record that triggered it              |
| `session-ended`   | conversation ends (timeout/bye/host)   | the final record                          |

**Your main project can send** (same envelope, `source: "nova-health-assistant-host"`):

| type           | payload                          | effect                                          |
|----------------|-----------------------------------|--------------------------------------------------|
| `init`         | `{ name, age, gender }` (any)     | pre-fills what's already known so NOVA doesn't re-ask |
| `end-session`  | —                                 | ends the current conversation immediately         |

Example, from your main project, for an `<iframe id="nova-frame">`:

```js
window.addEventListener("message", (event) => {
  const msg = event.data;
  if (!msg || msg.source !== "nova-health-assistant") return;

  if (msg.type === "patient-data") {
    // msg.payload = { name, age, gender, symptoms: [], vitals: {...}, ... }
    fillSidePanelFrom(msg.payload); // your own form-filling logic
  }
  if (msg.type === "urgent") {
    showUrgentAlert(msg.payload);
  }
  if (msg.type === "session-ended") {
    onPatientCheckComplete(msg.payload);
  }
});

// once the patient is known (e.g. already checked in):
document.getElementById("nova-frame").contentWindow.postMessage(
  { source: "nova-health-assistant-host", type: "init", payload: { name: "Sunita", age: 54 } },
  "*" // replace "*" with the widget's real origin once deployed
);
```

Once you know the real deployed origins for both apps, set:
- `HOST_APP_ORIGIN` in this app's `.env` isn't used for postMessage (that's
  set via the `<meta name="host-app-origin">` tag in `public/index.html` —
  see the comment there) — set that meta tag's `content` to your main
  project's origin, and use that same origin (not `"*"`) when your main
  project posts back to this widget.

## 5. How the pieces map to the original spec

- **Avatar videos**: `videoController.js` — unchanged.
- **Wake word**: `wakeword.js` — code kept intact but not engaged by
  default (see `SKIP_WAKE_WORD` above). Still built on local volume
  detection + Groq Whisper, not the browser's cloud `SpeechRecognition`
  (which silently fails on distro Chromium builds without Google's private
  key — see the comment at the top of `wakeword.js` for details and the
  Picovoice Porcupine offline-wake-word note).
- **Conversation session**: `app.js` state machine + `conversation.js`
  session history — same as before; history clears on sleep/session-end.
- **Patient data capture**: new, see section 3-4 above.
