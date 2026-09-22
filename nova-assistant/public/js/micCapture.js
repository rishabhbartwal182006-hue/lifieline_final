/**
 * MicCapture
 *
 * Replaces the browser's built-in SpeechRecognition entirely. Why: that
 * API is powered by Chromium's *cloud* speech service, which is gated
 * behind a private Google API key baked into official Google Chrome
 * builds. Community/distro Chromium builds — notably Raspberry Pi OS's
 * default Chromium — are typically compiled without that key, so
 * SpeechRecognition silently fails (or throws a "network" error) there,
 * even though it works fine on a PC running real Chrome/Edge. This
 * module works identically everywhere because it's just raw mic capture
 * (universally supported) + our own backend + our own Groq API key.
 *
 * Two things are combined here on purpose:
 *  1. A completely free, local, no-network "is anyone talking near the
 *     mic right now" volume detector (Web Audio AnalyserNode).
 *  2. Actual transcription only happens via /api/stt (Groq Whisper) once
 *     the local detector confirms real speech happened — never on a
 *     fixed timer. This matters because Groq's Whisper free tier is
 *     rate-limited (20 req/min, 2,000 req/day) — polling on a clock
 *     would exhaust the *daily* quota in a couple of hours. Gating on
 *     actual local speech detection keeps API usage proportional to how
 *     often people actually talk near the kiosk, not a fixed clock.
 */
const MicCapture = (() => {
  let sharedStream = null;
  let analyser = null;
  let sourceNode = null;
  let currentOpId = 0; // bumped on abort() to invalidate any in-flight operation

  function isStreamActive(stream) {
    if (!stream) return false;
    const tracks = stream.getAudioTracks ? stream.getAudioTracks() : [];
    return tracks.length > 0 && tracks.some((t) => t.readyState === "live" && t.enabled);
  }

  function reset() {
    if (sharedStream) {
      try {
        sharedStream.getTracks().forEach((t) => t.stop());
      } catch (_) {}
      sharedStream = null;
    }
    if (sourceNode) {
      try {
        sourceNode.disconnect();
      } catch (_) {}
      sourceNode = null;
    }
    analyser = null;
  }

  if (typeof navigator !== "undefined" && navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
    navigator.mediaDevices.addEventListener("devicechange", () => {
      console.log("[MicCapture] Audio devicechange detected (plug/unplug), resetting stream cache");
      reset();
    });
  }

  async function getStream() {
    if (sharedStream && !isStreamActive(sharedStream)) {
      console.warn("[MicCapture] Cached stream is inactive or ended, refreshing...");
      reset();
    }

    if (!sharedStream) {
      if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== "function") {
        throw new Error("Microphone API unavailable over insecure HTTP context.");
      }
      sharedStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // Bind ended event so unplugging mic resets cache immediately
      const tracks = sharedStream.getAudioTracks ? sharedStream.getAudioTracks() : [];
      tracks.forEach((track) => {
        track.addEventListener("ended", () => {
          console.warn("[MicCapture] Audio track ended unexpectedly, clearing stream");
          reset();
        });
      });
    }
    return sharedStream;
  }

  async function ensureAnalyser() {
    await SharedAudio.resumeAudioContext();
    if (analyser && isStreamActive(sharedStream)) return analyser;
    reset();
    const stream = await getStream();
    // Uses the SAME AudioContext as conversation.js's TTS playback (via
    // SharedAudio) — see sharedAudioContext.js for why this must not be a
    // separate context of its own.
    const audioCtx = SharedAudio.getAudioContext();
    sourceNode = audioCtx.createMediaStreamSource(stream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    sourceNode.connect(analyser);
    return analyser;
  }

  function currentRms(data) {
    let sumSquares = 0;
    for (let i = 0; i < data.length; i++) {
      const norm = (data[i] - 128) / 128;
      sumSquares += norm * norm;
    }
    return Math.sqrt(sumSquares / data.length);
  }

  function pickMimeType() {
    const candidates = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
      "audio/mp4"
    ];
    for (const type of candidates) {
      if (window.MediaRecorder && MediaRecorder.isTypeSupported(type)) return type;
    }
    return "";
  }

  /**
   * Waits for real speech to start, then records the utterance until it trails
   * into silence (or hits maxDurationMs), and resolves with a Blob.
   *
   * - maxWaitMs: how long to wait for speech to start before giving up.
   * - maxDurationMs: hard cap on how long a single utterance can run.
   * - silenceMs: continuous quiet after speech has started before utterance ends.
   * - speechThreshold: RMS level (0-1) above which we consider it speech.
   */
  async function captureUtterance({
    maxWaitMs = Infinity,
    maxDurationMs = 8000,
    silenceMs = 1000,
    speechThreshold = 0.012
  } = {}) {
    const opId = ++currentOpId;
    await SharedAudio.resumeAudioContext();
    const stream = await getStream();
    const node = await ensureAnalyser();
    const data = new Uint8Array(node.fftSize);

    // --- Phase 1: wait for speech to start (volume detection) ---
    const waitStartedAt = performance.now();
    await new Promise((resolve, reject) => {
      function tick() {
        if (opId !== currentOpId) return reject(new Error("aborted"));
        node.getByteTimeDomainData(data);
        const rms = currentRms(data);
        if (rms > speechThreshold) {
          return resolve();
        }
        if (performance.now() - waitStartedAt > maxWaitMs) {
          return reject(new Error("timeout"));
        }
        requestAnimationFrame(tick);
      }
      tick();
    });

    // --- Phase 2: speech detected, start recorder with pristine container header ---
    const mimeType = pickMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const speechChunks = [];

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        speechChunks.push(e.data);
      }
    };

    const stopped = new Promise((resolve) => {
      recorder.onstop = resolve;
    });

    recorder.start(100);

    const recordStartedAt = performance.now();
    let silenceStartedAt = null;

    await new Promise((resolve, reject) => {
      function tick() {
        if (opId !== currentOpId) {
          if (recorder.state !== "inactive") recorder.stop();
          return reject(new Error("aborted"));
        }
        node.getByteTimeDomainData(data);
        const rms = currentRms(data);
        const speaking = rms > speechThreshold;

        if (speaking) {
          silenceStartedAt = null;
        } else {
          if (silenceStartedAt === null) silenceStartedAt = performance.now();
          if (performance.now() - silenceStartedAt > silenceMs) {
            if (recorder.state !== "inactive") recorder.stop();
            return resolve();
          }
        }

        if (performance.now() - recordStartedAt > maxDurationMs) {
          if (recorder.state !== "inactive") recorder.stop();
          return resolve();
        }
        requestAnimationFrame(tick);
      }
      tick();
    });

    await stopped;

    if (opId !== currentOpId) throw new Error("aborted");
    if (speechChunks.length === 0) throw new Error("no-audio-captured");
    return new Blob(speechChunks, { type: mimeType || "audio/webm" });
  }

  /** Cancels whatever captureUtterance() call is currently in flight. */
  function abort() {
    currentOpId++;
  }

  /**
   * Returns { transcript, noSpeechProb }. noSpeechProb (0-1) is Whisper's
   * own estimate of whether the clip contained real speech at all — use
   * it to discard hallucinated text from near-silent/noise clips instead
   * of trusting every transcript blindly.
   */
  async function transcribe(blob) {
    const formData = new FormData();
    formData.append("audio", blob, "clip.webm");
    const res = await fetch("/api/stt", { method: "POST", body: formData });
    if (!res.ok) throw new Error("stt_failed");
    const { transcript, noSpeechProb } = await res.json();
    return { transcript: (transcript || "").trim(), noSpeechProb: noSpeechProb ?? 0 };
  }

  return { getStream, captureUtterance, abort, transcribe, reset };
})();
