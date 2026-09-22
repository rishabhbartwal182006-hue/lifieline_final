#include <Arduino.h>
#include <WiFi.h>
#include <WebServer.h>
#include <ESPmDNS.h>
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"

// ============================================================
// LIFELINE 360 — HOSPITAL KIOSK MOTORIZED DOOR CONTROLLER
// Node 3 in the Healthcare Continuum
// Hardware: Standard ESP32 DevKit (Non-Camera) + Servo Motor
// ============================================================

// ===========================
// Wi-Fi Credentials
// ===========================
const char *ssid     = "rish";
const char *password = "Wsb12345@";

// ===========================
// STATIC IP CONFIGURATION
// Node 1 (Hospital Cam) : 192.168.137.100
// Node 2 (Home Station) : 192.168.137.101
// Node 3 (Door Servo)   : 192.168.137.102
// ===========================
IPAddress STATIC_IP (192, 168, 137, 102);
IPAddress GATEWAY   (192, 168, 137,   1);
IPAddress SUBNET    (255, 255, 255,   0);
IPAddress DNS       (192, 168, 137,   1);

// ============================================================
// SERVO PIN CONFIGURATION
// Configured for GPIO 2 (Pin D2)
// Wiring:
//   - Orange/Yellow (Signal) -> GPIO 2 (Pin D2)
//   - Red (VCC)              -> 5V / VIN (Do not use 3.3V)
//   - Brown/Black (GND)      -> GND (Common ground with ESP32)
// ============================================================
#define SERVO_PIN 2

// Target Angles (User Specified)
#define ANGLE_OPEN   180  // Door fully opened to diagnostic bay
#define ANGLE_CLOSED 6    // Door sealed/closed

// Pulse Width Calibration for 50Hz (20ms period) Servo
// 500us = 0 deg, 1500us = 90 deg, 2500us = 180 deg
#define PWM_FREQ 50
#define PWM_RESOLUTION 16 // 16-bit timer: 0..65535
#define PWM_CHANNEL 0

// Current state
int currentAngle = ANGLE_CLOSED;
bool isDoorOpen  = false;
bool isMoving    = false;

WebServer server(80);

// Universal PWM driver supporting both ESP32 Arduino Core 2.x and Core 3.x
void initServoPWM() {
  pinMode(SERVO_PIN, OUTPUT);
#if defined(ESP_ARDUINO_VERSION) && ESP_ARDUINO_VERSION >= ESP_ARDUINO_VERSION_VAL(3, 0, 0)
  ledcAttach(SERVO_PIN, PWM_FREQ, PWM_RESOLUTION);
#else
  ledcSetup(PWM_CHANNEL, PWM_FREQ, PWM_RESOLUTION);
  ledcAttachPin(SERVO_PIN, PWM_CHANNEL);
#endif
}

// Convert angle (0..180) to 16-bit duty cycle for 50Hz PWM
uint32_t angleToDuty(int angle) {
  if (angle < 0) angle = 0;
  if (angle > 180) angle = 180;
  
  // Standard microsecond pulse mapping (500us to 2500us)
  float pulseUs = 500.0 + ((float)angle / 180.0) * 2000.0;
  
  // 50Hz period = 20,000us. 16-bit max = 65535
  uint32_t duty = (uint32_t)((pulseUs / 20000.0) * 65535.0);
  return duty;
}

void applyServoDuty(uint32_t duty) {
#if defined(ESP_ARDUINO_VERSION) && ESP_ARDUINO_VERSION >= ESP_ARDUINO_VERSION_VAL(3, 0, 0)
  ledcWrite(SERVO_PIN, duty);
#else
  ledcWrite(PWM_CHANNEL, duty);
#endif
}

// ============================================================
// SMOOTH MOTION ENGINE
// Incremental stepping with configurable delay prevents violent jerks
// and protects gear teeth from inrush current stress
// ============================================================
void smoothMove(int targetAngle, int stepDelayMs = 15) {
  if (targetAngle < 0) targetAngle = 0;
  if (targetAngle > 180) targetAngle = 180;
  
  if (currentAngle == targetAngle) {
    Serial.printf("[SERVO] Already at %d deg. Skipping redundant motion.\n", targetAngle);
    return;
  }

  isMoving = true;
  Serial.printf("[SERVO] Moving smoothly from %d deg to %d deg (delay: %dms)...\n",
                currentAngle, targetAngle, stepDelayMs);

  int step = (targetAngle > currentAngle) ? 1 : -1;

  while (currentAngle != targetAngle) {
    currentAngle += step;
    applyServoDuty(angleToDuty(currentAngle));
    delay(stepDelayMs);
  }

  isDoorOpen = (currentAngle == ANGLE_OPEN);
  isMoving   = false;
  Serial.printf("[SERVO] Motion complete. Current Angle: %d deg | Status: %s\n",
                currentAngle, isDoorOpen ? "OPEN" : "CLOSED");
}

// ============================================================
// HTTP REST ENDPOINTS
// ============================================================

void handleCORS() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
}

void handleRoot() {
  handleCORS();
  String html = "<!DOCTYPE html><html><head><meta name='viewport' content='width=device-width, initial-scale=1'>";
  html += "<title>Hospital Kiosk Door Controller</title>";
  html += "<style>body{font-family:sans-serif;text-align:center;padding:30px;background:#f8fafc;}";
  html += ".btn{display:inline-block;padding:14px 28px;margin:10px;font-size:18px;font-weight:bold;border-radius:12px;text-decoration:none;color:white;}";
  html += ".open{background:#10b981;}.close{background:#ef4444;}";
  html += ".card{background:white;max-width:400px;margin:auto;padding:24px;border-radius:20px;box-shadow:0 10px 25px rgba(0,0,0,0.08);}</style></head>";
  html += "<body><div class='card'><h2>Hospital Kiosk Door</h2>";
  html += "<p>Status: <b>" + String(isDoorOpen ? "OPEN (180&deg;)" : "CLOSED (6&deg;)") + "</b></p>";
  html += "<p>Pin: <b>GPIO " + String(SERVO_PIN) + "</b></p>";
  html += "<a href='/door/open' class='btn open'>Open Door (180&deg;)</a><br>";
  html += "<a href='/door/close' class='btn close'>Close Door (6&deg;)</a></div></body></html>";
  server.send(200, "text/html", html);
}

void handleDoorOpen() {
  handleCORS();
  Serial.println("[HTTP] Command received: OPEN DOOR");
  String json = "{\"success\":true,\"status\":\"open\",\"angle\":" + String(ANGLE_OPEN) + 
                ",\"device_id\":\"LIFELINE-KIOSK-DOOR-01\",\"gpio\":" + String(SERVO_PIN) + "}";
  server.send(200, "application/json", json); // Send HTTP response immediately so client doesn't time out!
  smoothMove(ANGLE_OPEN, 12);                  // Smooth sweep to 180 deg
}

void handleDoorClose() {
  handleCORS();
  Serial.println("[HTTP] Command received: CLOSE DOOR");
  String json = "{\"success\":true,\"status\":\"closed\",\"angle\":" + String(ANGLE_CLOSED) + 
                ",\"device_id\":\"LIFELINE-KIOSK-DOOR-01\",\"gpio\":" + String(SERVO_PIN) + "}";
  server.send(200, "application/json", json); // Send HTTP response immediately!
  smoothMove(ANGLE_CLOSED, 12);                // Smooth sweep to 6 deg
}

void handleDoorStatus() {
  handleCORS();
  String json = "{\"success\":true,\"status\":\"" + String(isDoorOpen ? "open" : "closed") + "\"" +
                ",\"angle\":" + String(currentAngle) +
                ",\"is_moving\":" + String(isMoving ? "true" : "false") +
                ",\"device_id\":\"LIFELINE-KIOSK-DOOR-01\"" +
                ",\"gpio\":" + String(SERVO_PIN) + "}";
  server.send(200, "application/json", json);
}

void setup() {
  // Disable brownout detector to prevent restart loops under servo motor load
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);

  Serial.begin(115200);
  Serial.println();
  Serial.println("==================================================");
  Serial.println("  LIFELINE 360 — HOSPITAL KIOSK DOOR CONTROLLER   ");
  Serial.println("  Node 3 (Motorized Servo Bay Access)             ");
  Serial.println("==================================================");
  Serial.printf("  [PIN] Servo Signal Pin configured: GPIO %d\n", SERVO_PIN);

  // Initialize hardware PWM
  initServoPWM();
  
  // Power-on default posture: Closed at 6 degrees quietly (no unwanted sweep)
  Serial.println("[INIT] Initializing servo quietly to CLOSED position (6 deg)...");
  applyServoDuty(angleToDuty(ANGLE_CLOSED));
  currentAngle = ANGLE_CLOSED;
  isDoorOpen   = false;

  // Wi-Fi Connection
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.persistent(true);
  WiFi.config(STATIC_IP, GATEWAY, SUBNET, DNS);
  WiFi.begin(ssid, password);

  Serial.print("[WIFI] Connecting to hotspot: ");
  Serial.println(ssid);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 25) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("  [OK] Connected! IP Address: http://");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("  [!] Wi-Fi connection timed out. Will auto-retry in background.");
  }

  // Setup mDNS: http://kiosk-door.local
  if (MDNS.begin("kiosk-door")) {
    Serial.println("  [OK] mDNS started: http://kiosk-door.local");
  }

  // Register HTTP Routes
  server.on("/", HTTP_GET, handleRoot);
  server.on("/door/open", HTTP_GET, handleDoorOpen);
  server.on("/door/open", HTTP_POST, handleDoorOpen);
  server.on("/door/close", HTTP_GET, handleDoorClose);
  server.on("/door/close", HTTP_POST, handleDoorClose);
  server.on("/door/status", HTTP_GET, handleDoorStatus);

  server.begin();
  Serial.println("[HTTP] Door Controller REST server online on port 80");
  Serial.println("==================================================");
}

unsigned long lastWifiCheck = 0;
void loop() {
  server.handleClient();
  
  // Auto-reconnect Wi-Fi in background if connection drops
  if (millis() - lastWifiCheck > 5000) {
    lastWifiCheck = millis();
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("[WIFI] Connection lost. Attempting auto-reconnect...");
      WiFi.reconnect();
    }
  }
  delay(2);
}
