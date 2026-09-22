/**
 * test_dht11_environment.js
 * Verification of DHT11 Temperature & Humidity Ingestion on Node 2 Home Care Station
 */

const http = require('http');
const express = require('express');
const { router: homeCareRouter, remotePatientsStore } = require('./routes/homeCareRoutes');

async function runTests() {
  console.log('🧪 Starting DHT11 Environment Integration Tests...\n');

  // 1. Setup mock ESP32-CAM HTTP server on 192.168.137.101 simulator port
  let espCalled = false;
  const mockEspPort = 19101;
  const mockEspServer = http.createServer((req, res) => {
    if (req.url === '/environment') {
      espCalled = true;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        temperature_c: 25.4,
        temperature_f: 77.7,
        humidity_pct: 54.0,
        sensor_online: true,
        sensor_type: 'DHT11',
        gpio: 13,
        device_id: 'LIFELINE-HOME-NODE-02'
      }));
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  await new Promise(resolve => mockEspServer.listen(mockEspPort, resolve));
  console.log(`[PASS] Mock ESP32-CAM server running on port ${mockEspPort}`);

  // Setup express test app
  const app = express();
  app.use(express.json());

  // Mock Socket.IO
  let emittedEvents = [];
  app.set('io', {
    emit: (event, payload) => {
      emittedEvents.push({ event, payload });
    }
  });

  app.use('/api/v1/patient', homeCareRouter);
  app.use('/api/v1', homeCareRouter);

  const server = http.createServer(app);
  const testPort = 4055;
  await new Promise(resolve => server.listen(testPort, resolve));
  console.log(`[PASS] Test Express server running on port ${testPort}`);

  // Test 1: Fetch when deviceIP is pointed to mock ESP
  const patient = remotePatientsStore.get('PT-HOME-01');
  const originalIP = patient.deviceIP;
  patient.deviceIP = `127.0.0.1:${mockEspPort}`;

  const res1 = await fetch(`http://127.0.0.1:${testPort}/api/v1/patient/PT-HOME-01/environment`);
  const data1 = await res1.json();

  console.log('\n--- Test 1: Active DHT11 Sensor Reading ---');
  console.log('Response:', data1);
  if (data1.success && data1.online && data1.temperature_c === 25.4 && data1.humidity_pct === 54.0) {
    console.log('✅ Test 1 PASSED: Real-time temperature (25.4°C) & humidity (54%) successfully parsed from GPIO 13');
  } else {
    console.error('❌ Test 1 FAILED');
    process.exit(1);
  }

  // Test 2: Socket.IO emission
  console.log('\n--- Test 2: Socket.IO rpm:environment_sync Event ---');
  const syncEvent = emittedEvents.find(e => e.event === 'rpm:environment_sync');
  if (syncEvent && syncEvent.payload.patientId === 'PT-HOME-01' && syncEvent.payload.environment.temperature_c === 25.4) {
    console.log('✅ Test 2 PASSED: Socket.IO rpm:environment_sync broadcast verified');
  } else {
    console.error('❌ Test 2 FAILED');
    process.exit(1);
  }

  // Test 3: Doctor remote-patients list includes environment
  console.log('\n--- Test 3: Doctor Command Center Telemetry ---');
  const res3 = await fetch(`http://127.0.0.1:${testPort}/api/v1/doctor/remote-patients`);
  const data3 = await res3.json();
  const docPatient = data3.remotePatients.find(p => p.patientId === 'PT-HOME-01');
  if (docPatient && docPatient.environment && docPatient.environment.temperature_c === 25.4) {
    console.log('✅ Test 3 PASSED: Doctor command center receives ambient DHT11 telemetry');
  } else {
    console.error('❌ Test 3 FAILED: docPatient environment missing', docPatient);
    process.exit(1);
  }

  // Test 4: Offline fallback handling - strictly null values (no hardcoded fake data)
  console.log('\n--- Test 4: Sensor Offline Graceful Fallback (No Hardcoded Numbers) ---');
  patient.deviceIP = '127.0.0.1:19999'; // unreachable port
  const res4 = await fetch(`http://127.0.0.1:${testPort}/api/v1/patient/PT-HOME-01/environment`);
  const data4 = await res4.json();
  console.log('Offline Response:', data4);
  if (data4.success && data4.online === false && data4.temperature_c === null && data4.humidity_pct === null) {
    console.log('✅ Test 4 PASSED: Graceful offline handling with strictly null temperature and humidity (0 fake data)');
  } else {
    console.error('❌ Test 4 FAILED: Hardcoded fake data was returned!', data4);
    process.exit(1);
  }

  // Cleanup
  patient.deviceIP = originalIP;
  await new Promise(resolve => mockEspServer.close(resolve));
  await new Promise(resolve => server.close(resolve));

  console.log('\n=============================================');
  console.log('🎉 ALL DHT11 SENSOR INTEGRATION TESTS PASSED!');
  console.log('=============================================\n');
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
