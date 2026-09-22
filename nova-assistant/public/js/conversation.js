/**
 * Conversation
 * Handles:
 *  - speech-to-text capture for a single user utterance during an active session
 *  - session memory (conversation history, cleared on sleep)
 *  - calling the backend chat + TTS endpoints
 *  - playing TTS audio back gaplessly via the Web Audio API
 *
 * AUDIO ENGINE NOTE: sentences are synthesized as separate TTS requests (for
 * low time-to-first-sound), but scheduled back to back on a single
 * AudioContext timeline instead of played through separate <audio> elements.
 * This is what makes multi-sentence replies sound like one continuous
 * utterance instead of a series of clips with tiny clicks/gaps between them.
 */
const Conversation = (() => {
  // Must match server/routes/tts.js's Cartesia output_format.sample_rate —
  // we're decoding raw PCM ourselves (no container/header to read it from).
  const TTS_SAMPLE_RATE = 22050;

  let history = []; // { role: "user"|"assistant", content }[]

  // AudioContext is shared with micCapture.js via SharedAudio — see that
  // file for why (browsers only resume one context per user gesture; two
  // independent contexts means one of them silently never gets audio).
  function getAudioContext() {
    return SharedAudio.getAudioContext();
  }

  function resumeAudioContext() {
    return SharedAudio.resumeAudioContext();
  }

  function reset() {
    history = [];
  }

  function pushUser(text) {
    history.push({ role: "user", content: text });
  }

  function pushAssistant(text) {
    history.push({ role: "assistant", content: text });
  }

  function getHistory() {
    return history;
  }

  let activeRecognition = null;
  let currentLang = "hi-IN"; // Default: Hindi

  // Language priority (highest → lowest):
  // 1. localStorage saved user preference (from manual toggle)
  // 2. URL ?lang= param (only en-IN / en explicitly — NOT "English" which is App.jsx UI label)
  // 3. Default: hi-IN
  try {
    const saved = localStorage.getItem("nova_stt_lang");
    if (saved === "en-IN" || saved === "hi-IN") {
      currentLang = saved;
    }
  } catch (_) {}

  try {
    const urlParams = new URLSearchParams(window.location.search);
    const l = urlParams.get("lang");
    // Only treat as English if the param is literally "en", "en-IN", or "en-US"
    // Do NOT treat "English" (App.jsx dashboard UI label) as a language override —
    // patients in India should always default to Hindi regardless of the dashboard UI language.
    if (l && (l.toLowerCase() === "en" || l.toLowerCase() === "en-in" || l.toLowerCase() === "en-us")) {
      currentLang = "en-IN";
    }
    // Any Hindi variant keeps the default or saved preference
  } catch (_) {}

  function setLanguage(lang) {
    if (lang === "en" || lang === "en-IN" || lang === "English") {
      currentLang = "en-IN";
    } else {
      currentLang = "hi-IN";
    }
    // Persist the user's manual choice across page reloads
    try { localStorage.setItem("nova_stt_lang", currentLang); } catch (_) {}
    console.log("[STT] Language set to:", currentLang);
  }

  function getLanguage() {
    return currentLang;
  }

  /**
   * Google's Free Speech-to-Text Model (built-in SpeechRecognition / webkitSpeechRecognition)
   *
   * SAMSUNG TAB A / ANDROID CHROME FIX:
   * Android Chrome silently terminates SpeechRecognition after every result
   * or after 5-8 seconds, even with continuous=true. This causes onend to
   * fire without any error, which previously triggered goToSleep().
   *
   * The fix: transparently restart the recognizer after every Android-forced stop,
   * accumulating transcripts across restarts, governed by a single 1.8s pause timer.
   * Only stop retrying on: explicit abort, permission denied, or user confirmed speech pause.
   */
  function listenWithGoogleSTT({ silenceTimeoutMs = 10000, onInterim = null } = {}) {
    return new Promise((resolve, reject) => {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        return reject(new Error("SpeechRecognition not supported"));
      }

      // --- Shared state across all restart cycles ---
      let settled = false;
      let finalTranscript = "";          // accumulated across all restarts
      let initialSilenceTimer = null;    // fires if user never speaks
      let speechPauseTimer = null;       // fires 1.8s after last speech detected
      let currentRecognizer = null;
      let restartCount = 0;
      const MAX_RESTARTS = 25;           // ~25 restarts × ~5-8s = ~2 minutes max session
      let hadSpeech = false;             // true once user has spoken at least once
      let networkErrorCount = 0;        // consecutive "network" errors → internet may be down
      const MAX_NETWORK_ERRORS = 3;     // after this many, stop retrying & play backup audio

      // Update the externally-visible activeRecognition handle so stopListening() works
      function setActive(rec) {
        currentRecognizer = rec;
        activeRecognition = rec;
      }

      function cleanup() {
        if (initialSilenceTimer) { clearTimeout(initialSilenceTimer); initialSilenceTimer = null; }
        if (speechPauseTimer)    { clearTimeout(speechPauseTimer);    speechPauseTimer = null; }
        activeRecognition = null;
        currentRecognizer = null;
      }

      function finish(err, text) {
        if (settled) return;
        settled = true;
        cleanup();
        if (currentRecognizer) {
          try { currentRecognizer.abort(); } catch (_) {}
        }
        if (err) reject(err);
        else resolve(text);
      }

      // Immediate offline check
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        console.warn("[Google STT] Browser is offline (navigator.onLine = false)");
        return finish(new Error("stt-network"));
      }

      // Initial silence guard: if the user never starts speaking, time out
      initialSilenceTimer = setTimeout(() => {
        if (typeof navigator !== "undefined" && navigator.onLine === false) {
          finish(new Error("stt-network"));
        } else if (finalTranscript.trim()) {
          finish(null, finalTranscript.trim());
        } else {
          finish(new Error("timeout"));
        }
      }, silenceTimeoutMs);

      // ── Spawn one recognition session; called again transparently on Android stop ──
      function spawnSession() {
        if (settled) return;
        if (typeof navigator !== "undefined" && navigator.onLine === false) {
          finish(new Error("stt-network"));
          return;
        }
        if (restartCount > MAX_RESTARTS) {
          const best = finalTranscript.trim();
          finish(best ? null : new Error("timeout"), best || undefined);
          return;
        }

        let rec;
        try {
          rec = new SpeechRecognition();
        } catch (err) {
          finish(err);
          return;
        }
        setActive(rec);

        rec.lang = currentLang;         // "hi-IN" or "en-IN"
        rec.continuous = true;
        rec.interimResults = true;
        rec.maxAlternatives = 1;

        const sessionStartedAt = Date.now();

        rec.onspeechstart = () => {
          hadSpeech = true;
          if (initialSilenceTimer) { clearTimeout(initialSilenceTimer); initialSilenceTimer = null; }
        };

        rec.onresult = (event) => {
          if (settled) return;
          if (initialSilenceTimer) { clearTimeout(initialSilenceTimer); initialSilenceTimer = null; }
          if (speechPauseTimer)    { clearTimeout(speechPauseTimer);    speechPauseTimer = null; }
          hadSpeech = true;
          networkErrorCount = 0; // successful result means network is working — reset counter

          let sessionFinal = "";
          let sessionInterim = "";
          for (let i = 0; i < event.results.length; ++i) {
            const item = event.results[i];
            if (item.isFinal) {
              sessionFinal += item[0].transcript + " ";
            } else {
              sessionInterim += item[0].transcript;
            }
          }

          finalTranscript = (sessionFinal.trim() || sessionInterim.trim());
          if (finalTranscript && onInterim) onInterim(finalTranscript);

          // After 1.8s of post-speech silence → finalize
          if (finalTranscript) {
            speechPauseTimer = setTimeout(() => {
              if (finalTranscript) finish(null, finalTranscript);
            }, 1800);
          }
        };

        rec.onerror = (event) => {
          if (settled) return;
          const err = event.error;
          console.warn("[Google STT] Error:", err, "| restart#", restartCount, "| hadSpeech:", hadSpeech);

          if (err === "aborted") {
            // Explicit stop() call from our own code — honour it
            finish(new Error("aborted"));
          } else if (err === "not-allowed" || err === "service-not-allowed") {
            finish(new Error("permission-denied"));
          } else if (err === "network") {
            // Google STT WebSpeech cloud service connection issue
            console.warn("[Google STT] WebSpeech service network issue (navigator.onLine:", typeof navigator !== "undefined" ? navigator.onLine : "unknown", ")");
            if (typeof navigator !== "undefined" && navigator.onLine === false) {
              // Device is genuinely disconnected from internet
              finish(new Error("stt-network"));
            } else {
              // Online! Seamlessly fall back to Groq Whisper STT without annoying offline audio
              console.log("[Google STT] Online fallback: Switching seamlessly to Groq Whisper STT...");
              finish(new Error("stt-fallback-whisper"));
            }
          } else if (err === "no-speech") {
            if (finalTranscript.trim()) {
              finish(null, finalTranscript.trim());
            }
            // else: let onend fire → restart
          } else {
            if (finalTranscript.trim()) {
              finish(null, finalTranscript.trim());
            }
          }
        };

        rec.onend = () => {
          if (settled) return;
          if (typeof navigator !== "undefined" && navigator.onLine === false) {
            finish(new Error("stt-network"));
            return;
          }
          const elapsed = Date.now() - sessionStartedAt;
          console.log(`[Google STT] Session ended (restart#${restartCount}, ${elapsed}ms, hadSpeech=${hadSpeech}, partial="${finalTranscript}")`);

          // If we already have a pause timer running (user spoke and paused 1.8s), let it fire
          if (speechPauseTimer) return;

          // If user has spoken and we have text, restart to keep accumulating mid-sentence
          if (hadSpeech && finalTranscript.trim()) {
            restartCount++;
            setTimeout(spawnSession, 80);
            return;
          }

          // If user has not spoken yet and overall silence timeout has not expired, keep listening!
          if (!hadSpeech && (Date.now() - sessionStartedAt) < silenceTimeoutMs && restartCount < MAX_RESTARTS) {
            restartCount++;
            setTimeout(spawnSession, 100);
            return;
          }

          // User spoke, has text, pause timer fired → already finished via timer
          // User never spoke and ran long → genuine timeout
          if (finalTranscript.trim()) {
            finish(null, finalTranscript.trim());
          } else {
            finish(new Error("timeout"));
          }
        };

        try {
          rec.start();
        } catch (err) {
          console.warn("[Google STT] start() threw:", err, "restart#", restartCount);
          // "already started" race condition on rapid restart — back off and retry
          if (err.message && err.message.includes("already started") && restartCount < MAX_RESTARTS) {
            restartCount++;
            setTimeout(spawnSession, 250);
          } else {
            finish(err);
          }
        }
      }

      spawnSession();
    });
  }

  /**
   * Listens for a single user utterance.
   * Priority: Google Free STT (SpeechRecognition) -> Fallback: MicCapture (Groq Whisper)
   */
  async function listenOnce({ silenceTimeoutMs = 15000, onInterim = null } = {}) {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      throw new Error("stt-network");
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    // 1. PRIMARY: Use Google Free STT Model
    if (SpeechRecognition) {
      try {
        console.log("[STT] Listening via Google Free STT Model (" + currentLang + ")...");
        const transcript = await listenWithGoogleSTT({ silenceTimeoutMs, onInterim });
        if (transcript && transcript.trim()) {
          return transcript.trim();
        }
      } catch (err) {
        if (err.message === "aborted") throw err;
        if (err.message === "permission-denied") throw err;  // bubble up for UI error state
        if (err.message === "stt-network" && typeof navigator !== "undefined" && navigator.onLine === false) {
          throw err;        // genuine offline — play backup audio
        }
        console.warn("[STT] Google STT ended (" + err.message + ") — falling back to Groq Whisper");
        // Fall through to Whisper instead of giving up immediately
      }
    }

    // 2. FALLBACK: MicCapture (Groq Whisper)
    console.log("[STT] Falling back to MicCapture (Groq Whisper)...");
    let blob;
    try {
      blob = await MicCapture.captureUtterance({
        maxWaitMs: 8000,
        maxDurationMs: 15000,
        silenceMs: 1200,
        speechThreshold: 0.005
      });
    } catch (err) {
      throw err.message === "timeout" ? new Error("timeout") : err;
    }

    const { transcript, noSpeechProb } = await MicCapture.transcribe(blob);
    if (!transcript || noSpeechProb > 0.75) throw new Error("ended-without-result");
    return transcript;
  }

  function stopListening() {
    if (activeRecognition) {
      try {
        activeRecognition.abort();
      } catch (_) {}
      activeRecognition = null;
    }
    try {
      MicCapture.abort();
    } catch (_) {}
  }

  async function askNova(userText) {
    pushUser(userText);

    const chatRes = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history, patientContext: PatientBridge.getKnownPatient() })
    });
    if (!chatRes.ok) throw new Error("chat_failed");
    const { reply } = await chatRes.json();
    pushAssistant(reply);
    requestPatientDataExtraction();
    return reply;
  }

  // Fire-and-forget: pulls a structured patient record out of the
  // conversation so far and forwards it to the host app via PatientBridge.
  // Deliberately never awaited by the caller and never throws outward —
  // a slow/failed extraction must not delay or break the spoken reply.
  function requestPatientDataExtraction() {
    return fetch("/api/patient/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history })
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.record) {
          PatientBridge.patientData(data.record);
          return data.record;
        }
        return null;
      })
      .catch((err) => {
        console.warn("Patient data extraction failed:", err);
        return null;
      });
  }

  // Cartesia (and most TTS providers) cap concurrent requests per account —
  // the free/base tier here allows 2. Sentence-pipelining fires a TTS
  // request as soon as each sentence is extracted from the LLM stream, so
  // without a cap, 3+ sentences completing in a quick burst would fire 3+
  // simultaneous requests and get a 429. This gate limits how many TTS
  // fetches are in flight at once; excess calls just wait their turn
  // instead of erroring. Bump this if you upgrade your Cartesia plan.
  const MAX_CONCURRENT_TTS = 1;
  let ttsInFlight = 0;
  const ttsWaitQueue = [];

  function acquireTtsSlot() {
    if (ttsInFlight < MAX_CONCURRENT_TTS) {
      ttsInFlight++;
      return Promise.resolve();
    }
    return new Promise((resolve) => ttsWaitQueue.push(resolve));
  }

  function releaseTtsSlot() {
    const next = ttsWaitQueue.shift();
    if (next) {
      next(); // hand the slot straight to the next waiter, count unchanged
    } else {
      ttsInFlight--;
    }
  }

  // Converts a raw 16-bit signed little-endian PCM buffer (what the server
  // now sends) into a Web Audio AudioBuffer ready for gapless scheduling.
  function pcm16ToAudioBuffer(arrayBuffer, sampleRate) {
    const ctx = getAudioContext();
    const safeLength = Math.floor(arrayBuffer.byteLength / 2);
    const int16 = new Int16Array(arrayBuffer, 0, safeLength);
    const float32 = new Float32Array(safeLength);
    for (let i = 0; i < safeLength; i++) {
      float32[i] = int16[i] / 32768;
    }
    const buffer = ctx.createBuffer(1, float32.length, sampleRate);
    buffer.getChannelData(0).set(float32);
    return buffer;
  }

  async function fetchTtsBuffer(text) {
    await acquireTtsSlot();
    try {
      const ttsRes = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text })
      });
      if (!ttsRes.ok) throw new Error("tts_failed");
      const arrayBuffer = await ttsRes.arrayBuffer();
      return pcm16ToAudioBuffer(arrayBuffer, TTS_SAMPLE_RATE);
    } finally {
      releaseTtsSlot();
    }
  }

  // Points to the speaker that is currently playing audio. Only one can be
  // active at a time. stopSpeaking() cancels it so no new nodes can start.
  let _activeSpeaker = null;

  function stopSpeaking() {
    if (_activeSpeaker) {
      _activeSpeaker.cancel();
      _activeSpeaker = null;
    }
  }

  /**
   * Gapless speaker: sentences are enqueued as they become available (as
   * text, not audio) and scheduled back-to-back on the AudioContext
   * timeline with sample-accurate start times — no waiting on a previous
   * clip's 'ended' event and no per-clip codec padding, so there's no
   * audible gap between sentences no matter how many make up a reply.
   *
   * Fetches still happen concurrently/ahead of time (via acquireTtsSlot),
   * so this keeps the "start speaking before the whole reply exists"
   * latency win — it just changes *how* clips are stitched together.
   */
  function createGaplessSpeaker() {
    const ctx = getAudioContext();
    const localNodes = new Set();  // nodes owned by THIS speaker only
    let cancelled = false;
    let schedulingChain = Promise.resolve();
    let nextStartTime = null;
    let scheduledCount = 0;
    let completedCount = 0;
    let finished = false;
    let firstStarted = false;
    let settled = false;
    let resolveDone;
    let rejectDone;
    const done = new Promise((resolve, reject) => {
      resolveDone = resolve;
      rejectDone = reject;
    });

    // Cancel this speaker: stop all playing nodes AND prevent the
    // schedulingChain from starting any new ones.  Resolves `done`
    // immediately so any awaiting caller (speak / askNovaAndSpeak) unblocks.
    function cancel() {
      cancelled = true;
      for (const node of localNodes) {
        try { node.onended = null; node.stop(); node.disconnect(); } catch (_) {}
      }
      localNodes.clear();
      if (!settled) {
        settled = true;
        resolveDone(); // unblock the awaiting caller cleanly
      }
    }

    function checkCompletion() {
      if (finished && completedCount >= scheduledCount && !settled) {
        settled = true;
        // NOTE: VideoController.toRest() is intentionally NOT called here.
        // The caller (speak/askNovaAndSpeak) owns the video state transition.
        resolveDone();
      }
    }

    function enqueue(text) {
      scheduledCount++;
      const bufferPromise = fetchTtsBuffer(text);

      // Chaining ensures sentences are *scheduled* in the order they were
      // enqueued even if a later sentence's fetch happens to resolve first
      // — necessary since each one's start time depends on the previous
      // one's exact duration.
      schedulingChain = schedulingChain.then(async () => {
        // Hard-stop: if this speaker was cancelled while the buffer was
        // being fetched, drop the audio and count the slot as done so
        // checkCompletion() can still fire for non-cancelled paths.
        if (cancelled) {
          completedCount++;
          return;
        }

        let buffer;
        try {
          buffer = await bufferPromise;
        } catch (err) {
          console.error("TTS fetch failed for a sentence, skipping it:", err);
          completedCount++;
          checkCompletion();
          return;
        }

        // Check again after the async fetch — cancellation could have
        // happened while we were waiting for the TTS response.
        if (cancelled) {
          completedCount++;
          return;
        }

        const startAt =
          nextStartTime === null
            ? ctx.currentTime + 0.03
            : Math.max(nextStartTime, ctx.currentTime);

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        localNodes.add(source);
        source.onended = () => {
          localNodes.delete(source);
          completedCount++;
          checkCompletion();
        };

        nextStartTime = startAt + buffer.duration;
        source.start(startAt);

        if (!firstStarted) {
          firstStarted = true;
          VideoController.toTalking();
        }
      });

      schedulingChain = schedulingChain.catch((err) => {
        if (!settled) {
          settled = true;
          rejectDone(err);
        }
      });
    }

    function finish() {
      finished = true;
      schedulingChain = schedulingChain.then(checkCompletion);
      checkCompletion(); // handles the "already all done" / "nothing enqueued" case
    }

    return { enqueue, finish, done, cancel };
  }

  /**
   * Speaks one piece of text start-to-finish. Cancels any currently-playing
   * speaker first so there is never more than one voice at a time.
   * Resolves once playback has finished.
   */
  async function speak(text) {
    stopSpeaking(); // kill anything already playing before we start
    const speaker = createGaplessSpeaker();
    _activeSpeaker = speaker;
    speaker.enqueue(text);
    speaker.finish();
    try {
      await speaker.done;
    } finally {
      if (_activeSpeaker === speaker) _activeSpeaker = null;
      VideoController.toRest();
    }
  }

  // Split on sentence-ending punctuation (including Hindi danda । and ॥),
  // keeping the punctuation attached. Leaves any trailing partial sentence in
  // the buffer for the next chunk.
  const SENTENCE_END_RE = /[^.!?|।\n]+[.!?|।]+(\s+|$)/gu;

  function extractCompleteSentences(buffer) {
    const sentences = [];
    let lastIndex = 0;
    let match;
    SENTENCE_END_RE.lastIndex = 0;
    while ((match = SENTENCE_END_RE.exec(buffer)) !== null) {
      const sentence = match[0].trim();
      if (sentence) sentences.push(sentence);
      lastIndex = SENTENCE_END_RE.lastIndex;
    }
    const remainder = buffer.slice(lastIndex);
    return { sentences, remainder };
  }

  // For the very first chunk of a reply only: if the first sentence is
  // long, waiting for its terminal punctuation before speaking anything
  // adds real delay. This looks for an earlier natural pause (comma/semi/
  // colon) at least MIN_CHARS in, so the first bit of speech can start
  // sooner. Only used once per reply — everything after speaks in full
  // sentences as normal, so it doesn't make the whole reply sound choppy.
  const EARLY_CLAUSE_RE = /^(.{15,}?[,;:])\s/;

  function findEarlyClauseCut(buffer) {
    const match = EARLY_CLAUSE_RE.exec(buffer);
    return match ? match[1] : null;
  }

  /**
   * Streams the LLM reply and speaks it sentence-by-sentence, gaplessly:
   *  - as soon as a sentence is complete, its TTS fetch starts immediately
   *    (in parallel with the LLM still generating the rest of the reply)
   *  - every sentence is scheduled back-to-back on one audio timeline, so
   *    the whole reply plays as one continuous stream of speech
   * This cuts perceived latency to "time to first sentence" instead of
   * "time to full reply" + "time to full audio", without sacrificing
   * continuity between sentences.
   *
   * Resolves with the full reply text once everything has finished playing.
   */
  async function askNovaAndSpeak(userText) {
    pushUser(userText);

    const chatRes = await fetch("/api/chat/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history, patientContext: PatientBridge.getKnownPatient() })
    });
    if (!chatRes.ok || !chatRes.body) throw new Error("chat_failed");

    const speaker = createGaplessSpeaker();
    _activeSpeaker = speaker;  // register so stopSpeaking() can cancel it mid-stream
    let firstChunkSent = false;
    let vitalsTriggeredThisTurn = false;

    // Detect vitals flow in real time while streaming so the door opens BEFORE or AS Nova speaks,
    // rather than lagging behind until speech finishes!
    function checkAndTriggerVitalsFlow(text) {
      if (vitalsTriggeredThisTurn) return;
      const lower = text.toLowerCase();
      const hasVitalsOrSugar =
        text.includes("शुगर") || text.includes("ग्लूकोज") ||
        lower.includes("sugar") || lower.includes("glucose") ||
        text.includes("ब्लड") || lower.includes("blood") ||
        text.includes("वाइटल") || lower.includes("vital");
      const hasMachineOrTest =
        text.includes("मशीन") || text.includes("स्लॉट") ||
        text.includes("बटन") || text.includes("जांच") ||
        text.includes("दरवाज़ा") || text.includes("दरवाजा") ||
        text.includes("डिवाइस") || text.includes("स्कैन") ||
        lower.includes("device") || lower.includes("scan") ||
        text.includes("लेते हैं") || text.includes("लेंगे") ||
        text.includes("रखें") || text.includes("लगाएं") ||
        text.includes("चेक") || lower.includes("test");
      const isSugarTest =
        (hasVitalsOrSugar && hasMachineOrTest) ||
        text.includes("दरवाज़ा खुल") || text.includes("दरवाजा खुल") ||
        text.includes("दरवाज़ा") || text.includes("दरवाजा") ||
        lower.includes("door") || lower.includes("open the door") ||
        text.includes("स्लॉट में रखें") || text.includes("बटन दबाएं") ||
        lower.includes("take your vitals") || lower.includes("take vitals") || lower.includes("check vitals");

      if (isSugarTest) {
        vitalsTriggeredThisTurn = true;
        window.waitingForSugarTest = true;

        // 1. Immediately pop up the action button on screen
        const sugarBtn = document.getElementById("sugar-done-btn");
        if (sugarBtn) sugarBtn.classList.remove("hidden");

        // 2. Immediately command ESP32 servo to OPEN door (180 deg) so it opens in parallel with speech
        const backendHost = window.location.hostname || 'localhost';
        fetch(`http://${backendHost}:4000/api/v1/kiosk/door/open`, { method: "POST" })
          .then(r => r.json())
          .then(d => console.log("[NOVA] Kiosk bay door auto-opened during stream:", d))
          .catch(err => console.warn("[NOVA] Door open trigger failed:", err));

        PatientBridge.doorAction("open");

        // 3. Stop mic capture & wake word immediately so servo motor audio cannot be recorded as an utterance
        try {
          MicCapture.abort();
          if (typeof WakeWordListener !== "undefined") WakeWordListener.stop();
        } catch (_) {}
      }
    }

    function enqueueSentence(sentence) {
      checkAndTriggerVitalsFlow(fullReply);

      // Strict guard: If vitals test is in progress (waiting for patient to insert machine and press button),
      // DO NOT speak any premature report announcement!
      if (window.waitingForSugarTest || vitalsTriggeredThisTurn) {
        const isPrematureReport =
          (sentence.includes("रिपोर्ट") || sentence.toLowerCase().includes("report")) &&
          (sentence.includes("स्क्रीन") || sentence.includes("दिखाई") || sentence.includes("तैयार"));
        if (isPrematureReport) {
          console.warn("[NOVA] Blocked premature report speech during vitals test turn:", sentence);
          return;
        }
      }

      firstChunkSent = true;
      speaker.enqueue(sentence);
    }

    const reader = chatRes.body.getReader();
    const decoder = new TextDecoder();
    let sseBuffer = "";
    let sentenceBuffer = "";
    let fullReply = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      sseBuffer += decoder.decode(value, { stream: true });

      const events = sseBuffer.split("\n\n");
      sseBuffer = events.pop() ?? ""; // last (possibly incomplete) event stays buffered

      for (const evt of events) {
        const line = evt.trim();
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (payload === "[DONE]") continue;

        let parsed;
        try {
          parsed = JSON.parse(payload);
        } catch {
          continue;
        }
        if (parsed.error) throw new Error(parsed.error);

        const delta = parsed.delta || "";
        if (!delta) continue;

        fullReply += delta;
        sentenceBuffer += delta;

        // Check for vitals keywords continuously as stream tokens arrive
        checkAndTriggerVitalsFlow(fullReply);

        if (!firstChunkSent) {
          const clause = findEarlyClauseCut(sentenceBuffer);
          if (clause) {
            enqueueSentence(clause.trim());
            sentenceBuffer = sentenceBuffer.slice(clause.length).replace(/^\s+/, "");
          }
        }

        const { sentences, remainder } = extractCompleteSentences(sentenceBuffer);
        sentenceBuffer = remainder;
        for (const sentence of sentences) {
          enqueueSentence(sentence);
        }
      }
    }

    // Any leftover text that never hit a sentence-ending punctuation mark
    // (e.g. the model's reply just trails off) still needs to be spoken.
    if (sentenceBuffer.trim()) {
      enqueueSentence(sentenceBuffer.trim());
    }

    speaker.finish();
    try {
      await speaker.done;
    } finally {
      if (_activeSpeaker === speaker) _activeSpeaker = null;
      VideoController.toRest();
    }

    pushAssistant(fullReply.trim());
    const extractPromise = requestPatientDataExtraction();

    // Final fallback check if vitals was somehow not triggered during stream
    checkAndTriggerVitalsFlow(fullReply);

    // Auto-navigate to report screen ONLY when report is announced without sugar test (e.g. guardian flow)
    // NEVER auto-navigate if we are waiting for the patient to insert machine and press scan button!
    const mentionsReportReady =
      (fullReply.includes("रिपोर्ट") || fullReply.includes("report")) &&
      (fullReply.includes("स्क्रीन पर") || fullReply.includes("तैयार है") || fullReply.includes("दिखाई जा रही"));
    if (mentionsReportReady && !vitalsTriggeredThisTurn && !window.waitingForSugarTest) {
      setTimeout(async () => {
        const freshRec = await extractPromise;
        const rec = freshRec || PatientBridge.getLastRecord() || {};
        PatientBridge.goToReport(rec);
      }, 1500);
    }

    return fullReply.trim();
  }

  return {
    reset,
    getHistory,
    listenOnce,
    stopListening,
    stopSpeaking,
    askNova,
    speak,
    askNovaAndSpeak,
    resumeAudioContext,
    setLanguage,
    getLanguage
  };
})();
