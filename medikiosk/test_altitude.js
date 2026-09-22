const assert = require('assert');
const { interpretVitals } = require('./services/altitudeAdjustmentService');

function context(vitals, altitudeMeters, symptoms = []) {
  return interpretVitals(vitals, { altitudeMeters, altitudeSource: 'staff_manual' }, symptoms);
}
function vital(result, type) { return result.find(v => v.type === type); }

const seaSpO2 = vital(context([{ type: 'spo2', value: 88, unit: '%'}], 0), 'spo2');
assert.equal(seaSpO2.status, 'critical', 'sea level SpO2 88 no symptoms -> critical');

const highSymptoms = context([{ type: 'spo2', value: 88, unit: '%' }], 2438, ['chest tightness']);
assert.equal(vital(highSymptoms, 'spo2').status, 'critical', '2438m SpO2 88 with chest tightness -> red flag');

const highNoSymptoms = context([{ type: 'spo2', value: 88, unit: '%' }], 2438);
assert.equal(vital(highNoSymptoms, 'spo2').status, 'borderline', '2438m SpO2 88 no symptoms -> borderline');

const bp = context([{ type: 'bp_systolic', value: 120, unit: 'mmHg' }, { type: 'bp_diastolic', value: 80, unit: 'mmHg' }], 2438);
assert.equal(vital(bp, 'bp_systolic').status, 'normal', '2438m BP 120/80 systolic -> normal');
assert.equal(vital(bp, 'bp_diastolic').status, 'normal', '2438m BP 120/80 diastolic -> normal');

const glucose2438 = vital(context([{ type: 'blood_glucose', value: 110, unit: 'mg/dL' }], 2438), 'blood_glucose');
assert.equal(glucose2438.status, 'normal', '2438m glucose 110 -> status normal');
assert.strictEqual(glucose2438.cautionNote, null, '2438m glucose 110 -> cautionNote = null');

const glucose2600 = vital(context([{ type: 'blood_glucose', value: 110, unit: 'mg/dL' }], 2600), 'blood_glucose');
assert.equal(glucose2600.status, 'caution', '2600m glucose 110 -> caution');
assert.ok(glucose2600.cautionNote, '2600m glucose 110 -> caution note present');

const glucoseLow = vital(context([{ type: 'blood_glucose', value: 45, unit: 'mg/dL' }], 2438), 'blood_glucose');
assert.equal(glucoseLow.status, 'critical', '2438m glucose 45 -> standard critical low');

console.log('test_altitude.js: all 9 assertions passed');
