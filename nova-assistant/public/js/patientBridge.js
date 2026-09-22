/**
 * PatientBridge
 *
 * The one file that defines how this widget talks to your main project.
 * Works whether you embed this page as an <iframe> or open it as a popup
 * window (window.open) — it posts to whichever one exists.
 *
 * OUTGOING messages (this widget -> your main project), all shaped as
 * { source: "nova-health-assistant", type: "...", payload: ... }:
 *
 *   type: "ready"
 *     Sent once on page load. payload: null.
 *     Use this in your main project to know the widget has loaded before
 *     you post "init" at it.
 *
 *   type: "session-started"
 *     Sent when the patient conversation actually begins (after the start
 *     tap / greeting). payload: null.
 *
 *   type: "patient-data"
 *     Sent after every assistant turn with the latest extracted record.
 *     payload: see server/lib/patientExtraction.js's EMPTY_RECORD shape,
 *     e.g. { name, age, gender, symptoms: [], vitals: {...}, notes,
 *     urgent_flag, ready_for_review }.
 *     Your side-panel form should just overwrite its fields with whatever
 *     non-null values arrive — later messages supersede earlier ones.
 *
 *   type: "urgent"
 *     Sent once, the moment urgent_flag first turns true in a
 *     "patient-data" update — so you can surface an alert immediately
 *     without waiting for the patient to finish talking.
 *     payload: the same record that triggered it.
 *
 *   type: "session-ended"
 *     Sent when the conversation goes back to sleep (silence timeout,
 *     patient said bye, or your main project sent "end-session").
 *     payload: the final patient record.
 *
 * INCOMING messages (your main project -> this widget), same envelope
 * shape, sent via `iframeEl.contentWindow.postMessage(msg, targetOrigin)`:
 *
 *   type: "init"
 *     payload: { name, age, gender } (any subset). Pre-fills what NOVA
 *     already knows so it doesn't re-ask the patient's name/age if your
 *     main project already has them on file (e.g. patient just checked in).
 *
 *   type: "end-session"
 *     Tell the widget to stop the current conversation and go back to the
 *     idle/start screen right now (e.g. health worker pressed "done" on
 *     the main project's own UI).
 *
 * SECURITY: set HOST_APP_ORIGIN in your deployment (baked in at build time
 * or injected via a <meta> tag — see getTargetOrigin() below) once you know
 * the real origin your main project is served from, instead of leaving "*".
 */
const PatientBridge = (() => {
  let knownPatient = {}; // { name, age, gender } merged in from "init"
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const stepParam = urlParams.get("step");
    if (stepParam) {
      knownPatient.current_kiosk_step = Number(stepParam);
    }
  } catch (e) {}

  let lastRecord = null; // most recent extracted patient record, if any
  let lastUrgentSent = false;
  let onInit = null;
  let onEndSession = null;
  let onPatientDataCallback = null;

  function getTargetOrigin() {
    const meta = document.querySelector('meta[name="host-app-origin"]');
    return meta && meta.content ? meta.content : "*";
  }

  function targets() {
    const t = [];
    if (window.parent && window.parent !== window) t.push(window.parent);
    if (window.opener) t.push(window.opener);
    return t;
  }

  function send(type, payload) {
    const msg = { source: "nova-health-assistant", type, payload: payload ?? null };
    const origin = getTargetOrigin();
    targets().forEach((w) => {
      try {
        w.postMessage(msg, origin);
      } catch (err) {
        console.warn("PatientBridge: postMessage failed:", err);
      }
    });
  }

  function handleIncoming(event) {
    const data = event.data;
    if (!data || data.source !== "nova-health-assistant-host") return;

    if (data.type === "init" && data.payload) {
      knownPatient = { ...knownPatient, ...data.payload };
      if (onInit) onInit(knownPatient);
    } else if (data.type === "end-session") {
      if (onEndSession) onEndSession();
    }
  }

  window.addEventListener("message", handleIncoming);

  function ready() {
    send("ready");
  }

  function sessionStarted() {
    send("session-started");
  }

  function sessionEnded(finalRecord) {
    send("session-ended", finalRecord || lastRecord || null);
    lastUrgentSent = false;
    lastRecord = null;
  }

  function patientData(record) {
    lastRecord = record;
    send("patient-data", record);
    if (record && record.urgent_flag && !lastUrgentSent) {
      lastUrgentSent = true;
      send("urgent", record);
    }
    if (onPatientDataCallback) {
      try {
        onPatientDataCallback(record);
      } catch (e) {
        console.warn("onPatientDataCallback error:", e);
      }
    }
  }

  function getKnownPatient() {
    return knownPatient;
  }

  function getLastRecord() {
    return lastRecord;
  }

  /** Registers a callback for when "init" data arrives from the host. */
  function setOnInit(fn) {
    onInit = fn;
  }

  /** Registers a callback for when the host asks to end the session. */
  function setOnEndSession(fn) {
    onEndSession = fn;
  }

  /** Registers a callback for when new patient data is extracted. */
  function setOnPatientData(fn) {
    onPatientDataCallback = fn;
  }

  function goToReport(record) {
    const payload = record || lastRecord || null;
    send("go-to-report", payload);
  }

  function doorAction(action) {
    send("door-action", { action });
  }

  return {
    ready,
    sessionStarted,
    sessionEnded,
    patientData,
    goToReport,
    doorAction,
    getKnownPatient,
    getLastRecord,
    setOnInit,
    setOnEndSession,
    setOnPatientData
  };
})();
