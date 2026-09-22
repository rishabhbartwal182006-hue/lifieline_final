#include <Arduino.h>
#include "esp_camera.h"
#include <WiFi.h>
#include <ESPmDNS.h>

// ============================================================
// LIFELINE 360 — HOME PERSONAL STATION (CAMERA 2)
// Firmware for Patient Home Device ESP32-CAM
// Node 2 in the Hospital-to-Home Continuum of Care
// ============================================================

// ===========================
// Select camera model in board_config.h
// ===========================
#include "board_config.h"

// ===========================
// Enter your WiFi credentials
// ===========================
const char *ssid = "rish";
const char *password = "Wsb12345@";

// ===========================
// STATIC IP — CAMERA 2 (HOME STATION)
// Windows Hotspot gateway: 192.168.137.1
// Hospital Camera 1 uses:  192.168.137.100
// Home Camera 2 uses:      192.168.137.101
// ===========================
IPAddress STATIC_IP (192, 168, 137, 101);   // Home station fixed address
IPAddress GATEWAY   (192, 168, 137,   1);   // Windows hotspot gateway
IPAddress SUBNET    (255, 255, 255,   0);
IPAddress DNS       (192, 168, 137,   1);   // Gateway as DNS

void startCameraServer();
void setupLedFlash();

// ============================================================
// DHT11 TEMPERATURE & HUMIDITY SENSOR DRIVER (GPIO 13)
// 3-Pin Module: VCC -> 3.3V/5V | GND -> GND | DATA/OUT/S -> GPIO 13
// ============================================================
#define DHT11_PIN 13

struct DHTData {
  float temperature = 0.0;
  float humidity = 0.0;
  bool valid = false;
  unsigned long lastReadTime = 0;
};

DHTData g_dhtData;

// Zero-dependency direct bit-bang DHT11 reader
bool readDHT11(float &tempC, float &humidity) {
  uint8_t data[5] = {0, 0, 0, 0, 0};
  
  // 1. Host pulls low for at least 18ms
  pinMode(DHT11_PIN, OUTPUT);
  digitalWrite(DHT11_PIN, LOW);
  delay(20);
  
  // 2. Host pulls high for 30us, switches to input
  digitalWrite(DHT11_PIN, HIGH);
  delayMicroseconds(30);
  pinMode(DHT11_PIN, INPUT_PULLUP);
  
  // Wait for DHT response (low 80us)
  unsigned long timeout = micros();
  while (digitalRead(DHT11_PIN) == HIGH) {
    if (micros() - timeout > 100) return false;
  }
  
  // Wait for DHT to pull high (80us)
  timeout = micros();
  while (digitalRead(DHT11_PIN) == LOW) {
    if (micros() - timeout > 100) return false;
  }
  
  // Wait for DHT to pull low before data transmission begins
  timeout = micros();
  while (digitalRead(DHT11_PIN) == HIGH) {
    if (micros() - timeout > 100) return false;
  }
  
  // 3. Read 40 bits (5 bytes)
  for (int i = 0; i < 40; i++) {
    // 50us low level marks start of each bit
    timeout = micros();
    while (digitalRead(DHT11_PIN) == LOW) {
      if (micros() - timeout > 100) return false;
    }
    
    // High level duration: 26-28us = 0, 70us = 1
    unsigned long pulseStart = micros();
    while (digitalRead(DHT11_PIN) == HIGH) {
      if (micros() - pulseStart > 120) return false;
    }
    unsigned long pulseLen = micros() - pulseStart;
    
    uint8_t byteIdx = i / 8;
    data[byteIdx] <<= 1;
    if (pulseLen > 40) {
      data[byteIdx] |= 1;
    }
  }
  
  // 4. Verify checksum
  if (data[4] == ((data[0] + data[1] + data[2] + data[3]) & 0xFF)) {
    humidity = (float)data[0] + ((float)data[1] * 0.1);
    tempC = (float)data[2] + ((float)data[3] * 0.1);
    return true;
  }
  return false;
}

void updateDHT11() {
  if (millis() - g_dhtData.lastReadTime < 2500) {
    return; // DHT11 minimum polling interval
  }
  float t = 0, h = 0;
  if (readDHT11(t, h)) {
    g_dhtData.temperature = t;
    g_dhtData.humidity = h;
    g_dhtData.valid = true;
  }
  g_dhtData.lastReadTime = millis();
}

void setup() {
  Serial.begin(115200);
  Serial.setDebugOutput(true);
  Serial.println();
  Serial.println("==================================================");
  Serial.println("  LIFELINE 360 — HOME COMPANION VITAL SCANNER     ");
  Serial.println("  Device Type: Node 2 (Home Personal Station)     ");
  Serial.println("==================================================");

  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sccb_sda = SIOD_GPIO_NUM;
  config.pin_sccb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.frame_size = FRAMESIZE_UXGA;
  config.pixel_format = PIXFORMAT_JPEG;
  config.grab_mode = CAMERA_GRAB_WHEN_EMPTY;
  config.fb_location = CAMERA_FB_IN_PSRAM;
  config.jpeg_quality = 12;
  config.fb_count = 1;

  if (config.pixel_format == PIXFORMAT_JPEG) {
    if (psramFound()) {
      config.jpeg_quality = 10;
      config.fb_count = 2;
      config.grab_mode = CAMERA_GRAB_LATEST;
    } else {
      config.frame_size = FRAMESIZE_SVGA;
      config.fb_location = CAMERA_FB_IN_DRAM;
    }
  } else {
    config.frame_size = FRAMESIZE_240X240;
#if CONFIG_IDF_TARGET_ESP32S3
    config.fb_count = 2;
#endif
  }

#if defined(CAMERA_MODEL_ESP_EYE)
  pinMode(13, INPUT_PULLUP);
  pinMode(14, INPUT_PULLUP);
#endif

  // camera init
  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("[ERROR] Camera init failed with error 0x%x\n", err);
    return;
  }

  sensor_t *s = esp_camera_sensor_get();
  if (s->id.PID == OV3660_PID) {
    s->set_vflip(s, 1);
    s->set_brightness(s, 1);
    s->set_saturation(s, -2);
  }
  if (config.pixel_format == PIXFORMAT_JPEG) {
    s->set_framesize(s, FRAMESIZE_QVGA);
  }

#if defined(CAMERA_MODEL_M5STACK_WIDE) || defined(CAMERA_MODEL_M5STACK_ESP32CAM)
  s->set_vflip(s, 1);
  s->set_hmirror(s, 1);
#endif

#if defined(CAMERA_MODEL_ESP32S3_EYE)
  s->set_vflip(s, 1);
#endif

#if defined(LED_GPIO_NUM)
  setupLedFlash();
#endif

  // Indicator LEDs (GPIO 12 for Power/WiFi indicator; GPIO 13 dedicated to DHT11 sensor)
  pinMode(12, OUTPUT);
  digitalWrite(12, LOW);

  WiFi.disconnect(true);
  delay(500);
  WiFi.mode(WIFI_STA);

  if (!WiFi.config(STATIC_IP, GATEWAY, SUBNET, DNS)) {
    Serial.println("WARNING: Static IP config failed — will use DHCP");
  } else {
    Serial.println("Static IP configured: 192.168.137.101 (Home Station)");
  }

  WiFi.begin(ssid, password);
  WiFi.setSleep(false);

  Serial.print("WiFi connecting");
  while (WiFi.status() != WL_CONNECTED) {
    digitalWrite(12, HIGH); delay(250);
    digitalWrite(12, LOW);  delay(250);
    Serial.print(".");
  }

  digitalWrite(12, HIGH); // Solid ON when ready
  Serial.println("");
  Serial.println("==================================================");
  Serial.print  ("  Home Cam IP Address : http://");
  Serial.println(WiFi.localIP());
  if (WiFi.localIP() == STATIC_IP) {
    Serial.println("  [OK] Static IP 192.168.137.101 active!");
  } else {
    Serial.println("  [!] DHCP assigned alternative IP.");
  }

  // Setup mDNS responder: http://home-vitals-cam.local
  if (MDNS.begin("home-vitals-cam")) {
    Serial.println("  [OK] mDNS responder started: http://home-vitals-cam.local");
  }

  // Initial DHT11 probe
  pinMode(DHT11_PIN, INPUT_PULLUP);
  float initT = 0, initH = 0;
  if (readDHT11(initT, initH)) {
    g_dhtData.temperature = initT;
    g_dhtData.humidity = initH;
    g_dhtData.valid = true;
    Serial.printf("  [OK] DHT11 Online on GPIO %d: %.1f C, %.1f %% RH\n", DHT11_PIN, initT, initH);
  } else {
    Serial.printf("  [NOTE] DHT11 on GPIO %d ready (awaiting first reading)\n", DHT11_PIN);
  }
  Serial.println("==================================================");

  startCameraServer();

  Serial.print("Home Camera Ready! Open: http://");
  Serial.print(WiFi.localIP());
  Serial.println("/capture");
  Serial.println("Room Environment Stream: http://192.168.137.101/environment");
}

void loop() {
  updateDHT11();
  if (g_dhtData.valid) {
    Serial.printf("[HOME CAM ALIVE] http://%s/capture | Real DHT11 Temp: %.1f C | Hum: %.1f %%\n",
                  WiFi.localIP().toString().c_str(), g_dhtData.temperature, g_dhtData.humidity);
  } else {
    Serial.printf("[HOME CAM ALIVE] http://%s/capture | DHT11 awaiting live pulse on GPIO %d\n",
                  WiFi.localIP().toString().c_str(), DHT11_PIN);
  }
  delay(5000);
}
