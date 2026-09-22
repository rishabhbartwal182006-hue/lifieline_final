/**
 * NOVA state machine
 *
 * SLEEPING -> "Hey Nova" heard -> GREETING (short spoken greeting) -> ACTIVE_LISTENING
 * ACTIVE_LISTENING -> user speaks -> PROCESSING -> SPEAKING -> ACTIVE_LISTENING (no wake word needed again)
 * ACTIVE_LISTENING -> silence for SLEEP_TIMEOUT_MS -> SLEEPING (session/history cleared)
 * ACTIVE_LISTENING -> user says a sleep phrase ("bye", "go to sleep", ...) -> short farewell -> SLEEPING
 */
const SLEEP_TIMEOUT_MS = 9000; // spec: ~8-10s configurable

// ─── Backup Audio (offline / slow-response fallback) ──────────────────────
// Pre-recorded PCM file generated from the same Cartesia TTS voice.
// Played automatically when network is down or API response times out.
// Prevents overlap with live TTS: live TTS is stopped before backup plays,
// and backup blocks new TTS while it is active.
const BACKUP_AUDIO_PATH = "/audio/backup_network_error.pcm";
const BACKUP_TTS_SAMPLE_RATE = 22050; // must match conversation.js TTS_SAMPLE_RATE
// How long (ms) to wait for /api/chat/stream to start before playing backup
const CHAT_RESPONSE_TIMEOUT_MS = 12000;

// Originally this kiosk always listened for "Hey Nova" continuously. Now
// that a session is triggered by a button on your main project (which is
// itself the "wake" gesture), that extra voice-detection round trip is
// unnecessary latency for a patient who already tapped a button to talk.
// Wake-word listening enabled by default so NOVA continues listening for
// "Hey Nova" between conversations, along with the manual mic button.
const SKIP_WAKE_WORD = false;

// Short varied greeting spoken as soon as the wake word is heard, before
// listening for the actual question — makes the wake feel acknowledged
// immediately instead of Nova just silently starting to listen.
// Kept comma-free where possible so TTS reads them as one continuous
// phrase instead of pausing mid-sentence.
const GREETINGS = [
  "Hey! How can I help?",
  "Hi there! What can I do for you?",
  "Yes? What do you need?",
  "Hey I'm listening.",
  "Hi! Go ahead I'm all ears.",
  "What can I help you with?"
];

const GREETINGS_HI = [
  "नमस्ते! मैं आपकी स्वास्थ्य सहायिका नोवा हूँ। मैं आपकी क्या मदद करूँ?",
  "नमस्ते! बताइए, आपकी क्या सहायता कर सकती हूँ?",
  "जी, मैं सुन रही हूँ। आप क्या जानना चाहते हैं?",
  "नमस्ते! क्या आप कोई स्वास्थ्य जांच या सलाह चाहते हैं?"
];

const FAREWELLS = [
  "Bye! Just say Hey Nova if you need me again.",
  "See you later!",
  "Okay going to sleep. Say Hey Nova to wake me.",
  "Goodbye!",
  "Alright catch you later."
];

const FAREWELLS_HI = [
  "नमस्ते! जब भी ज़रूरत हो, हे नोवा कहिए। अपना ध्यान रखें।",
  "अलविदा! अपना ख्याल रखें।",
  "ठीक है, मैं स्लीप मोड में जा रही हूँ। कभी भी आवाज़ दें।"
];

// Phrases that end the session immediately, mid-conversation, instead of
// being sent to the LLM. Checked as whole-word matches so e.g. "bye" won't
// misfire on words like "goodbye-cruel-world" mid-sentence — close enough
// for spoken transcripts.
const SLEEP_PHRASES = [
  /\bbye\b/i,
  /\bgoodbye\b/i,
  /\bgood night\b/i,
  /\bgo to sleep\b/i,
  /\bstop listening\b/i,
  /\bthat('?s| is) all\b/i,
  /\bsee you\b/i,
  /अलविदा/i,
  /बाय/i,
  /सो\s*जाओ/i,
  /शांत\s*हो\s*जाओ/i,
  /रुक\s*जाओ/i
];

const DOOR_OPEN_PHRASES = [
  /दरवा[ज़ज]ा?\s*खोल/i,
  /दरवा[ज़ज]े?\s*खोल/i,
  /द्वार\s*खोल/i,
  /गेट\s*खोल/i,
  /स्लॉट\s*खोल/i,
  /बे\s*खोल/i,
  /darw[a|z|j]*\s*khol/i,
  /darwaza\s*open/i,
  /darwaja\s*open/i,
  /door\s*khol/i,
  /door\s*open/i,
  /open\s*door/i,
  /\bkholo\b/i,
  /\bkhol\s+do\b/i,
  /\bkholiye\b/i,
  /\bopen\s+(the\s+)?(bay|door|kiosk|slot|gate)\b/i,
  /\b(bay|door|kiosk|slot|gate)\s+open\b/i
];

const DOOR_CLOSE_PHRASES = [
  /दरवा[ज़ज]ा?\s*बंद/i,
  /दरवा[ज़ज]े?\s*बंद/i,
  /द्वार\s*बंद/i,
  /गेट\s*बंद/i,
  /स्लॉट\s*बंद/i,
  /बे\s*बंद/i,
  /darw[a|z|j]*\s*band/i,
  /darwaza\s*close/i,
  /darwaja\s*close/i,
  /door\s*band/i,
  /door\s*close/i,
  /close\s*door/i,
  /\bband\s*karo\b/i,
  /\bband\s+do\b/i,
  /\bband\s+kijiye\b/i,
  /\bclose\s+(the\s+)?(bay|door|kiosk|slot|gate)\b/i,
  /\b(bay|door|kiosk|slot|gate)\s+close\b/i
];

function isSleepCommand(text) {
  return SLEEP_PHRASES.some((re) => re.test(text));
}

function isDoorOpenCommand(text) {
  return DOOR_OPEN_PHRASES.some((re) => re.test(text));
}

function isDoorCloseCommand(text) {
  return DOOR_CLOSE_PHRASES.some((re) => re.test(text));
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getGreeting() {
  const isHi = typeof Conversation !== "undefined" && Conversation.getLanguage()?.startsWith("hi");
  return pickRandom(isHi ? GREETINGS_HI : GREETINGS);
}

function getFarewell() {
  const isHi = typeof Conversation !== "undefined" && Conversation.getLanguage()?.startsWith("hi");
  return pickRandom(isHi ? FAREWELLS_HI : FAREWELLS);
}

const statusText = document.getElementById("status-text");
const listeningIndicator = document.getElementById("listening-indicator");
const transcriptBar = document.getElementById("transcript-bar");
const userTranscriptEl = document.getElementById("user-transcript");
const reportBtn = document.getElementById("report-btn");
const sugarDoneBtn = document.getElementById("sugar-done-btn");

if (reportBtn) {
  reportBtn.addEventListener("click", () => {
    const rec = PatientBridge.getLastRecord();
    PatientBridge.goToReport(rec);
  });
}

if (sugarDoneBtn) {
  let _scanInProgress = false; // guard against double-clicks

  sugarDoneBtn.addEventListener("click", async () => {
    if (_scanInProgress) return;
    _scanInProgress = true;

    // ── 1. Immediately silence everything else ─────────────────────────────
    Conversation.stopSpeaking();    // kill any in-flight TTS audio nodes
    Conversation.stopListening();   // abort microphone capture
    state = "SCANNING";             // prevent runListenTurn from re-entering

    sugarDoneBtn.disabled = true;
    sugarDoneBtn.innerHTML = '<span>⏳ स्कैन हो रही है...</span>';
    setStatus("मशीन से रीडिंग स्कैन की जा रही है...");
    showListeningUI(false);
    showTranscript(null);
    VideoController.toRest();

    // Resume audio context after user tap
    try { await Conversation.resumeAudioContext(); } catch (_) {}

    // ── 2. Call the vitals scanner ─────────────────────────────────────────
    let scannedValue = null;
    let scanSuccess = false;
    try {
      const sessId = new URLSearchParams(window.location.search).get("session_id")
                     || `kiosk-nova-${Date.now()}`;
      const backendHost = window.location.hostname || 'localhost';
      const res = await fetch(`http://${backendHost}:4000/api/v1/vitals/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessId })
      });
      const data = await res.json();
      if (data && data.success && data.reading && data.reading.value) {
        scannedValue = String(data.reading.value);
        scanSuccess = true;
      } else {
        console.warn("Scan response without valid reading:", data);
      }
    } catch (err) {
      console.error("Vitals scan API call failed:", err);
    }

    // ── 3a. SUCCESS — announce reading and go to report ────────────────────
    if (scanSuccess && scannedValue) {
      window.waitingForSugarTest = false;
      sugarDoneBtn.innerHTML = `<span>✅ स्कैन सफल: ${scannedValue} mg/dL</span>`;
      setStatus(`ब्लड शुगर: ${scannedValue} mg/dL`);

      const rec = PatientBridge.getLastRecord() || {};
      if (!rec.vitals) rec.vitals = {};
      rec.vitals.blood_glucose       = scannedValue;
      rec.vitals.blood_glucose_mg_dl = scannedValue;
      rec.vitals.bloodSugar          = scannedValue;
      PatientBridge.patientData(rec);

      // Speak confirmation (speak() handles toTalking/toRest internally)
      try {
        await Conversation.speak(
          `आपकी ब्लड शुगर रीडिंग ${scannedValue} मिलीग्राम प्रति डेसीलीटर है। आपकी रिपोर्ट अभी स्क्रीन पर दिखाई जा रही है।`
        );
      } catch (e) {
        console.warn("Spoken confirmation error:", e);
        VideoController.toRest();
      }

      // Send to report screen after speech ends
      PatientBridge.goToReport(rec);
      sugarDoneBtn.classList.add("hidden");
      goToSleep();

      // 🚪 AFTER SHOWING SUMMARY OF REPORT: After 5 seconds the door will close by itself
      setTimeout(() => {
        const backendHost = window.location.hostname || 'localhost';
        fetch(`http://${backendHost}:4000/api/v1/kiosk/door/close`, { method: "POST" })
          .then(r => r.json())
          .then(res => console.log("[NOVA] Diagnostic bay door auto-closed 5s after report:", res))
          .catch(err => console.warn("[NOVA] Door close error:", err));
        PatientBridge.doorAction("close");
      }, 5000);

    // ── 3b. FAILURE — prompt retry ─────────────────────────────────────────
    } else {
      sugarDoneBtn.disabled = false;
      sugarDoneBtn.innerHTML = '<span>⚠️ दोबारा दबाएं</span>';
      setStatus("रीडिंग नहीं मिली — स्लॉट जांचें और दोबारा दबाएं");

      try {
        await Conversation.speak(
          "मशीन से रीडिंग नहीं मिली। कृपया मशीन को स्लॉट में ठीक से रखें और दोबारा बटन दबाएं।"
        );
      } catch (e) {
        VideoController.toRest();
      }

      // Return to waiting state so button stays active
      state = "SLEEPING";
      window.waitingForSugarTest = true;
      sugarDoneBtn.classList.remove("hidden");
    }

    _scanInProgress = false;
  });
}

let state = "SLEEPING";

// ─── Backup Audio Engine (Offline & Network Error Resilient) ───────────────
let _backupAudioBuffer = null;
let _backupAudioEl     = null;
let _backupAudioNode   = null;
let _backupPlaying     = false;

/**
 * Prepares the backup audio as early as possible.
 * Uses window.BACKUP_AUDIO_DATA_URI (embedded WAV, zero network dependency)
 * with a fallback to fetching /audio/backup_network_error.pcm.
 */
async function loadBackupAudio() {
  // 1. Prime HTML5 Audio element from embedded base64 Data URI
  if (typeof window !== "undefined" && window.BACKUP_AUDIO_DATA_URI) {
    try {
      if (!_backupAudioEl) {
        _backupAudioEl = new Audio();
        _backupAudioEl.src = window.BACKUP_AUDIO_DATA_URI;
        _backupAudioEl.preload = "auto";
        _backupAudioEl.load();
      }
    } catch (e) {
      console.warn("[Backup] HTMLAudioElement setup failed:", e);
    }
  }

  // 2. Decode into Web Audio AudioBuffer for glitch-free Web Audio playback
  if (_backupAudioBuffer) return;

  try {
    const ctx = SharedAudio.getAudioContext();
    if (window.BACKUP_AUDIO_DATA_URI) {
      // Decode the data URI directly using browser's native decoder
      const res = await fetch(window.BACKUP_AUDIO_DATA_URI);
      const arrayBuffer = await res.arrayBuffer();
      ctx.decodeAudioData(arrayBuffer, (buf) => {
        _backupAudioBuffer = buf;
        console.log(`[Backup] WebAudio buffer ready from data URI (${buf.duration.toFixed(1)}s)`);
      }, (e) => {
        console.warn("[Backup] decodeAudioData error:", e);
      });
      return;
    }

    // Fallback: network fetch if data URI not present
    const res = await fetch(BACKUP_AUDIO_PATH);
    if (!res.ok) return;
    const arrayBuffer = await res.arrayBuffer();
    const safeLen = Math.floor(arrayBuffer.byteLength / 2);
    const int16   = new Int16Array(arrayBuffer, 0, safeLen);
    const float32 = new Float32Array(safeLen);
    for (let i = 0; i < safeLen; i++) {
      float32[i] = int16[i] / 32768;
    }
    const buf = ctx.createBuffer(1, float32.length, BACKUP_TTS_SAMPLE_RATE);
    buf.getChannelData(0).set(float32);
    _backupAudioBuffer = buf;
    console.log(`[Backup] WebAudio buffer ready via fetch (${(arrayBuffer.byteLength / 2 / BACKUP_TTS_SAMPLE_RATE).toFixed(1)}s)`);
  } catch (err) {
    console.warn("[Backup] Buffer load attempt ended:", err);
  }
}

function isBackupPlaying() { return _backupPlaying; }

/**
 * Plays the offline backup audio in Nova's voice.
 * Strictly guarantees ZERO OVERLAP:
 * - Cancels all live TTS streaming and buffers
 * - Cancels active STT and wake word listeners
 * - Sets _backupPlaying to lock other speech sources
 * - Animates avatar talking during playback, then rests
 */
function playBackupAudio() {
  return new Promise((resolve) => {
    if (_backupPlaying) {
      resolve();
      return;
    }

    // Hard stop anything else that might be active
    try { Conversation.stopSpeaking(); } catch (_) {}
    try { Conversation.stopListening(); } catch (_) {}
    try { WakeWordListener.stop(); } catch (_) {}

    _backupPlaying = true;
    VideoController.toTalking?.();

    let doneFired = false;
    function onPlaybackDone() {
      if (doneFired) return;
      doneFired = true;
      _backupPlaying = false;
      _backupAudioNode = null;
      VideoController.toRest?.();
      resolve();
    }

    // Priority 1: Web Audio BufferSource if available (resumed context)
    const ctx = SharedAudio.getAudioContext();
    if (_backupAudioBuffer && ctx && ctx.state === "running") {
      try {
        const source = ctx.createBufferSource();
        source.buffer = _backupAudioBuffer;
        source.connect(ctx.destination);
        _backupAudioNode = source;
        source.onended = onPlaybackDone;
        source.start(ctx.currentTime);
        console.log("[Backup] Playing via WebAudio");
        return;
      } catch (err) {
        console.warn("[Backup] WebAudio playback failed, trying HTML5 Audio:", err);
      }
    }

    // Priority 2: HTML5 Audio Element (works even if AudioContext was suspended)
    if (_backupAudioEl || window.BACKUP_AUDIO_DATA_URI) {
      try {
        const el = _backupAudioEl || new Audio(window.BACKUP_AUDIO_DATA_URI);
        _backupAudioNode = el;
        el.currentTime = 0;
        el.onended = onPlaybackDone;
        el.onerror = (e) => {
          console.warn("[Backup] HTML5 Audio playback error:", e);
          onPlaybackDone();
        };
        const playPromise = el.play();
        if (playPromise) {
          playPromise.catch((err) => {
            console.warn("[Backup] HTML5 play() promise rejected:", err);
            onPlaybackDone();
          });
        }
        console.log("[Backup] Playing via HTML5 Audio");
        return;
      } catch (err) {
        console.warn("[Backup] HTML5 Audio play failed:", err);
      }
    }

    // If nothing could play, cleanly release
    onPlaybackDone();
  });
}

/** Silently stop backup audio if it is currently playing. */
function stopBackupAudio() {
  if (_backupAudioNode) {
    try {
      if (typeof _backupAudioNode.pause === "function") {
        _backupAudioNode.pause();
        _backupAudioNode.currentTime = 0;
      } else if (typeof _backupAudioNode.stop === "function") {
        _backupAudioNode.onended = null;
        _backupAudioNode.stop();
      }
    } catch (_) {}
    _backupAudioNode = null;
  }
  _backupPlaying = false;
  VideoController.toRest?.();
}

/**
 * Universal offline handler:
 * - Switches state out of active listening
 * - Updates on-screen status banner
 * - Plays Nova's backup audio announcement
 * - Leaves mic button visible so user can tap when internet returns
 */
async function handleOfflineNotice() {
  console.warn("[NOVA] Triggering offline notice");
  state = "SLEEPING";
  showListeningUI(false);
  showTranscript(null);
  setStatus("⚠️ इंटरनेट से कनेक्ट नहीं हो पा रहा");
  manualWakeBtn.classList.remove("hidden");
  WakeWordListener.stop();

  await playBackupAudio();

  setStatus("कृपया इंटरनेट चालू करें और नीचे माइक बटन दबाएं");
}
// ──────────────────────────────────────────────────────────────────────────



function setStatus(text) {
  statusText.textContent = text;
}

function showListeningUI(show) {
  listeningIndicator.classList.toggle("hidden", !show);
}

function showTranscript(text) {
  if (!text) {
    transcriptBar.classList.add("hidden");
    userTranscriptEl.textContent = "";
    return;
  }
  userTranscriptEl.textContent = text;
  transcriptBar.classList.remove("hidden");
}

function goToSleep() {
  const wasActive = state !== "SLEEPING";
  state = "SLEEPING";
  Conversation.stopListening();
  showListeningUI(false);
  showTranscript(null);

  // If waiting for patient to test sugar and insert machine, KEEP button visible!
  if (window.waitingForSugarTest) {
    sugarDoneBtn?.classList.remove("hidden");
    VideoController.toRest();
    VideoController.setIdle?.(true);
    manualWakeBtn.classList.remove("hidden");
    setStatus("मशीन स्लॉट में रखने के बाद नीचे दिया गया बटन दबाएं");
    // Explicitly keep WakeWordListener stopped so servo motor noise doesn't trigger wakeups
    WakeWordListener.stop();
    return;
  }

  if (wasActive) {
    // Tell the host app this patient's turn is over, one last time, with
    // whatever was captured — before wiping the in-page history.
    PatientBridge.sessionEnded(PatientBridge.getLastRecord());
  }
  Conversation.reset();
  sugarDoneBtn?.classList.add("hidden");
  VideoController.toRest();
  // Optional chaining on purpose: a missing/failing method here must never
  // block the line below from running — that line is what actually makes
  // "Hey Nova" (or the restart) work at all.
  VideoController.setIdle?.(true);
  manualWakeBtn.classList.remove("hidden");
  setStatus('Say "Hey Nova" or tap mic to begin');
  WakeWordListener.start(onWakeWordDetected);
}

function onWakeWordDetected() {
  if (state !== "SLEEPING") return;
  WakeWordListener.stop();

  // Instant offline check on wake: if device has no connection, tell patient immediately
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    handleOfflineNotice();
    return;
  }

  state = "GREETING";
  setStatus("...");
  VideoController.setIdle?.(false); // resume dual-video decode for instant crossfades during the conversation
  VideoController.toRest();
  PatientBridge.sessionStarted();
  greetThenListen();
}

async function greetThenListen() {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    await handleOfflineNotice();
    return;
  }

  try {
    await Conversation.speak(getGreeting());
  } catch (err) {
    console.warn("Greeting playback failed:", err);
    // If speaking greeting failed because network/TTS is unreachable
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      await handleOfflineNotice();
      return;
    }
  }

  // In case something (e.g. sleep timeout race) put us back to sleep
  // while the greeting was playing.
  if (state === "SLEEPING") return;
  state = "ACTIVE_LISTENING";
  setStatus("Listening...");
  runListenTurn();
}

async function runListenTurn() {
  if (state !== "ACTIVE_LISTENING") return;

  // Immediate offline check before trying to listen
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    await handleOfflineNotice();
    return;
  }

  showListeningUI(true);
  showTranscript(null);

  try {
    const transcript = await Conversation.listenOnce({
      silenceTimeoutMs: SLEEP_TIMEOUT_MS,
      onInterim: (interimText) => {
        showTranscript(interimText);
      }
    });
    showListeningUI(false);
    showTranscript(transcript);
    await handleUserUtterance(transcript);
  } catch (err) {
    console.log("[NOVA] Listen turn ended:", err.message);
    showListeningUI(false);
    showTranscript(null);

    if (state === "ACTIVE_LISTENING") {
      if (err.message === "permission-denied" || err.message === "not-allowed") {
        setStatus("⚠️ माइक अनुमति की आवश्यकता है — नीचे माइक बटन दबाएं या HTTPS लिंक खोलें");
        state = "SLEEPING";
        manualWakeBtn.classList.remove("hidden");
        return;
      }

      // Check if STT failed due to GENUINE offline state (no connection at all)
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        await handleOfflineNotice();
        return;
      }

      // If online, don't trigger the offline alert; go to sleep cleanly
      goToSleep();
    }
  }
}

async function handleUserUtterance(transcript) {
  if (!transcript || !transcript.trim()) {
    // Empty/garbage recognition result — just listen again.
    runListenTurn();
    return;
  }

  if (isSleepCommand(transcript)) {
    state = "SPEAKING";
    setStatus("Speaking...");
    try {
      await Conversation.speak(getFarewell());
    } catch (err) {
      console.error("Farewell playback failed:", err);
    }
    goToSleep();
    return;
  }

  // 🚪 Direct Voice Command: OPEN DOOR
  if (isDoorOpenCommand(transcript)) {
    state = "SPEAKING";
    setStatus("दरवाज़ा खोल रही हूँ...");
    const backendHost = window.location.hostname || 'localhost';
    fetch(`http://${backendHost}:4000/api/v1/kiosk/door/open`, { method: "POST" })
      .then(r => r.json())
      .then(d => console.log("[NOVA] Door opened via voice command:", d))
      .catch(err => console.warn("[NOVA] Door open failed:", err));
    PatientBridge.doorAction("open");
    
    window.waitingForSugarTest = true;
    if (sugarDoneBtn) sugarDoneBtn.classList.remove("hidden");

    const isHi = typeof Conversation !== "undefined" && Conversation.getLanguage()?.startsWith("hi");
    const openMsg = isHi
      ? "जी, मैं आपके लिए डायग्नोस्टिक बे का दरवाज़ा खोल रही हूँ। कृपया अपना उपकरण स्लॉट में रखें और जांच शुरू करें।"
      : "Opening the diagnostic bay door for you now. Please place your device into the slot.";

    try {
      await Conversation.speak(openMsg);
    } catch (err) {
      console.error("Door open speech failed:", err);
    }
    goToSleep();
    return;
  }

  // 🚪 Direct Voice Command: CLOSE DOOR
  if (isDoorCloseCommand(transcript)) {
    state = "SPEAKING";
    setStatus("दरवाज़ा बंद कर रही हूँ...");
    const backendHost = window.location.hostname || 'localhost';
    fetch(`http://${backendHost}:4000/api/v1/kiosk/door/close`, { method: "POST" })
      .then(r => r.json())
      .then(d => console.log("[NOVA] Door closed via voice command:", d))
      .catch(err => console.warn("[NOVA] Door close failed:", err));
    PatientBridge.doorAction("close");
    
    window.waitingForSugarTest = false;
    if (sugarDoneBtn) sugarDoneBtn.classList.add("hidden");

    const isHi = typeof Conversation !== "undefined" && Conversation.getLanguage()?.startsWith("hi");
    const closeMsg = isHi
      ? "जी, डायग्नोस्टिक बे का दरवाज़ा बंद कर दिया गया है।"
      : "The diagnostic bay door has been closed.";

    try {
      await Conversation.speak(closeMsg);
    } catch (err) {
      console.error("Door close speech failed:", err);
    }
    goToSleep();
    return;
  }

  // Stop any leftover backup audio before sending a new user message
  stopBackupAudio();

  state = "PROCESSING";
  setStatus("Thinking...");

  let chatError = false;
  try {
    state = "SPEAKING";
    setStatus("Speaking...");
    await Conversation.askNovaAndSpeak(transcript);

  } catch (err) {
    chatError = true;
    const msg = err.message || "";
    console.error("[NOVA] Chat/TTS error:", msg);

    // If door opened or vitals flow was triggered, NEVER speak an error notice!
    if (window.waitingForSugarTest || isDoorOpenCommand(transcript)) {
      console.log("[NOVA] Vitals/door action in progress — suppressing error speech");
      return;
    }

    // Only play the offline audio if the browser is GENUINELY offline
    const isTrulyOffline = (typeof navigator !== "undefined" && navigator.onLine === false);

    if (isTrulyOffline) {
      setStatus("⚠️ नेटवर्क समस्या — कृपया इंटरनेट जाँचें");
      await playBackupAudio();   // waits for full playback, prevents any overlap
      setStatus("कृपया दोबारा कोशिश करें या इंटरनेट जाँचें");
    } else {
      // Internet is active — log and gracefully recover without speaking annoying false timeout notices
      console.warn("[NOVA] Utterance handling completed with warning:", msg);
      setStatus("बात करने के लिए टैप करें या 'Hey Nova' कहें");
      goToSleep();
      return;
    }
  }

  // If Nova just instructed the patient to take vitals / insert machine:
  // Stop listening on the microphone so servo door noise or silence does not
  // trigger an unwanted turn. Patient will press the on-screen button.
  if (window.waitingForSugarTest) {
    state = "SLEEPING";
    Conversation.stopListening();
    WakeWordListener.stop();
    showListeningUI(false);
    showTranscript(null);
    sugarDoneBtn?.classList.remove("hidden");
    VideoController.toRest();
    VideoController.setIdle?.(true);
    setStatus("मशीन स्लॉट में रखने के बाद नीचे दिया गया बटन दबाएं");
    return;
  }

  // After speaking (or on error), go back to listening without needing
  // the wake word again, unless we've since been put to sleep elsewhere.
  if (state !== "SLEEPING") {
    state = "ACTIVE_LISTENING";
    setStatus("Listening...");
    runListenTurn();
  }
}


function sleepBriefly(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// --- fullscreen ---
// Browsers only allow entering fullscreen from a real user gesture (click/tap),
// so this can't be done automatically on page load — needs the button.
const fullscreenBtn = document.getElementById("fullscreen-btn");

function isFullscreen() {
  return !!(
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.msFullscreenElement
  );
}

function requestFullscreen(el) {
  const fn =
    el.requestFullscreen ||
    el.webkitRequestFullscreen ||
    el.msRequestFullscreen;
  if (fn) return fn.call(el);
  return Promise.reject(new Error("Fullscreen API not supported"));
}

function exitFullscreen() {
  const fn =
    document.exitFullscreen ||
    document.webkitExitFullscreen ||
    document.msExitFullscreen;
  if (fn) return fn.call(document);
  return Promise.resolve();
}

function updateFullscreenBtn() {
  fullscreenBtn.classList.toggle("hidden", isFullscreen());
}

fullscreenBtn.addEventListener("click", async () => {
  try {
    if (!isFullscreen()) {
      await requestFullscreen(document.documentElement);
    } else {
      await exitFullscreen();
    }
  } catch (err) {
    console.error("Fullscreen request failed:", err);
  }
});

["fullscreenchange", "webkitfullscreenchange", "MSFullscreenChange"].forEach((evt) =>
  document.addEventListener(evt, updateFullscreenBtn)
);
updateFullscreenBtn();

// --- language toggle (Hindi / English Google STT) ---
const langToggleBtn = document.getElementById("lang-toggle-btn");
if (langToggleBtn) {
  function updateLangBtnUI() {
    const cur = Conversation.getLanguage();
    langToggleBtn.textContent = (cur === "en-IN") ? "🌐 English" : "🌐 हिन्दी";
  }
  updateLangBtnUI();

  langToggleBtn.addEventListener("click", () => {
    const next = (Conversation.getLanguage() === "hi-IN") ? "en-IN" : "hi-IN";
    Conversation.setLanguage(next);
    updateLangBtnUI();
    setStatus(next === "en-IN" ? "Language: English (Google STT)" : "भाषा: हिन्दी (Google STT)");
  });
}

// --- cursor auto-hide ---
// Hides the cursor after a few seconds of no mouse movement (kiosk-style),
// but shows it again as soon as the mouse moves so it stays usable for
// clicking the fullscreen button during normal browser use.
const CURSOR_IDLE_MS = 3000;
let cursorIdleTimer = null;

function showCursor() {
  document.body.classList.remove("cursor-idle");
  clearTimeout(cursorIdleTimer);
  cursorIdleTimer = setTimeout(() => {
    document.body.classList.add("cursor-idle");
  }, CURSOR_IDLE_MS);
}

document.addEventListener("mousemove", showCursor);
showCursor();

// --- start overlay ---
// One explicit tap that unlocks audio playback (AudioContext) and mic
// access together, then starts wake-word listening. See the HTML comment
// on #start-overlay for why this exists.
const startOverlay = document.getElementById("start-overlay");
const startBtn = document.getElementById("start-btn");

async function handleStart() {
  startBtn.disabled = true;
  try {
    await Conversation.resumeAudioContext();
  } catch (err) {
    console.warn("Failed to resume AudioContext:", err);
  }

  let micGranted = false;
  const hasSpeechRec = !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  if (hasSpeechRec) {
    micGranted = true;
  }

  if (navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === "function") {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      micGranted = true;
    } catch (err) {
      console.warn("Mic permission check via getUserMedia:", err);
    }
  }

  try {
    if (!isFullscreen()) {
      await requestFullscreen(document.documentElement);
    }
  } catch (err) {
    console.warn("Fullscreen request failed:", err);
  }

  // Always hide start overlay so NOVA opens and interacts
  startOverlay.classList.add("hidden");
  manualWakeBtn.classList.remove("hidden");

  state = "SLEEPING";
  if (!micGranted && !hasSpeechRec) {
    setStatus("सहायक सक्रिय है (माइक के लिए अनुमति दें या टैप करें)");
  }

  // Pre-load backup audio now that the AudioContext is running (fire-and-forget)
  loadBackupAudio();

  onWakeWordDetected();
}

startBtn.addEventListener("click", handleStart);

// --- manual wake override ---
// Skips voice-based wake-word detection entirely and jumps straight into
// the same flow "Hey Nova" would trigger. Useful when the mic/wake-word
// isn't reliable yet, or in a loud/quiet environment where saying "Hey
// Nova" out loud isn't practical.
const manualWakeBtn = document.getElementById("manual-wake-btn");

manualWakeBtn.addEventListener("click", async () => {
  if (state !== "SLEEPING") return;
  try { await Conversation.resumeAudioContext(); } catch (_) {}
  loadBackupAudio(); // Ensure backup audio is primed on user tap

  // If user taps mic while offline, trigger backup notice immediately
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    handleOfflineNotice();
    return;
  }

  if (navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === "function") {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      s.getTracks().forEach(t => t.stop());
    } catch (_) {}
  }
  onWakeWordDetected();
});

// --- host app bridge ---
// Lets your main project end the session remotely (e.g. a "Done" button on
// its own side panel) even mid-conversation.
PatientBridge.setOnEndSession(() => {
  if (state !== "SLEEPING") goToSleep();
});

// --- window online / offline event listeners ---
window.addEventListener("offline", () => {
  console.warn("[NOVA] Window went offline");
  if (state === "ACTIVE_LISTENING" || state === "GREETING") {
    handleOfflineNotice();
  }
});

window.addEventListener("online", () => {
  console.log("[NOVA] Window back online");
  if (state === "SLEEPING") {
    setStatus('Say "Hey Nova" or tap mic to begin');
    WakeWordListener.start(onWakeWordDetected);
  }
});

function requestDoorClose() {
  const backendHost = window.location.hostname || 'localhost';
  const closeUrl = `http://${backendHost}:4000/api/v1/kiosk/door/close`;
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon(closeUrl);
    } else {
      fetch(closeUrl, { method: "POST", keepalive: true }).catch(() => {});
    }
  } catch (_) {
    fetch(closeUrl, { method: "POST" }).catch(() => {});
  }
}

// --- boot ---
window.addEventListener("DOMContentLoaded", () => {
  VideoController.init();
  setStatus('Tap "Start" to begin');

  // Pre-prime backup audio immediately from bundled data URI / cache
  loadBackupAudio();

  PatientBridge.ready();

  // Ensure bay door is closed on load or page refresh
  requestDoorClose();
});

// Close door on page refresh or navigation
window.addEventListener("beforeunload", requestDoorClose);
