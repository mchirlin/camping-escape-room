// =============================================================================
// Interactive Test — Continuous Input→Output Loop + WiFi Web Control
// =============================================================================
//
// Purpose: Continuously monitor inputs and produce immediate outputs on repeat.
//   - Capacitive touch → vibration motor (while touching), servo (on release)
//   - RFID tag detected → NeoPixel color (ROYGBIV by slot) + play a sound
//   - WiFi AP mode with web UI for remote control and status monitoring
//
// Hardware (same crafting table setup):
//   - ESP32 DevKit v1
//   - 2x PCA9548A I2C multiplexers (0x70, 0x71)
//   - 9x PN532 NFC readers (one per grid slot)
//   - 9x WS2812B NeoPixel 24-LED rings (daisy-chained)
//   - 1x DFPlayer Mini MP3 module (UART)
//   - 1x MG90S micro servo
//   - 1x Vibration motor (via MOSFET)
//   - Capacitive touch pad
//
// Pin assignments (from PCB-DESIGN-GUIDE.md / component-test):
//   GPIO 18 — NeoPixel DIN
//   GPIO 4  — Servo signal
//   GPIO 25 — DFPlayer TX (ESP32 TX → DFPlayer RX)
//   GPIO 21 — I2C SDA
//   GPIO 22 — I2C SCL
//   GPIO 27 — Capacitive touch pad (Touch7)
//   GPIO 26 — Vibration motor (MOSFET gate)
//
// Libraries needed:
//   - Adafruit NeoPixel
//   - ESP32Servo
//   - DFRobotDFPlayerMini
//   - Adafruit PN532
//   - Wire (built-in)
//   - WiFi (built-in)
//   - WebServer (built-in)
//
// WiFi:
//   AP Mode — SSID: "CraftingTable" (no password)
//   Web UI at http://192.168.4.1/
//   Endpoints:
//     GET /        — HTML control page
//     GET /cmd?c=L — Light test (cycle rings)
//     GET /cmd?c=P — Pixel crawl
//     GET /cmd?c=off — All LEDs off
//     GET /status  — JSON status of slots, readers, touch, dfplayer
//     GET /log     — JSON array of recent log messages
//
// =============================================================================

#include <Wire.h>
#include <Adafruit_PN532.h>
#include <Adafruit_NeoPixel.h>
#include <ESP32Servo.h>
#include <DFRobotDFPlayerMini.h>
#include <WiFi.h>
#include <WebServer.h>

// =============================================================================
// Pin Definitions
// =============================================================================
#define NEOPIXEL_PIN    18
#define SERVO_PIN_0     17   // Servo 0 — J14
#define SERVO_PIN_1     16   // Servo 1 — J15
#define SERVO_PIN_2     4    // Servo 2 — J16
#define DFPLAYER_TX_PIN 25   // ESP32 TX → DFPlayer RX
#define I2C_SDA         21
#define I2C_SCL         22
#define TOUCH_PAD       27   // Touch7
#define MOTOR_PIN       26   // Vibration motor via MOSFET

// =============================================================================
// Hardware Config
// =============================================================================
#define NUM_SLOTS       9
#define LEDS_PER_RING   24
#define TOTAL_LEDS      (NUM_SLOTS * LEDS_PER_RING)
#define LED_SKIP        2    // Light every-other LED
#define BRIGHTNESS      25

// PCA9548A addresses
#define PCA1_ADDR       0x70  // Slots 0-7 (NEEDS REPLACEMENT BOARD)
#define PCA2_ADDR       0x71  // Slot 8 (working)

// WiFi AP Config
#define WIFI_SSID       "CraftingTable"
// No password — open AP for easy access

// =============================================================================
// Multiplexer channel mapping for each logical slot (phone-keypad numbering)
// =============================================================================
//   Grid layout (viewed from front):
//     8  7  6      ← top row
//     5  4  3      ← middle row
//     2  1  0      ← bottom row
const struct { uint8_t pca; uint8_t ch; } SLOT_MUX[NUM_SLOTS] = {
  {PCA2_ADDR, 0}, {PCA1_ADDR, 6}, {PCA1_ADDR, 7},  // Slots 0, 1, 2 (bottom row)
  {PCA1_ADDR, 1}, {PCA1_ADDR, 2}, {PCA1_ADDR, 5},  // Slots 3, 4, 5 (middle row)
  {PCA1_ADDR, 0}, {PCA1_ADDR, 3}, {PCA1_ADDR, 4},  // Slots 6, 7, 8 (top row)
};

// NeoPixel ring order in the daisy-chain (physical wiring order).
const int8_t RING_ORDER[NUM_SLOTS] = {
  0,   // Chain position 0 → Slot 0 (bottom-right)
  1,   // Chain position 1 → Slot 1 (bottom-center)
  2,   // Chain position 2 → Slot 2 (bottom-left)
  5,   // Chain position 3 → Slot 5 (middle-left)
  4,   // Chain position 4 → Slot 4 (middle-center)
  3,   // Chain position 5 → Slot 3 (middle-right)
  6,   // Chain position 6 → Slot 6 (top-right)
  7,   // Chain position 7 → Slot 7 (top-center)
  8,   // Chain position 8 → Slot 8 (top-left)
};

// Reverse lookup: given a logical slot, which chain position is it?
int8_t SLOT_TO_RING[NUM_SLOTS];

// Servo config
#define SERVO_REST_DEG   90   // Resting: perpendicular (blocking door)
#define SERVO_PUSH_DEG   180  // Activated: rotated away (door released)
#define SERVO_HOLD_MS    500

// Touch config
#define TOUCH_THRESHOLD  1000  // Below this = touched

// Tag read timeout (ms) — keep short so web server stays responsive
#define TAG_READ_TIMEOUT 50

// =============================================================================
// ROYGBIV Color Table — mapped across 9 slots
// =============================================================================
const uint16_t SLOT_HUES[NUM_SLOTS] = {
  0,      // Slot 0: Red
  5461,   // Slot 1: Orange
  10922,  // Slot 2: Yellow
  16384,  // Slot 3: Yellow-Green
  21845,  // Slot 4: Green
  32768,  // Slot 5: Cyan/Blue-Green
  43690,  // Slot 6: Blue
  49152,  // Slot 7: Indigo
  54613,  // Slot 8: Violet/Purple
};

// =============================================================================
// Globals
// =============================================================================
Adafruit_NeoPixel strip(TOTAL_LEDS, NEOPIXEL_PIN, NEO_GRB + NEO_KHZ800);
Adafruit_PN532 nfc(I2C_SDA, I2C_SCL, &Wire);
Servo servo0;
Servo servo1;
Servo servo2;
const uint8_t SERVO_PINS[3] = {SERVO_PIN_0, SERVO_PIN_1, SERVO_PIN_2};
Servo* servos[3] = {&servo0, &servo1, &servo2};
HardwareSerial dfSerial(1);
DFRobotDFPlayerMini dfPlayer;
WebServer server(80);

bool readerOk[NUM_SLOTS];
bool slotActive[NUM_SLOTS];        // Tag currently present on slot
bool wasTouched = false;           // Previous touch state (for edge detection)
bool dfPlayerReady = false;
bool currentTouchState = false;    // Exposed for web status

// =============================================================================
// Circular Log Buffer
// =============================================================================
#define LOG_SIZE 20
String logBuffer[LOG_SIZE];
int logHead = 0;  // Next write position
int logCount = 0; // Total messages stored (max LOG_SIZE)

void logMsg(const String &msg) {
  Serial.println(msg);
  logBuffer[logHead] = msg;
  logHead = (logHead + 1) % LOG_SIZE;
  if (logCount < LOG_SIZE) logCount++;
}

// Printf-style log helper
void logMsgf(const char* fmt, ...) {
  char buf[256];
  va_list args;
  va_start(args, fmt);
  vsnprintf(buf, sizeof(buf), fmt, args);
  va_end(args);
  logMsg(String(buf));
}

// =============================================================================
// PCA9548A Multiplexer Control
// =============================================================================
void pcaDeselectAll() {
  Wire.beginTransmission(PCA1_ADDR);
  Wire.write(0);
  Wire.endTransmission();
  Wire.beginTransmission(PCA2_ADDR);
  Wire.write(0);
  Wire.endTransmission();
}

void selectSlot(uint8_t slot) {
  pcaDeselectAll();
  Wire.beginTransmission(SLOT_MUX[slot].pca);
  Wire.write(1 << SLOT_MUX[slot].ch);
  uint8_t err = Wire.endTransmission();
  if (SLOT_MUX[slot].pca == PCA2_ADDR) {
    delay(5);
  } else {
    delay(2);
  }
}

// =============================================================================
// PN532 Init
// =============================================================================
bool initReader(uint8_t slot) {
  selectSlot(slot);

  Wire.beginTransmission(SLOT_MUX[slot].pca);
  uint8_t pcaErr = Wire.endTransmission();
  if (pcaErr != 0) {
    logMsgf("  [SLOT %d] PCA9548A @ 0x%02X NOT responding (err=%d)",
            slot, SLOT_MUX[slot].pca, pcaErr);
    return false;
  }

  if (SLOT_MUX[slot].pca == PCA2_ADDR) {
    delay(10);
  }

  nfc.begin();
  delay(5);

  uint32_t ver = nfc.getFirmwareVersion();
  if (!ver) {
    if (SLOT_MUX[slot].pca == PCA2_ADDR) {
      logMsgf("  [SLOT %d] PN532 retry on PCA2...", slot);
      delay(50);
      nfc.begin();
      delay(10);
      ver = nfc.getFirmwareVersion();
    }
    if (!ver) {
      logMsgf("  [SLOT %d] PN532 NOT FOUND (PCA=0x%02X, CH=%d)",
              slot, SLOT_MUX[slot].pca, SLOT_MUX[slot].ch);
      return false;
    }
  }
  nfc.SAMConfig();
  logMsgf("  [SLOT %d] PN532 OK (FW %d.%d) via PCA 0x%02X CH %d", slot,
          (ver >> 16) & 0xFF, (ver >> 8) & 0xFF,
          SLOT_MUX[slot].pca, SLOT_MUX[slot].ch);
  return true;
}

// =============================================================================
// NeoPixel Helpers
// =============================================================================
void setRing(uint8_t ring, uint32_t color) {
  uint16_t offset = ring * LEDS_PER_RING;
  for (uint16_t i = 0; i < LEDS_PER_RING; i++) {
    strip.setPixelColor(offset + i, (i % LED_SKIP == 0) ? color : 0);
  }
}

void clearRing(uint8_t ring) {
  setRing(ring, 0);
}

void clearAllRings() {
  for (uint8_t i = 0; i < NUM_SLOTS; i++) clearRing(i);
  strip.show();
}

uint32_t getSlotColor(uint8_t slot) {
  uint16_t hue = SLOT_HUES[slot];
  return strip.gamma32(strip.ColorHSV(hue, 255, 180));
}

// =============================================================================
// Sound
// =============================================================================
void playSound(uint8_t track) {
  if (dfPlayerReady) {
    dfPlayer.playFolder(1, track);  // Folder 01, track 001-009
  }
}

// =============================================================================
// Servo Action (on touch release)
// =============================================================================
void servoSweep() {
  servoSweepN(2);  // Default: Servo 2 (GPIO 4, original behavior)
}

void servoSweepN(uint8_t n) {
  if (n > 2) return;
  logMsgf("[SERVO] Sweeping servo %d (GPIO %d)", n, SERVO_PINS[n]);
  servos[n]->attach(SERVO_PINS[n]);
  delay(50);
  servos[n]->write(SERVO_PUSH_DEG);
  delay(SERVO_HOLD_MS);
  servos[n]->write(SERVO_REST_DEG);
  delay(SERVO_HOLD_MS);
  servos[n]->detach();
}

// =============================================================================
// Ring Tests
// =============================================================================
void testAllRings() {
  logMsg("[LED TEST] Cycling through all rings (slot 0-8)...");
  for (uint8_t slot = 0; slot < NUM_SLOTS; slot++) {
    int8_t ring = SLOT_TO_RING[slot];
    if (ring < 0) {
      logMsgf("  Slot %d -> not wired, skipping", slot);
      continue;
    }
    uint32_t color = getSlotColor(slot);
    setRing(ring, color);
    strip.show();
    logMsgf("  Slot %d -> Chain pos %d -> ON", slot, ring);
    delay(1000);
    clearRing(ring);
    strip.show();
  }
  logMsg("[LED TEST] Done.");
}

void testPixelCrawl() {
  logMsg("[LED CRAWL] Lighting one pixel at a time (0.2s each)...");
  for (uint16_t i = 0; i < TOTAL_LEDS; i++) {
    strip.clear();
    strip.setPixelColor(i, strip.Color(50, 50, 50));
    strip.show();
    if (i % LEDS_PER_RING == 0) {
      logMsgf("  --- Ring boundary at pixel %d (ring %d) ---",
              i, i / LEDS_PER_RING);
    }
    delay(200);
  }
  strip.clear();
  strip.show();
  logMsg("[LED CRAWL] Done.");
}

// =============================================================================
// Web Server — HTML Page (PROGMEM)
// =============================================================================
const char HTML_PAGE[] PROGMEM = R"rawliteral(<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Crafting Table</title><style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Courier New',monospace;background:#1a1a1a;color:#a0a0a0;padding:12px;max-width:480px;margin:0 auto}
h1{color:#5b8731;font-size:1.4em;text-align:center;margin-bottom:8px;text-shadow:2px 2px #000;letter-spacing:2px}
.subtitle{text-align:center;color:#6b5b3a;font-size:0.8em;margin-bottom:16px}
.btn-row{display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap}
button{flex:1;min-width:100px;min-height:52px;border:3px solid #3d3d3d;background:#2d2d2d;color:#c8c8c8;
font-family:'Courier New',monospace;font-size:1em;font-weight:bold;cursor:pointer;
image-rendering:pixelated;border-radius:0}
button:active{background:#5b8731;color:#fff;border-color:#7ec842}
.btn-light{border-color:#5b8731}
.btn-crawl{border-color:#6b5b3a}
.btn-off{border-color:#8b2020}
.btn-motor{border-color:#8b6914}
.btn-motor.vibe{border-color:#6b4fa5}
.btn-refresh{border-color:#4a6fa5;min-width:60px;flex:0}
h2{color:#6b5b3a;font-size:1em;margin:12px 0 6px;border-bottom:1px solid #333;padding-bottom:4px}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-bottom:12px}
.slot{background:#2a2a2a;border:2px solid #333;padding:8px;text-align:center;font-size:0.8em;min-height:40px;cursor:pointer}
.slot.active{border-color:#5b8731;background:#2d3d20;color:#7ec842}
.slot.no-reader{border-color:#4a1a1a;color:#666}
.info{font-size:0.75em;color:#666;margin-bottom:8px}
.info span{margin-right:12px}
.info .on{color:#5b8731}
.info .off{color:#8b2020}
#log{background:#111;border:1px solid #333;padding:8px;height:180px;overflow-y:auto;
font-size:0.7em;line-height:1.4;white-space:pre-wrap;word-break:break-all}
</style></head><body>
<h1>&#x2B1C; Crafting Table</h1>
<p class="subtitle">Escape Room Control Panel</p>
<div class="btn-row">
<button class="btn-light" onclick="cmd('L')">&#x1F4A1; Light Test</button>
<button class="btn-crawl" onclick="cmd('P')">&#x1F41B; Pixel Crawl</button>
<button class="btn-off" onclick="cmd('off')">&#x26AB; All Off</button>
</div>
<h2>Motors</h2>
<div class="btn-row">
<button class="btn-motor" onclick="cmd('sv0')">Servo 0</button>
<button class="btn-motor" onclick="cmd('sv1')">Servo 1</button>
<button class="btn-motor" onclick="cmd('sv2')">Servo 2</button>
</div>
<div class="btn-row">
<button class="btn-motor vibe" onclick="cmd('von')">&#x1F4F3; Vibe ON</button>
<button class="btn-off" onclick="cmd('voff')">Vibe OFF</button>
</div>
<h2>Slot Status</h2>
<div class="grid" id="grid"></div>
<div class="info">
<span>Touch: <span id="tch" class="off">-</span></span>
<span>DFPlayer: <span id="dfp" class="off">-</span></span>
<button class="btn-refresh" onclick="refresh()">&#x1F504;</button>
</div>
<h2>Log</h2>
<div id="log">Connecting...</div>
<script>
function cmd(c){fetch('/cmd?c='+c).then(r=>r.text()).then(t=>{refresh()})}
function refresh(){
fetch('/status').then(r=>r.json()).then(d=>{
let g='';
let order=[6,7,8,3,4,5,0,1,2];
for(let k=0;k<9;k++){let j=order[k];
let cls='slot';
if(!d.readers[j])cls+=' no-reader';
else if(d.slots[j])cls+=' active';
g+='<div class="'+cls+'" onclick="cmd(\'s'+j+'\')">'+j+(d.slots[j]?' &#x2705;':d.readers[j]?' .':' &#x274C;')+'</div>';
}
document.getElementById('grid').innerHTML=g;
let te=document.getElementById('tch');te.textContent=d.touch?'ON':'off';te.className=d.touch?'on':'off';
let df=document.getElementById('dfp');df.textContent=d.dfplayer?'OK':'--';df.className=d.dfplayer?'on':'off';
});
fetch('/log').then(r=>r.json()).then(arr=>{
document.getElementById('log').textContent=arr.join('\n');
let el=document.getElementById('log');el.scrollTop=el.scrollHeight;
});}
setInterval(refresh,2000);refresh();
</script></body></html>)rawliteral";

// =============================================================================
// Web Server Handlers
// =============================================================================
void handleRoot() {
  server.send_P(200, "text/html", HTML_PAGE);
}

void handleCmd() {
  String c = server.arg("c");
  if (c == "L" || c == "l") {
    server.send(200, "text/plain", "OK: Light test");
    testAllRings();
  } else if (c == "P" || c == "p") {
    server.send(200, "text/plain", "OK: Pixel crawl");
    testPixelCrawl();
  } else if (c == "off") {
    clearAllRings();
    for (uint8_t i = 0; i < NUM_SLOTS; i++) slotActive[i] = false;
    logMsg("[WEB] All LEDs off");
    server.send(200, "text/plain", "OK: All off");
  } else if (c.startsWith("sv")) {
    // Servo sweep: c = "sv0", "sv1", "sv2"
    int n = c.substring(2).toInt();
    if (n >= 0 && n <= 2) {
      server.send(200, "text/plain", "OK: Servo sweep");
      servoSweepN(n);
    } else {
      server.send(400, "text/plain", "Invalid servo (0-2)");
    }
  } else if (c.startsWith("s")) {
    // Activate/deactivate a slot: c = "s0" through "s8"
    int slot = c.substring(1).toInt();
    if (slot >= 0 && slot < NUM_SLOTS) {
      slotActive[slot] = !slotActive[slot];
      int8_t ring = SLOT_TO_RING[slot];
      if (ring >= 0) {
        if (slotActive[slot]) {
          setRing(ring, getSlotColor(slot));
          playSound(slot + 1);
        } else {
          clearRing(ring);
        }
        strip.show();
      }
      logMsgf("[WEB] Slot %d %s", slot, slotActive[slot] ? "ON" : "OFF");
      server.send(200, "text/plain", "OK");
    } else {
      server.send(400, "text/plain", "Invalid slot");
    }
  } else if (c == "von") {
    // Vibration motor ON
    digitalWrite(MOTOR_PIN, HIGH);
    logMsg("[WEB] Vibration motor ON");
    server.send(200, "text/plain", "OK: Motor ON");
  } else if (c == "voff") {
    // Vibration motor OFF
    digitalWrite(MOTOR_PIN, LOW);
    logMsg("[WEB] Vibration motor OFF");
    server.send(200, "text/plain", "OK: Motor OFF");
  } else {
    server.send(400, "text/plain", "Unknown command");
  }
}

void handleStatus() {
  String json = "{\"touch\":";
  json += currentTouchState ? "true" : "false";
  json += ",\"slots\":[";
  for (uint8_t i = 0; i < NUM_SLOTS; i++) {
    json += slotActive[i] ? "true" : "false";
    if (i < NUM_SLOTS - 1) json += ",";
  }
  json += "],\"readers\":[";
  for (uint8_t i = 0; i < NUM_SLOTS; i++) {
    json += readerOk[i] ? "true" : "false";
    if (i < NUM_SLOTS - 1) json += ",";
  }
  json += "],\"dfplayer\":";
  json += dfPlayerReady ? "true" : "false";
  json += "}";
  server.send(200, "application/json", json);
}

void handleLog() {
  String json = "[";
  // Output messages in chronological order
  int start = (logCount < LOG_SIZE) ? 0 : logHead;
  int count = (logCount < LOG_SIZE) ? logCount : LOG_SIZE;
  for (int i = 0; i < count; i++) {
    int idx = (start + i) % LOG_SIZE;
    // Escape quotes in log messages for valid JSON
    String escaped = logBuffer[idx];
    escaped.replace("\\", "\\\\");
    escaped.replace("\"", "\\\"");
    json += "\"" + escaped + "\"";
    if (i < count - 1) json += ",";
  }
  json += "]";
  server.send(200, "application/json", json);
}

// =============================================================================
// Setup
// =============================================================================
void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println();
  Serial.println("========================================");
  Serial.println("  Interactive Test + WiFi Web Control");
  Serial.println("========================================");
  Serial.println("  Touch pad  -> vibration motor ON");
  Serial.println("  Release    -> servo sweep");
  Serial.println("  RFID tag   -> colored light + sound");
  Serial.println("  WiFi AP    -> web control panel");
  Serial.println("========================================");
  Serial.println();

  // --- WiFi AP Mode ---
  WiFi.mode(WIFI_AP);
  WiFi.softAP(WIFI_SSID);
  delay(100);
  Serial.println("[WIFI] Access Point started");
  Serial.printf("[WIFI] SSID: %s\n", WIFI_SSID);
  Serial.printf("[WIFI] IP: %s\n", WiFi.softAPIP().toString().c_str());
  Serial.println("[WIFI] Connect to this network, then open http://192.168.4.1/");
  Serial.println();

  // --- Web Server Routes ---
  server.on("/", handleRoot);
  server.on("/cmd", handleCmd);
  server.on("/status", handleStatus);
  server.on("/log", handleLog);
  server.begin();
  Serial.println("[WEB] Server started on port 80");

  // --- I2C ---
  Wire.begin(I2C_SDA, I2C_SCL);
  Wire.setClock(100000);

  Serial.println("[I2C] Scanning bus...");
  uint8_t devCount = 0;
  for (uint8_t addr = 1; addr < 127; addr++) {
    Wire.beginTransmission(addr);
    uint8_t err = Wire.endTransmission();
    if (err == 0) {
      Serial.printf("[I2C]   Found device at 0x%02X\n", addr);
      devCount++;
    }
  }
  Serial.printf("[I2C] %d device(s) on bus\n\n", devCount);

  // --- Motor pin ---
  pinMode(MOTOR_PIN, OUTPUT);
  digitalWrite(MOTOR_PIN, LOW);

  // --- NeoPixels ---
  strip.begin();
  strip.setBrightness(BRIGHTNESS);
  strip.clear();
  strip.show();
  logMsgf("[LED] %d LEDs across %d rings initialized", TOTAL_LEDS, NUM_SLOTS);

  // Build SLOT_TO_RING reverse lookup from RING_ORDER
  for (uint8_t i = 0; i < NUM_SLOTS; i++) SLOT_TO_RING[i] = -1;
  for (uint8_t i = 0; i < NUM_SLOTS; i++) {
    if (RING_ORDER[i] >= 0) {
      SLOT_TO_RING[RING_ORDER[i]] = i;
    }
  }
  logMsg("[LED] Ring wiring map (slot -> chain position):");
  for (uint8_t i = 0; i < NUM_SLOTS; i++) {
    if (SLOT_TO_RING[i] >= 0) {
      logMsgf("[LED]   Slot %d -> Ring %d", i, SLOT_TO_RING[i]);
    } else {
      logMsgf("[LED]   Slot %d -> not connected", i);
    }
  }

  // --- DFPlayer ---
  logMsg("[SOUND] Initializing DFPlayer...");
  dfSerial.begin(9600, SERIAL_8N1, -1, DFPLAYER_TX_PIN);
  delay(500);
  if (dfPlayer.begin(dfSerial, false)) {
    dfPlayer.volume(20);
    dfPlayerReady = true;
    logMsg("[SOUND] DFPlayer OK, volume 20/30");
  } else {
    logMsg("[SOUND] DFPlayer NOT FOUND - sounds disabled");
  }

  // --- NFC readers ---
  logMsg("[RFID] Initializing readers...");

  Wire.beginTransmission(PCA1_ADDR);
  uint8_t pca1Err = Wire.endTransmission();
  logMsgf("[RFID] PCA9548A #1 (0x%02X): %s", PCA1_ADDR,
          pca1Err == 0 ? "OK" : "NOT FOUND");

  Wire.beginTransmission(PCA2_ADDR);
  uint8_t pca2Err = Wire.endTransmission();
  logMsgf("[RFID] PCA9548A #2 (0x%02X): %s", PCA2_ADDR,
          pca2Err == 0 ? "OK" : "NOT FOUND");

  if (pca2Err != 0) {
    logMsg("[RFID] WARNING: 2nd PCA9548A not found!");
    logMsg("       Check: A0 pin HIGH for addr 0x71? Power? I2C wiring?");
  }

  uint8_t ok = 0;
  for (uint8_t i = 0; i < NUM_SLOTS; i++) {
    readerOk[i] = initReader(i);
    slotActive[i] = false;
    if (readerOk[i]) ok++;
  }
  pcaDeselectAll();
  logMsgf("[RFID] %d of %d readers OK", ok, NUM_SLOTS);

  // --- Servos (verify all three, then detach) ---
  for (uint8_t i = 0; i < 3; i++) {
    servos[i]->attach(SERVO_PINS[i]);
    servos[i]->write(SERVO_REST_DEG);
  }
  delay(300);
  for (uint8_t i = 0; i < 3; i++) {
    servos[i]->detach();
  }
  logMsgf("[SERVO] 3 servos ready on GPIO %d, %d, %d", SERVO_PIN_0, SERVO_PIN_1, SERVO_PIN_2);

  // --- Touch baseline ---
  logMsgf("[TOUCH] Threshold set to %d (below = touched)", TOUCH_THRESHOLD);

  logMsg("");
  logMsg("Running! Interact with hardware or use web UI.");
  logMsg("  Serial: 'L' = light test, 'P' = pixel crawl");
  logMsgf("  Web: http://%s/", WiFi.softAPIP().toString().c_str());
  logMsg("");
}

// =============================================================================
// Main Loop
// =============================================================================
void loop() {
  // ----- WEB SERVER -----
  server.handleClient();

  // ----- SERIAL COMMANDS -----
  if (Serial.available()) {
    char c = Serial.read();
    while (Serial.available()) Serial.read();
    if (c == 'L' || c == 'l') {
      testAllRings();
    } else if (c == 'P' || c == 'p') {
      testPixelCrawl();
    }
  }

  // ----- CAPACITIVE TOUCH → MOTOR + SERVO -----
  int touchVal = touchRead(TOUCH_PAD);
  bool isTouched = (touchVal < TOUCH_THRESHOLD);
  currentTouchState = isTouched;

  if (isTouched) {
    if (!wasTouched) {
      logMsgf("[TOUCH] >>> Touched! (val=%d) - Motor ON", touchVal);
    }
    digitalWrite(MOTOR_PIN, HIGH);
  } else {
    if (wasTouched) {
      logMsgf("[TOUCH] >>> Released (val=%d) - Motor OFF, Servo sweep", touchVal);
      digitalWrite(MOTOR_PIN, LOW);
      servoSweep();
    }
  }
  wasTouched = isTouched;

  // ----- RFID SCANNING → LIGHT + SOUND -----
  for (uint8_t i = 0; i < NUM_SLOTS; i++) {
    server.handleClient();  // Keep web responsive during scan loop

    if (!readerOk[i]) continue;

    selectSlot(i);

    if (SLOT_MUX[i].pca == PCA2_ADDR) {
      nfc.begin();
      nfc.SAMConfig();
    }

    uint8_t uid[7];
    uint8_t uidLen;
    bool tagPresent = nfc.readPassiveTargetID(PN532_MIFARE_ISO14443A, uid, &uidLen, TAG_READ_TIMEOUT);

    if (tagPresent && !slotActive[i]) {
      slotActive[i] = true;

      int8_t ring = SLOT_TO_RING[i];
      if (ring >= 0) {
        uint32_t color = getSlotColor(i);
        setRing(ring, color);
        strip.show();
      }

      playSound(i + 1);

      // Build UID string
      String uidStr = "";
      for (uint8_t b = 0; b < uidLen; b++) {
        if (uid[b] < 0x10) uidStr += "0";
        uidStr += String(uid[b], HEX);
        if (b < uidLen - 1) uidStr += ":";
      }
      logMsgf("[SLOT %d] Tag detected -> Ring %d, Hue=%d, Track=%d UID: %s",
              i, ring, SLOT_HUES[i], i + 1, uidStr.c_str());

    } else if (!tagPresent && slotActive[i]) {
      slotActive[i] = false;
      int8_t ring = SLOT_TO_RING[i];
      if (ring >= 0) {
        clearRing(ring);
        strip.show();
      }
      logMsgf("[SLOT %d] Tag removed - ring %d OFF", i, ring);
    }
  }
  pcaDeselectAll();

  // Small delay between scan cycles
  delay(10);
}
