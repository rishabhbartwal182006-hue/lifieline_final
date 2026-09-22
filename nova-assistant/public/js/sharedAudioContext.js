/**
 * SharedAudio
 *
 * A single AudioContext shared by conversation.js (TTS playback) and
 * micCapture.js (mic volume detection for wake-word + listening).
 *
 * Why this needs to be shared, not one-per-module: browsers create every
 * AudioContext in a "suspended" state until a real user gesture resumes
 * it. app.js's start-overlay tap resumes THIS ONE context. If each module
 * created its own AudioContext independently, only whichever one got
 * explicitly resumed would actually process audio — the other would sit
 * permanently suspended, silently producing no data (which is exactly
 * what happened when micCapture.js briefly had its own separate context:
 * its AnalyserNode always read silence, so the wake-word volume detector
 * never triggered at all, even though TTS playback worked fine).
 */
const SharedAudio = (() => {
  let audioContext = null;

  function getAudioContext() {
    if (!audioContext) {
      const AC = window.AudioContext || window.webkitAudioContext;
      audioContext = new AC();
    }
    return audioContext;
  }

  function resumeAudioContext() {
    const ctx = getAudioContext();
    if (ctx.state === "suspended") {
      return ctx.resume();
    }
    return Promise.resolve();
  }

  return { getAudioContext, resumeAudioContext };
})();
