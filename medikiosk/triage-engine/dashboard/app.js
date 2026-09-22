/* ============================================================
   MEDIKIOSK DOCTOR COMMAND CENTER
   ============================================================ */

(() => {
  "use strict";

  /* ==========================================================
     DOM
  =========================================================== */

  const $ = (selector) => document.querySelector(selector);

  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  /* ==========================================================
     STATE
  =========================================================== */

  const state = {
    patients: [],

    selectedPatientId: null,

    filter: "all",

    search: "",

    activeTab: "overview",

    connected: false,

    finalized: {},

    drafts: {},

    carePlans: {},

    audit: {},

    demoMode: false,
  };

  /* ==========================================================
     DEMO DATA
  =========================================================== */

  const demoPatients = [
    {
      id: "demo-urgent-01",
      sessionId: "kiosk_sess_seed_02",
      patientId: "ABHA-7721-URGENT-1",

      name: "Sunita Verma",
      age: 47,
      sex: "Female",

      triage: "URGENT",

      status: "provisional",

      chiefComplaint: "Intermittent chest discomfort with left-arm discomfort.",

      symptoms: ["Chest discomfort", "Left-arm discomfort"],

      redFlags: ["Elevated blood pressure"],

      rules: [
        "Elevated blood pressure",
        "Chest discomfort requires physician review",
      ],

      vitals: {
        bp: "138/86",
        hr: "82",
        spo2: "97",
        temp: "36.8",
        glucose: "104",
      },

      subjective:
        "Patient reports intermittent chest discomfort with associated left-arm discomfort.",

      objective:
        "BP 138/86 mmHg. Heart rate 82 bpm. SpO₂ 97%. Blood glucose 104 mg/dL.",

      assessment:
        "Urgent physician review required due to reported chest discomfort and elevated blood pressure.",

      plan: "Review symptoms, repeat measurements if clinically indicated and determine treatment plan.",

      medications: [
        {
          name: "Paracetamol",
          details: "Patient reported",
        },
      ],

      investigations: [],

      instructions: "",

      followUp: "",

      referral: "",

      createdAt: new Date(Date.now() - 9 * 60 * 1000).toISOString(),

      audit: [
        {
          event: "Patient event received",
          detail: "Kiosk intake submitted",
          time: new Date(Date.now() - 9 * 60 * 1000).toISOString(),
        },
        {
          event: "Triage updated",
          detail: "URGENT — priority physician review",
          time: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
        },
        {
          event: "Red flag detected",
          detail: "Elevated blood pressure",
          time: new Date(Date.now() - 7 * 60 * 1000).toISOString(),
        },
      ],
    },

    {
      id: "demo-routine-01",
      sessionId: "kiosk_sess_seed_03",
      patientId: "ABHA-8832-ROUTINE-1",

      name: "Arun Mehta",
      age: 34,
      sex: "Male",

      triage: "ROUTINE",

      status: "provisional",

      chiefComplaint: "Mild headache for approximately two days.",

      symptoms: ["Headache"],

      redFlags: [],

      rules: [],

      vitals: {
        bp: "122/78",
        hr: "74",
        spo2: "98",
        temp: "36.6",
        glucose: "96",
      },

      subjective: "Patient reports mild intermittent headache for two days.",

      objective:
        "BP 122/78 mmHg. Heart rate 74 bpm. SpO₂ 98%. Blood glucose 96 mg/dL.",

      assessment: "Mild headache without current red-flag findings.",

      plan: "Routine physician assessment and symptomatic management as appropriate.",

      medications: [],

      investigations: [],

      instructions: "",

      followUp: "",

      referral: "",

      createdAt: new Date(Date.now() - 17 * 60 * 1000).toISOString(),

      audit: [
        {
          event: "Patient event received",
          detail: "Kiosk intake submitted",
          time: new Date(Date.now() - 17 * 60 * 1000).toISOString(),
        },
        {
          event: "Triage calculated",
          detail: "ROUTINE — standard queue",
          time: new Date(Date.now() - 16 * 60 * 1000).toISOString(),
        },
      ],
    },

    {
      id: "demo-routine-02",
      sessionId: "kiosk_sess_seed_04",
      patientId: "ABHA-9144-ROUTINE-1",

      name: "Meena Joshi",
      age: 62,
      sex: "Female",

      triage: "ROUTINE",

      status: "provisional",

      chiefComplaint: "General fatigue and reduced appetite.",

      symptoms: ["Fatigue", "Reduced appetite"],

      redFlags: [],

      rules: [],

      vitals: {
        bp: "126/80",
        hr: "78",
        spo2: "97",
        temp: "36.5",
        glucose: "108",
      },

      subjective: "Patient reports generalized fatigue and reduced appetite.",

      objective:
        "BP 126/80 mmHg. Heart rate 78 bpm. SpO₂ 97%. Blood glucose 108 mg/dL.",

      assessment: "Routine assessment required.",

      plan: "Clinical review and appropriate follow-up based on physician assessment.",

      medications: [],

      investigations: [],

      instructions: "",

      followUp: "",

      referral: "",

      createdAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),

      audit: [
        {
          event: "Patient event received",
          detail: "Kiosk intake submitted",
          time: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
        },
      ],
    },
  ];

  /* ==========================================================
     INITIALIZATION
  =========================================================== */

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    updateGreeting();

    setupNavigation();

    setupFilters();

    setupSearch();

    setupButtons();

    setupModal();

    setupKeyboardShortcuts();

    connectSocket();

    loadDashboard();

    fetchPatientQueue();
    setInterval(fetchPatientQueue, 5000);
  }

  /* ==========================================================
     GREETING
  =========================================================== */

  function updateGreeting() {
    const hour = new Date().getHours();

    let greeting = "Good morning, Doctor";

    if (hour >= 12 && hour < 17) {
      greeting = "Good afternoon, Doctor";
    }

    if (hour >= 17) {
      greeting = "Good evening, Doctor";
    }

    if (hour >= 22 || hour < 5) {
      greeting = "Good night, Doctor";
    }

    const element = $("#greeting");

    if (element) {
      element.textContent = greeting;
    }
  }

  /* ==========================================================
     NAVIGATION
  =========================================================== */

  function setupNavigation() {
    $$("[data-nav]").forEach((button) => {
      button.addEventListener("click", () => {
        const nav = button.dataset.nav;

        $$(".nav-item").forEach((item) => {
          item.classList.remove("active");
        });

        button.classList.add("active");

        if (nav === "queue") {
          state.filter = "all";

          updateFilterButtons();

          renderQueue();

          focusWorkspace();

          return;
        }

        if (nav === "emergency") {
          state.filter = "emergency";

          updateFilterButtons();

          renderQueue();

          focusWorkspace();

          return;
        }

        if (nav === "audit") {
          if (!state.selectedPatientId) {
            const first = state.patients[0];

            if (first) {
              selectPatient(first.id);
            }
          }

          state.activeTab = "audit";

          renderEncounter();

          focusWorkspace();
        }
      });
    });
  }

  /* ==========================================================
     FILTERS
  =========================================================== */

  function setupFilters() {
    $$(".filter-button").forEach((button) => {
      button.addEventListener("click", () => {
        state.filter = button.dataset.filter;

        updateFilterButtons();

        renderQueue();

        /*
         * Important:
         * If the current patient doesn't belong to
         * the selected filter, remove them from the
         * right-side encounter panel.
         */

        const selected = getSelectedPatient();

        if (selected && !patientMatchesFilter(selected)) {
          state.selectedPatientId = null;

          state.activeTab = "overview";

          renderEncounter();
        }
      });
    });
  }

  function updateFilterButtons() {
    $$(".filter-button").forEach((button) => {
      button.classList.toggle("active", button.dataset.filter === state.filter);
    });
  }

  /* ==========================================================
     SEARCH
  =========================================================== */

  function setupSearch() {
    const search = $("#global-search");

    if (!search) return;

    search.addEventListener("input", (event) => {
      state.search = event.target.value.trim().toLowerCase();

      renderQueue();
    });
  }

  /* ==========================================================
     BUTTONS
  =========================================================== */

  function setupButtons() {
    $("#refresh-btn")?.addEventListener("click", async () => {
      await loadDashboard(true);

      showToast("Encounter queue refreshed.");
    });

    $("#seed-btn")?.addEventListener("click", async () => {
      await seedDemoPatients();
    });

    $("#notification-button")?.addEventListener("click", () => {
      const emergency = state.patients.find(
        (patient) => patient.triage === "EMERGENCY",
      );

      if (!emergency) {
        showToast("No emergency encounters require attention.");

        return;
      }

      openEmergencyModal(emergency);
    });
  }

  /* ==========================================================
     KEYBOARD
  =========================================================== */

  function setupKeyboardShortcuts() {
    document.addEventListener("keydown", (event) => {
      if (
        event.key === "/" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        event.preventDefault();

        $("#global-search")?.focus();
      }
    });
  }

  /* ==========================================================
     DASHBOARD LOAD
  =========================================================== */

  async function loadDashboard(showLoading = false) {
    try {
      const response = await fetch("/api/events/sessions");

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      const sessions = extractSessions(data);

      if (sessions.length > 0) {
        state.patients = sessions.map(normalizeSession);

        state.demoMode = false;
      } else {
        /*
         * Keep the real dashboard empty if
         * the backend has no sessions.
         *
         * Demo data is loaded only when the
         * doctor presses "Load Demo Patients".
         */

        state.patients = [];
        state.demoMode = false;
      }
    } catch (error) {
      console.warn("Could not load backend sessions:", error);

      /*
       * We intentionally do NOT automatically
       * pretend demo patients are real patients.
       */

      state.patients = [];

      setConnection(false);
    }

    renderAll();

    if (showLoading) {
      showToast("Queue updated.");
    }
  }

  /* ==========================================================
     PATIENT QUEUE FETCH & RENDER (Prompt 2)
  =========================================================== */

  async function fetchPatientQueue() {
    try {
      const response = await fetch('/api/doctor/queue');
      const queue = await response.json();
      renderQueueTable(queue);
    } catch (err) {
      console.error('Error loading patient queue:', err);
    }
  }

  function renderQueueTable(queue) {
    if (!Array.isArray(queue)) return;

    if (queue.length > 0) {
      const normalizedQueue = queue.map((item) => {
        const itemTriage = item.triageLevel || item.triage || (item.redFlags?.length ? (item.redFlags.some(f => f.urgency_tier === 'critical') ? 'EMERGENCY' : 'URGENT') : 'ROUTINE');
        return normalizeSession({
          id: item.patientId || `PT-${Date.now()}`,
          sessionId: item.patientId || `sess_${Date.now()}`,
          patientId: item.patientId,
          name: item.name,
          age: item.age,
          sex: item.gender || item.sex || "—",
          triage: itemTriage,
          triageLevel: itemTriage,
          status: item.status || (itemTriage === 'EMERGENCY' ? 'critical' : 'waiting'),
          chiefComplaint: Array.isArray(item.symptoms) ? item.symptoms.join(", ") : (item.symptoms || "General intake"),
          symptoms: Array.isArray(item.symptoms) ? item.symptoms : [item.symptoms],
          vitals: item.vitals || {},
          altitudeContext: item.altitudeContext || null,
          redFlags: item.redFlags || [],
          rules: (item.redFlags || []).map(r => r.reason || r.flag_type || r),
          createdAt: item.timestamp || new Date().toISOString()
        });
      });

      const existingMap = new Map(state.patients.map((p) => [p.id, p]));
      for (const item of normalizedQueue) {
        existingMap.set(item.id, item);
      }
      state.patients = Array.from(existingMap.values());
      state.demoMode = false;
      renderAll();
    }
  }

  /* ==========================================================
     SESSION EXTRACTION
  =========================================================== */

  function extractSessions(data) {
    if (Array.isArray(data)) {
      return data;
    }

    if (Array.isArray(data?.sessions)) {
      return data.sessions;
    }

    if (Array.isArray(data?.data)) {
      return data.data;
    }

    if (Array.isArray(data?.results)) {
      return data.results;
    }

    return [];
  }

  /* ==========================================================
     NORMALIZE SESSION
  =========================================================== */

  function normalizeSession(session) {
  const triageResult =
    session?.triageResult || session?.latestTriageResult || session?.latestTriage || session?.triage || null;

  const rawTriage = typeof session?.triage === 'string'
    ? session.triage
    : session?.triageLevel ||
      triageResult?.triageLevel ||
      (session?.redFlags?.length ? (session.redFlags.some(f => f.urgency_tier === 'critical') ? 'EMERGENCY' : 'URGENT') : 'ROUTINE');

  const triage = normalizeTriage(rawTriage);

  const demographics =
    session?.patientDemographics || session?.demographics || session?.patient || {};

  const GENDER_MAP = { M: "Male", F: "Female", O: "Other" };

  const rawSex = session?.sex || session?.gender || demographics?.sex || demographics?.gender || "";

  const patientName =
    session?.patientName ||
    demographics?.fullName ||
    demographics?.name ||
    session?.name ||
    buildPatientName(demographics) ||
    "Unknown patient";

  const patientId =
    session?.abhaId ||
    session?.patientId ||
    demographics?.abhaId ||
    demographics?.abha_id ||
    demographics?.patientId ||
    "—";

  const age = session?.age ?? demographics?.age ?? "—";
  const sex = GENDER_MAP[rawSex] || rawSex || "—";

  const rawSymptoms = Array.isArray(session?.symptoms)
    ? session.symptoms
    : Array.isArray(session?.symptoms?.list)
      ? session.symptoms.list
      : [];

  const symptoms = rawSymptoms
    .map((s) => (typeof s === "string" ? s : s?.symptomName || s?.name || s?.description || ""))
    .filter(Boolean);

  const chiefComplaint =
    session?.chiefComplaint ||
    session?.intake?.chiefComplaint ||
    session?.intake?.chief_complaint ||
    (Array.isArray(session?.chiefComplaints)
      ? session.chiefComplaints[0]?.symptom ||
        session.chiefComplaints[0]?.text ||
        session.chiefComplaints[0]
      : "") ||
    session?.symptoms?.primary?.symptomName ||
    symptoms[0] ||
    "Clinical encounter";

  const sessionRedFlags = Array.isArray(session?.redFlags)
    ? session.redFlags.map((r) => (typeof r === "string" ? r : r?.reason || r?.flag_type || ""))
    : [];

  const rules = [
    ...(triageResult?.triggeredRules || session?.rules || []),
    ...sessionRedFlags
  ]
    .map((r) => (typeof r === "string" ? r.replace(/^RULE_/, "").replace(/_/g, " ") : r))
    .filter(Boolean);

  const redFlags = triage !== "ROUTINE" ? (rules.length ? rules : ["Priority clinical alert"]) : [];

  return {
    id: session?.sessionId || session?.intakeId || session?.id || session?._id,
    sessionId: session?.sessionId || session?.intakeId || session?.id || session?._id,
    patientId,
    name: patientName,
    age,
    sex,
    triage,
    status: session?.status || "PROVISIONAL",
    chiefComplaint,
    symptoms,
    redFlags,
    rules,
    vitals: normalizeVitals(session?.vitals || session?.latestVitals || {}),
    rawVitals: session?.vitals || session?.latestVitals || {},
    altitudeContext: session?.altitudeContext || session?.triageResult?.altitudeContext || null,
    environment: session?.environment || null,
    subjective: session?.subjective || session?.hpi?.narrative || session?.intake?.hpi || "",
    objective: session?.objective || "",
    assessment: session?.assessment || "",
    plan: session?.plan || "",
    medications: session?.medications || [],
    investigations: session?.investigations || [],
    instructions: session?.instructions || "",
    followUp: session?.followUp || "",
    referral: session?.referral || "",
    ayush: session?.ayushParameters || session?.ayush || {},
    discrepancyFlags: session?.discrepancyFlags || [],
    createdAt:
      session?.startTime || session?.createdAt || session?.lastUpdated ||
      session?.submitted_at || new Date().toISOString(),
    updatedAt:
      session?.lastUpdated || session?.updatedAt || session?.createdAt ||
      new Date().toISOString(),
    audit: normalizeAudit(session?.auditTrail)
  };
}

  function buildPatientName(patient) {
    if (!patient) return "";

    const first = patient.firstName || "";

    const last = patient.lastName || "";

    return `${first} ${last}`.trim();
  }

  /* ==========================================================
     TRIAGE
  =========================================================== */

  function normalizeTriage(value) {
    if (!value) {
      return "ROUTINE";
    }

    let norm = "";
    if (typeof value === "string") {
      norm = value.toUpperCase();
    } else {
      norm = (
        value.level ||
        value.triageLevel ||
        value.triage ||
        value.status ||
        "ROUTINE"
      ).toUpperCase();
    }

    if (norm === "CRITICAL") return "EMERGENCY";
    if (norm === "EMERGENCY" || norm === "URGENT" || norm === "ROUTINE") return norm;
    return "ROUTINE";
  }

  /* ==========================================================
     VITALS
  =========================================================== */

  function normalizeVitals(vitals) {
  let v = vitals || {};

  if (Array.isArray(v)) {
    const mapped = {};
    for (const item of v) {
      if (!item) continue;
      const t = String(item.type || item.vital_type || '').toLowerCase();
      const val = item.value;
      if (t === 'bp_systolic' || t === 'systolic') mapped.systolic = val;
      else if (t === 'bp_diastolic' || t === 'diastolic') mapped.diastolic = val;
      else if (t === 'blood_pressure' || t === 'bp') mapped.bp = val;
      else if (t === 'spo2') mapped.spo2 = val;
      else if (t === 'heart_rate' || t === 'pulse') mapped.hr = val;
      else if (t === 'blood_glucose' || t === 'glucose' || t === 'sugar') mapped.glucose = val;
      else if (t === 'temperature' || t === 'temp') mapped.temp = val;
      else if (t) mapped[t] = val;
    }
    v = mapped;
  }

  const byType = (type) => {
    const key = Object.keys(v).find((k) => k.toUpperCase() === type);
    return key ? v[key] : undefined;
  };

  const scalar = (reading) => {
    if (reading == null) return "";
    const value = typeof reading === "object" ? (reading.value ?? reading.vitalValue) : reading;
    return typeof value === "object" || value == null ? "" : value;
  };

  /*
   * Blood pressure arrives in multiple shapes:
   *   { value: "145/95" }                          — legacy backend
   *   { value: { systolic: 145, diastolic: 95 } }  — triage-engine
   *   { systolic: 145, diastolic: 95 }             — older kiosk contract
   *   "145/95"                                     — plain string
   */
  let bp = "";
  const bpReading = byType("BLOOD_PRESSURE") || v.bloodPressure || v.blood_pressure || v.bp;

  if (bpReading) {
    if (typeof bpReading === "string") {
      bp = bpReading.includes("undefined") ? "" : bpReading;
    } else {
      const raw = bpReading.value !== undefined ? bpReading.value : bpReading;
      if (typeof raw === "string") {
        bp = raw.includes("undefined") ? "" : raw;
      } else if (raw) {
        const sys = scalar(raw?.systolic) || scalar(raw?.systolicBP) || scalar(v.systolicBP) || scalar(v.systolic);
        const dia = scalar(raw?.diastolic) || scalar(raw?.diastolicBP) || scalar(v.diastolicBP) || scalar(v.diastolic);
        bp = formatBP(sys, dia);
      }
    }
  } else if (v.systolic !== undefined && v.diastolic !== undefined) {
    bp = formatBP(scalar(v.systolic), scalar(v.diastolic));
  }

  const hr = scalar(byType("HEART_RATE") || v.heartRate || v.heart_rate || v.hr || v.pulse);
  const spo2 = scalar(byType("SPO2") || v.spo2 || v.SpO2 || v.oxygenSaturation);
  const temp = scalar(byType("TEMPERATURE") || v.temperature || v.temp);
  const glucose = scalar(byType("BLOOD_GLUCOSE") || v.bloodGlucose || v.blood_glucose || v.bloodSugar || v.blood_sugar || v.glucose);

  return {
    bp: bp || "—",
    hr: hr !== "" ? hr : "—",
    spo2: spo2 !== "" ? spo2 : "—",
    temp: temp !== "" ? temp : "—",
    glucose: glucose !== "" ? glucose : "—"
  };
}

  function formatBP(systolic, diastolic) {
    if (systolic == null || diastolic == null || String(systolic).includes("undefined") || String(diastolic).includes("undefined")) {
      return "";
    }

    return `${systolic}/${diastolic}`;
  }

  /* ==========================================================
     SYMPTOMS
  =========================================================== */

  function normalizeSymptoms(symptoms) {
    if (!Array.isArray(symptoms)) {
      return [];
    }

    return symptoms
      .map((symptom) => {
        if (typeof symptom === "string") {
          return symptom;
        }

        return (
          symptom?.symptomName || symptom?.name || symptom?.description || ""
        );
      })
      .filter(Boolean);
  }

  /* ==========================================================
     RENDER ALL
  =========================================================== */

  function renderAll() {
    updateStats();

    updateSidebarCounts();

    renderQueue();

    renderEncounter();
  }

  /* ==========================================================
     STATS
  =========================================================== */

  function updateStats() {
    const total = state.patients.length;

    const emergency = state.patients.filter(
      (p) => p.triage === "EMERGENCY",
    ).length;

    const urgent = state.patients.filter((p) => p.triage === "URGENT").length;

    const routine = state.patients.filter((p) => p.triage === "ROUTINE").length;

    $("#stat-total").textContent = total;

    $("#stat-emergency").textContent = emergency;

    $("#stat-urgent").textContent = urgent;

    $("#stat-routine").textContent = routine;
  }

  /* ==========================================================
     SIDEBAR COUNTS
  =========================================================== */

  function updateSidebarCounts() {
    $("#nav-queue-count").textContent = state.patients.length;

    const emergency = state.patients.filter(
      (p) => p.triage === "EMERGENCY",
    ).length;

    $("#nav-emergency-count").textContent = emergency;

    $("#notification-dot").classList.toggle("hidden", emergency === 0);
  }

  /* ==========================================================
     QUEUE FILTER
  =========================================================== */

  function getVisiblePatients() {
    return state.patients.filter((patient) => {
      if (
        state.filter !== "all" &&
        patient.triage.toLowerCase() !== state.filter
      ) {
        return false;
      }

      if (!state.search) {
        return true;
      }

      const haystack = [
        patient.name,
        patient.patientId,
        patient.sessionId,
        patient.chiefComplaint,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(state.search);
    });
  }

  function patientMatchesFilter(patient) {
    if (state.filter === "all") {
      return true;
    }

    return patient.triage.toLowerCase() === state.filter;
  }

  /* ==========================================================
     QUEUE RENDER
  =========================================================== */

  function renderQueue() {
    const queue = $("#queue");

    if (!queue) return;

    const patients = getVisiblePatients();

    updateQueueHeader(patients.length);

    if (patients.length === 0) {
      const emergency = state.filter === "emergency";

      const title = emergency
        ? "No emergency encounters"
        : state.filter === "urgent"
          ? "No urgent encounters"
          : state.filter === "routine"
            ? "No routine encounters"
            : state.search
              ? "No matching encounters"
              : "No encounters yet";

      const description = emergency
        ? "There are currently no patients requiring immediate attention."
        : state.search
          ? "Try another patient name, ABHA ID or encounter reference."
          : "New kiosk encounters will appear here automatically.";

      queue.innerHTML = `

        <div class="queue-empty ${emergency ? "emergency" : ""}">

          <div class="queue-empty-inner">

            <div class="queue-empty-icon">
              ${emergency ? "✓" : "○"}
            </div>

            <h3>
              ${escapeHtml(title)}
            </h3>

            <p>
              ${escapeHtml(description)}
            </p>

            ${
              emergency
                ? `
                  <button
                    class="button secondary"
                    id="empty-view-all"
                    type="button"
                  >
                    View all encounters
                  </button>
                `
                : ""
            }

          </div>

        </div>
      `;

      $("#empty-view-all")?.addEventListener("click", () => {
        state.filter = "all";

        updateFilterButtons();

        renderQueue();

        const first = state.patients[0];

        if (first) {
          selectPatient(first.id);
        }
      });

      return;
    }

    queue.innerHTML = patients
      .map((patient) => renderQueueItem(patient))
      .join("");

    $$(".queue-item").forEach((button) => {
      button.addEventListener("click", () => {
        selectPatient(button.dataset.patientId);
      });
    });
  }

  function updateQueueHeader(count) {
    const title = $("#queue-title");

    const subtitle = $("#queue-subtitle");

    const titles = {
      all: "Encounter Queue",

      emergency: "Emergency Queue",

      urgent: "Priority Queue",

      routine: "Routine Queue",
    };

    title.textContent = titles[state.filter] || "Encounter Queue";

    if (state.filter === "emergency") {
      subtitle.textContent = `${count} requiring immediate attention`;
    } else if (state.filter === "urgent") {
      subtitle.textContent = `${count} priority review`;
    } else if (state.filter === "routine") {
      subtitle.textContent = `${count} standard queue`;
    } else {
      subtitle.textContent = `${count} patients`;
    }
  }

  function renderQueueItem(patient) {
    const selected = patient.id === state.selectedPatientId;

    const triageClass = patient.triage.toLowerCase();

    return `

      <button
        class="queue-item ${selected ? "selected" : ""}"
        data-patient-id="${escapeAttribute(patient.id)}"
        type="button"
      >

        <div class="queue-item-main">

          <div>

            <div class="patient-name">
              ${escapeHtml(patient.name)}
            </div>

            <div class="patient-id">
              ${escapeHtml(patient.patientId)}
            </div>

          </div>

          <span class="queue-status ${triageClass}">
            ${escapeHtml(patient.triage)}
          </span>

        </div>

        <div class="queue-item-meta">

          <span>
            ${escapeHtml(patient.sex)}
            ${patient.age !== "—" ? ` · ${escapeHtml(patient.age)}y` : ""}
          </span>

          <span>•</span>

          <span class="queue-time">
            ${formatRelativeTime(patient.createdAt)}
          </span>

        </div>

      </button>

    `;
  }

  /* ==========================================================
     SELECT PATIENT
  =========================================================== */

  async function selectPatient(id) {
    const patient = state.patients.find(
      (item) => String(item.id) === String(id),
    );

    if (!patient) return;

    state.selectedPatientId = patient.id;

    state.activeTab = "overview";

    /*
     * Load additional clinical data.
     * If unavailable, the current queue data
     * remains usable.
     */

    await enrichPatient(patient);

    renderQueue();

    renderEncounter();
  }

  /* ==========================================================
     ENRICH PATIENT
  =========================================================== */

  async function enrichPatient(patient) {
    if (!patient?.sessionId) {
      return;
    }

    try {
      const [sessionResponse, auditResponse] = await Promise.allSettled([
        fetch(`/api/events/session/${encodeURIComponent(patient.sessionId)}`),

        fetch(
          `/api/events/session/${encodeURIComponent(patient.sessionId)}/audit`,
        ),
      ]);

      /*
       * Session endpoint
       */

      if (sessionResponse.status === "fulfilled" && sessionResponse.value.ok) {
        const data = await sessionResponse.value.json();

        mergeSessionData(patient, data);
      }

      /*
       * Audit endpoint
       */

      if (auditResponse.status === "fulfilled" && auditResponse.value.ok) {
        const data = await auditResponse.value.json();

        patient.audit = normalizeAudit(data);
      }
    } catch (error) {
      console.warn("Could not enrich patient:", error);
    }
  }

  function mergeSessionData(patient, data) {
  const session = data?.session || data?.data?.session || data;
  const full = data?.data || {};

  if (!session || typeof session !== "object") return;

  const fresh = normalizeSession(session);

  /* The single-session endpoint also returns the full record — enrich from it */
  const demo = full.patientDemographics || {};
  if (demo.fullName) fresh.name = demo.fullName;
  if (demo.age != null) fresh.age = demo.age;
  if (demo.gender) {
    fresh.sex = { M: "Male", F: "Female", O: "Other" }[demo.gender] || demo.gender;
  }
  if (full.hpi?.narrative) fresh.subjective = full.hpi.narrative;
  if (full.ayushParameters && Object.keys(full.ayushParameters).length) {
    fresh.ayush = full.ayushParameters;
  }
  if (Array.isArray(full.discrepancyFlags)) {
    fresh.discrepancyFlags = full.discrepancyFlags
      .map((d) => d?.message || d?.flagId)
      .filter(Boolean);
  }
  if (full.environment || session.environment) {
    fresh.environment = full.environment || session.environment;
  }
  if (full.preConsultationSummary?.section1_vitals) {
    fresh.vitalsDetail = full.preConsultationSummary.section1_vitals;
  }

  ["name", "patientId", "age", "sex", "triage", "status", "chiefComplaint", "symptoms",
   "redFlags", "rules", "vitals", "rawVitals", "environment", "vitalsDetail", "subjective", "ayush", "discrepancyFlags",
   "createdAt", "updatedAt"].forEach((key) => {
    const value = fresh[key];
    const empty =
      value == null ||
      value === "" ||
      (Array.isArray(value) && value.length === 0) ||
      (typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0);

    if (key === "vitals" && patient.vitals && typeof value === "object") {
      const freshHasReal = Object.values(value || {}).some((v) => v && v !== "—");
      if (!freshHasReal) return;
      patient.vitals = { ...patient.vitals, ...value };
      return;
    }

    if (!empty) patient[key] = value;
  });
}

  function mergeTriageData(patient, data) {
    const triage = data?.triage || data?.latestTriage || data;

    if (!triage) return;

    patient.triage = normalizeTriage(triage);

    patient.redFlags = triage.redFlags || patient.redFlags || [];

    patient.rules = triage.rules || patient.rules || [];
  }

  function normalizeAudit(data) {
  const events =
    data?.auditTrail || data?.events || data?.audit || (Array.isArray(data) ? data : null);

  if (!Array.isArray(events)) return [];

  return events.map((event) => ({
    event: event.eventType || event.type || event.event || event.action || "Clinical event",
    detail:
      event.reason ||
      event.description ||
      event.detail ||
      (Array.isArray(event.triggeredRules) && event.triggeredRules.length
        ? `Rules: ${event.triggeredRules.join(", ")}`
        : ""),
    time: event.timestamp || event.createdAt || new Date().toISOString()
  }));
}

  /* ==========================================================
     ENCOUNTER RENDER
  =========================================================== */

  function renderEncounter() {
    const panel = $("#patient-panel");

    if (!panel) return;

    const patient = getSelectedPatient();

    if (!patient) {
      renderEncounterEmpty();

      return;
    }

    const finalized = !!state.finalized[patient.id];

    panel.innerHTML = `

      <header class="encounter-header">

        <div class="encounter-heading">

          <div>

            <div class="encounter-eyebrow">
              CURRENT ENCOUNTER
            </div>

            <h2 class="encounter-name">
              ${escapeHtml(patient.name)}
            </h2>

            <div class="encounter-subline">
              ${escapeHtml(patient.sessionId || "—")}
              · ABHA:
              ${escapeHtml(patient.patientId || "—")}
            </div>

          </div>

          <div class="encounter-statuses">

            <span
              class="status-badge ${patient.triage.toLowerCase()}"
            >
              ${escapeHtml(patient.triage)}
            </span>

            <span
              class="status-badge ${finalized ? "verified" : "provisional"}"
            >
              ${finalized ? "VERIFIED" : "PROVISIONAL"}
            </span>

          </div>

        </div>


        ${renderVitals(patient)}


        <nav class="encounter-tabs">

          ${renderTab("overview", "Overview")}

          ${renderTab("soap", "SOAP")}

          ${renderTab("careplan", "Care Plan")}

          ${renderTab("signoff", "Sign-off")}

          ${renderTab("audit", "Export & Audit")}

        </nav>

      </header>


      <div class="encounter-content">

        ${renderTabContent(patient)}

      </div>

    `;

    setupEncounterTabs();

    setupEncounterActions();

    $("#override-altitude-btn")?.addEventListener("click", async () => {
      const currentAlt = patient.environment?.altitudeMeters ?? 2438;
      const input = prompt(`Enter patient elevation in meters (currently ${currentAlt} m):`, String(currentAlt));
      if (input === null) return;
      const meters = parseInt(input, 10);
      if (isNaN(meters) || meters < 0 || meters > 9000) {
        alert("Please enter a valid altitude between 0 and 9,000 meters.");
        return;
      }
      const reason = prompt("Enter clinical reason for altitude override:", "Physician assessment of patient acclimatization status");
      try {
        const res = await fetch(`/api/v1/clinical/patient/${encodeURIComponent(patient.sessionId || patient.id)}/override-altitude`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            altitudeMeters: meters,
            overrideReason: reason || "Physician override",
            doctorNotes: "Overridden in Doctor Command Center"
          })
        });
        if (res.ok) {
          showToast(`Altitude updated to ${meters} m. Audit log recorded.`);
          await enrichPatient(patient);
          renderAll();
        } else {
          showToast("Failed to update altitude on server.", "error");
        }
      } catch (err) {
        showToast(`Override error: ${err.message}`, "error");
      }
    });
  }

  function renderEncounterEmpty() {
    const emergency = state.filter === "emergency";

    $("#patient-panel").innerHTML = `

      <div class="encounter-empty">

        <div class="encounter-empty-inner">

          <div class="encounter-empty-icon">
            ${emergency ? "✓" : "○"}
          </div>

          <h2>
            ${emergency ? "No emergency encounter" : "No encounter selected"}
          </h2>

          <p>
            ${
              emergency
                ? "There are currently no emergency patients requiring immediate attention. When an emergency encounter arrives, it will appear here automatically."
                : "Select a patient from the encounter queue to begin clinical review."
            }
          </p>

          ${
            emergency
              ? `
                <button
                  class="button secondary"
                  id="encounter-view-all"
                  type="button"
                >
                  View all encounters
                </button>
              `
              : ""
          }

        </div>

      </div>
    `;

    $("#encounter-view-all")?.addEventListener("click", () => {
      state.filter = "all";

      updateFilterButtons();

      renderQueue();

      const first = state.patients[0];

      if (first) {
        selectPatient(first.id);
      }
    });
  }

  /* ==========================================================
     VITALS & ALTITUDE DECISION-SUPPORT CARDS
  =========================================================== */

  function renderAltitudeContextBanner(patient) {
    const ac = patient.altitudeContext;
    if (!ac || ac.altitudeContext === 'NONE' || ac.altitudeContext === 'UNAVAILABLE') {
      return '';
    }

    const isSignificant = ac.altitudeContext === 'SIGNIFICANT';
    const patterns = Array.isArray(ac.patternsDetected) ? ac.patternsDetected.join(', ') : '';
    const reasons = Array.isArray(ac.reasons) ? ac.reasons.map(r => `<li>${escapeHtml(r)}</li>`).join('') : '';

    return `
      <div style="margin-top: 14px; margin-bottom: 16px; padding: 14px 18px; border-radius: 8px; background: ${isSignificant ? '#fef2f2' : '#f0f9ff'}; border: 1px solid ${isSignificant ? '#fecaca' : '#bae6fd'}; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 16px;">🏔️</span>
            <strong style="font-size: 14px; color: ${isSignificant ? '#991b1b' : '#0369a1'};">
              Altitude Clinical Context (${ac.exposure?.facilityAltitudeM ?? 'High'} m) — ${escapeHtml(ac.altitudeContext)}
            </strong>
          </div>
          ${patterns ? `<span style="font-size: 11px; padding: 3px 10px; border-radius: 12px; background: ${isSignificant ? '#fee2e2' : '#e0f2fe'}; color: ${isSignificant ? '#991b1b' : '#0284c7'}; font-weight: 700;">${escapeHtml(patterns)}</span>` : ''}
        </div>
        <p style="font-size: 12.5px; color: #1e293b; font-weight: 500; margin: 0 0 8px 0; line-height: 1.4;">${escapeHtml(ac.clinicalAdvisory || '')}</p>
        ${reasons ? `<ul style="font-size: 11.5px; color: #475569; margin: 0 0 8px 0; padding-left: 20px; line-height: 1.5;">${reasons}</ul>` : ''}
        <div style="font-size: 11px; color: #64748b; border-top: 1px dashed ${isSignificant ? '#fca5a5' : '#cbd5e1'}; padding-top: 6px; margin-top: 6px;">
          ⚠️ <em>CDC/WMS Invariant:</em> Altitude provides clinical context; measured vitals & symptoms govern triage severity. Altitude never excuses severe hypoxemia or respiratory distress.
        </div>
      </div>
    `;
  }

  function renderVitals(patient) {
    const vitals = patient.vitals || {};

    return `
      <div class="vitals-strip" style="margin-bottom: 14px;">
        ${renderVital("BP", vitals.bp, "mmHg")}
        ${renderVital("Heart rate", vitals.hr, "bpm")}
        ${renderVital("SpO₂", vitals.spo2, "%")}
        ${renderVital("Temperature", vitals.temp, "°C")}
        ${renderVital("Glucose", vitals.glucose, "mg/dL")}
      </div>
      ${renderAltitudeContextBanner(patient)}
    `;
  }

  function renderVital(label, value, unit) {
    return `
      <div class="vital-cell">
        <span class="vital-label">
          ${label}
        </span>
        <span class="vital-value">
          ${escapeHtml(String(value ?? "—"))}
          ${value !== "—" ? `<span class="vital-unit">${unit}</span>` : ""}
        </span>
      </div>
    `;
  }

  /* ==========================================================
     TABS
  =========================================================== */

  function renderTab(id, label) {
    return `

      <button
        class="encounter-tab ${state.activeTab === id ? "active" : ""}"
        data-tab="${id}"
        type="button"
      >
        ${label}
      </button>

    `;
  }

  function setupEncounterTabs() {
    $$(".encounter-tab").forEach((button) => {
      button.addEventListener("click", () => {
        state.activeTab = button.dataset.tab;

        renderEncounter();
      });
    });
  }

  /* ==========================================================
     TAB CONTENT
  =========================================================== */

  function renderTabContent(patient) {
    switch (state.activeTab) {
      case "soap":
        return renderSOAP(patient);

      case "careplan":
        return renderCarePlan(patient);

      case "signoff":
        return renderSignOff(patient);

      case "audit":
        return renderAudit(patient);

      case "overview":
      default:
        return renderOverview(patient);
    }
  }

  /* ==========================================================
     OVERVIEW
  =========================================================== */

  function renderOverview(patient) {
    const triageClass = patient.triage.toLowerCase();

    const symptoms = patient.symptoms?.length
      ? patient.symptoms
      : ["No symptoms recorded"];

    const redFlags = patient.redFlags?.length
      ? patient.redFlags
      : ["No active red flags"];

    const rules = patient.rules?.length
      ? patient.rules
      : ["No additional rules triggered"];

    return `

      <section class="content-section">

        <div class="section-heading">
          <h3>Clinical snapshot</h3>
          <span>
            Kiosk-derived information
          </span>
        </div>


        <div class="overview-grid">

          <div class="info-card">

            <div class="info-card-title">
              Chief complaint
            </div>

            <h4>
              ${escapeHtml(patient.chiefComplaint)}
            </h4>

            <p>
              Review the kiosk history before making
              treatment decisions.
            </p>

          </div>


          <div class="triage-box ${triageClass}">

            <div class="info-card-title">
              Triage decision
            </div>

            <div class="triage-level">
              ${escapeHtml(patient.triage)}
            </div>

            <div class="triage-action">

              ${
                patient.triage === "EMERGENCY"
                  ? "Immediate physician attention"
                  : patient.triage === "URGENT"
                    ? "Priority physician review"
                    : "Standard clinical queue"
              }

            </div>

          </div>

        </div>

      </section>


      <section class="content-section">

        <div class="section-heading">
          <h3>Reported symptoms</h3>
        </div>

        <div class="chip-list">

          ${symptoms
            .map(
              (item) => `
                <span class="clinical-chip">
                  ${escapeHtml(item)}
                </span>
              `,
            )
            .join("")}

        </div>

      </section>


      <section class="content-section">

        <div class="section-heading">
          <h3>Red flags</h3>
          <span>
            Rule engine output
          </span>
        </div>

        <div class="chip-list">

          ${redFlags
            .map(
              (item) => `
                <span class="clinical-chip ${
                  item === "No active red flags" ? "" : "danger"
                }">
                  ${escapeHtml(item)}
                </span>
              `,
            )
            .join("")}

        </div>

      </section>


      <section class="content-section">

        <div class="section-heading">
          <h3>Triggered rules</h3>
        </div>

        <div class="chip-list">

          ${rules
            .map(
              (item) => `
                <span class="clinical-chip ${
                  item === "No additional rules triggered" ? "" : "warning"
                }">
                  ${escapeHtml(item)}
                </span>
              `,
            )
            .join("")}

        </div>

      </section>


      <section class="content-section">

        <div class="section-heading">
          <h3>Doctor action</h3>
        </div>

        <div class="info-card">

          <div class="info-card-title">
            Next step
          </div>

          <h4>
            ${
              patient.triage === "EMERGENCY"
                ? "Review emergency findings immediately"
                : patient.triage === "URGENT"
                  ? "Complete physician assessment"
                  : "Perform routine clinical assessment"
            }
          </h4>

          <p>
            Use the SOAP and Care Plan tabs to
            document your clinical decision and
            treatment plan.
          </p>

        </div>

      </section>

    `;
  }

  /* ==========================================================
     SOAP
  =========================================================== */

  function getDraft(patient) {
    if (!state.drafts[patient.id]) {
      state.drafts[patient.id] = {
        subjective: patient.subjective || "",

        objective: patient.objective || "",

        assessment: patient.assessment || "",

        plan: patient.plan || "",
      };
    }

    return state.drafts[patient.id];
  }

  function renderSOAP(patient) {
    const draft = getDraft(patient);

    const locked = !!state.finalized[patient.id];

    return `

      ${
        locked
          ? `
            <div class="locked-banner">
              <strong>✓ Clinical summary finalized</strong>
              Editing is disabled after physician sign-off.
            </div>
          `
          : ""
      }


      <section class="content-section">

        <div class="section-heading">

          <h3>
            Physician SOAP note
          </h3>

          <span>
            ${locked ? "LOCKED" : "DRAFT"}
          </span>

        </div>


        <div class="editor-layout">

          ${renderEditorField(
            "Subjective",
            "Patient-reported symptoms, history and relevant statements.",
            "subjective",
            draft.subjective,
            locked,
          )}

          ${renderEditorField(
            "Objective",
            "Vitals, examination findings and available measurements.",
            "objective",
            draft.objective,
            locked,
          )}

          ${renderEditorField(
            "Assessment",
            "Physician assessment / clinical impression.",
            "assessment",
            draft.assessment,
            locked,
          )}

          ${renderEditorField(
            "Plan",
            "Clinical management plan.",
            "plan",
            draft.plan,
            locked,
          )}

        </div>


        ${
          locked
            ? ""
            : `
              <div class="editor-footer">

                <button
                  class="button secondary"
                  data-action="discard-soap"
                  type="button"
                >
                  Discard Changes
                </button>

                <button
                  class="button primary"
                  data-action="save-soap"
                  type="button"
                >
                  Save SOAP Draft
                </button>

              </div>
            `
        }

      </section>

    `;
  }

  function renderEditorField(title, description, field, value, locked) {
    return `

      <div class="editor-card">

        <div class="editor-card-header">

          <strong>
            ${title}
          </strong>

          <span class="editor-badge">
            ${locked ? "Verified" : "Physician editable"}
          </span>

        </div>

        <div
          style="
            padding: 8px 12px 0;
            color: #959dac;
            font-size: 8px;
          "
        >
          ${description}
        </div>

        <textarea
          data-soap-field="${field}"
          ${locked ? "disabled" : ""}
          placeholder="Enter physician documentation..."
        >${escapeHtml(value)}</textarea>

      </div>

    `;
  }

  /* ==========================================================
     CARE PLAN
  =========================================================== */

  function getCarePlan(patient) {
    if (!state.carePlans[patient.id]) {
      state.carePlans[patient.id] = {
        treatment: patient.plan || "",

        medications: patient.medications ? [...patient.medications] : [],

        investigations: patient.investigations
          ? [...patient.investigations]
          : [],

        instructions: patient.instructions || "",

        followUp: patient.followUp || "",

        referral: patient.referral || "",
      };
    }

    return state.carePlans[patient.id];
  }

  function renderCarePlan(patient) {
    const plan = getCarePlan(patient);

    const locked = !!state.finalized[patient.id];

    return `

      ${
        locked
          ? `
            <div class="locked-banner">
              <strong>✓ Treatment plan finalized</strong>
              This encounter is locked after physician sign-off.
            </div>
          `
          : ""
      }


      <section class="content-section">

        <div class="section-heading">

          <h3>
            Physician care plan
          </h3>

          <span>
            ${locked ? "LOCKED" : "EDITABLE"}
          </span>

        </div>


        <div class="care-grid">


          <!-- TREATMENT -->

          <div class="care-card full">

            <h3>
              Treatment / Management
            </h3>

            <p>
              Document the physician-directed treatment
              or management decision.
            </p>

            <textarea
              class="form-textarea"
              data-care-field="treatment"
              ${locked ? "disabled" : ""}
              placeholder="Enter treatment and management plan..."
            >${escapeHtml(plan.treatment)}</textarea>

          </div>


          <!-- MEDICATIONS -->

          <div class="care-card">

            <h3>
              Medications
            </h3>

            <p>
              Add or modify medications prescribed
              during this encounter.
            </p>

            <div class="medication-list">

              ${
                plan.medications.length
                  ? plan.medications
                      .map(
                        (med, index) => `
                          <div class="medication-row">

                            <div>

                              <div class="medication-name">
                                ${escapeHtml(med.name)}
                              </div>

                              <div class="medication-meta">
                                ${escapeHtml(med.details || "")}
                              </div>

                            </div>

                            ${
                              locked
                                ? ""
                                : `
                                  <button
                                    class="remove-medication"
                                    data-remove-med="${index}"
                                    type="button"
                                    aria-label="Remove medication"
                                  >
                                    ×
                                  </button>
                                `
                            }

                          </div>
                        `,
                      )
                      .join("")
                  : `
                    <div
                      style="
                        color:#99a1af;
                        font-size:9px;
                        padding:8px 0;
                      "
                    >
                      No medications added.
                    </div>
                  `
              }

            </div>


            ${
              locked
                ? ""
                : `
                  <div class="add-row">

                    <input
                      class="form-input"
                      id="new-medication"
                      placeholder="Medication name"
                    />

                    <button
                      class="button secondary"
                      data-action="add-medication"
                      type="button"
                    >
                      + Add
                    </button>

                  </div>
                `
            }

          </div>


          <!-- INVESTIGATIONS -->

          <div class="care-card">

            <h3>
              Investigations
            </h3>

            <p>
              Select or add investigations required
              by the physician.
            </p>

            <div class="checkbox-list">

              ${[
                "Repeat blood pressure",
                "ECG",
                "Blood glucose",
                "CBC",
                "Electrolytes",
              ]
                .map((item) => {
                  const checked = plan.investigations.includes(item);

                  return `

                      <label class="checkbox-row">

                        <input
                          type="checkbox"
                          data-investigation="${escapeAttribute(item)}"
                          ${checked ? "checked" : ""}
                          ${locked ? "disabled" : ""}
                        />

                        ${escapeHtml(item)}

                      </label>

                    `;
                })
                .join("")}

            </div>

          </div>


          <!-- PATIENT INSTRUCTIONS -->

          <div class="care-card full">

            <h3>
              Patient Instructions
            </h3>

            <p>
              Record instructions communicated to the patient.
            </p>

            <textarea
              class="form-textarea"
              data-care-field="instructions"
              ${locked ? "disabled" : ""}
              placeholder="Enter patient instructions..."
            >${escapeHtml(plan.instructions)}</textarea>

          </div>


          <!-- FOLLOW UP -->

          <div class="care-card">

            <h3>
              Follow-up
            </h3>

            <p>
              Define the expected follow-up.
            </p>

            <select
              class="form-select"
              data-care-field="followUp"
              ${locked ? "disabled" : ""}
            >

              <option value="">
                No follow-up specified
              </option>

              <option
                value="48 hours"
                ${plan.followUp === "48 hours" ? "selected" : ""}
              >
                Within 48 hours
              </option>

              <option
                value="7 days"
                ${plan.followUp === "7 days" ? "selected" : ""}
              >
                7 days
              </option>

              <option
                value="14 days"
                ${plan.followUp === "14 days" ? "selected" : ""}
              >
                14 days
              </option>

              <option
                value="30 days"
                ${plan.followUp === "30 days" ? "selected" : ""}
              >
                30 days
              </option>

            </select>

          </div>


          <!-- REFERRAL -->

          <div class="care-card">

            <h3>
              Referral
            </h3>

            <p>
              Add specialist or department referral.
            </p>

            <input
              class="form-input"
              data-care-field="referral"
              ${locked ? "disabled" : ""}
              value="${escapeAttribute(plan.referral)}"
              placeholder="Department / specialist"
            />

          </div>

        </div>


        ${
          locked
            ? ""
            : `
              <div class="editor-footer">

                <button
                  class="button secondary"
                  data-action="reset-careplan"
                  type="button"
                >
                  Reset
                </button>

                <button
                  class="button primary"
                  data-action="save-careplan"
                  type="button"
                >
                  Save Care Plan
                </button>

              </div>
            `
        }

      </section>

    `;
  }

  /* ==========================================================
     SIGN OFF
  =========================================================== */

  function renderSignOff(patient) {
    const finalized = !!state.finalized[patient.id];

    return `

      <section class="content-section">

        <div class="section-heading">

          <h3>
            Physician sign-off
          </h3>

          <span>
            Clinical summary lifecycle
          </span>

        </div>


        <div class="signoff-card">

          <div class="signoff-status">

            <div class="signoff-icon">
              ${finalized ? "✓" : "✎"}
            </div>

            <div>

              <h3>
                ${
                  finalized
                    ? "Encounter finalized"
                    : "Ready for physician sign-off"
                }
              </h3>

              <p>
                ${
                  finalized
                    ? "This clinical record is locked and can no longer be edited."
                    : "Review the Overview, SOAP and Care Plan before signing."
                }
              </p>

            </div>

          </div>


          ${
            finalized
              ? `
                <div
                  style="
                    margin-top:15px;
                    padding:11px;
                    border-radius:7px;
                    background:#f2faf6;
                    color:#287858;
                    font-size:9px;
                  "
                >
                  ✓ Signed by Dr. Rajesh Sharma
                  <br />
                  <span style="opacity:.7">
                    HPR verification recorded
                  </span>
                </div>
              `
              : `
                <div class="hpr-input">

                  <label class="form-label">
                    HPR ID
                  </label>

                  <input
                    class="form-input"
                    id="hpr-id"
                    placeholder="Enter physician HPR ID"
                  />

                </div>


                <div class="editor-footer">

                  <button
                    class="button secondary"
                    data-action="review-before-sign"
                    type="button"
                  >
                    Review Care Plan
                  </button>

                  <button
                    class="button primary"
                    data-action="finalize"
                    type="button"
                  >
                    Sign & Finalize
                  </button>

                </div>
              `
          }

        </div>

      </section>


      ${
        finalized
          ? `
            <section class="content-section">

              <div class="section-heading">
                <h3>
                  Post-signature state
                </h3>
              </div>

              <div class="info-card">

                <div class="info-card-title">
                  LOCKED
                </div>

                <h4>
                  Clinical edits are disabled
                </h4>

                <p>
                  Further system actions should create
                  a new auditable amendment rather than
                  silently modifying the finalized record.
                </p>

              </div>

            </section>
          `
          : ""
      }

    `;
  }

  /* ==========================================================
     AUDIT + EXPORT
  =========================================================== */

  function renderAudit(patient) {
    const audit = patient.audit?.length
      ? patient.audit
      : [
          {
            event: "No audit events available",
            detail: "Audit stream is empty.",
            time: new Date().toISOString(),
          },
        ];

    return `

      <section class="content-section">

        <div class="section-heading">

          <h3>
            Export clinical record
          </h3>

          <span>
            FHIR R4
          </span>

        </div>


        <div class="export-options">

          <label class="export-option">

            <input
              type="checkbox"
              id="export-vitals"
            />

            <div>

              <strong>
                Vitals only
              </strong>

              <span>
                BP, SpO₂, heart rate and glucose observations.
              </span>

            </div>

          </label>


          <label class="export-option">

            <input
              type="checkbox"
              id="export-history"
              checked
            />

            <div>

              <strong>
                Include diagnostic history
              </strong>

              <span>
                Relevant history and clinical information.
              </span>

            </div>

          </label>


          <label class="export-option">

            <input
              type="checkbox"
              id="export-ayush"
              checked
            />

            <div>

              <strong>
                Include AYUSH / clinical notes
              </strong>

              <span>
                Available assessment information.
              </span>

            </div>

          </label>

        </div>


        <div class="editor-footer">

          <button
            class="button primary"
            data-action="export"
            type="button"
          >
            Export FHIR R4 Bundle
          </button>

        </div>

      </section>


      <section class="content-section">

        <div class="section-heading">

          <h3>
            Audit Trail
          </h3>

          <span>
            Append-only history
          </span>

        </div>


        <div class="audit-list">

          ${audit
            .map(
              (item) => `

                <div class="audit-item">

                  <strong>
                    ${escapeHtml(item.event)}
                  </strong>

                  <span>
                    ${escapeHtml(item.detail || "")}
                  </span>

                  <time>
                    ${formatDateTime(item.time)}
                  </time>

                </div>

              `,
            )
            .join("")}

        </div>

      </section>

    `;
  }

  /* ==========================================================
     ENCOUNTER ACTIONS
  =========================================================== */

  function setupEncounterActions() {
    const patient = getSelectedPatient();

    if (!patient) return;

    /*
     * SOAP fields
     */

    $$("[data-soap-field]").forEach((textarea) => {
      textarea.addEventListener("input", () => {
        const draft = getDraft(patient);

        draft[textarea.dataset.soapField] = textarea.value;
      });
    });

    /*
     * Care plan fields
     */

    $$("[data-care-field]").forEach((element) => {
      element.addEventListener("input", () => {
        const plan = getCarePlan(patient);

        plan[element.dataset.careField] = element.value;
      });

      element.addEventListener("change", () => {
        const plan = getCarePlan(patient);

        plan[element.dataset.careField] = element.value;
      });
    });

    /*
     * Investigations
     */

    $$("[data-investigation]").forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        const plan = getCarePlan(patient);

        const name = checkbox.dataset.investigation;

        if (checkbox.checked) {
          if (!plan.investigations.includes(name)) {
            plan.investigations.push(name);
          }
        } else {
          plan.investigations = plan.investigations.filter(
            (item) => item !== name,
          );
        }
      });
    });

    /*
     * Action buttons
     */

    $$("[data-action]").forEach((button) => {
      button.addEventListener("click", () => {
        handleAction(button.dataset.action);
      });
    });

    /*
     * Remove medication
     */

    $$("[data-remove-med]").forEach((button) => {
      button.addEventListener("click", () => {
        const plan = getCarePlan(patient);

        const index = Number(button.dataset.removeMed);

        plan.medications.splice(index, 1);

        renderEncounter();
      });
    });
  }

  /* ==========================================================
     ACTION HANDLER
  =========================================================== */

  function handleAction(action) {
    const patient = getSelectedPatient();

    if (!patient) return;

    switch (action) {
      case "save-soap":
        saveSOAP(patient);
        break;

      case "discard-soap":
        delete state.drafts[patient.id];

        renderEncounter();

        showToast("SOAP draft discarded.");

        break;

      case "add-medication":
        addMedication(patient);
        break;

      case "save-careplan":
        saveCarePlan(patient);
        break;

      case "reset-careplan":
        delete state.carePlans[patient.id];

        renderEncounter();

        showToast("Care plan reset.");

        break;

      case "review-before-sign":
        state.activeTab = "careplan";

        renderEncounter();

        break;

      case "finalize":
        finalizeEncounter(patient);
        break;

      case "export":
        exportFHIR(patient);
        break;
    }
  }

  /* ==========================================================
     SAVE SOAP
  =========================================================== */

  function saveSOAP(patient) {
    const draft = getDraft(patient);

    patient.subjective = draft.subjective;

    patient.objective = draft.objective;

    patient.assessment = draft.assessment;

    patient.plan = draft.plan;

    addLocalAudit(
      patient,
      "Clinical summary draft saved",
      "Physician SOAP documentation updated.",
    );

    showToast("SOAP draft saved.");

    renderEncounter();
  }

  /* ==========================================================
     ADD MEDICATION
  =========================================================== */

  function addMedication(patient) {
    const input = $("#new-medication");

    if (!input) return;

    const name = input.value.trim();

    if (!name) {
      showToast("Enter a medication name first.");

      input.focus();

      return;
    }

    const plan = getCarePlan(patient);

    plan.medications.push({
      name,

      details: "Physician added",
    });

    renderEncounter();

    showToast("Medication added to draft care plan.");
  }

  /* ==========================================================
     SAVE CARE PLAN
  =========================================================== */

  function saveCarePlan(patient) {
    const plan = getCarePlan(patient);

    patient.plan = plan.treatment;

    patient.medications = [...plan.medications];

    patient.investigations = [...plan.investigations];

    patient.instructions = plan.instructions;

    patient.followUp = plan.followUp;

    patient.referral = plan.referral;

    addLocalAudit(
      patient,
      "Care plan draft saved",
      "Physician treatment plan updated.",
    );

    showToast("Care plan draft saved.");

    renderEncounter();
  }

  /* ==========================================================
     FINALIZE
  =========================================================== */

  function finalizeEncounter(patient) {
    const hprInput = $("#hpr-id");

    const hpr = hprInput?.value.trim();

    if (!hpr) {
      showToast("Enter the physician HPR ID before signing.");

      hprInput?.focus();

      return;
    }

    /*
     * IMPORTANT:
     *
     * This frontend state lock mirrors the lifecycle
     * already used by your project.
     *
     * Connect this action to your existing clinical
     * summary finalize endpoint when wiring the exact
     * backend route.
     */

    state.finalized[patient.id] = true;

    addLocalAudit(
      patient,
      "Clinical summary finalized",
      `Signed by Dr. Rajesh Sharma · HPR ${hpr}`,
    );

    state.activeTab = "signoff";

    renderEncounter();

    showToast("Clinical summary finalized and locked.");
  }

  /* ==========================================================
     LOCAL AUDIT
  =========================================================== */

  function addLocalAudit(patient, event, detail) {
    if (!patient.audit) {
      patient.audit = [];
    }

    patient.audit.unshift({
      event,

      detail,

      time: new Date().toISOString(),
    });
  }

  /* ==========================================================
     FHIR EXPORT
  =========================================================== */

  function exportFHIR(patient) {
    const finalized = !!state.finalized[patient.id];

    if (!finalized) {
      showToast("Finalize the clinical summary before export.");

      return;
    }

    /*
     * The project already has a FHIR bundle
     * implementation in the backend.
     *
     * Do not claim this browser-generated action
     * is an ABDM/HIS transmission.
     *
     * For now we provide a clear UI response.
     */

    addLocalAudit(
      patient,
      "FHIR export requested",
      "FHIR R4 clinical record export prepared.",
    );

    showToast("FHIR R4 export requested for this encounter.");

    renderEncounter();
  }

  /* ==========================================================
     DEMO SEED
  =========================================================== */

  async function seedDemoPatients() {
    try {
      const response = await fetch("/api/events/demo/seed", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      showToast("Demo encounters loaded from backend.");

      await loadDashboard();

      /*
       * If backend seeding does not return
       * sessions immediately, don't silently
       * fake them. The demo data button can
       * still be used in standalone UI mode.
       */

      if (state.patients.length === 0) {
        loadLocalDemoData();
      }
    } catch (error) {
      console.warn("Demo seed endpoint unavailable:", error);

      loadLocalDemoData();

      showToast("Demo patients loaded for UI preview.");
    }
  }

  function loadLocalDemoData() {
    state.patients = demoPatients.map((patient) => structuredClone(patient));

    state.demoMode = true;

    renderAll();
  }

  /* ==========================================================
     EMERGENCY MODAL
  =========================================================== */

  function setupModal() {
    $("#modal-close")?.addEventListener("click", closeEmergencyModal);

    $("#alert-modal")?.addEventListener("click", (event) => {
      if (event.target === $("#alert-modal")) {
        closeEmergencyModal();
      }
    });

    $("#modal-review")?.addEventListener("click", () => {
      const id = $("#alert-modal").dataset.patientId;

      closeEmergencyModal();

      if (id) {
        state.filter = "emergency";

        updateFilterButtons();

        selectPatient(id);
      }
    });
  }

  function openEmergencyModal(patient) {
    const modal = $("#alert-modal");

    modal.dataset.patientId = patient.id;

    $("#modal-title").textContent = patient.name;

    $("#modal-reason").textContent =
      patient.chiefComplaint ||
      "Emergency triage requires immediate physician attention.";

    $("#modal-rules").innerHTML = (
      patient.redFlags?.length ? patient.redFlags : patient.rules || []
    )
      .map(
        (rule) => `
            <span class="modal-rule">
              ${escapeHtml(rule)}
            </span>
          `,
      )
      .join("");

    $("#modal-meta").textContent =
      `${patient.patientId} · ${patient.sessionId}`;

    modal.classList.remove("hidden");
  }

  function closeEmergencyModal() {
    $("#alert-modal")?.classList.add("hidden");
  }

  /* ==========================================================
     SOCKET.IO
  =========================================================== */

  function connectSocket() {
    if (typeof io !== "function") {
      setConnection(false);

      return;
    }

    const socket = io();

    socket.on("connect", () => {
      setConnection(true);

      socket.emit("JOIN_DASHBOARD");
    });

    socket.on("disconnect", () => {
      setConnection(false);
    });

    socket.on("connect_error", () => {
      setConnection(false);
    });

    /*
     * A triage update means the queue may
     * need refreshing.
     */
    socket.on("patient:new", async () => {
      await fetchPatientQueue();
      showToast("New patient queued.");
    });

    socket.on("kiosk:intake_submitted", async () => {
      await fetchPatientQueue();
      await loadDashboard();

      showToast("New kiosk encounter received.");
    });

    socket.on("PATIENT_EVENT_RECEIVED", async () => {
      await loadDashboard();
    });
    socket.on("TRIAGE_UPDATED", async () => {
      await loadDashboard();
    });

    /*
     * Emergency escalation.
     */

    socket.on("ESCALATION_REQUIRED", async (payload) => {
      await loadDashboard();

      const sessionId = payload?.sessionId || payload?.session?.sessionId;

      const patient = state.patients.find(
        (item) => item.sessionId === sessionId,
      );

      if (patient) {
        openEmergencyModal(patient);
      } else {
        showToast("New emergency escalation received.");
      }
    });

    socket.on("RULE_TRIGGERED", async () => {
      await loadDashboard();
    });

    socket.on("RED_FLAG_DETECTED", async () => {
      await loadDashboard();
    });
  }

  /* ==========================================================
     CONNECTION STATUS
  =========================================================== */

  function setConnection(connected) {
    state.connected = connected;

    const dot = $("#connection-dot");

    const label = $("#connection-label");

    dot.classList.remove("connected", "error");

    if (connected) {
      dot.classList.add("connected");

      label.textContent = "Live connection";
    } else {
      dot.classList.add("error");

      label.textContent = "Offline / reconnecting";
    }
  }

  /* ==========================================================
     SELECTED PATIENT
  =========================================================== */

  function getSelectedPatient() {
    if (!state.selectedPatientId) {
      return null;
    }

    return (
      state.patients.find(
        (patient) => String(patient.id) === String(state.selectedPatientId),
      ) || null
    );
  }

  /* ==========================================================
     FOCUS
  =========================================================== */

  function focusWorkspace() {
    const workspace = $(".workspace");

    if (!workspace) return;

    const top = workspace.getBoundingClientRect().top + window.scrollY - 75;

    window.scrollTo({
      top,

      behavior: "smooth",
    });
  }

  /* ==========================================================
     TIME
  =========================================================== */

  function formatRelativeTime(iso) {
    if (!iso) return "—";

    const time = new Date(iso).getTime();

    if (Number.isNaN(time)) {
      return "—";
    }

    const diff = Math.max(0, Date.now() - time);

    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) {
      return "just now";
    }

    if (minutes < 60) {
      return `${minutes}m ago`;
    }

    const hours = Math.floor(minutes / 60);

    if (hours < 24) {
      return `${hours}h ago`;
    }

    return `${Math.floor(hours / 24)}d ago`;
  }

  function formatDateTime(iso) {
    if (!iso) return "—";

    const date = new Date(iso);

    if (Number.isNaN(date.getTime())) {
      return "—";
    }

    return date.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  /* ==========================================================
     TOAST
  =========================================================== */

  let toastTimer;

  function showToast(message) {
    const toast = $("#toast");

    toast.textContent = message;

    toast.classList.remove("hidden");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
      toast.classList.add("hidden");
    }, 2600);
  }

  /* ==========================================================
     HTML ESCAPING
  =========================================================== */

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value);
  }
})();
