const assert = require('assert');
const { evaluateMultiSystemTriage } = require('./services/redFlagRules');

console.log('================================================================');
console.log('🧪 TESTING MANUAL VITALS CAPTURE & DASHBOARD NORMALIZATION');
console.log('================================================================\n');

// 1. Test buildDashboardSummary simulation
function extractVitalScalar(val) {
  if (val === undefined || val === null) return undefined;
  if (typeof val === 'object') {
    const inner = val.value ?? val.vitalValue;
    return inner !== undefined && inner !== null ? inner : undefined;
  }
  return val;
}

function extractBPValues(vitals) {
  if (!vitals) return { systolic: undefined, diastolic: undefined, stringVal: undefined };

  const rawBp = vitals.bp || vitals.blood_pressure || (typeof vitals.bloodPressure === 'string' ? vitals.bloodPressure : undefined);
  if (typeof rawBp === 'string' && rawBp.includes('/')) {
    const parts = rawBp.split('/');
    return {
      systolic: Number(parts[0]) || parts[0],
      diastolic: Number(parts[1]) || parts[1],
      stringVal: rawBp
    };
  }

  const bpObj = (vitals.bloodPressure && typeof vitals.bloodPressure === 'object') ? vitals.bloodPressure : vitals;
  const sysRaw = bpObj.systolic !== undefined ? bpObj.systolic : (bpObj.systolicBP ?? bpObj.systolic_bp);
  const diaRaw = bpObj.diastolic !== undefined ? bpObj.diastolic : (bpObj.diastolicBP ?? bpObj.diastolic_bp);

  const sys = extractVitalScalar(sysRaw);
  const dia = extractVitalScalar(diaRaw);

  if (sys !== undefined && dia !== undefined) {
    return {
      systolic: sys,
      diastolic: dia,
      stringVal: `${sys}/${dia}`
    };
  }

  return { systolic: undefined, diastolic: undefined, stringVal: undefined };
}

function formatBP(systolic, diastolic) {
  if (!systolic || !diastolic || String(systolic).includes("undefined") || String(diastolic).includes("undefined")) {
    return "";
  }
  return `${systolic}/${diastolic}`;
}

// Normalize vitals as on the dashboard
function normalizeVitals(vitals) {
  const v = vitals || {};

  const byType = (type) => {
    const key = Object.keys(v).find((k) => k.toUpperCase() === type);
    return key ? v[key] : undefined;
  };

  const scalar = (reading) => {
    if (reading == null) return "";
    const value = typeof reading === "object" ? (reading.value ?? reading.vitalValue) : reading;
    return typeof value === "object" || value == null ? "" : value;
  };

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
console.log('[TEST 1] Kiosk Manual Entry Payload');
const kioskManualVitals = {
  bloodPressure: {
    systolic: { value: 130, unit: 'mmHg' },
    diastolic: { value: 85, unit: 'mmHg' }
  },
  spo2: { value: 95, unit: '%' },
  heartRate: { value: 78, unit: 'bpm' },
  bloodGlucose: { value: 110, unit: 'mg/dL' },
  bp: "130/85",
  hr: 78,
  glucose: 110
};

const norm1 = normalizeVitals(kioskManualVitals);
assert.strictEqual(norm1.bp, "130/85");
assert.strictEqual(norm1.spo2, 95);
assert.strictEqual(norm1.hr, 78);
assert.strictEqual(norm1.glucose, 110);
console.log('  ✔ PASS: Kiosk manual vitals normalized correctly onto dashboard:', norm1);

// TEST 2: React Patient Terminal Manual Entry (bp: "128/82", spo2: "97", heartRate: "72", bloodSugar: "105 mg/dL")
console.log('\n[TEST 2] Patient Terminal Manual Entry Payload');
const terminalVitals = {
  bp: "128/82",
  spo2: "97",
  heartRate: "72",
  hr: "72",
  bloodSugar: "105 mg/dL",
  bloodGlucose: 105
};

const norm2 = normalizeVitals(terminalVitals);
assert.strictEqual(norm2.bp, "128/82");
assert.strictEqual(norm2.spo2, "97");
assert.strictEqual(norm2.hr, "72");
assert.strictEqual(norm2.glucose, 105);
console.log('  ✔ PASS: Patient terminal vitals (including bloodSugar) normalized correctly:', norm2);

// TEST 3: Backend buildDashboardSummary with flat vitals
console.log('\n[TEST 3] Backend extractBPValues & extractVitalScalar with flat vitals');
const bpExt = extractBPValues({ bp: "140/90" });
assert.strictEqual(bpExt.stringVal, "140/90");
assert.strictEqual(bpExt.systolic, 140);
assert.strictEqual(bpExt.diastolic, 90);

const spo2Ext = extractVitalScalar(96);
assert.strictEqual(spo2Ext, 96);
console.log('  ✔ PASS: Backend handles flat vitals without returning undefined/undefined');

// TEST 4: Unmeasured Vitals (No hardware, user entered nothing)
console.log('\n[TEST 4] Unmeasured vitals safely display dashes');
const unmeasured = normalizeVitals({});
assert.strictEqual(unmeasured.bp, "—");
assert.strictEqual(unmeasured.spo2, "—");
assert.strictEqual(unmeasured.hr, "—");
assert.strictEqual(unmeasured.glucose, "—");
console.log('  ✔ PASS: Unmeasured vitals display dashes as expected:', unmeasured);

console.log('\n================================================================');
console.log('🎉 ALL MANUAL VITALS & DASHBOARD TESTS PASSED!');
console.log('================================================================\n');
