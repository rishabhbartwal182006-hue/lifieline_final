/**
 * test_door_controller.js
 * Verification of ESP32 Kiosk Door Controller REST proxy & Socket.IO integration
 */

const http = require('http');
const express = require('express');

// Set mock Door Controller port
const mockDoorPort = 19102;
process.env.DOOR_CONTROLLER_IP = `127.0.0.1:${mockDoorPort}`;

const kioskRouter = require('./routes/kioskRoutes');

async function runTests() {
  console.log('🧪 Starting Hospital Kiosk Door Controller Tests...\n');

  let currentAngle = 6; // Default closed (6 deg)
  let isDoorOpen = false;

  // 1. Setup Mock Door Controller HTTP server
  const mockDoorServer = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    if (req.url === '/door/open') {
      currentAngle = 180;
      isDoorOpen = true;
      res.end(JSON.stringify({
        success: true,
        status: 'open',
        angle: 180,
        device_id: 'LIFELINE-KIOSK-DOOR-01'
      }));
    } else if (req.url === '/door/close') {
      currentAngle = 6;
      isDoorOpen = false;
      res.end(JSON.stringify({
        success: true,
        status: 'closed',
        angle: 6,
        device_id: 'LIFELINE-KIOSK-DOOR-01'
      }));
    } else if (req.url === '/door/status') {
      res.end(JSON.stringify({
        success: true,
        status: isDoorOpen ? 'open' : 'closed',
        angle: currentAngle,
        is_moving: false,
        device_id: 'LIFELINE-KIOSK-DOOR-01',
        gpio: 18
      }));
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  await new Promise(resolve => mockDoorServer.listen(mockDoorPort, resolve));
  console.log(`[PASS] Mock ESP32 Door Controller running on port ${mockDoorPort}`);

  // Setup Express test app
  const app = express();
  app.use(express.json());

  let emittedEvents = [];
  app.set('io', {
    emit: (event, payload) => {
      emittedEvents.push({ event, payload });
    }
  });

  app.use('/api/v1/kiosk', kioskRouter);

  const testServerPort = 4056;
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(testServerPort, resolve));
  console.log(`[PASS] Test Express server running on port ${testServerPort}`);

  // Test 1: Open Door
  console.log('\n--- Test 1: Command Open Door (Angle 180°) ---');
  const res1 = await fetch(`http://127.0.0.1:${testServerPort}/api/v1/kiosk/door/open`, { method: 'POST' });
  const data1 = await res1.json();
  console.log('Open Door Response:', data1);
  if (data1.success && data1.online && data1.status === 'open' && data1.angle === 180) {
    console.log('✅ Test 1 PASSED: Door successfully commanded to OPEN (180 deg)');
  } else {
    console.error('❌ Test 1 FAILED');
    process.exit(1);
  }

  // Test 2: Verify Socket.IO broadcast
  console.log('\n--- Test 2: Socket.IO kiosk:door_state Event ---');
  const doorEvent = emittedEvents.find(e => e.event === 'kiosk:door_state');
  if (doorEvent && doorEvent.payload.status === 'open' && doorEvent.payload.angle === 180) {
    console.log('✅ Test 2 PASSED: Socket.IO kiosk:door_state broadcast verified');
  } else {
    console.error('❌ Test 2 FAILED');
    process.exit(1);
  }

  // Test 3: Close Door
  console.log('\n--- Test 3: Command Close Door (Angle 6°) ---');
  const res3 = await fetch(`http://127.0.0.1:${testServerPort}/api/v1/kiosk/door/close`, { method: 'POST' });
  const data3 = await res3.json();
  console.log('Close Door Response:', data3);
  if (data3.success && data3.online && data3.status === 'closed' && data3.angle === 6) {
    console.log('✅ Test 3 PASSED: Door successfully commanded to CLOSE (6 deg)');
  } else {
    console.error('❌ Test 3 FAILED');
    process.exit(1);
  }

  // Test 4: Query Door Status
  console.log('\n--- Test 4: Query Door Status ---');
  const res4 = await fetch(`http://127.0.0.1:${testServerPort}/api/v1/kiosk/door/status`);
  const data4 = await res4.json();
  console.log('Door Status Response:', data4);
  if (data4.success && data4.online && data4.status === 'closed' && data4.angle === 6) {
    console.log('✅ Test 4 PASSED: Door status query returned accurate state');
  } else {
    console.error('❌ Test 4 FAILED');
    process.exit(1);
  }

  // Test 5: Offline handling when Door ESP32 is powered off
  console.log('\n--- Test 5: Graceful Handling when Door Controller is Offline ---');
  process.env.DOOR_CONTROLLER_IP = '127.0.0.1:19998'; // Unreachable
  const res5 = await fetch(`http://127.0.0.1:${testServerPort}/api/v1/kiosk/door/open`, { method: 'POST' });
  const data5 = await res5.json();
  console.log('Offline Fallback Response:', data5);
  if (data5.success && data5.online === false && data5.status === 'offline') {
    console.log('✅ Test 5 PASSED: Handled offline door controller without crashing');
  } else {
    console.error('❌ Test 5 FAILED');
    process.exit(1);
  }

  // Cleanup
  await new Promise(resolve => mockDoorServer.close(resolve));
  await new Promise(resolve => server.close(resolve));

  console.log('\n======================================================');
  console.log('🎉 ALL KIOSK DOOR CONTROLLER TESTS PASSED SUCCESSFULLY!');
  console.log('======================================================\n');
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
