import { useState, useMemo, useEffect } from "react";
import "./App.css";
import VitalScanner from "./VitalScanner";

const languages = ["English", "हिन्दी", "தமிழ்", "తెలుగు", "বাংলা"];

const symptoms = [
  { id: "Cold / Runny nose", label: "Cold / Runny nose" },
  { id: "Chest discomfort", label: "Chest discomfort" },
  { id: "Breathing difficulty", label: "Breathing difficulty" },
  { id: "Fever", label: "Fever" },
  { id: "Headache", label: "Headache" },
  { id: "Cough", label: "Cough" },
  { id: "Stomach pain", label: "Stomach pain" },
  { id: "Nausea", label: "Nausea" },
  { id: "Other", label: "Other" },
];

const hpiOptions = {
  site: ["Center of chest", "Left side", "Right side", "Other"],
  onset: ["Today", "Yesterday", "Few days ago", "More than a week ago"],
  character: ["Pressure", "Heavy", "Burning", "Sharp", "Other"],
  radiation: ["Left arm", "Right arm", "Back", "Jaw", "None"],
  associated: ["Sweating", "Breathing difficulty", "Nausea", "Dizziness", "None"],
};

function App() {
  const scannerSessionId = useMemo(
    () => `kiosk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    []
  );
  const [step, setStep] = useState(1);
  const [language, setLanguage] = useState("English");
  const [mode, setMode] = useState("Tap");
  const [listening, setListening] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submissionData, setSubmissionData] = useState(null);
  const [documentName, setDocumentName] = useState("");
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState("");
  const [ocrResult, setOcrResult] = useState(null);
  const [altitudeMode, setAltitudeMode] = useState("facility_config");
  const [altitudeMeters, setAltitudeMeters] = useState("");
  const [staffPin, setStaffPin] = useState("");
  const [usualSleepingAltitudeM, setUsualSleepingAltitudeM] = useState("200");
  const [arrivalHours, setArrivalHours] = useState("12");
  const [isResident, setIsResident] = useState(false);
  const [showNovaModal, setShowNovaModal] = useState(false);
  const [reviewEditMode, setReviewEditMode] = useState(false);
  const [ambientEnv, setAmbientEnv] = useState(null);

  // Fetch facility altitude config from backend
  useEffect(() => {
    const backendHost = window.location.hostname || 'localhost';
    const configUrl = (window.location.port === '5173')
      ? `http://${backendHost}:4000/api/v1/facility/config`
      : '/api/v1/facility/config';
    fetch(configUrl)
      .then(res => res.json())
      .then(data => {
        if (data && data.facilityAltitudeM !== null && data.facilityAltitudeM !== undefined) {
          setAltitudeMeters(String(data.facilityAltitudeM));
        } else {
          setAltitudeMeters("");
        }
      })
      .catch(() => {
        setAltitudeMeters("");
      });
  }, []);

  // Poll DHT11 Ambient Climate from ESP32 Node 2 via backend
  useEffect(() => {
    const backendHost = window.location.hostname || 'localhost';
    const envUrl = (window.location.port === '5173')
      ? `http://${backendHost}:4000/api/v1/patient/PT-HOME-01/environment`
      : '/api/v1/patient/PT-HOME-01/environment';

    const fetchEnv = () => {
      fetch(envUrl)
        .then(res => res.json())
        .then(data => {
          if (data && data.online === true && data.temperature_c !== null && data.temperature_c !== undefined) {
            setAmbientEnv(data);
          } else {
            setAmbientEnv(null);
          }
        })
        .catch(() => {
          setAmbientEnv(null);
        });
    };

    fetchEnv();
    const interval = setInterval(fetchEnv, 6000);
    return () => clearInterval(interval);
  }, []);

  const [patient, setPatient] = useState({
    name: "",
    age: "",
    gender: "",
  });

  const [symptomList, setSymptomList] = useState([]);
  const [hpi, setHpi] = useState({
    site: "",
    onset: "",
    character: "",
    radiation: "",
    associated: "",
    severity: "",
  });

  const [vitals, setVitals] = useState({
    bp: "",
    spo2: "",
    heartRate: "",
    bloodSugar: "",
  });

  // ── Listen to live data stream from NOVA Assistant via postMessage ──
  useEffect(() => {
    const handleNovaMessage = (event) => {
      const data = event.data;
      if (!data || data.source !== "nova-health-assistant") return;

      // Auto-fill all demographics, symptoms, and vitals whenever a payload is sent
      const record = data.payload;
      if (record) {
        if (record.name) {
          setPatient((prev) => ({ ...prev, name: record.name }));
        }
        if (record.age) {
          setPatient((prev) => ({ ...prev, age: String(record.age) }));
        }
        if (record.gender) {
          setPatient((prev) => ({ ...prev, gender: record.gender }));
        }

        // Auto-fill symptoms
        if (Array.isArray(record.symptoms) && record.symptoms.length > 0) {
          const matched = [];
          record.symptoms.forEach((sym) => {
            const lower = String(sym).toLowerCase();
            if (lower.includes("cold") || lower.includes("जुकाम") || lower.includes("सर्दी") || lower.includes("runny nose")) matched.push("Cold / Runny nose");
            if (lower.includes("chest")) matched.push("Chest discomfort");
            if (lower.includes("breath") || lower.includes("सांस")) matched.push("Breathing difficulty");
            if (lower.includes("fever") || lower.includes("बुखार") || lower.includes("ताप")) matched.push("Fever");
            if (lower.includes("headache") || lower.includes("सिर")) matched.push("Headache");
            if (lower.includes("cough") || lower.includes("खांसी")) matched.push("Cough");
            if (lower.includes("stomach") || lower.includes("पेट")) matched.push("Stomach pain");
            if (lower.includes("nausea") || lower.includes("उल्टी")) matched.push("Nausea");
            if (lower.includes("weak") || lower.includes("कमजोर") || lower.includes("थकान")) matched.push("Fatigue / Weakness");
            if (lower.includes("dizz") || lower.includes("चक्कर")) matched.push("Dizziness");
          });
          if (matched.length > 0) {
            setSymptomList((prev) => [...new Set([...prev, ...matched])]);
          } else {
            setSymptomList((prev) => [...new Set([...prev, ...record.symptoms])]);
          }
        }

        // Auto-fill vitals (e.g. glucose, BP, SpO2, Heart Rate)
        if (record.vitals) {
          const v = record.vitals;
          const sugar = v.blood_glucose_mg_dl ?? v.blood_glucose ?? v.bloodSugar;
          const spo2Val = v.spo2_percent ?? v.spo2;
          const hrVal = v.pulse_bpm ?? v.heart_rate ?? v.heartRate;
          let bpVal = v.bp ?? v.blood_pressure;
          if (!bpVal && v.systolic_bp && v.diastolic_bp) {
            bpVal = `${v.systolic_bp}/${v.diastolic_bp}`;
          }

          setVitals((prev) => ({
            ...prev,
            bloodSugar: sugar ? String(sugar) : prev.bloodSugar,
            bp: bpVal || prev.bp,
            spo2: spo2Val ? String(spo2Val) : prev.spo2,
            heartRate: hrVal ? String(hrVal) : prev.heartRate,
          }));
        }
      }

      // ── door-action: control kiosk bay door from Nova assistant ──
      if (data.type === "door-action") {
        const action = data.payload?.action;
        if (action === "open" || action === "close") {
          const backendHost = window.location.hostname || 'localhost';
          const doorUrl = (window.location.port === '5173')
            ? `http://${backendHost}:4000/api/v1/kiosk/door/${action}`
            : `/api/v1/kiosk/door/${action}`;
          fetch(doorUrl, { method: "POST" }).catch(() => {});
        }
      }

      // ── go-to-report: navigate to report screen ──
      if (data.type === "go-to-report") {
        setShowNovaModal(false);
        setStep(8);
        return;
      }
    };

    window.addEventListener("message", handleNovaMessage);
    return () => window.removeEventListener("message", handleNovaMessage);
  }, []);

  // ── Auto-close bay door immediately on page load or refresh ──
  useEffect(() => {
    const backendHost = window.location.hostname || 'localhost';
    const closeUrl = (window.location.port === '5173')
      ? `http://${backendHost}:4000/api/v1/kiosk/door/close`
      : '/api/v1/kiosk/door/close';
    console.log("[Door] Page loaded/refreshed — auto-closing bay door to 6 deg default");
    fetch(closeUrl, { method: "POST" }).catch(() => {});
  }, []);

  // ── Form Flow: Auto-open door when entering Step 7 (Taking vitals) ──
  useEffect(() => {
    if (step === 7) {
      const backendHost = window.location.hostname || 'localhost';
      const openUrl = (window.location.port === '5173')
        ? `http://${backendHost}:4000/api/v1/kiosk/door/open`
        : '/api/v1/kiosk/door/open';
      fetch(openUrl, { method: "POST" })
        .then(r => r.json())
        .then(res => console.log("[Door] Bay door auto-opened on Step 7 entry:", res))
        .catch(err => console.warn("[Door] Auto-open failed:", err));
    }
  }, [step]);

  // ── Auto-close door 5s after summary of report (Step 8) is shown ──
  useEffect(() => {
    if (step === 8) {
      const timer = setTimeout(() => {
        const backendHost = window.location.hostname || 'localhost';
        const closeUrl = (window.location.port === '5173')
          ? `http://${backendHost}:4000/api/v1/kiosk/door/close`
          : '/api/v1/kiosk/door/close';
        fetch(closeUrl, { method: "POST" })
          .then(r => r.json())
          .then(res => console.log("[Door] Bay door auto-closed 5s after report displayed:", res))
          .catch(err => console.warn("[Door] Auto-close failed:", err));
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [step]);

  const hasCardiacRedFlag =
    symptomList.some(s => /chest|heart|cardiac/i.test(s)) &&
    (hpi.associated === "Sweating" ||
      hpi.associated === "Breathing difficulty" ||
      /radiat|left\s*arm|arm|jaw/i.test(hpi.radiation || "") ||
      symptomList.some(s => /heart\s*attack/i.test(s)));

  const hasStrokeRedFlag =
    symptomList.some(s => /stroke|facial\s*droop|paralysis|slurr|weakness|speech/i.test(s));

  const hasBreathingRedFlag =
    symptomList.some(s => /breathing\s*difficulty|suffocat|gasp|asthma/i.test(s)) &&
    (Number(vitals.spo2) < 90 || hpi.severity === "Severe" || hpi.associated === "Breathing difficulty");

  const hasSevereHyperglycemiaRedFlag =
    Number(String(vitals.bloodSugar || '').replace(/[^\d.]/g, '')) >= 250 &&
    (hpi.associated === "Nausea" || symptomList.some(s => /vomit|nausea/i.test(s)));

  const hasRedFlag = hasCardiacRedFlag || hasStrokeRedFlag || hasBreathingRedFlag || hasSevereHyperglycemiaRedFlag ||
    symptomList.some(s => /heart\s*attack|stroke|unconscious|seizure|bleeding/i.test(s));

  const updatePatient = (field, value) => {
    setPatient((current) => ({ ...current, [field]: value }));
  };

  const toggleSymptom = (id) => {
    setSymptomList((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  };

  const startVoiceInput = (field) => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Voice input is not supported here. Please use Chrome.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang =
      language === "हिन्दी"
        ? "hi-IN"
        : language === "தமிழ்"
        ? "ta-IN"
        : language === "తెలుగు"
        ? "te-IN"
        : language === "বাংলা"
        ? "bn-IN"
        : "en-IN";

    recognition.continuous = false;
    recognition.interimResults = false;

    setListening(true);
    recognition.start();

    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript.trim();

      if (field === "name") updatePatient("name", text);

      if (field === "age") {
        const number = text.match(/\d+/);
        if (number) updatePatient("age", number[0]);
        else alert("Please say your age clearly.");
      }

      if (field === "complaint") {
        const lower = text.toLowerCase();
        const found = [];

        if (lower.includes("cold") || lower.includes("जुकाम") || lower.includes("सर्दी") || lower.includes("runny nose")) found.push("Cold / Runny nose");
        if (lower.includes("chest")) found.push("Chest discomfort");
        if (lower.includes("breath")) found.push("Breathing difficulty");
        if (lower.includes("fever")) found.push("Fever");
        if (lower.includes("headache")) found.push("Headache");
        if (lower.includes("cough")) found.push("Cough");
        if (lower.includes("stomach") || lower.includes("abdominal"))
          found.push("Stomach pain");
        if (lower.includes("nausea")) found.push("Nausea");

        if (found.length) {
          setSymptomList((current) => [...new Set([...current, ...found])]);
        } else {
          alert("I could not recognise the symptom. Please try again.");
        }
      }
    };

    recognition.onerror = () => {
      setListening(false);
      alert("Voice could not be detected. Please try again.");
    };

    recognition.onend = () => setListening(false);
  };

  const validatePatient = () => {
    if (!patient.name.trim()) {
      alert("Please enter your name.");
      return false;
    }

    if (!patient.age || Number(patient.age) < 1 || Number(patient.age) > 120) {
      alert("Please enter a valid age.");
      return false;
    }

    if (!patient.gender) {
      alert("Please select gender.");
      return false;
    }

    return true;
  };

  const validateHpi = () => {
    if (!hpi.site || !hpi.onset || !hpi.character || !hpi.radiation || !hpi.associated) {
      alert("Please answer all the symptom questions.");
      return false;
    }

    if (!hpi.severity) {
      alert("Please select severity.");
      return false;
    }

    return true;
  };

  const resetApp = () => {
    setStep(1);
    setLanguage("English");
    setMode("Tap");
    setListening(false);
    setSubmitted(false);
    setIsSubmitting(false);
    setSubmitSuccess(false);
    setSubmitError("");
    setSubmissionData(null);
    setReviewEditMode(false);
    setDocumentName("");
    setAltitudeMode("facility_config");
    setAltitudeMeters("2438");
    setStaffPin("");
    setPatient({ name: "", age: "", gender: "" });
    setSymptomList([]);
    setHpi({
      site: "",
      onset: "",
      character: "",
      radiation: "",
      associated: "",
      severity: "",
    });
    setVitals({ bp: "", spo2: "", heartRate: "", bloodSugar: "" });
  };

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (altitudeMode === "staff_manual" && !staffPin.trim()) {
      alert(language === "हिन्दी" ? "स्टाफ़ ओवरराइड PIN आवश्यक है।" : "A staff override PIN is required.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError("");

    const formData = {
      patientId: `PT-${Date.now().toString().slice(-4)}`,
      name: patient.name || "Anonymous Patient",
      age: patient.age || "—",
      symptoms: symptomList.length ? symptomList : ["General intake"],
      chiefComplaint: symptomList[0] || "General intake",
      hpi: {
        ...hpi,
        hasRedFlag: hasRedFlag
      },
      hasRedFlag: hasRedFlag,
      altitudeContext: {
        facilityAltitudeM: altitudeMeters && !isNaN(Number(altitudeMeters)) ? Number(altitudeMeters) : null,
        exposure: {
          usualSleepingAltitudeM: isResident ? (Number(altitudeMeters) || 200) : (Number(usualSleepingAltitudeM) || 200),
          currentSleepingAltitudeM: altitudeMeters && !isNaN(Number(altitudeMeters)) ? Number(altitudeMeters) : undefined,
          hoursAtCurrentAltitude: isResident ? undefined : (Number(arrivalHours) || undefined),
          highestSleepingAltitudeLast14DaysM: isResident ? (Number(altitudeMeters) || 200) : (Number(usualSleepingAltitudeM) || 200),
          isLongTermResident: isResident
        }
      },
      environment: {
        altitudeMeters: altitudeMeters && !isNaN(Number(altitudeMeters)) ? Number(altitudeMeters) : null,
        altitudeSource: altitudeMode,
        timeAtAltitudeHours: isResident ? undefined : (Number(arrivalHours) || undefined),
        residenceAltitudeMeters: isResident ? (Number(altitudeMeters) || 200) : (Number(usualSleepingAltitudeM) || 200),
        acclimatizationStatus: isResident ? "resident" : (Number(arrivalHours) <= 120 ? "acute_exposure" : "extended")
      },
      vitals: {
        bp: vitals.bp && vitals.bp.trim() ? vitals.bp.trim() : undefined,
        spo2: vitals.spo2 && vitals.spo2.trim() ? vitals.spo2.trim() : undefined,
        heartRate: vitals.heartRate && vitals.heartRate.trim() ? vitals.heartRate.trim() : undefined,
        hr: vitals.heartRate && vitals.heartRate.trim() ? vitals.heartRate.trim() : undefined,
        bloodSugar: vitals.bloodSugar && vitals.bloodSugar.trim() ? `${vitals.bloodSugar.trim().replace(/[^\d.]/g, '')} mg/dL` : undefined,
        bloodGlucose: vitals.bloodSugar && vitals.bloodSugar.trim() ? Number(vitals.bloodSugar.trim().replace(/[^\d.]/g, '')) : undefined
      }
    };

    try {
      const backendHost = window.location.hostname || 'localhost';
      const apiUrl = (window.location.port === '5173')
        ? `http://${backendHost}:4000/api/patient/submit`
        : '/api/patient/submit';

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to submit clinical intake record.");
      }

      setSubmissionData(result.data || formData);
      setSubmitSuccess(true);
      setSubmitted(true);
    } catch (err) {
      console.error("Submission failed:", err);
      setSubmitError(err.message || "Network error. Please inform hospital attendant.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Automated OCR Extraction handler
  const handleOcrUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setDocumentName(file.name);
    setOcrLoading(true);
    setOcrError(null);

    const formData = new FormData();
    formData.append("document", file);

    const backendHost = window.location.hostname || 'localhost';
    const ocrUrl = (window.location.port === '5173')
      ? `http://${backendHost}:4000/api/v1/ocr`
      : '/api/v1/ocr';

    try {
      const response = await fetch(ocrUrl, {
        method: "POST",
        body: formData,
      });

      const resData = await response.json();

      if (!response.ok || !resData.success) {
        throw new Error(resData.message || "Failed to process document with OCR.");
      }

      const ocrDoc = resData.data;
      setOcrResult(ocrDoc);

      const parsed = ocrDoc.structuredData || {};

      // Auto-populate patient details dynamically from OCR if extracted
      setPatient(prev => ({
        ...prev,
        name: parsed.patientName || prev.name || "",
        age: (parsed.age !== null && parsed.age !== undefined) ? String(parsed.age) : (prev.age || ""),
        gender: parsed.gender || prev.gender || ""
      }));

      // Auto-populate symptoms if detected from document
      if (Array.isArray(parsed.symptoms) && parsed.symptoms.length > 0) {
        setSymptomList(prev => {
          const set = new Set([...prev, ...parsed.symptoms]);
          return Array.from(set);
        });
      }
    } catch (err) {
      console.error("[OCR Upload Error]:", err);
      setOcrError(err.message || "Could not read document. You can still enter details manually.");
    } finally {
      setOcrLoading(false);
    }
  };

  const handleDocumentUpload = handleOcrUpload;

  const goNext = () => {
    if (step === 2) setStep(3);
    else if (step === 3) setStep(4);
    else if (step === 4 && validatePatient()) setStep(5);
    else if (step === 5) {
      if (!symptomList.length) {
        alert("Please select at least one symptom.");
        return;
      }
      if (symptomList.includes("Chest discomfort")) setStep(6);
      else setStep(7);
    } else if (step === 6 && validateHpi()) setStep(7);
    else if (step === 7) {
      // Proceeding to next step from Step 7: close door automatically
      const backendHost = window.location.hostname || 'localhost';
      const closeUrl = (window.location.port === '5173')
        ? `http://${backendHost}:4000/api/v1/kiosk/door/close`
        : '/api/v1/kiosk/door/close';
      fetch(closeUrl, { method: "POST" }).catch(() => {});
      setStep(8);
    }
  };

  const BackButton = ({ target }) => (
    <button
      className="secondary-btn"
      onClick={() => {
        if (step === 7) {
          const backendHost = window.location.hostname || 'localhost';
          const closeUrl = (window.location.port === '5173')
            ? `http://${backendHost}:4000/api/v1/kiosk/door/close`
            : '/api/v1/kiosk/door/close';
          fetch(closeUrl, { method: "POST" }).catch(() => {});
        }
        setStep(target);
      }}
    >
      ← Back
    </button>
  );

  const StepHeader = ({ number, title, subtitle }) => (
    <div className="step-header">
      <div className="step-count">Step {number} of 8</div>
      <h2>{title}</h2>
      <p>{subtitle}</p>
    </div>
  );

  const Header = () => (
    <header className="header">
      <div className="brand">
        <div className="brand-mark">M</div>
        <div>
          <h1>MediKiosk</h1>
          <span>Clinical Intake</span>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <a
          href={`http://${window.location.hostname || 'localhost'}:4000/appointment.html`}
          style={{
            color: "#4f46e5",
            textDecoration: "none",
            fontSize: "13px",
            fontWeight: "600",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "8px 14px",
            borderRadius: "8px",
            background: "#eef2ff",
            border: "1px solid #c7d2fe",
            transition: "all 0.2s ease"
          }}
        >
          <span>📅 Book Appointment</span>
        </a>
        <a
          href={`http://${window.location.hostname || 'localhost'}:4000`}
          className="portal-exit-link"
          style={{
            color: "#168f91",
            textDecoration: "none",
            fontSize: "13px",
            fontWeight: "600",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "8px 14px",
            borderRadius: "8px",
            background: "#f0f9f9",
            border: "1px solid #cce8e8",
            transition: "all 0.2s ease"
          }}
        >
          ← Return to Portal
        </a>
        {ambientEnv && ambientEnv.online === true && ambientEnv.temperature_c !== null && (
          <div
            className="kiosk-status"
            style={{
              background: "#ecfdf5",
              border: "1px solid #a7f3d0",
              color: "#065f46",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 12px",
              borderRadius: "8px",
              fontSize: "12px",
              fontWeight: "600"
            }}
            title="DHT11 Room Climate Stream (Node 2)"
          >
            <span>🌡️</span>
            <span>{Number(ambientEnv.temperature_c).toFixed(1)}°C</span>
            <span style={{ color: "#059669", opacity: 0.6 }}>|</span>
            <span>💧</span>
            <span>{Number(ambientEnv.humidity_pct).toFixed(0)}% RH</span>
          </div>
        )}
        <div className="kiosk-status">
          <span className="status-dot" />
          Kiosk ready
        </div>
      </div>
    </header>
  );

  const Footer = () => (
    <footer>
      Information is reviewed by healthcare staff before being added to the medical record.
    </footer>
  );

  if (submitted) {
    return (
      <div className="app">
        <Header />
        <main className="main">
          <section className="card success-card">
            <div className="success-mark">✓</div>
            <h2>Intake completed</h2>
            <p className="subtitle">
              Your information has been sent for healthcare staff review.
            </p>

            <div className="status-box">
              <div>
                <span>Patient</span>
                <strong>{patient.name}</strong>
              </div>
              <div>
                <span>Status</span>
                <strong>Awaiting clinical review</strong>
              </div>
            </div>

            {hasRedFlag && (
              <div className="alert-box">
                <strong>Urgent staff review requested</strong>
                <p>
                  Your answers include symptoms that require prompt attention.
                  Please remain available for healthcare staff.
                </p>
              </div>
            )}

            <button className="primary-btn" onClick={resetApp}>
              Start new intake
            </button>
          </section>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="app">
      <Header />

      <main className="main">
        {/* STEP 1 */}
        {step === 1 && (
          <section className="card welcome-card">
            <div className="welcome-mark">M</div>
            <h2>Welcome to MediKiosk</h2>
            <p className="subtitle">
              A simple way to share information before your consultation.
            </p>

            <div className="field-block">
              <label>Select your language</label>
              <div className="language-grid">
                {languages.map((item) => (
                  <button
                    key={item}
                    className={language === item ? "choice selected" : "choice"}
                    onClick={() => setLanguage(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div className="mode-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
              <button
                className={mode === "Nova" ? "mode-card selected" : "mode-card"}
                onClick={() => {
                  setMode("Nova");
                  setShowNovaModal(true);
                }}
                style={{
                  border: mode === "Nova" ? "2px solid #168f91" : "1px solid #c4e7e7",
                  background: mode === "Nova" ? "#f2fafa" : "#ffffff"
                }}
              >
                <span className="mode-icon" style={{ background: "#e0f2f1", color: "#00796b", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                    <line x1="12" x2="12" y1="19" y2="22"/>
                  </svg>
                </span>
                <div>
                  <strong>NOVA Assistant</strong>
                  <p>{language === "हिन्दी" ? "AI से बोलकर जांच कराएं" : "Speak with virtual health assistant"}</p>
                </div>
              </button>

              <button
                className={mode === "Talk" ? "mode-card selected" : "mode-card"}
                onClick={() => setMode("Talk")}
              >
                <span className="mode-icon">MIC</span>
                <div>
                  <strong>Talk</strong>
                  <p>Answer questions using your voice.</p>
                </div>
              </button>

              <button
                className={mode === "Tap" ? "mode-card selected" : "mode-card"}
                onClick={() => setMode("Tap")}
              >
                <span className="mode-icon">TAP</span>
                <div>
                  <strong>Tap</strong>
                  <p>Choose answers on the screen.</p>
                </div>
              </button>
            </div>

            <div className="field-block">
              <label>{language === "हिन्दी" ? "सुविधा ऊंचाई संदर्भ" : "Facility Elevation Context"}</label>
              <select value={altitudeMode} onChange={(e) => setAltitudeMode(e.target.value)}>
                <option value="facility_config">
                  {altitudeMeters ? (language === "हिन्दी" ? `सुविधा ऊंचाई: ${altitudeMeters} मी` : `Facility Elevation: ${altitudeMeters} m`) : (language === "हिन्दी" ? "मानक ऊंचाई (अकॉन्फिगर)" : "Standard Elevation (Unconfigured)")}
                </option>
                <option value="staff_manual">{language === "हिन्दी" ? "स्टाफ़ मैन्युअल ओवरराइड" : "Staff manual override"}</option>
              </select>
              {altitudeMode === "staff_manual" && (
                <div className="vitals-grid" style={{ marginTop: "10px" }}>
                  <input aria-label="Altitude in metres" value={altitudeMeters} onChange={(e) => setAltitudeMeters(e.target.value)} placeholder="Altitude (m)" />
                  <input aria-label="Staff override PIN" type="password" value={staffPin} onChange={(e) => setStaffPin(e.target.value)} placeholder={language === "हिन्दी" ? "स्टाफ़ PIN" : "Staff override PIN"} />
                </div>
              )}

              {/* Objective Exposure Questions if Elevation >= 2,450 m */}
              {altitudeMeters && Number(altitudeMeters) >= 2450 && (
                <div style={{ marginTop: "14px", padding: "12px", background: "#f0f9ff", borderRadius: "8px", border: "1px solid #bae6fd" }}>
                  <label style={{ fontSize: "13px", fontWeight: 700, color: "#0369a1", display: "block", marginBottom: "6px" }}>
                    {language === "हिन्दी" ? "ऊंचाई जोखिम संदर्भ (CDC / WMS)" : "Altitude Exposure Profile (CDC / WMS)"}
                  </label>
                  
                  <div style={{ display: "flex", gap: "10px", marginBottom: "8px" }}>
                    <button
                      type="button"
                      style={{ flex: 1, padding: "8px", borderRadius: "6px", border: isResident ? "2px solid #0284c7" : "1px solid #cbd5e1", background: isResident ? "#e0f2fe" : "#ffffff", fontWeight: isResident ? 700 : 500, fontSize: "12px", cursor: "pointer" }}
                      onClick={() => setIsResident(true)}
                    >
                      {language === "हिन्दी" ? "स्थानीय निवासी" : "Local Resident"}
                    </button>
                    <button
                      type="button"
                      style={{ flex: 1, padding: "8px", borderRadius: "6px", border: !isResident ? "2px solid #0284c7" : "1px solid #cbd5e1", background: !isResident ? "#e0f2fe" : "#ffffff", fontWeight: !isResident ? 700 : 500, fontSize: "12px", cursor: "pointer" }}
                      onClick={() => setIsResident(false)}
                    >
                      {language === "हिन्दी" ? "निचले क्षेत्र से यात्री" : "Traveler / Visitor"}
                    </button>
                  </div>

                  {!isResident && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      <span style={{ fontSize: "11px", color: "#475569" }}>
                        {language === "हिन्दी" ? "इस ऊंचाई पर आगमन समय:" : "Duration at this elevation:"}
                      </span>
                      <select
                        value={arrivalHours}
                        onChange={(e) => setArrivalHours(e.target.value)}
                        style={{ padding: "6px 8px", fontSize: "12px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                      >
                        <option value="6">&lt; 12 hours ago (acute exposure)</option>
                        <option value="24">12 – 24 hours ago (acute exposure)</option>
                        <option value="48">1 – 2 days ago (acute acclimatization window)</option>
                        <option value="72">3 days ago</option>
                        <option value="120">4 – 5 days ago</option>
                        <option value="192">&gt; 1 week ago</option>
                      </select>
                    </div>
                  )}
                </div>
              )}
            </div>

            <button className="primary-btn" onClick={() => setStep(2)}>
              Continue →
            </button>

            <p className="help-text">Need help? Ask hospital staff.</p>
          </section>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <section className="card">
            <StepHeader
              number="2"
              title="Identify yourself"
              subtitle="Use your ABHA QR or continue without ABHA."
            />

            <div className="abha-box">
              <div className="qr-placeholder">
                QR
              </div>
              <div>
                <h3>ABHA QR</h3>
                <p>Scan your ABHA QR code at the kiosk.</p>
                <button
                  className="outline-btn"
                  onClick={() => alert("Demo: ABHA scanner would open here.")}
                >
                  Scan ABHA QR
                </button>
              </div>
            </div>

            <div className="or-line"><span>OR</span></div>

            <button className="primary-btn" onClick={goNext}>
              Continue without ABHA →
            </button>

            <BackButton target={1} />
          </section>
        )}

        {/* STEP 3: Medical Documents (placed before personal info for autofill) */}
        {step === 3 && (
          <section className="card">
            <StepHeader
              number="3"
              title="Previous medical documents"
              subtitle="Have an existing prescription or discharge summary? Scan or upload it to auto-fill your details, or skip to enter manually."
            />

            <div className="upload-box">
              <div className="upload-icon">DOC</div>
              <h3>{documentName ? "Document uploaded" : "Scan or upload medical document"}</h3>
              <p>
                {documentName
                  ? `Selected: ${documentName}`
                  : "Upload your prescription or lab report image to automatically extract and verify your details."}
              </p>

              <label
                className="outline-btn file-label"
                style={{
                  cursor: ocrLoading ? "not-allowed" : "pointer",
                  opacity: ocrLoading ? 0.7 : 1,
                  display: "inline-block"
                }}
              >
                {ocrLoading ? "Scanning document with OCR..." : (documentName ? "Upload Different Document" : "Choose Document Image")}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/jpg"
                  disabled={ocrLoading}
                  onChange={handleDocumentUpload}
                  hidden
                />
              </label>
            </div>

            {ocrLoading && (
              <div style={{
                margin: "16px 0",
                padding: "20px",
                background: "#f0f9ff",
                borderRadius: "10px",
                textAlign: "center",
                border: "1px solid #bae6fd"
              }}>
                <div style={{
                  display: "inline-block",
                  width: "28px",
                  height: "28px",
                  border: "3px solid #0284c7",
                  borderTopColor: "transparent",
                  borderRadius: "50%",
                  animation: "spin 0.8s linear infinite"
                }} />
                <p style={{ margin: "10px 0 4px", fontWeight: 600, color: "#0369a1", fontSize: "15px" }}>
                  Extracting medical data via Tesseract OCR...
                </p>
                <small style={{ color: "#64748b" }}>
                  Reading patient demographics, clinical symptoms, and medications...
                </small>
              </div>
            )}

            {ocrError && (
              <div style={{
                margin: "16px 0",
                padding: "14px 16px",
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "8px",
                color: "#b91c1c",
                fontSize: "14px"
              }}>
                ⚠️ <strong>OCR Notice:</strong> {ocrError}
              </div>
            )}

            {documentName && !ocrLoading && (
              <div className="extraction-box" style={{
                margin: "18px 0",
                padding: "16px 20px",
                background: "#f8fafc",
                border: "1px solid #cbd5e1",
                borderRadius: "10px",
                textAlign: "left"
              }}>
                <div className="extraction-title" style={{
                  fontWeight: 700,
                  fontSize: "15px",
                  color: "#0f766e",
                  marginBottom: "10px",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px"
                }}>
                  <span>✓</span> Extracted Medical Document Data
                </div>

                <p style={{ margin: "6px 0", fontSize: "14px" }}>
                  <strong>Detected Patient:</strong>{" "}
                  {patient.name ? (
                    <span style={{ color: "#0f172a", fontWeight: 600 }}>{patient.name}</span>
                  ) : (
                    <span style={{ color: "#94a3b8", fontStyle: "italic" }}>Name not found in document</span>
                  )}
                  {" "}
                  (Age: {patient.age ? patient.age : "—"}, Gender: {patient.gender ? patient.gender : "—"})
                </p>

                <p style={{ margin: "6px 0", fontSize: "14px" }}>
                  <strong>Document Classification:</strong>{" "}
                  <span style={{
                    padding: "2px 8px",
                    borderRadius: "12px",
                    background: ocrResult?.documentType === "PRESCRIPTION" ? "#dbeafe" : ocrResult?.documentType === "LAB_REPORT" ? "#fef3c7" : "#f1f5f9",
                    color: ocrResult?.documentType === "PRESCRIPTION" ? "#1e40af" : ocrResult?.documentType === "LAB_REPORT" ? "#92400e" : "#475569",
                    fontSize: "12px",
                    fontWeight: 600
                  }}>
                    {ocrResult?.documentType === "PRESCRIPTION" ? "Prescription" : ocrResult?.documentType === "LAB_REPORT" ? "Lab Report" : "Clinical Document"}
                  </span>
                  {ocrResult?.confidence > 0 && (
                    <span style={{ marginLeft: "10px", fontSize: "12px", color: "#64748b" }}>
                      (Confidence: {Math.round(ocrResult.confidence * 100)}%)
                    </span>
                  )}
                </p>

                {ocrResult?.structuredData?.doctorName && (
                  <p style={{ margin: "6px 0", fontSize: "14px" }}>
                    <strong>Prescribing Doctor:</strong> Dr. {ocrResult.structuredData.doctorName}
                  </p>
                )}

                {ocrResult?.structuredData?.medications && ocrResult.structuredData.medications.length > 0 && (
                  <p style={{ margin: "6px 0", fontSize: "14px" }}>
                    <strong>Detected Medications:</strong>{" "}
                    {ocrResult.structuredData.medications.map((m, idx) => (
                      <span key={idx} style={{
                        display: "inline-block",
                        background: "#e0f2fe",
                        color: "#0369a1",
                        padding: "2px 8px",
                        borderRadius: "4px",
                        marginRight: "6px",
                        fontSize: "12px",
                        fontWeight: 500
                      }}>
                        {typeof m === "string" ? m : `${m.name} ${m.dosage || ""}`.trim()}
                      </span>
                    ))}
                  </p>
                )}

                {ocrResult?.structuredData?.symptoms && ocrResult.structuredData.symptoms.length > 0 && (
                  <p style={{ margin: "6px 0", fontSize: "14px" }}>
                    <strong>Detected Symptoms:</strong>{" "}
                    {ocrResult.structuredData.symptoms.map((sym, idx) => (
                      <span key={idx} style={{
                        display: "inline-block",
                        background: "#fef3c7",
                        color: "#92400e",
                        padding: "2px 8px",
                        borderRadius: "4px",
                        marginRight: "6px",
                        fontSize: "12px",
                        fontWeight: 500
                      }}>
                        {sym}
                      </span>
                    ))}
                  </p>
                )}

                {ocrResult?.extractedText && (
                  <details style={{ marginTop: "10px", fontSize: "12px", color: "#64748b" }}>
                    <summary style={{ cursor: "pointer", fontWeight: 600, color: "#2563eb", outline: "none" }}>
                      View Raw OCR Extracted Text
                    </summary>
                    <pre style={{
                      marginTop: "6px",
                      padding: "10px",
                      background: "#ffffff",
                      borderRadius: "6px",
                      border: "1px solid #e2e8f0",
                      maxHeight: "120px",
                      overflowY: "auto",
                      whiteSpace: "pre-wrap",
                      fontSize: "11px",
                      fontFamily: "monospace",
                      color: "#334155"
                    }}>
                      {ocrResult.extractedText}
                    </pre>
                  </details>
                )}

                <small style={{ display: "block", marginTop: "10px", color: "#64748b" }}>
                  All extracted information can be reviewed or edited in the next step.
                </small>
              </div>
            )}

            <button className="primary-btn" onClick={goNext} disabled={ocrLoading}>
              {documentName ? "Continue with Extracted Details →" : "Continue to Manual Entry →"}
            </button>

            <button className="skip-btn" onClick={goNext} disabled={ocrLoading}>
              I don't have previous documents — skip
            </button>

            <BackButton target={2} />
          </section>
        )}

        {/* STEP 4: Patient Information */}
        {step === 4 && (
          <section className="card">
            <StepHeader
              number="4"
              title="Patient information"
              subtitle={documentName ? "Review and verify details extracted from your document." : "Please enter your basic information needed for intake."}
            />

            <div className="form-grid">
              <div className="field-block full">
                <label>Full name</label>
                <div className="input-row">
                  <input
                    value={patient.name}
                    onChange={(e) => updatePatient("name", e.target.value)}
                    placeholder="Enter full name"
                  />
                  {mode === "Talk" && (
                    <button
                      className="mic-btn"
                      onClick={() => startVoiceInput("name")}
                    >
                      MIC
                    </button>
                  )}
                </div>
              </div>

              <div className="field-block">
                <label>Age</label>
                <div className="input-row">
                  <input
                    type="number"
                    value={patient.age}
                    onChange={(e) => updatePatient("age", e.target.value)}
                    placeholder="Age"
                  />
                  {mode === "Talk" && (
                    <button
                      className="mic-btn"
                      onClick={() => startVoiceInput("age")}
                    >
                      MIC
                    </button>
                  )}
                </div>
              </div>

              <div className="field-block">
                <label>Gender</label>
                <select
                  value={patient.gender}
                  onChange={(e) => updatePatient("gender", e.target.value)}
                >
                  <option value="">Select gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            {mode === "Talk" && (
              <div className="voice-note">
                {listening
                  ? "Listening… speak clearly."
                  : "Tap MIC beside a field to answer by voice."}
              </div>
            )}

            <button className="primary-btn" onClick={goNext}>
              Continue →
            </button>
            <BackButton target={3} />
          </section>
        )}

        {/* STEP 5: Symptoms */}
        {step === 5 && (
          <section className="card">
            <StepHeader
              number="5"
              title="What brings you here today?"
              subtitle="Select all symptoms that apply."
            />

            {mode === "Talk" && (
              <button
                className="voice-complaint"
                onClick={() => startVoiceInput("complaint")}
              >
                {listening ? "Listening…" : "MIC  Tell me your symptoms"}
              </button>
            )}

            <div className="symptom-grid">
              {symptoms.map((item) => (
                <button
                  key={item.id}
                  className={
                    symptomList.includes(item.id)
                      ? "symptom selected"
                      : "symptom"
                  }
                  onClick={() => toggleSymptom(item.id)}
                >
                  {item.label}
                  <span>{symptomList.includes(item.id) ? "✓" : "+"}</span>
                </button>
              ))}
            </div>

            {symptomList.length > 0 && (
              <div className="selected-line">
                Selected: {symptomList.join(", ")}
              </div>
            )}

            <button className="primary-btn" onClick={goNext}>
              Continue →
            </button>
            <BackButton target={4} />
          </section>
        )}

        {/* STEP 6: HPI */}
        {step === 6 && (
          <section className="card">
            <StepHeader
              number="6"
              title="Tell us more about the symptom"
              subtitle="These questions help the healthcare professional understand your complaint."
            />

            <div className="question">
              <label>Where do you feel the discomfort?</label>
              <div className="small-choice-grid">
                {hpiOptions.site.map((item) => (
                  <button
                    key={item}
                    className={hpi.site === item ? "choice selected" : "choice"}
                    onClick={() => setHpi({ ...hpi, site: item })}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div className="question">
              <label>When did it start?</label>
              <div className="small-choice-grid">
                {hpiOptions.onset.map((item) => (
                  <button
                    key={item}
                    className={hpi.onset === item ? "choice selected" : "choice"}
                    onClick={() => setHpi({ ...hpi, onset: item })}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div className="question">
              <label>How does it feel?</label>
              <div className="small-choice-grid">
                {hpiOptions.character.map((item) => (
                  <button
                    key={item}
                    className={hpi.character === item ? "choice selected" : "choice"}
                    onClick={() => setHpi({ ...hpi, character: item })}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div className="question">
              <label>Does it spread anywhere?</label>
              <div className="small-choice-grid">
                {hpiOptions.radiation.map((item) => (
                  <button
                    key={item}
                    className={hpi.radiation === item ? "choice selected" : "choice"}
                    onClick={() => setHpi({ ...hpi, radiation: item })}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div className="question">
              <label>Any associated symptom?</label>
              <div className="small-choice-grid">
                {hpiOptions.associated.map((item) => (
                  <button
                    key={item}
                    className={
                      hpi.associated === item ? "choice selected" : "choice"
                    }
                    onClick={() => setHpi({ ...hpi, associated: item })}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div className="question">
              <label>How severe is it?</label>
              <div className="severity-grid">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                  <button
                    key={n}
                    className={
                      Number(hpi.severity) === n
                        ? "severity selected"
                        : "severity"
                    }
                    onClick={() => setHpi({ ...hpi, severity: n })}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {hasRedFlag && (
              <div className="alert-box">
                <strong>Please wait for healthcare staff.</strong>
                <p>
                  Your answers indicate that prompt staff review is needed.
                </p>
              </div>
            )}

            <button className="primary-btn" onClick={goNext}>
              Continue →
            </button>
            <BackButton target={5} />
          </section>
        )}

        {/* STEP 7 */}
        {step === 7 && (
          <section className="card">
            <StepHeader
              number="7"
              title="Vitals & Diagnostics"
            />

            {/* Display scanned readings cleanly in cards without manual typing */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "14px",
              marginBottom: "20px"
            }}>
              <div style={{
                padding: "18px 20px",
                borderRadius: "12px",
                border: vitals.bloodSugar ? "1px solid #168f91" : "1px dashed #dce5e8",
                background: vitals.bloodSugar ? "#f2fafa" : "#ffffff",
                display: "flex",
                flexDirection: "column",
                gap: "6px"
              }}>
                <span style={{ fontSize: "12px", fontWeight: 700, color: vitals.bloodSugar ? "#168f91" : "#74858d", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Blood Glucose
                </span>
                <div style={{ fontSize: "24px", fontWeight: 800, color: vitals.bloodSugar ? "#18394b" : "#b0bec5" }}>
                  {vitals.bloodSugar ? `${vitals.bloodSugar} mg/dL` : "Awaiting scan…"}
                </div>
                <small style={{ fontSize: "11px", color: vitals.bloodSugar ? "#2e9d68" : "#94a3b8" }}>
                  {vitals.bloodSugar ? "✓ Reading verified" : "Tap scan to capture"}
                </small>
              </div>

              <div style={{
                padding: "18px 20px",
                borderRadius: "12px",
                border: vitals.spo2 ? "1px solid #168f91" : "1px dashed #dce5e8",
                background: vitals.spo2 ? "#f2fafa" : "#ffffff",
                display: "flex",
                flexDirection: "column",
                gap: "6px"
              }}>
                <span style={{ fontSize: "12px", fontWeight: 700, color: vitals.spo2 ? "#168f91" : "#74858d", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Pulse & SpO₂
                </span>
                <div style={{ fontSize: "24px", fontWeight: 800, color: vitals.spo2 ? "#18394b" : "#b0bec5" }}>
                  {vitals.spo2 ? `${vitals.spo2}%` : "Optional"}
                </div>
                <small style={{ fontSize: "11px", color: "#94a3b8" }}>
                  {vitals.spo2 ? "Recorded" : "Oximeter reading"}
                </small>
              </div>

              <div style={{
                padding: "18px 20px",
                borderRadius: "12px",
                border: vitals.heartRate ? "1px solid #168f91" : "1px dashed #dce5e8",
                background: vitals.heartRate ? "#f2fafa" : "#ffffff",
                display: "flex",
                flexDirection: "column",
                gap: "6px"
              }}>
                <span style={{ fontSize: "12px", fontWeight: 700, color: vitals.heartRate ? "#168f91" : "#74858d", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Heart Rate
                </span>
                <div style={{ fontSize: "24px", fontWeight: 800, color: vitals.heartRate ? "#18394b" : "#b0bec5" }}>
                  {vitals.heartRate ? `${vitals.heartRate} bpm` : "Optional"}
                </div>
                <small style={{ fontSize: "11px", color: "#94a3b8" }}>
                  {vitals.heartRate ? "Recorded" : "Pulse / HR reading"}
                </small>
              </div>

              <div style={{
                padding: "18px 20px",
                borderRadius: "12px",
                border: vitals.bp ? "1px solid #168f91" : "1px dashed #dce5e8",
                background: vitals.bp ? "#f2fafa" : "#ffffff",
                display: "flex",
                flexDirection: "column",
                gap: "6px"
              }}>
                <span style={{ fontSize: "12px", fontWeight: 700, color: vitals.bp ? "#168f91" : "#74858d", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Blood Pressure
                </span>
                <div style={{ fontSize: "24px", fontWeight: 800, color: vitals.bp ? "#18394b" : "#b0bec5" }}>
                  {vitals.bp ? vitals.bp : "Optional"}
                </div>
                <small style={{ fontSize: "11px", color: "#94a3b8" }}>
                  {vitals.bp ? "Recorded" : "Standard cuff reading"}
                </small>
              </div>
            </div>

            {/* AI Vital Scanner Component */}
            <VitalScanner
              sessionId={scannerSessionId}
              onScanSuccess={(reading) => {
                if (!reading) return;
                const rType = String(reading.type || '').toLowerCase();
                if (rType.includes('spo2') || rType.includes('oximeter')) {
                  const spVal = reading.spo2 ?? reading.value;
                  if (spVal) setVitals(prev => ({ ...prev, spo2: String(spVal) }));
                  const pulse = reading.pulse || reading.heart_rate;
                  if (pulse) setVitals(prev => ({ ...prev, heartRate: String(pulse) }));
                } else if (rType.includes('bp') || rType.includes('blood_pressure') || reading.systolic) {
                  const bpStr = (reading.systolic && reading.diastolic)
                    ? `${reading.systolic}/${reading.diastolic}`
                    : String(reading.value || '');
                  if (bpStr) setVitals(prev => ({ ...prev, bp: bpStr }));
                  const pulse = reading.pulse || reading.heart_rate;
                  if (pulse) setVitals(prev => ({ ...prev, heartRate: String(pulse) }));
                } else if (rType.includes('heart_rate') || rType.includes('pulse')) {
                  if (reading.value) setVitals(prev => ({ ...prev, heartRate: String(reading.value) }));
                } else if (rType.includes('glucose') || rType.includes('sugar') || rType.includes('blood_glucose')) {
                  if (reading.value) setVitals(prev => ({ ...prev, bloodSugar: String(reading.value) }));
                } else if (reading.value) {
                  setVitals(prev => ({ ...prev, bloodSugar: String(reading.value) }));
                }
              }}
            />

            <div style={{ marginTop: "24px", display: "flex", flexDirection: "column", gap: "10px" }}>
              <button className="primary-btn" onClick={goNext}>
                Continue to Review →
              </button>
              <BackButton target={6} />
            </div>
          </section>
        )}

        {/* STEP 8 */}
        {step === 8 && (
          submitSuccess ? (
            <section className="card" style={{ textAlign: "center", padding: "40px 24px" }}>
              <div style={{
                width: "76px",
                height: "76px",
                borderRadius: "50%",
                background: "#ecfdf5",
                color: "#059669",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "40px",
                margin: "0 auto 20px",
                border: "3px solid #10b981",
                boxShadow: "0 0 24px rgba(16, 185, 129, 0.2)"
              }}>
                ✓
              </div>

              <h2 style={{ fontSize: "24px", fontWeight: "800", color: "#0f172a", marginBottom: "8px" }}>
                {language === "हिन्दी" ? "क्लिनिकल समीक्षा हेतु प्रेषित!" : "Transmitted to Doctor Command Center"}
              </h2>

              <p style={{ color: "#64748b", fontSize: "14px", maxWidth: "540px", margin: "0 auto 24px" }}>
                {language === "हिन्दी"
                  ? "मरीज़ का डेटा, वाइटल्स और ट्राइएज रिपोर्ट डॉक्टर के डैशबोर्ड पर सफलतापूर्वक भेज दिए गए हैं।"
                  : "Patient intake, vital telemetry, and triage scoring have been successfully broadcast to the physician queue."}
              </p>

              {/* Intake Summary Card */}
              <div style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "14px",
                padding: "20px",
                maxWidth: "480px",
                margin: "0 auto 24px",
                textAlign: "left",
                display: "grid",
                gap: "12px"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #e2e8f0", paddingBottom: "10px" }}>
                  <span style={{ color: "#64748b", fontWeight: "600" }}>Token / Patient ID:</span>
                  <strong style={{ fontFamily: "monospace", color: "#0f766e", fontSize: "17px" }}>
                    {submissionData?.patientId || "PT-QUEUE"}
                  </strong>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #e2e8f0", paddingBottom: "10px" }}>
                  <span style={{ color: "#64748b", fontWeight: "600" }}>Patient Name:</span>
                  <strong>{submissionData?.name || patient.name || "Anonymous Patient"}</strong>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #e2e8f0", paddingBottom: "10px" }}>
                  <span style={{ color: "#64748b", fontWeight: "600" }}>Triage Priority:</span>
                  <span style={{
                    fontWeight: "800",
                    padding: "3px 12px",
                    borderRadius: "20px",
                    fontSize: "12px",
                    background: (submissionData?.triageLevel === "EMERGENCY" || hasRedFlag) ? "#fef2f2" : "#f0fdf4",
                    color: (submissionData?.triageLevel === "EMERGENCY" || hasRedFlag) ? "#dc2626" : "#16a34a",
                    border: `1px solid ${(submissionData?.triageLevel === "EMERGENCY" || hasRedFlag) ? "#fca5a5" : "#86efac"}`
                  }}>
                    {submissionData?.triageLevel || (hasRedFlag ? "EMERGENCY" : "ROUTINE")}
                  </span>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#64748b", fontWeight: "600" }}>Queue Status:</span>
                  <span style={{ color: "#059669", fontWeight: "700" }}>● Live in Doctor Queue</span>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxWidth: "480px", margin: "0 auto" }}>
                <button
                  className="primary-btn"
                  onClick={resetApp}
                  style={{ width: "100%", padding: "14px", fontSize: "16px", fontWeight: "700" }}
                >
                  {language === "हिन्दी" ? "अगला मरीज़ / नया प्रारंभ करें" : "Next Patient / Start New Intake →"}
                </button>
                <button
                  className="secondary-btn"
                  onClick={() => window.location.href = '/'}
                  style={{ width: "100%", padding: "12px", fontSize: "14px" }}
                >
                  {language === "हिन्दी" ? "मुख्य स्क्रीन पर वापस जाएं" : "Return to MediKiosk Home"}
                </button>
              </div>
            </section>
          ) : (
            <section className="card">
              <StepHeader
                number="8"
                title="Review your information"
                subtitle="Check the details before sending them for clinical review."
              />

            {/* Top Micro-Adjustment action bar */}
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: reviewEditMode ? "#ecfdf5" : "#f0fdfa",
              border: `1px solid ${reviewEditMode ? "#6ee7b7" : "#99f6e4"}`,
              padding: "12px 18px",
              borderRadius: "12px",
              marginBottom: "16px"
            }}>
              <div>
                <strong style={{ color: "#0f766e", display: "block", fontSize: "15px" }}>
                  {reviewEditMode ? "✏️ Micro-Adjusting Report" : "📋 Final Intake Report"}
                </strong>
                <span style={{ fontSize: "12px", color: "#115e59" }}>
                  {reviewEditMode
                    ? "Adjust any numbers or patient info below before submitting."
                    : "Review all recorded data. Click 'Micro Adjust' if you need to tweak any values."}
                </span>
              </div>
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setReviewEditMode(!reviewEditMode)}
                style={{
                  padding: "7px 16px",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: "pointer",
                  background: reviewEditMode ? "#0f766e" : "#ffffff",
                  color: reviewEditMode ? "#ffffff" : "#0f766e",
                  border: "1px solid #0f766e",
                  borderRadius: "8px",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.06)"
                }}
              >
                {reviewEditMode ? "✓ Done Adjusting" : "✏️ Micro Adjust"}
              </button>
            </div>

            {/* Review and Micro-Adjust Content */}
            {reviewEditMode ? (
              <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "16px",
                background: "#f8fafc",
                padding: "16px",
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
                marginBottom: "20px"
              }}>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 600, color: "#475569" }}>Patient Name</label>
                  <input
                    className="input-field"
                    type="text"
                    value={patient.name}
                    onChange={(e) => setPatient(p => ({ ...p, name: e.target.value }))}
                    style={{ width: "100%", marginTop: "4px" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 600, color: "#475569" }}>Age</label>
                  <input
                    className="input-field"
                    type="number"
                    value={patient.age}
                    onChange={(e) => setPatient(p => ({ ...p, age: e.target.value }))}
                    style={{ width: "100%", marginTop: "4px" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 600, color: "#475569" }}>Gender</label>
                  <select
                    className="input-field"
                    value={patient.gender}
                    onChange={(e) => setPatient(p => ({ ...p, gender: e.target.value }))}
                    style={{ width: "100%", marginTop: "4px" }}
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 600, color: "#475569" }}>Blood Sugar (mg/dL)</label>
                  <input
                    className="input-field"
                    type="number"
                    value={vitals.bloodSugar}
                    placeholder="e.g. 115"
                    onChange={(e) => setVitals(v => ({ ...v, bloodSugar: e.target.value }))}
                    style={{ width: "100%", marginTop: "4px" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 600, color: "#475569" }}>SpO₂ (%)</label>
                  <input
                    className="input-field"
                    type="number"
                    value={vitals.spo2}
                    placeholder="e.g. 98"
                    onChange={(e) => setVitals(v => ({ ...v, spo2: e.target.value }))}
                    style={{ width: "100%", marginTop: "4px" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 600, color: "#475569" }}>Heart Rate (bpm)</label>
                  <input
                    className="input-field"
                    type="number"
                    value={vitals.heartRate}
                    placeholder="e.g. 74"
                    onChange={(e) => setVitals(v => ({ ...v, heartRate: e.target.value }))}
                    style={{ width: "100%", marginTop: "4px" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 600, color: "#475569" }}>Blood Pressure</label>
                  <input
                    className="input-field"
                    type="text"
                    value={vitals.bp}
                    placeholder="e.g. 120/80"
                    onChange={(e) => setVitals(v => ({ ...v, bp: e.target.value }))}
                    style={{ width: "100%", marginTop: "4px" }}
                  />
                </div>
                <div style={{ gridColumn: "span 2" }}>
                  <label style={{ fontSize: "12px", fontWeight: 600, color: "#475569" }}>Reported Symptoms (Click to toggle)</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "6px" }}>
                    {symptoms.map((s) => {
                      const active = symptomList.includes(s.label);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => toggleSymptom(s.label)}
                          style={{
                            padding: "4px 10px",
                            borderRadius: "16px",
                            fontSize: "12px",
                            fontWeight: 600,
                            border: `1px solid ${active ? "#0f766e" : "#cbd5e1"}`,
                            background: active ? "#0f766e" : "#ffffff",
                            color: active ? "#ffffff" : "#475569",
                            cursor: "pointer"
                          }}
                        >
                          {active ? `✓ ${s.label}` : `+ ${s.label}`}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="review-list">
                <div><span>Name</span><strong>{patient.name || "Not entered"}</strong></div>
                <div><span>Age</span><strong>{patient.age || "Not entered"}</strong></div>
                <div><span>Gender</span><strong>{patient.gender || "Not entered"}</strong></div>
                <div><span>Language</span><strong>{language}</strong></div>
                <div><span>Mode</span><strong>{mode}</strong></div>
                <div><span>Altitude</span><strong>{altitudeMeters ? `${altitudeMeters} m (${isResident ? 'Resident' : 'Traveler'})` : "Standard Elevation (Unconfigured)"}</strong></div>
                <div><span>Symptoms</span><strong>{symptomList.length ? symptomList.join(", ") : "None reported"}</strong></div>

                {symptomList.includes("Chest discomfort") && (
                  <>
                    <div><span>Site</span><strong>{hpi.site || "—"}</strong></div>
                    <div><span>Onset</span><strong>{hpi.onset || "—"}</strong></div>
                    <div><span>Character</span><strong>{hpi.character || "—"}</strong></div>
                    <div><span>Radiation</span><strong>{hpi.radiation || "—"}</strong></div>
                    <div><span>Associated</span><strong>{hpi.associated || "—"}</strong></div>
                    <div><span>Severity</span><strong>{hpi.severity ? `${hpi.severity}/10` : "—"}</strong></div>
                  </>
                )}

                <div><span>Blood Sugar</span><strong style={{ color: "#0f766e" }}>{vitals.bloodSugar ? `${vitals.bloodSugar} mg/dL` : "Not recorded"}</strong></div>
                <div><span>SpO₂</span><strong>{vitals.spo2 ? `${vitals.spo2}%` : "Not entered"}</strong></div>
                <div><span>Heart rate</span><strong>{vitals.heartRate ? `${vitals.heartRate} bpm` : "Not entered"}</strong></div>
                <div><span>Blood pressure</span><strong>{vitals.bp || "Not entered"}</strong></div>
                <div><span>Document</span><strong>{documentName || "None"}</strong></div>
              </div>
            )}

            {hasRedFlag && (
              <div className="alert-box">
                <strong>Urgent staff review</strong>
                <p>
                  The intake contains a red-flag combination. The kiosk does not
                  diagnose the patient; it requests prompt healthcare staff review.
                </p>
              </div>
            )}

            {submitError && (
              <div className="alert-box" style={{ background: "#fef2f2", border: "1px solid #fca5a5", color: "#b91c1c", marginBottom: "16px" }}>
                <strong>Submission Notice</strong>
                <p>{submitError}</p>
              </div>
            )}

            <button
              className="primary-btn"
              onClick={handleSubmit}
              disabled={isSubmitting}
              style={{ opacity: isSubmitting ? 0.7 : 1, cursor: isSubmitting ? "not-allowed" : "pointer" }}
            >
              {isSubmitting ? "Transmitting to Doctor Console..." : "Send for clinical review ✓"}
            </button>
            <p className="help-text">Decision-support MVP. Illustrative altitude profiles. Raw values preserved. Clinician sign-off required. Pilot validation needed.</p>
            <BackButton target={7} />
          </section>
        )
      )}
      </main>

      {/* NOVA Voice Health Assistant Modal */}
      {showNovaModal && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15, 23, 42, 0.75)",
          backdropFilter: "blur(6px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          padding: "20px"
        }}>
          <div style={{
            background: "#ffffff",
            borderRadius: "20px",
            width: "100%",
            maxWidth: "760px",
            height: "88vh",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
            border: "1px solid #dce5e8"
          }}>
            {/* Modal Header */}
            <div style={{
              padding: "16px 24px",
              background: "#168f91",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "10px",
                  background: "rgba(255, 255, 255, 0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                    <line x1="12" x2="12" y1="19" y2="22"/>
                  </svg>
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 700 }}>NOVA — Health Assistant</h3>
                  <p style={{ margin: 0, fontSize: "12px", opacity: 0.9 }}>Natural Voice Intake • Real-time patient sync</p>
                </div>
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  onClick={() => {
                    setShowNovaModal(false);
                    setStep(8);
                  }}
                  style={{
                    background: "#0d9488",
                    border: "none",
                    color: "#ffffff",
                    padding: "6px 14px",
                    borderRadius: "8px",
                    fontWeight: 700,
                    fontSize: "12px",
                    cursor: "pointer",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.15)"
                  }}
                >
                  📋 View Final Report
                </button>
                <button
                  onClick={() => window.open(`http://${window.location.hostname || 'localhost'}:3000`, "_blank", "width=800,height=900")}
                  style={{
                    background: "rgba(255, 255, 255, 0.2)",
                    border: "none",
                    color: "#ffffff",
                    padding: "6px 12px",
                    borderRadius: "8px",
                    fontWeight: 600,
                    fontSize: "12px",
                    cursor: "pointer"
                  }}
                >
                  ↗ Open Full Window
                </button>
                <button
                  onClick={() => setShowNovaModal(false)}
                  style={{
                    background: "rgba(255, 255, 255, 0.2)",
                    border: "none",
                    color: "#ffffff",
                    padding: "6px 14px",
                    borderRadius: "8px",
                    fontWeight: 700,
                    fontSize: "13px",
                    cursor: "pointer"
                  }}
                >
                  ✕ Close
                </button>
              </div>
            </div>

            {/* Embedded Standalone Nova Assistant App */}
            <iframe
              src={`http://${window.location.hostname || 'localhost'}:3000?step=${step}&session_id=${scannerSessionId}&lang=${encodeURIComponent(language || 'हिन्दी')}`}
              title="NOVA Virtual Health Assistant"
              style={{
                flex: 1,
                width: "100%",
                border: "none",
                background: "#000000"
              }}
              allow="microphone *; camera *; autoplay *; fullscreen *; speech-recognition *"
            />
          </div>
        </div>
      )}

      {/* Floating NOVA Assistant Button — instant help at any step */}
      {!showNovaModal && (
        <button
          type="button"
          onClick={() => setShowNovaModal(true)}
          style={{
            position: "fixed",
            bottom: "28px",
            right: "28px",
            background: "linear-gradient(135deg, #0d9488, #059669)",
            color: "#ffffff",
            border: "2px solid #a7f3d0",
            borderRadius: "50px",
            padding: "12px 22px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            boxShadow: "0 8px 24px rgba(13, 148, 136, 0.45)",
            cursor: "pointer",
            zIndex: 1000,
            fontWeight: 700,
            fontSize: "14px",
            transition: "all 0.25s ease"
          }}
          title={`Need help with Step ${step}? Ask NOVA`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <line x1="12" x2="12" y1="19" y2="22"/>
          </svg>
          <span>Ask NOVA for Help</span>
        </button>
      )}

      <Footer />
    </div>
  );
}

export default App;
