/* Usage: node demo/load_scenario.js <session-id> [scenario-index]
 * Requires a valid bearer token in DEMO_BEARER_TOKEN and a running API server.
 */
const fs = require('fs');
const path = require('path');

const sessionId = process.argv[2];
const index = Number(process.argv[3] || 0);
if (!sessionId) throw new Error('Usage: node demo/load_scenario.js <session-id> [scenario-index]');

const scenarios = JSON.parse(fs.readFileSync(path.join(__dirname, 'altitude_scenarios.json'), 'utf8'));
const scenario = scenarios[index];
if (!scenario) throw new Error(`Scenario ${index} was not found.`);
const baseUrl = process.env.DEMO_API_URL || 'http://localhost:3000/api/v1';
const token = process.env.DEMO_BEARER_TOKEN;
if (!token) throw new Error('Set DEMO_BEARER_TOKEN before loading a scenario.');

async function request(url, options) {
  const response = await fetch(url, {
    ...options,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(options.headers || {}) }
  });
  if (!response.ok) throw new Error(`${response.status}: ${await response.text()}`);
  return response.json();
}

(async () => {
  await request(`${baseUrl}/sessions/${encodeURIComponent(sessionId)}/environment`, { method: 'POST', body: JSON.stringify(scenario.environment) });
  for (const vital of scenario.vitals) {
    await request(`${baseUrl}/sessions/${encodeURIComponent(sessionId)}/vitals`, {
      method: 'POST', body: JSON.stringify({ ...vital, source: 'staff_manual_entry' })
    });
  }
  const interpreted = await request(`${baseUrl}/sessions/${encodeURIComponent(sessionId)}/vitals/interpreted`, { method: 'GET' });
  console.log(JSON.stringify({ scenario: scenario.name, interpreted }, null, 2));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
