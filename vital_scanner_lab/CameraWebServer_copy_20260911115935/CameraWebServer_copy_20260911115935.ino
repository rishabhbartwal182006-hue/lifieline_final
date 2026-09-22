#include <Arduino.h>
#include "esp_camera.h"
#include <WiFi.h>

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
// STATIC IP — ESP32 always boots at this address
// Windows Hotspot gateway is ALWAYS 192.168.137.1
// Change STATIC_IP last digit if there's a conflict (use .100-.200 range)
// ===========================
IPAddress STATIC_IP (192, 168, 137, 100);   // ESP32 fixed address
IPAddress GATEWAY   (192, 168, 137,   1);   // Windows hotspot — never changes
IPAddress SUBNET    (255, 255, 255,   0);
IPAddress DNS       (192, 168, 137,   1);   // use gateway as DNS too

void startCameraServer();
void setupLedFlash();

void setup() {
  Serial.begin(115200);
  Serial.setDebugOutput(true);
  Serial.println();

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
  config.pixel_format = PIXFORMAT_JPEG;  // for streaming
  //config.pixel_format = PIXFORMAT_RGB565; // for face detection/recognition
  config.grab_mode = CAMERA_GRAB_WHEN_EMPTY;
  config.fb_location = CAMERA_FB_IN_PSRAM;
  config.jpeg_quality = 12;
  config.fb_count = 1;

  // if PSRAM IC present, init with UXGA resolution and higher JPEG quality
  //                      for larger pre-allocated frame buffer.
  if (config.pixel_format == PIXFORMAT_JPEG) {
    if (psramFound()) {
      config.jpeg_quality = 10;
      config.fb_count = 2;
      config.grab_mode = CAMERA_GRAB_LATEST;
    } else {
      // Limit the frame size when PSRAM is not available
      config.frame_size = FRAMESIZE_SVGA;
      config.fb_location = CAMERA_FB_IN_DRAM;
    }
  } else {
    // Best option for face detection/recognition
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
    Serial.printf("Camera init failed with error 0x%x", err);
    return;
  }

  sensor_t *s = esp_camera_sensor_get();
  // initial sensors are flipped vertically and colors are a bit saturated
  if (s->id.PID == OV3660_PID) {
    s->set_vflip(s, 1);        // flip it back
    s->set_brightness(s, 1);   // up the brightness just a bit
    s->set_saturation(s, -2);  // lower the saturation
  }
  // drop down frame size for higher initial frame rate
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

// Setup LED FLash if LED pin is defined in camera_pins.h
#if defined(LED_GPIO_NUM)
  setupLedFlash();
#endif

  // ── MediKiosk LED setup ────────────────────────────────────
  // Blue LED (GPIO 12): blinks while connecting, solid ON when ready
  // Red  LED (GPIO 13): controlled in app_httpd.cpp on capture
  pinMode(12, OUTPUT);
  pinMode(13, OUTPUT);
  digitalWrite(12, LOW);   // OFF until WiFi ready
  digitalWrite(13, LOW);   // OFF at startup

  // ── Force forget old saved WiFi networks ──────────────────
  // This ensures ESP32 only connects to YOUR hotspot
  WiFi.disconnect(true);
  delay(500);
  WiFi.mode(WIFI_STA);

  // ── Apply Static IP (MUST be before WiFi.begin) ───────────
  // All 4 args required: IP, gateway, subnet, DNS
  // Without DNS arg, static IP silently falls back to DHCP!
  if (!WiFi.config(STATIC_IP, GATEWAY, SUBNET, DNS)) {
    Serial.println("WARNING: Static IP config failed — will use DHCP");
  } else {
    Serial.println("Static IP configured: 192.168.137.100");
  }

  WiFi.begin(ssid, password);
  WiFi.setSleep(false);

  // Blue LED blinks while waiting for WiFi
  Serial.print("WiFi connecting");
  while (WiFi.status() != WL_CONNECTED) {
    digitalWrite(12, HIGH); delay(250);
    digitalWrite(12, LOW);  delay(250);
    Serial.print(".");
  }

  // Blue LED stays ON solid = WiFi + server ready
  digitalWrite(12, HIGH);
  Serial.println("");
  Serial.println("========================================");
  Serial.print  ("  IP Address : http://");
  Serial.println(WiFi.localIP());
  if (WiFi.localIP() == STATIC_IP) {
    Serial.println("  [OK] Static IP confirmed! Will be same every boot.");
  } else {
    Serial.println("  [!] Got different IP — check gateway setting.");
    Serial.print  ("  Expected: "); Serial.println(STATIC_IP);
  }
  Serial.println("========================================");

  startCameraServer();

  Serial.print("Camera Ready! Open: http://");
  Serial.print(WiFi.localIP());
  Serial.println("/capture");
  Serial.println("IP repeats every 5s below:");
}

void loop() {
  // Print IP every 5 seconds
  Serial.print("[ALIVE] http://");
  Serial.print(WiFi.localIP());
  Serial.println("/capture   <- should always be 192.168.137.100");
  delay(5000);
}
