/**
 * WakeWordListener
 *
 * Listens for "Hey Nova" (and a few variants). Rebuilt on top of
 * MicCapture instead of the browser's built-in SpeechRecognition — see
 * micCapture.js for why (SpeechRecognition doesn't work at all in
 * Chromium builds without Google's private API key, notably Raspberry
 * Pi OS's default Chromium).
 *
 * Important trade-off, honestly stated: this is still not a true local/
 * offline wake-word engine — it still sends a short audio clip to our
 * backend (then Groq Whisper) whenever someone speaks near the mic, to
 * check whether it was the wake phrase. What's different from before is
 * WHEN that happens: only when the local volume detector hears actual
 * speech, never on a fixed timer — so during silence (most of a kiosk's
 * runtime) there's zero network/API cost at all. If you need a fully
 * offline wake-word engine later (no audio ever leaves the device until
 * genuinely woken), the natural upgrade is Picovoice Porcupine's WASM
 * build with a custom "Hey Nova" keyword file — that's an external
 * account + trained model file, so it's a separate step, not something
 * swapped in here automatically.
 */
const WakeWordListener = (() => {
  let onWakeCallback = null;
  let enabled = false;
  let loopPromise = null;

  const WAKE_PHRASES = [
    "hey nova",
    "hi nova",
    "hii nova",
    "hey, nova",
    "hi, nova",
    "wake up nova",
    "wakeup nova",
    "nova wake up",
    // Whisper commonly mishears "Nova" as "Noah" in short clips —
    // confirmed from real console logs during testing.
    "hey noah",
    "hi noah",
    "hey, noah",
    "hi, noah",
    "wake up noah"
  ];

  // Above this, Whisper's own estimate says the clip probably wasn't
  // real speech at all — discard it rather than checking the (likely
  // hallucinated) text against the wake phrases.
  const NO_SPEECH_PROB_THRESHOLD = 0.75;

  function matchesWake(transcript) {
    const t = transcript.toLowerCase().trim();
    return WAKE_PHRASES.some((phrase) => t.includes(phrase));
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function loop() {
    while (enabled) {
      try {
        // Waits (for free, no network) until someone actually speaks
        // nearby, then records that one utterance.
        const blob = await MicCapture.captureUtterance({
          maxWaitMs: Infinity,
          maxDurationMs: 4000,
          silenceMs: 1000,
          speechThreshold: 0.012
        });

        if (!enabled) break; // stopped while we were mid-capture

        const { transcript, noSpeechProb } = await MicCapture.transcribe(blob);
        // Logged unconditionally (not just on error) so it's actually
        // possible to see what Whisper heard for a real "Hey Nova"
        // attempt, instead of guessing blind — check the browser
        // console while testing.
        console.log('WakeWordListener heard: "%s" (noSpeechProb=%s)', transcript, noSpeechProb.toFixed(2));

        if (noSpeechProb > NO_SPEECH_PROB_THRESHOLD) {
          // Whisper itself thinks this probably wasn't real speech —
          // likely hallucinated text from background noise. Discard it.
          continue;
        }

        if (transcript && matchesWake(transcript)) {
          if (onWakeCallback) onWakeCallback();
          break; // app.js calls stop() right away from the wake callback anyway
        }
        // Not the wake phrase — loop straight back to (free) listening
        // for the next burst of speech, no delay needed.
      } catch (err) {
        if (err.message === "aborted") break; // stop() was called
        console.warn("WakeWordListener: capture/transcribe failed, retrying:", err);
        await sleep(500); // brief backoff so a persistent error doesn't spin-loop
      }
    }
  }

  let activeWakeRecognizer = null;
  let restartTimer = null;

  function spawnGoogleWakeRecognizer(onWake) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition || !enabled) return false;

    if (activeWakeRecognizer) {
      try { activeWakeRecognizer.abort(); } catch (_) {}
      activeWakeRecognizer = null;
    }

    try {
      const recognizer = new SpeechRecognition();
      activeWakeRecognizer = recognizer;
      recognizer.lang = "en-IN"; // English/Hinglish handles "Hey Nova" with lowest latency
      recognizer.continuous = true;
      recognizer.interimResults = true;

      recognizer.onresult = (event) => {
        if (!enabled) return;
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const phrase = event.results[i][0].transcript.toLowerCase().trim();
          console.log('[Google WakeWord] Heard: "%s"', phrase);
          if (matchesWake(phrase)) {
            stop();
            if (onWake) onWake();
            return;
          }
        }
      };

      recognizer.onerror = (e) => {
        if (!enabled) return;
        if (e.error === "aborted" || e.error === "not-allowed" || e.error === "service-not-allowed") {
          // Permission denied or explicit stop — don't restart
          console.warn("[Google WakeWord] Permanent error:", e.error);
          return;
        }
        // no-speech, network, audio-capture → restart quietly with fresh instance
        console.log("[Google WakeWord] Recoverable error:", e.error, "— restarting fresh instance");
      };

      recognizer.onend = () => {
        if (enabled && activeWakeRecognizer === recognizer) {
          activeWakeRecognizer = null;
          clearTimeout(restartTimer);
          restartTimer = setTimeout(() => {
            if (enabled) {
              spawnGoogleWakeRecognizer(onWake);
            }
          }, 200);
        }
      };

      recognizer.start();
      console.log("[Google WakeWord] Active and listening for 'Hey Nova'...");
      return true;
    } catch (e) {
      console.warn("[Google WakeWord] Could not start, falling back to MicCapture:", e);
      activeWakeRecognizer = null;
      return false;
    }
  }

  if (typeof navigator !== "undefined" && navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
    navigator.mediaDevices.addEventListener("devicechange", () => {
      if (enabled) {
        console.log("[WakeWord] Device changed while listening for wake word — re-spawning recognizer");
        clearTimeout(restartTimer);
        restartTimer = setTimeout(() => {
          if (enabled) {
            spawnGoogleWakeRecognizer(onWakeCallback);
          }
        }, 500);
      }
    });
  }

  function start(onWake) {
    if (enabled) return; // already running
    onWakeCallback = onWake;
    enabled = true;

    // 1. Prioritize Google Free SpeechRecognition on tablets/Chrome
    const started = spawnGoogleWakeRecognizer(onWake);
    if (!started) {
      // 2. Fallback to MicCapture (Groq Whisper)
      loopPromise = loop();
    }
  }

  function stop() {
    enabled = false;
    clearTimeout(restartTimer);
    restartTimer = null;
    if (activeWakeRecognizer) {
      try {
        activeWakeRecognizer.abort();
      } catch (_) {}
      activeWakeRecognizer = null;
    }
    MicCapture.abort();
  }

  return { start, stop };
})();
