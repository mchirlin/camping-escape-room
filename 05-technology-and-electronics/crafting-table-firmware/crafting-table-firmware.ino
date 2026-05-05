// =============================================================================
// Crafting Table Firmware — ESP32
// =============================================================================
//
// Full 9-slot crafting table with NFC block detection, recipe matching,
// NeoPixel feedback, DFPlayer sound, servo doors, WiFi status API,
// and tag registration mode.
//
// Hardware:
//   - ESP32 DevKit v1 (38-pin)
//   - 2x PCA9548A I2C multiplexers (0x70, 0x71)
//   - 9x PN532 NFC readers (one per grid slot, all at I2C 0x24)
//   - 9x WS2812B NeoPixel 24-LED rings (daisy-chained)
//   - 1x DFPlayer Mini MP3 module (UART)
//   - 3x MG90S micro servos (door pushers)
//   - 2x copper tape pads (capacitive touch submit)
//
// Libraries (Arduino Library Manager):
//   - Adafruit PN532
//   - Adafruit NeoPixel
//   - ESP32Servo
//   - DFRobotDFPlayerMini
//
// Board: "ESP32 Dev Module" in Arduino IDE
// =============================================================================

#include <Wire.h>
#include <Adafruit_PN532.h>
#include <Adafruit_NeoPixel.h>
#include <ESP32Servo.h>
#include <DFRobotDFPlayerMini.h>
#include <WiFi.h>
#include <WebServer.h>
#include <ESPmDNS.h>

// =============================================================================
// Pin Assignments
// =============================================================================
#define SDA_PIN        21
#define SCL_PIN        22
#define NEOPIXEL_PIN   18
#define SERVO1_PIN     4     // Door 1 (recipes: wooden_pickaxe, fishing_rod)
#define SERVO2_PIN     16    // Door 2 (recipes: gold_sword, tnt)
#define SERVO3_PIN     17    // Door 3 (recipes: compass, diamond_shovel)
#define DFPLAYER_TX    25    // ESP32 TX → DFPlayer RX
#define DFPLAYER_RX    26    // ESP32 RX ← DFPlayer TX
#define TOUCH_L_PIN    32    // Left copper pad  (Touch9)
#define TOUCH_R_PIN    33    // Right copper pad (Touch8)

// =============================================================================
// Hardware Config
// =============================================================================
#define NUM_SLOTS      9
#define LEDS_PER_RING  24
#define TOTAL_LEDS     (NUM_SLOTS * LEDS_PER_RING)
#define LED_SKIP       2     // Light every-other LED for even glow
#define BRIGHTNESS     25    // 0-255, keep low for battery

// PCA9548A addresses
#define PCA1_ADDR      0x70  // Slots 0-7
#define PCA2_ADDR      0x71  // Slot 8

// Multiplexer channel mapping: {pca_addr, channel} for each slot
// Grid layout (player's perspective):
//   [0][1][2]
//   [3][4][5]
//   [6][7][8]
const struct { uint8_t pca; uint8_t ch; } SLOT_MUX[NUM_SLOTS] = {
  {PCA1_ADDR, 0}, {PCA1_ADDR, 1}, {PCA1_ADDR, 2},
  {PCA1_ADDR, 3}, {PCA1_ADDR, 4}, {PCA1_ADDR, 5},
  {PCA1_ADDR, 6}, {PCA1_ADDR, 7}, {PCA2_ADDR, 0},
};

// Servo pulse widths (calibrate per servo)
#define SERVO_REST_US  500
#define SERVO_PUSH_US  2200
#define SERVO_PUSH_MS  600

// NTAG215 user data starts at page 4 (4 bytes per page)
// We store block type string in pages 4-7 (16 bytes max)
#define TAG_DATA_PAGE  4
#define TAG_DATA_PAGES 4

// Scan timing
#define SCAN_INTERVAL_MS  100
#define TAG_READ_TIMEOUT  100

// Touch pad config
#define TOUCH_THRESHOLD_PCT 70  // Trigger at 70% of baseline (lower = touched)
#define TOUCH_DEBOUNCE_MS   50  // Both pads must be held this long

// =============================================================================
// DFPlayer Track Numbers (matches dfplayer-sdcard/README.md)
// =============================================================================
#define SND_CRAFT_SUCCESS  1
#define SND_CRAFT_FAIL     2
#define SND_BLOCK_PLACE    3
#define SND_LEVELUP        4
#define SND_EXPLOSION      5
#define SND_CREEPER_HISS   6
#define SND_CHEST_OPEN     7
#define SND_CHEST_CLOSE    8
#define SND_XP_PICKUP      9
#define SND_ANVIL_USE      10

// =============================================================================
// WiFi Config
// =============================================================================
// On boot: tries to join your phone hotspot (STA mode).
// If the hotspot isn't found within 10 seconds, creates its own AP instead.
// Either way, mDNS advertises http://crafting-table.local
//
// To use hotspot mode: turn on your phone hotspot before powering the table.
// To use AP mode: just leave the hotspot off — table creates "CraftingTable".

#define WIFI_STA_SSID  "YourPhone"        // Phone hotspot SSID — change this
#define WIFI_STA_PASS  "hotspotpassword"  // Phone hotspot password — change this
#define WIFI_AP_SSID   "CraftingTable"    // Fallback AP name
#define WIFI_AP_PASS   "minecraft"        // Fallback AP password
#define WIFI_AP_CHAN   6
#define WIFI_STA_TIMEOUT 10000            // ms to wait for hotspot connection
#define MDNS_NAME      "crafting-table"   // → http://crafting-table.local

// =============================================================================
// Block Types — must match what's written to NFC tags
// =============================================================================
// Keep these short (≤15 chars) to fit in 4 NTAG215 pages
const char* BLOCK_TYPES[] = {
  "wood_plank", "stick", "iron_ingot", "string",
  "gold_ingot", "diamond", "gunpowder", "sand", "redstone"
};
#define NUM_BLOCK_TYPES 9

// =============================================================================
// Recipes — 3x3 grid patterns
// =============================================================================
// "" = empty slot, block type string = required block
// Grid indices: [0][1][2] / [3][4][5] / [6][7][8]

struct Recipe {
  const char* name;
  const char* grid[NUM_SLOTS];
  uint8_t door;  // Which servo door (0, 1, 2)
};

const Recipe RECIPES[] = {
  // Door 0: Wooden Pickaxe — 3 wood plank across top, 2 sticks down center
  {"wooden_pickaxe", {
    "wood_plank", "wood_plank", "wood_plank",
    "",           "stick",      "",
    "",           "stick",      ""
  }, 0},

  // Door 0: Fishing Rod — sticks diagonal + string right column
  {"fishing_rod", {
    "",     "",       "stick",
    "",     "stick",  "string",
    "stick","",       "string"
  }, 0},

  // Door 1: Gold Sword — 2 gold on top, stick below
  {"gold_sword", {
    "", "gold_ingot", "",
    "", "gold_ingot", "",
    "", "stick",      ""
  }, 1},

  // Door 1: TNT — gunpowder/sand checkerboard
  {"tnt", {
    "gunpowder", "sand",      "gunpowder",
    "sand",      "gunpowder", "sand",
    "gunpowder", "sand",      "gunpowder"
  }, 1},

  // Door 2: Compass — 4 iron around redstone center
  {"compass", {
    "",           "iron_ingot", "",
    "iron_ingot", "redstone",   "iron_ingot",
    "",           "iron_ingot", ""
  }, 2},

  // Door 2: Diamond Shovel — diamond on top, 2 sticks below
  {"diamond_shovel", {
    "", "diamond", "",
    "", "stick",   "",
    "", "stick",   ""
  }, 2},
};
#define NUM_RECIPES 6

// =============================================================================
// Globals
// =============================================================================
Adafruit_NeoPixel strip(TOTAL_LEDS, NEOPIXEL_PIN, NEO_GRB + NEO_KHZ800);
// Constructor matches POC pattern: (irq, reset, &Wire)
// IRQ/RESET not physically wired — library falls back to I2C polling.
// Using SDA/SCL pin numbers here is harmless; Wire.begin() reconfigures them.
Adafruit_PN532 nfc(SDA_PIN, SCL_PIN, &Wire);
Servo servos[3];
HardwareSerial dfSerial(1);  // UART1 for DFPlayer
DFRobotDFPlayerMini dfPlayer;
WebServer server(80);

// Slot state
String slotBlock[NUM_SLOTS];       // Block type on each slot ("" = empty)
bool slotPresent[NUM_SLOTS];       // Tag physically present
bool readerOk[NUM_SLOTS];          // Reader initialized successfully

// Recipe state
String lastCraftedRecipe = "";
unsigned long lastCraftTime = 0;
bool craftTriggered = false;       // Prevents re-triggering same pattern

// Servo state
bool doorOpen[3] = {false, false, false};

// Mode
bool registrationMode = false;     // Tag writing mode via serial
uint8_t regSlot = 0;               // Which slot to use for registration

// Touch pads
uint16_t touchBaselineL = 0;       // Calibrated baseline (untouched)
uint16_t touchBaselineR = 0;
uint16_t touchThresholdL = 0;      // Trigger threshold
uint16_t touchThresholdR = 0;

// =============================================================================
// PCA9548A Multiplexer Control
// =============================================================================
void pcaSelect(uint8_t pcaAddr, uint8_t channel) {
  Wire.beginTransmission(pcaAddr);
  Wire.write(1 << channel);
  Wire.endTransmission();
}

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
  pcaSelect(SLOT_MUX[slot].pca, SLOT_MUX[slot].ch);
  delay(2);
}

// =============================================================================
// PN532 — Init & Read
// =============================================================================
bool initReader(uint8_t slot) {
  selectSlot(slot);
  nfc.begin();
  uint32_t ver = nfc.getFirmwareVersion();
  if (!ver) {
    Serial.printf("  [SLOT %d] PN532 NOT FOUND\n", slot);
    return false;
  }
  nfc.SAMConfig();
  Serial.printf("  [SLOT %d] PN532 OK (FW %d.%d)\n", slot,
                (ver >> 16) & 0xFF, (ver >> 8) & 0xFF);
  return true;
}

// Read block type string from NTAG215 user data pages.
// Returns block type string or "" if no tag / unrecognized.
String readBlockType(uint8_t slot) {
  selectSlot(slot);

  uint8_t uid[7];
  uint8_t uidLen;
  if (!nfc.readPassiveTargetID(PN532_MIFARE_ISO14443A, uid, &uidLen, TAG_READ_TIMEOUT))
    return "";

  // Read pages 4-7 (16 bytes of user data)
  char buf[TAG_DATA_PAGES * 4 + 1];
  memset(buf, 0, sizeof(buf));

  for (uint8_t p = 0; p < TAG_DATA_PAGES; p++) {
    uint8_t data[4];
    if (!nfc.ntag2xx_ReadPage(TAG_DATA_PAGE + p, data))
      return "";  // Read failed — tag removed mid-read
    memcpy(buf + p * 4, data, 4);
  }

  // Null-terminate and trim
  buf[TAG_DATA_PAGES * 4] = '\0';
  String blockType = String(buf);
  blockType.trim();

  // Validate against known block types
  for (uint8_t i = 0; i < NUM_BLOCK_TYPES; i++) {
    if (blockType == BLOCK_TYPES[i]) return blockType;
  }

  // Unknown tag data — return empty (could be unwritten tag)
  if (blockType.length() > 0) {
    Serial.printf("  [SLOT %d] Unknown tag data: '%s'\n", slot, blockType.c_str());
  }
  return "";
}

// =============================================================================
// NeoPixel Feedback
// =============================================================================
void setRing(uint8_t ring, uint32_t color) {
  uint16_t offset = ring * LEDS_PER_RING;
  for (uint16_t i = 0; i < LEDS_PER_RING; i++) {
    strip.setPixelColor(offset + i, (i % LED_SKIP == 0) ? color : 0);
  }
}

void clearRing(uint8_t ring) { setRing(ring, 0); }

void showAllRings(uint32_t color) {
  for (uint8_t i = 0; i < NUM_SLOTS; i++) setRing(i, color);
  strip.show();
}

void rainbowSweep(uint16_t durationMs) {
  unsigned long start = millis();
  while (millis() - start < durationMs) {
    uint16_t elapsed = millis() - start;
    uint16_t hueBase = (elapsed * 65536UL) / durationMs;
    for (uint16_t i = 0; i < TOTAL_LEDS; i++) {
      if (i % LED_SKIP == 0) {
        uint16_t hue = hueBase + (i * 65536UL / TOTAL_LEDS);
        strip.setPixelColor(i, strip.gamma32(strip.ColorHSV(hue)));
      }
    }
    strip.show();
    delay(20);
  }
}

void flashColor(uint32_t color, uint8_t flashes, uint16_t onMs, uint16_t offMs) {
  for (uint8_t f = 0; f < flashes; f++) {
    showAllRings(color);
    delay(onMs);
    showAllRings(0);
    delay(offMs);
  }
}

// Update ring colors — white glow on occupied slots, off on empty
void updateRingColors() {
  uint32_t white = strip.Color(60, 60, 60);
  for (uint8_t i = 0; i < NUM_SLOTS; i++) {
    if (slotBlock[i].length() > 0) setRing(i, white);
    else clearRing(i);
  }
  strip.show();
}

// =============================================================================
// DFPlayer Sound
// =============================================================================
void initDFPlayer() {
  dfSerial.begin(9600, SERIAL_8N1, DFPLAYER_RX, DFPLAYER_TX);
  delay(500);
  if (dfPlayer.begin(dfSerial)) {
    dfPlayer.volume(25);  // 0-30
    Serial.println("[SOUND] DFPlayer OK");
  } else {
    Serial.println("[SOUND] DFPlayer FAILED — check wiring/SD card");
  }
}

void playSound(uint8_t track) {
  dfPlayer.play(track);
}

// =============================================================================
// Servo Door Control
// =============================================================================
void initServos() {
  servos[0].attach(SERVO1_PIN);
  servos[1].attach(SERVO2_PIN);
  servos[2].attach(SERVO3_PIN);
  for (uint8_t i = 0; i < 3; i++) {
    servos[i].writeMicroseconds(SERVO_REST_US);
  }
  delay(500);
  Serial.println("[SERVO] 3 servos initialized");
}

void pushDoor(uint8_t door) {
  if (door >= 3) return;
  Serial.printf("[SERVO] Pushing door %d\n", door);
  servos[door].writeMicroseconds(SERVO_PUSH_US);
  delay(SERVO_PUSH_MS);
  servos[door].writeMicroseconds(SERVO_REST_US);
  doorOpen[door] = true;
}

void resetAllDoors() {
  for (uint8_t i = 0; i < 3; i++) {
    servos[i].writeMicroseconds(SERVO_REST_US);
    doorOpen[i] = false;
  }
  Serial.println("[SERVO] All doors reset");
}

// =============================================================================
// Capacitive Touch Pads — Craft Submit
// =============================================================================
void calibrateTouch() {
  // Sample each pad several times and average for baseline
  uint32_t sumL = 0, sumR = 0;
  const uint8_t samples = 10;
  for (uint8_t i = 0; i < samples; i++) {
    sumL += touchRead(TOUCH_L_PIN);
    sumR += touchRead(TOUCH_R_PIN);
    delay(10);
  }
  touchBaselineL = sumL / samples;
  touchBaselineR = sumR / samples;
  touchThresholdL = touchBaselineL * TOUCH_THRESHOLD_PCT / 100;
  touchThresholdR = touchBaselineR * TOUCH_THRESHOLD_PCT / 100;
  Serial.printf("[TOUCH] Baseline L=%d R=%d, Threshold L=%d R=%d\n",
                touchBaselineL, touchBaselineR, touchThresholdL, touchThresholdR);
}

// Returns true if both pads are being touched simultaneously
bool bothPadsTouched() {
  uint16_t valL = touchRead(TOUCH_L_PIN);
  uint16_t valR = touchRead(TOUCH_R_PIN);
  return (valL < touchThresholdL) && (valR < touchThresholdR);
}

// =============================================================================
// Recipe Matching
// =============================================================================
// Returns recipe index (0-5) or -1 if no match
int checkRecipes() {
  for (uint8_t r = 0; r < NUM_RECIPES; r++) {
    bool match = true;
    for (uint8_t s = 0; s < NUM_SLOTS; s++) {
      String expected = RECIPES[r].grid[s];
      if (expected.length() == 0) {
        // Slot must be empty
        if (slotBlock[s].length() != 0) { match = false; break; }
      } else {
        if (slotBlock[s] != expected) { match = false; break; }
      }
    }
    if (match) return r;
  }
  return -1;
}

// Count how many slots have blocks
uint8_t filledSlotCount() {
  uint8_t count = 0;
  for (uint8_t i = 0; i < NUM_SLOTS; i++) {
    if (slotBlock[i].length() > 0) count++;
  }
  return count;
}

// =============================================================================
// Craft Execution
// =============================================================================
void executeCraft(int recipeIdx) {
  const Recipe& recipe = RECIPES[recipeIdx];
  Serial.printf("\n*** CRAFTED: %s → Door %d ***\n\n", recipe.name, recipe.door);

  lastCraftedRecipe = recipe.name;
  lastCraftTime = millis();

  // Green flash on occupied slots
  flashColor(strip.Color(0, 80, 0), 3, 200, 150);

  // Sound
  playSound(SND_CRAFT_SUCCESS);

  // Open the door
  pushDoor(recipe.door);

  // Rainbow celebration
  rainbowSweep(2000);

  // Restore white glow on occupied slots
  updateRingColors();

  craftTriggered = true;  // Don't re-trigger until grid changes
}

// =============================================================================
// WiFi AP + HTTP Status API
// =============================================================================
void initWiFi() {
  bool connected = false;

  // Try to join phone hotspot first
  Serial.printf("[WIFI] Looking for '%s'...\n", WIFI_STA_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_STA_SSID, WIFI_STA_PASS);

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < WIFI_STA_TIMEOUT) {
    delay(250);
    Serial.print(".");
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    connected = true;
    WiFi.setAutoReconnect(true);
    Serial.printf("[WIFI] Joined hotspot! IP: %s\n", WiFi.localIP().toString().c_str());
  } else {
    // Hotspot not found — create own AP
    WiFi.disconnect();
    WiFi.mode(WIFI_AP);
    WiFi.softAP(WIFI_AP_SSID, WIFI_AP_PASS, WIFI_AP_CHAN);
    Serial.printf("[WIFI] Hotspot not found — AP '%s' started, IP: %s\n",
                  WIFI_AP_SSID, WiFi.softAPIP().toString().c_str());
  }

  // mDNS: reachable at http://crafting-table.local
  if (MDNS.begin(MDNS_NAME)) {
    MDNS.addService("http", "tcp", 80);
    Serial.printf("[WIFI] mDNS: http://%s.local\n", MDNS_NAME);
  }

  // GET /status — JSON for fog map integration
  server.on("/status", HTTP_GET, []() {
    String json = "{\"slots\":[";
    for (uint8_t i = 0; i < NUM_SLOTS; i++) {
      json += "\"" + slotBlock[i] + "\"";
      if (i < NUM_SLOTS - 1) json += ",";
    }
    json += "],\"recipe\":";
    if (lastCraftedRecipe.length() > 0)
      json += "\"" + lastCraftedRecipe + "\"";
    else
      json += "null";
    json += ",\"lastCraft\":" + String(lastCraftTime) + "}";

    server.sendHeader("Access-Control-Allow-Origin", "*");
    server.send(200, "application/json", json);
  });

  // GET /reset — reset doors (game master utility)
  server.on("/reset", HTTP_GET, []() {
    resetAllDoors();
    craftTriggered = false;
    server.sendHeader("Access-Control-Allow-Origin", "*");
    server.send(200, "text/plain", "OK");
  });

  server.begin();
  Serial.println("[WIFI] HTTP server started on port 80");
}

// =============================================================================
// Tag Registration Mode — write block type to NTAG215 via serial
// =============================================================================
// Commands (type in Serial Monitor):
//   reg                — enter registration mode (uses slot 0)
//   reg 3              — enter registration mode using slot 3
//   write wood_plank   — write "wood_plank" to tag on active slot
//   read               — read current tag data on active slot
//   exit               — leave registration mode
//   craft              — manual submit (same as touching both pads)
//   reset              — reset all servo doors
//   doors              — push all doors open (game master override)

void writeBlockTag(uint8_t slot, const char* blockType) {
  selectSlot(slot);

  uint8_t uid[7];
  uint8_t uidLen;
  if (!nfc.readPassiveTargetID(PN532_MIFARE_ISO14443A, uid, &uidLen, 500)) {
    Serial.println("  No tag found — place tag on reader and try again");
    return;
  }

  // Prepare 16-byte buffer (4 pages × 4 bytes), zero-padded
  uint8_t buf[TAG_DATA_PAGES * 4];
  memset(buf, 0, sizeof(buf));
  strncpy((char*)buf, blockType, sizeof(buf) - 1);

  // Write pages 4-7
  for (uint8_t p = 0; p < TAG_DATA_PAGES; p++) {
    if (!nfc.ntag2xx_WritePage(TAG_DATA_PAGE + p, buf + p * 4)) {
      Serial.printf("  Write FAILED on page %d\n", TAG_DATA_PAGE + p);
      return;
    }
  }

  Serial.printf("  Written '%s' to tag on slot %d\n", blockType, slot);

  // Verify by reading back
  String readBack = readBlockType(slot);
  if (readBack == blockType) {
    Serial.println("  Verified OK ✓");
  } else {
    Serial.printf("  Verify MISMATCH: read back '%s'\n", readBack.c_str());
  }
}

void handleSerial() {
  if (!Serial.available()) return;

  String cmd = Serial.readStringUntil('\n');
  cmd.trim();
  if (cmd.length() == 0) return;

  if (cmd == "reset") {
    resetAllDoors();
    craftTriggered = false;
    return;
  }

  if (cmd == "doors") {
    for (uint8_t i = 0; i < 3; i++) pushDoor(i);
    return;
  }

  if (cmd == "craft") {
    // Manual submit via serial (same as touching both pads)
    int match = checkRecipes();
    if (match >= 0) {
      executeCraft(match);
    } else {
      Serial.println("[CRAFT] No matching recipe");
      playSound(SND_CRAFT_FAIL);
      flashColor(strip.Color(80, 0, 0), 2, 200, 150);
      updateRingColors();
    }
    return;
  }

  if (cmd.startsWith("reg")) {
    registrationMode = true;
    if (cmd.length() > 4) regSlot = cmd.substring(4).toInt();
    else regSlot = 0;
    if (regSlot >= NUM_SLOTS) regSlot = 0;
    Serial.printf("\n=== REGISTRATION MODE (slot %d) ===\n", regSlot);
    Serial.println("Commands: write <type>, read, exit");
    Serial.print("Types: ");
    for (uint8_t i = 0; i < NUM_BLOCK_TYPES; i++) {
      Serial.print(BLOCK_TYPES[i]);
      if (i < NUM_BLOCK_TYPES - 1) Serial.print(", ");
    }
    Serial.println();
    return;
  }

  if (cmd == "exit") {
    registrationMode = false;
    Serial.println("=== NORMAL MODE ===");
    return;
  }

  if (registrationMode) {
    if (cmd == "read") {
      String bt = readBlockType(regSlot);
      if (bt.length() > 0)
        Serial.printf("  Tag on slot %d: '%s'\n", regSlot, bt.c_str());
      else
        Serial.printf("  No valid tag on slot %d\n", regSlot);
    } else if (cmd.startsWith("write ")) {
      String blockType = cmd.substring(6);
      blockType.trim();
      // Validate
      bool valid = false;
      for (uint8_t i = 0; i < NUM_BLOCK_TYPES; i++) {
        if (blockType == BLOCK_TYPES[i]) { valid = true; break; }
      }
      if (valid) {
        writeBlockTag(regSlot, blockType.c_str());
      } else {
        Serial.printf("  Unknown block type: '%s'\n", blockType.c_str());
      }
    } else {
      Serial.println("  Unknown command. Use: write <type>, read, exit");
    }
  }
}

// =============================================================================
// Setup
// =============================================================================
void setup() {
  Serial.begin(9600);
  delay(2000);
  Serial.println();
  Serial.println("========================================");
  Serial.println("  Crafting Table Firmware v1.0");
  Serial.println("========================================");

  // I2C
  Wire.begin(SDA_PIN, SCL_PIN);
  Wire.setClock(100000);

  // NFC readers
  Serial.println("[RFID] Initializing 9 readers...");
  uint8_t ok = 0;
  for (uint8_t i = 0; i < NUM_SLOTS; i++) {
    readerOk[i] = initReader(i);
    if (readerOk[i]) ok++;
  }
  pcaDeselectAll();
  Serial.printf("[RFID] %d of %d readers OK\n", ok, NUM_SLOTS);

  // NeoPixels
  strip.begin();
  strip.setBrightness(BRIGHTNESS);
  strip.clear();
  strip.show();
  Serial.printf("[LED] %d LEDs across %d rings\n", TOTAL_LEDS, NUM_SLOTS);

  // Startup animation — quick white pulse across all rings
  for (uint8_t r = 0; r < NUM_SLOTS; r++) {
    setRing(r, strip.Color(60, 60, 60));
    strip.show();
    delay(80);
    clearRing(r);
    strip.show();
  }

  // DFPlayer
  initDFPlayer();

  // Servos
  initServos();

  // WiFi
  initWiFi();

  // Touch pads
  calibrateTouch();

  // Init slot state
  for (uint8_t i = 0; i < NUM_SLOTS; i++) {
    slotBlock[i] = "";
    slotPresent[i] = false;
  }

  Serial.println();
  Serial.println("Ready! Place blocks, then touch both pads to craft.");
  Serial.println("Serial commands: reg, craft, reset, doors");
  Serial.println();
}

// =============================================================================
// Main Loop
// =============================================================================
void loop() {
  // Handle serial commands
  handleSerial();

  // Handle HTTP requests
  server.handleClient();

  // Reconnect WiFi if station mode dropped
  static unsigned long lastWifiCheck = 0;
  if (WiFi.getMode() == WIFI_STA && WiFi.status() != WL_CONNECTED
      && millis() - lastWifiCheck > 5000) {
    lastWifiCheck = millis();
    Serial.println("[WIFI] Reconnecting...");
    WiFi.reconnect();
  }

  // Skip scanning in registration mode
  if (registrationMode) {
    delay(50);
    return;
  }

  // --- Scan all 9 slots ---
  bool anyChange = false;

  for (uint8_t i = 0; i < NUM_SLOTS; i++) {
    if (!readerOk[i]) continue;

    String blockType = readBlockType(i);
    bool present = blockType.length() > 0;

    if (blockType != slotBlock[i]) {
      anyChange = true;
      slotBlock[i] = blockType;

      if (present && !slotPresent[i]) {
        Serial.printf("[SLOT %d] %s\n", i, blockType.c_str());
        playSound(SND_BLOCK_PLACE);
      } else if (!present && slotPresent[i]) {
        Serial.printf("[SLOT %d] removed\n", i);
      }
      slotPresent[i] = present;
    }
  }
  pcaDeselectAll();

  if (anyChange) {
    craftTriggered = false;  // Grid changed — allow new submit
    updateRingColors();
  }

  // --- Touch-to-craft: both pads must be touched simultaneously ---
  // Short touch = craft submit, long hold (2s) = game master reset
  if (bothPadsTouched()) {
    delay(TOUCH_DEBOUNCE_MS);
    if (!bothPadsTouched()) {
      delay(SCAN_INTERVAL_MS);
      return;
    }

    // Time how long both pads are held
    unsigned long holdStart = millis();
    while (bothPadsTouched() && millis() - holdStart < 2000) delay(50);

    if (bothPadsTouched()) {
      // Held 2+ seconds — game master reset
      Serial.println("[TOUCH] Long hold — RESET");
      resetAllDoors();
      craftTriggered = false;
      lastCraftedRecipe = "";
      flashColor(strip.Color(80, 0, 80), 3, 150, 100);  // Purple flash = reset
      updateRingColors();
      while (bothPadsTouched()) delay(50);  // Wait for release
    } else if (!craftTriggered) {
      // Short touch — craft submit
      Serial.println("[TOUCH] Submit!");
      int match = checkRecipes();

      if (match >= 0) {
        executeCraft(match);
      } else {
        Serial.println("[CRAFT] No matching recipe");
        playSound(SND_CRAFT_FAIL);
        flashColor(strip.Color(80, 0, 0), 2, 200, 150);
        updateRingColors();
      }
    }
  }

  delay(SCAN_INTERVAL_MS);
}
