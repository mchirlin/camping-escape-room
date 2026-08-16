// =============================================================================
// Crafting Table Firmware — Recipe Matching + Touch-to-Craft
// =============================================================================
//
// Purpose: Minecraft-themed escape room crafting table controller.
//   - 9 NFC slots detect block tags placed on the grid
//   - 3-second capacitive touch hold triggers recipe evaluation
//   - Matched recipes play sounds, animate LEDs, and open door servos
//   - WiFi AP mode with web UI for control, status, and game reset
//   - Tag registration: write Minecraft block type directly to NFC tag memory
//
// Hardware:
//   - ESP32 DevKit v1
//   - 2x PCA9548A I2C multiplexers (0x70, 0x71)
//   - 9x PN532 NFC readers (one per grid slot)
//   - 9x WS2812B NeoPixel 24-LED rings (daisy-chained)
//   - 1x DFPlayer Mini MP3 module (UART)
//   - 3x MG90S micro servos (one per door)
//   - 1x Vibration motor (via MOSFET)
//   - Capacitive touch pads
//
// Grid Layout (slot numbers):
//     6  7  8      ← top row
//     3  4  5      ← middle row
//     0  1  2      ← bottom row
//
// Recipes:
//   1. Wooden Pickaxe (door 0): wood_plank×3 top + stick×2 center column
//   2. Fishing Rod (door 1): sticks diagonal + strings right column
//   3. Gold Sword (door 2): gold_ingot×2 + stick center column
//   4. TNT (door 0): gunpowder/sand checkerboard
//   5. Compass (door 1): iron_ingot cross + redstone center
//   6. Diamond Shovel (door 2): diamond + stick×2 center column
//
// Pin assignments:
//   GPIO 18 — NeoPixel DIN
//   GPIO 17 — Servo 0 (door 0)
//   GPIO 16 — Servo 1 (door 1)
//   GPIO 4  — Servo 2 (door 2)
//   GPIO 25 — DFPlayer TX (ESP32 TX → DFPlayer RX)
//   GPIO 21 — I2C SDA
//   GPIO 22 — I2C SCL
//   GPIO 27 — Capacitive touch pad (Touch7)
//   GPIO 33 — Capacitive touch pad (Touch8)
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
//     GET /           — HTML control page
//     GET /cmd?c=L    — Light test (cycle rings)
//     GET /cmd?c=P    — Pixel crawl
//     GET /cmd?c=off  — All LEDs off
//     GET /status     — JSON status of slots, readers, touch, dfplayer, types
//     GET /log        — JSON array of recent log messages
//     GET /register?type=wood_plank — Read tag from slot 4, write type to tag
//     GET /reset      — Reset game (clear crafted flags, close doors)
//
// SD Card Sound Layout:
//   Folder 01: slot placement sounds (tracks 001-009)
//   Folder 02: recipe sounds (tracks 001-006 = success per recipe, 010 = error)
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
#define SERVO_PIN_0     17   // Servo 0 — J14 (door 0)
#define SERVO_PIN_1     16   // Servo 1 — J15 (door 1)
#define SERVO_PIN_2     4    // Servo 2 — J16 (door 2)
#define DFPLAYER_TX_PIN 25   // ESP32 TX → DFPlayer RX
#define I2C_SDA         21
#define I2C_SCL         22
#define TOUCH_PAD       27   // Touch7
#define TOUCH_PAD_2     33   // Touch8
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
#define PCA1_ADDR       0x70  // Slots 0-7
#define PCA2_ADDR       0x71  // Slot 8

// WiFi AP Config
#define WIFI_SSID       "CraftingTable"

// Registration slot (middle of the grid)
#define REGISTER_SLOT   4

// Tag memory layout: type string stored in pages 4-7 (NTAG215 user memory)
#define TAG_TYPE_START_PAGE  4
#define TAG_TYPE_NUM_PAGES   4
#define TAG_TYPE_MAX_LEN     14  // "amethyst_shard" = 14 chars

// Touch config
#define TOUCH_THRESHOLD  700  // Below this = touched
#define CRAFT_HOLD_MS    3000 // Hold 3 seconds to trigger crafting

// Servo config
#define SERVO_REST_DEG   90   // Resting: perpendicular (blocking door)
#define SERVO_PUSH_DEG   180  // Activated: rotated away (door released)
#define SERVO_HOLD_MS    500

// Tag read timeout (ms)
#define TAG_READ_TIMEOUT 50

// Number of recipes
#define NUM_RECIPES      13

// =============================================================================
// Block Types — valid types for tag registration
// =============================================================================
const char* BLOCK_TYPES[] = {
  "wood_plank", "sand", "stick", "iron_ingot", "string",
  "redstone", "diamond", "gold_ingot", "gunpowder", "coal",
  "copper_ingot", "amethyst_shard", "paper", "cobblestone", "tripwire_hook"
};
#define NUM_BLOCK_TYPES 15

// Abbreviated display names (for web grid)
const char* BLOCK_ABBREV[] = {
  "wood", "sand", "stick", "iron", "str",
  "red", "dia", "gold", "gun", "coal",
  "cop", "ame", "paper", "cob", "trip"
};

// Colors for each block type (RGB) — average pixel color from texture
const uint32_t BLOCK_COLORS[] = {
  0xA2824E,  // wood_plank
  0xDBCFA3,  // sand
  0x4B3815,  // stick
  0x9C9C9C,  // iron_ingot
  0x8F9A9B,  // string
  0x6B0500,  // redstone
  0x54BDB4,  // diamond
  0xDCB342,  // gold_ingot
  0x535353,  // gunpowder
  0x232124,  // coal
  0xB65C3E,  // copper_ingot
  0x9370C0,  // amethyst_shard
  0xD5D5D1,  // paper
  0x7F7F7F,  // cobblestone
  0x8E8576,  // tripwire_hook
};

// =============================================================================
// Recipe Definitions
// =============================================================================
// Grid layout:
//   slot6  slot7  slot8    (top row)
//   slot3  slot4  slot5    (middle row)
//   slot0  slot1  slot2    (bottom row)
//
// Each recipe: name, 9-slot pattern ("" = must be empty), door index (0-2)

struct Recipe {
  const char* name;
  const char* pattern[NUM_SLOTS];  // [0]-[8], "" means slot must be empty
  uint8_t doorIndex;               // Which door to open (0, 1, or 2)
};

const Recipe RECIPES[NUM_RECIPES] = {
  // Recipe 0: Wooden Pickaxe → door 0
  {
    "Wooden Pickaxe",
    {"", "stick", "", "", "stick", "", "wood_plank", "wood_plank", "wood_plank"},
    0
  },
  // Recipe 1: Fishing Rod → door 1
  {
    "Fishing Rod",
    {"stick", "", "string", "", "stick", "string", "", "", "stick"},
    1
  },
  // Recipe 2: Gold Sword → door 2
  {
    "Gold Sword",
    {"", "stick", "", "", "gold_ingot", "", "", "gold_ingot", ""},
    2
  },
  // Recipe 3: TNT → door 0
  {
    "TNT",
    {"gunpowder", "sand", "gunpowder", "sand", "gunpowder", "sand", "gunpowder", "sand", "gunpowder"},
    0
  },
  // Recipe 4: Compass → door 1
  {
    "Compass",
    {"", "iron_ingot", "", "iron_ingot", "redstone", "iron_ingot", "", "iron_ingot", ""},
    1
  },
  // Recipe 5: Diamond Shovel → door 2
  {
    "Diamond Shovel",
    {"", "stick", "", "", "stick", "", "", "diamond", ""},
    2
  },
  // Recipe 6: Torch → no door (bonus)
  // [    ] [coal]  [    ]
  // [    ] [stick] [    ]
  // [    ] [    ]  [    ]
  {
    "Torch",
    {"", "", "", "", "stick", "", "", "coal", ""},
    0
  },
  // Recipe 7: Map → no door (bonus)
  // [paper] [paper]  [paper]
  // [paper] [compass doesn't exist as block... use redstone] [paper]
  // [paper] [paper]  [paper]
  // Simplified: 8 paper + 1 redstone center (thematic stand-in for compass)
  {
    "Map",
    {"paper", "paper", "paper", "paper", "redstone", "paper", "paper", "paper", "paper"},
    1
  },
  // Recipe 8: Spyglass → no door (bonus)
  // [    ] [amethyst] [    ]
  // [    ] [copper]   [    ]
  // [    ] [copper]   [    ]
  {
    "Spyglass",
    {"", "copper_ingot", "", "", "copper_ingot", "", "", "amethyst_shard", ""},
    2
  },
  // Recipe 9: Diamond Pickaxe → no door (bonus)
  // [dia]   [dia]   [dia]
  // [    ]  [stick] [    ]
  // [    ]  [stick] [    ]
  {
    "Diamond Pickaxe",
    {"", "stick", "", "", "stick", "", "diamond", "diamond", "diamond"},
    0
  },
  // Recipe 10: Iron Sword → no door (bonus)
  // [    ] [iron]  [    ]
  // [    ] [iron]  [    ]
  // [    ] [stick] [    ]
  {
    "Iron Sword",
    {"", "stick", "", "", "iron_ingot", "", "", "iron_ingot", ""},
    2
  },
  // Recipe 11: Crossbow → no door (bonus)
  // [stick]  [iron]          [stick]
  // [string] [tripwire_hook] [string]
  // [    ]   [stick]         [    ]
  {
    "Crossbow",
    {"", "stick", "", "string", "tripwire_hook", "string", "stick", "iron_ingot", "stick"},
    1
  },
  // Recipe 12: Stone Pickaxe → no door (bonus)
  // [cobble] [cobble] [cobble]
  // [    ]   [stick]  [    ]
  // [    ]   [stick]  [    ]
  {
    "Stone Pickaxe",
    {"", "stick", "", "", "stick", "", "cobblestone", "cobblestone", "cobblestone"},
    0
  },
};

// =============================================================================
// Multiplexer channel mapping for each logical slot
// =============================================================================
const struct { uint8_t pca; uint8_t ch; } SLOT_MUX[NUM_SLOTS] = {
  {PCA2_ADDR, 0}, {PCA1_ADDR, 6}, {PCA1_ADDR, 7},  // Slots 0, 1, 2 (bottom row)
  {PCA1_ADDR, 1}, {PCA1_ADDR, 2}, {PCA1_ADDR, 5},  // Slots 3, 4, 5 (middle row)
  {PCA1_ADDR, 0}, {PCA1_ADDR, 3}, {PCA1_ADDR, 4},  // Slots 6, 7, 8 (top row)
};

// NeoPixel ring order in the daisy-chain (physical wiring order)
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
bool dfPlayerReady = false;
bool musicPlaying = true;           // Background music state
bool currentTouchState = false;    // Exposed for web status
int currentTouchVal1 = 0;          // Raw touch value pad 1
int currentTouchVal2 = 0;          // Raw touch value pad 2

// Tag UID and type tracking per slot
String slotUid[NUM_SLOTS];         // Current tag UID hex string (empty if no tag)
String slotType[NUM_SLOTS];        // Block type read from tag (empty if unregistered)

// Touch-to-craft state
unsigned long touchStartMs = 0;    // When touch first detected (0 = not touching)
bool craftTriggered = false;       // Prevents re-trigger while still holding
bool wasTouched = false;           // Previous touch state for edge detection

// Recipe state
bool recipeCrafted[NUM_RECIPES];   // Once crafted, don't re-trigger

// =============================================================================
// Circular Log Buffer
// =============================================================================
#define LOG_SIZE 20
String logBuffer[LOG_SIZE];
int logHead = 0;
int logCount = 0;

void logMsg(const String &msg) {
  Serial.println(msg);
  logBuffer[logHead] = msg;
  logHead = (logHead + 1) % LOG_SIZE;
  if (logCount < LOG_SIZE) logCount++;
}

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
// Animation: Rainbow Sweep (~2 seconds)
// =============================================================================
void rainbowSweep() {
  logMsg("[ANIM] Rainbow sweep");
  unsigned long startTime = millis();
  uint16_t hueOffset = 0;
  // Run for ~2 seconds, advancing hue each frame
  while (millis() - startTime < 2000) {
    for (uint16_t i = 0; i < TOTAL_LEDS; i++) {
      // Spread hue across the strip + offset for animation
      uint16_t pixelHue = hueOffset + (i * 65536L / TOTAL_LEDS);
      strip.setPixelColor(i, strip.gamma32(strip.ColorHSV(pixelHue, 255, 180)));
    }
    strip.show();
    hueOffset += 1500;  // Speed of rotation
    delay(20);
  }
  // Restore slot ring colors after animation
  for (uint8_t i = 0; i < NUM_SLOTS; i++) {
    int8_t ring = SLOT_TO_RING[i];
    if (ring >= 0) {
      if (slotActive[i] && slotType[i].length() > 0) {
        setRing(ring, getTypeColor(slotType[i]));
      } else if (slotActive[i]) {
        setRing(ring, 0xFFFFFF);
      } else {
        clearRing(ring);
      }
    }
  }
  strip.show();
}

// =============================================================================
// Animation: Flash Red (error feedback)
// =============================================================================
void flashRed() {
  logMsg("[ANIM] Flash red (no match)");
  for (uint8_t flash = 0; flash < 2; flash++) {
    // All rings red
    for (uint8_t i = 0; i < NUM_SLOTS; i++) {
      int8_t ring = SLOT_TO_RING[i];
      if (ring >= 0) setRing(ring, strip.Color(255, 0, 0));
    }
    strip.show();
    delay(250);
    // All rings off
    for (uint8_t i = 0; i < NUM_SLOTS; i++) {
      int8_t ring = SLOT_TO_RING[i];
      if (ring >= 0) clearRing(ring);
    }
    strip.show();
    delay(250);
  }
  // Restore slot ring colors
  for (uint8_t i = 0; i < NUM_SLOTS; i++) {
    int8_t ring = SLOT_TO_RING[i];
    if (ring >= 0) {
      if (slotActive[i] && slotType[i].length() > 0) {
        setRing(ring, getTypeColor(slotType[i]));
      } else if (slotActive[i]) {
        setRing(ring, 0xFFFFFF);
      } else {
        clearRing(ring);
      }
    }
  }
  strip.show();
}

// =============================================================================
// Vibration Patterns
// =============================================================================
void vibeBuzzSuccess() {
  // 3 short pulses
  for (uint8_t i = 0; i < 3; i++) {
    digitalWrite(MOTOR_PIN, HIGH);
    delay(100);
    digitalWrite(MOTOR_PIN, LOW);
    delay(100);
  }
}

void vibeBuzzError() {
  // 1 longer pulse
  digitalWrite(MOTOR_PIN, HIGH);
  delay(200);
  digitalWrite(MOTOR_PIN, LOW);
}

// =============================================================================
// Sound
// =============================================================================
void playSound(uint8_t track) {
  if (dfPlayerReady) {
    dfPlayer.disableLoop();
    dfPlayer.playFolder(1, 1);  // Folder 01, track 001 = block_place
  }
}

void playCraftSound(uint8_t recipeIndex) {
  if (dfPlayerReady) {
    dfPlayer.disableLoop();
    musicPlaying = false;
    dfPlayer.playFolder(2, 1);  // Folder 02, track 001 = craft_success
  }
}

void playErrorSound() {
  if (dfPlayerReady) {
    dfPlayer.disableLoop();
    dfPlayer.playFolder(2, 2);  // Folder 02, track 002 = craft_fail
  }
}

// =============================================================================
// Tag UID Helpers
// =============================================================================
String uidToHexString(uint8_t* uid, uint8_t uidLen) {
  String s = "";
  for (uint8_t i = 0; i < uidLen; i++) {
    if (uid[i] < 0x10) s += "0";
    s += String(uid[i], HEX);
  }
  s.toLowerCase();
  return s;
}

String uidToDisplayString(uint8_t* uid, uint8_t uidLen) {
  String s = "";
  for (uint8_t i = 0; i < uidLen; i++) {
    if (uid[i] < 0x10) s += "0";
    s += String(uid[i], HEX);
    if (i < uidLen - 1) s += ":";
  }
  s.toLowerCase();
  return s;
}

bool isValidBlockType(const String &type) {
  for (int i = 0; i < NUM_BLOCK_TYPES; i++) {
    if (type == BLOCK_TYPES[i]) return true;
  }
  return false;
}

String getTypeAbbrev(const String &type) {
  for (int i = 0; i < NUM_BLOCK_TYPES; i++) {
    if (type == BLOCK_TYPES[i]) return String(BLOCK_ABBREV[i]);
  }
  return "???";
}

uint32_t getTypeColor(const String &type) {
  for (int i = 0; i < NUM_BLOCK_TYPES; i++) {
    if (type == BLOCK_TYPES[i]) return BLOCK_COLORS[i];
  }
  return 0xFFFFFF;  // White fallback
}

// =============================================================================
// Tag Type Read/Write Helpers (NTAG215 pages 4-7)
// =============================================================================
bool writeTypeToTag(const String &type) {
  uint8_t len = type.length();
  if (len > TAG_TYPE_MAX_LEN) len = TAG_TYPE_MAX_LEN;

  uint8_t buf[16];
  memset(buf, 0, sizeof(buf));
  buf[0] = len;
  for (uint8_t i = 0; i < len; i++) {
    buf[1 + i] = (uint8_t)type.charAt(i);
  }

  for (uint8_t p = 0; p < TAG_TYPE_NUM_PAGES; p++) {
    uint8_t pageData[4];
    memcpy(pageData, &buf[p * 4], 4);
    if (!nfc.ntag2xx_WritePage(TAG_TYPE_START_PAGE + p, pageData)) {
      logMsgf("[TAG-WR] Failed writing page %d", TAG_TYPE_START_PAGE + p);
      return false;
    }
    delay(5);
  }
  return true;
}

String readTypeFromTag() {
  uint8_t buf[16];
  memset(buf, 0, sizeof(buf));

  for (uint8_t p = 0; p < TAG_TYPE_NUM_PAGES; p++) {
    uint8_t pageData[4];
    if (!nfc.ntag2xx_ReadPage(TAG_TYPE_START_PAGE + p, pageData)) {
      logMsgf("[TAG-RD] Failed reading page %d", TAG_TYPE_START_PAGE + p);
      return "";
    }
    memcpy(&buf[p * 4], pageData, 4);
  }

  uint8_t len = buf[0];
  if (len == 0 || len > TAG_TYPE_MAX_LEN) {
    return "";
  }

  String type = "";
  for (uint8_t i = 0; i < len; i++) {
    char c = (char)buf[1 + i];
    if (c < 0x20 || c > 0x7E) {
      return "";
    }
    type += c;
  }

  return type;
}

// =============================================================================
// Recipe Evaluation
// =============================================================================
// Returns recipe index (0-5) if grid matches a recipe, or -1 if no match.
int checkRecipes() {
  for (int r = 0; r < NUM_RECIPES; r++) {
    // Skip already-crafted recipes
    if (recipeCrafted[r]) continue;

    bool match = true;
    for (int i = 0; i < NUM_SLOTS; i++) {
      const char* expected = RECIPES[r].pattern[i];
      if (strlen(expected) == 0) {
        // Slot must be empty
        if (slotActive[i] || slotType[i].length() > 0) {
          match = false;
          break;
        }
      } else {
        // Slot must have this exact type
        if (!slotActive[i] || slotType[i] != String(expected)) {
          match = false;
          break;
        }
      }
    }
    if (match) return r;
  }
  return -1;
}

// =============================================================================
// Craft Execution
// =============================================================================
void executeCraft(int recipeIndex) {
  logMsgf("[CRAFT] === RECIPE MATCHED: %s (door %d) ===",
          RECIPES[recipeIndex].name, RECIPES[recipeIndex].doorIndex);

  // Mark as crafted
  recipeCrafted[recipeIndex] = true;

  // Play success sound
  playCraftSound(recipeIndex);

  // Rainbow sweep animation (~2 seconds)
  rainbowSweep();

  // Open the corresponding door
  servoSweepN(RECIPES[recipeIndex].doorIndex);

  // Haptic feedback: 3 short pulses
  vibeBuzzSuccess();

  logMsgf("[CRAFT] Door %d opened for %s",
          RECIPES[recipeIndex].doorIndex, RECIPES[recipeIndex].name);
}

void executeCraftFail() {
  logMsg("[CRAFT] No recipe match — error feedback");

  // Play error sound
  playErrorSound();

  // Flash red
  flashRed();

  // Short vibration
  vibeBuzzError();
}

// =============================================================================
// Servo Action
// =============================================================================
void servoSweep() {
  servoSweepN(2);
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
// Game Reset
// =============================================================================
void resetGame() {
  logMsg("[GAME] === RESET ===");
  // Clear crafted flags
  for (int i = 0; i < NUM_RECIPES; i++) {
    recipeCrafted[i] = false;
  }
  // Close all doors (return servos to rest)
  for (uint8_t i = 0; i < 3; i++) {
    servos[i]->attach(SERVO_PINS[i]);
    servos[i]->write(SERVO_REST_DEG);
  }
  delay(300);
  for (uint8_t i = 0; i < 3; i++) {
    servos[i]->detach();
  }
  logMsg("[GAME] All recipes cleared, doors closed");
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
.btn-reg{border-color:#4a9fa5}
.btn-reset{border-color:#cc4400;background:#3a1a00;color:#ff8844}
h2{color:#6b5b3a;font-size:1em;margin:12px 0 6px;border-bottom:1px solid #333;padding-bottom:4px}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-bottom:12px}
.slot{background:#2a2a2a;border:2px solid #333;padding:8px;text-align:center;font-size:0.8em;min-height:50px;cursor:pointer}
.slot.active{border-color:#5b8731;background:#2d3d20;color:#7ec842}
.slot.no-reader{border-color:#4a1a1a;color:#666}
.slot .stype{font-size:0.7em;color:#8b8;margin-top:2px}
.slot .stype.unreg{color:#b86}
.info{font-size:0.75em;color:#666;margin-bottom:8px}
.info span{margin-right:12px}
.info .on{color:#5b8731}
.info .off{color:#8b2020}
.reg-box{background:#222;border:1px solid #4a9fa5;padding:10px;margin-bottom:12px}
.reg-box select{background:#1a1a1a;color:#c8c8c8;border:1px solid #555;padding:4px;font-family:monospace;width:100%;margin:6px 0}
.reg-box .result{font-size:0.75em;margin-top:6px;min-height:1.2em;color:#8b8}
.reg-box .result.err{color:#b44}
.crafted{font-size:0.75em;color:#5b8731;margin-bottom:8px}
.crafted span{display:inline-block;margin:2px 6px 2px 0;padding:2px 6px;background:#2d3d20;border:1px solid #5b8731}
.crafted span.no{background:#2a2a2a;border-color:#333;color:#666}
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
<h2>Volume</h2>
<div class="btn-row">
<input type="range" id="vol" min="0" max="30" value="30" style="flex:1;accent-color:#5b8731" oninput="setVol(this.value)">
<span id="volval" style="min-width:30px;text-align:center;color:#c8c8c8">30</span>
</div>
<div class="btn-row">
<button class="btn-light" onclick="cmd('mon')">&#x1F3B5; Music ON</button>
<button class="btn-off" onclick="cmd('moff')">&#x1F507; Music OFF</button>
</div>
<h2>Slot Status</h2>
<div class="grid" id="grid"></div>
<div class="info">
<span>Touch1: <span id="tv1" class="off">-</span></span>
<span>Touch2: <span id="tv2" class="off">-</span></span>
<span>DFPlayer: <span id="dfp" class="off">-</span></span>
<button class="btn-refresh" onclick="refresh()">&#x1F504;</button>
</div>
<h2>Recipes</h2>
<div id="recipes" style="display:flex;flex-wrap:wrap;gap:12px;margin-bottom:12px"></div>
<h2>Game State</h2>
<div class="crafted" id="crafted"></div>
<div class="btn-row">
<button class="btn-reset" onclick="resetGame()">&#x1F504; Reset Game</button>
</div>
<h2>Log</h2>
<div id="log">Connecting...</div>
<h2>Register Tags</h2>
<div class="reg-box">
<p style="font-size:0.8em;color:#888">Place tag on <b>slot 4</b> (center), select type, tap Program.<br>Type is written directly to the tag's memory.</p>
<select id="btype">
<option value="wood_plank">wood_plank</option>
<option value="sand">sand</option>
<option value="stick">stick</option>
<option value="iron_ingot">iron_ingot</option>
<option value="string">string</option>
<option value="redstone">redstone</option>
<option value="diamond">diamond</option>
<option value="gold_ingot">gold_ingot</option>
<option value="gunpowder">gunpowder</option>
<option value="coal">coal</option>
<option value="copper_ingot">copper_ingot</option>
<option value="amethyst_shard">amethyst_shard</option>
<option value="paper">paper</option>
<option value="cobblestone">cobblestone</option>
<option value="tripwire_hook">tripwire_hook</option>
</select>
<div class="btn-row">
<button class="btn-reg" onclick="regTag()">&#x1F4BE; Program</button>
</div>
<div class="result" id="regres"></div>
</div>
<script>
function cmd(c){fetch('/cmd?c='+c).then(r=>r.text()).then(t=>{refresh()})}
function setVol(v){document.getElementById('volval').textContent=v;fetch('/volume?v='+v);}
function regTag(){
let t=document.getElementById('btype').value;
let el=document.getElementById('regres');
el.textContent='Programming...';el.className='result';
fetch('/register?type='+t).then(r=>r.json()).then(d=>{
if(d.success){el.textContent='Written to tag: '+d.type;el.className='result';}
else{el.textContent='FAIL: '+(d.error||'no tag');el.className='result err';}
refresh();
}).catch(e=>{el.textContent='Error: '+e;el.className='result err';});
}
function resetGame(){
if(confirm('Reset all recipes and close doors?')){
fetch('/reset').then(r=>r.json()).then(d=>{refresh();});
}}
function refresh(){
fetch('/status').then(r=>r.json()).then(d=>{
let g='';
let order=[6,7,8,3,4,5,0,1,2];
for(let k=0;k<9;k++){let j=order[k];
let cls='slot';
if(!d.readers[j])cls+=' no-reader';
else if(d.slots[j])cls+=' active';
let label=j+(d.slots[j]?' &#x2705;':d.readers[j]?' .':' &#x274C;');
let typeHtml='';
if(d.slots[j]&&d.types){let tp=d.types[j];
if(tp)typeHtml='<div class="stype">'+tp+'</div>';
else typeHtml='<div class="stype unreg">???</div>';
}
g+='<div class="'+cls+'" onclick="cmd(\'s'+j+'\')">'+label+typeHtml+'</div>';
}
document.getElementById('grid').innerHTML=g;
let te=document.getElementById('tv1');te.textContent=d.touchVal1;te.className=d.touch?'on':'off';
let t2=document.getElementById('tv2');t2.textContent=d.touchVal2;t2.className=d.touchVal2<1000?'on':'off';
let df=document.getElementById('dfp');df.textContent=d.dfplayer?'OK':'--';df.className=d.dfplayer?'on':'off';
// Crafted recipes display
if(d.crafted){
let names=['Pickaxe','Fish Rod','Gold Sword','TNT','Compass','Shovel','Torch','Map','Spyglass','Dia Pick','Iron Sword','Crossbow','Stone Pick'];
let h='';
for(let i=0;i<d.crafted.length;i++){
h+='<span class="'+(d.crafted[i]?'':'no')+'">'+names[i]+'</span>';
}
document.getElementById('crafted').innerHTML=h;
}
});
fetch('/log').then(r=>r.json()).then(arr=>{
document.getElementById('log').textContent=arr.join('\n');
let el=document.getElementById('log');el.scrollTop=el.scrollHeight;
});}
setInterval(refresh,2000);refresh();
fetch('/recipes').then(r=>r.json()).then(recipes=>{
let h='';
let abbr={'wood_plank':'wood','sand':'sand','stick':'stick','iron_ingot':'iron','string':'str','redstone':'red','diamond':'dia','gold_ingot':'gold','gunpowder':'gun','coal':'coal','copper_ingot':'cop','amethyst_shard':'ame','paper':'paper'};
recipes.forEach(r=>{
h+='<div style="background:#222;border:1px solid #444;padding:6px;width:140px">';
h+='<div style="font-size:0.75em;color:#5b8731;margin-bottom:4px;font-weight:bold">'+r.name+' (D'+r.door+')</div>';
h+='<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:2px">';
let order=[6,7,8,3,4,5,0,1,2];
for(let k=0;k<9;k++){let i=order[k];let p=r.pattern[i];
let bg=p?'#3a3a2a':'#1a1a1a';let txt=p?(abbr[p]||p.slice(0,4)):'';
h+='<div style="background:'+bg+';padding:2px;text-align:center;font-size:0.55em;min-height:18px;color:#aaa">'+txt+'</div>';
}
h+='</div></div>';
});
document.getElementById('recipes').innerHTML=h;
});
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
    for (uint8_t i = 0; i < NUM_SLOTS; i++) {
      slotActive[i] = false;
      slotUid[i] = "";
      slotType[i] = "";
    }
    logMsg("[WEB] All LEDs off");
    server.send(200, "text/plain", "OK: All off");
  } else if (c.startsWith("sv")) {
    int n = c.substring(2).toInt();
    if (n >= 0 && n <= 2) {
      server.send(200, "text/plain", "OK: Servo sweep");
      servoSweepN(n);
    } else {
      server.send(400, "text/plain", "Invalid servo (0-2)");
    }
  } else if (c.startsWith("s")) {
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
    digitalWrite(MOTOR_PIN, HIGH);
    logMsg("[WEB] Vibration motor ON");
    server.send(200, "text/plain", "OK: Motor ON");
  } else if (c == "voff") {
    digitalWrite(MOTOR_PIN, LOW);
    logMsg("[WEB] Vibration motor OFF");
    server.send(200, "text/plain", "OK: Motor OFF");
  } else if (c == "mon") {
    // Music on
    if (dfPlayerReady) {
      dfPlayer.enableLoop();
      dfPlayer.playFolder(3, 1);
      musicPlaying = true;
      logMsg("[SOUND] Music ON");
    }
    server.send(200, "text/plain", "OK: Music ON");
  } else if (c == "moff") {
    // Music off
    if (dfPlayerReady) {
      dfPlayer.disableLoop();
      dfPlayer.stop();
      musicPlaying = false;
      logMsg("[SOUND] Music OFF");
    }
    server.send(200, "text/plain", "OK: Music OFF");
  } else {
    server.send(400, "text/plain", "Unknown command");
  }
}

void handleStatus() {
  String json = "{\"touch\":";
  json += currentTouchState ? "true" : "false";
  json += ",\"touchVal1\":";
  json += currentTouchVal1;
  json += ",\"touchVal2\":";
  json += currentTouchVal2;
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
  json += "],\"types\":[";
  for (uint8_t i = 0; i < NUM_SLOTS; i++) {
    if (slotActive[i] && slotUid[i].length() > 0) {
      if (slotType[i].length() > 0) {
        String abbr = getTypeAbbrev(slotType[i]);
        json += "\"" + abbr + "\"";
      } else {
        json += "null";
      }
    } else {
      json += "null";
    }
    if (i < NUM_SLOTS - 1) json += ",";
  }
  json += "],\"crafted\":[";
  for (uint8_t i = 0; i < NUM_RECIPES; i++) {
    json += recipeCrafted[i] ? "true" : "false";
    if (i < NUM_RECIPES - 1) json += ",";
  }
  json += "],\"dfplayer\":";
  json += dfPlayerReady ? "true" : "false";
  json += "}";
  server.send(200, "application/json", json);
}

void handleLog() {
  String json = "[";
  int start = (logCount < LOG_SIZE) ? 0 : logHead;
  int count = (logCount < LOG_SIZE) ? logCount : LOG_SIZE;
  for (int i = 0; i < count; i++) {
    int idx = (start + i) % LOG_SIZE;
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
// Tag Registration Handler
// =============================================================================
void handleRegister() {
  String type = server.arg("type");

  if (!isValidBlockType(type)) {
    String json = "{\"success\":false,\"error\":\"invalid type: " + type + "\"}";
    server.send(400, "application/json", json);
    logMsgf("[REG] Invalid type: %s", type.c_str());
    return;
  }

  if (!readerOk[REGISTER_SLOT]) {
    server.send(200, "application/json", "{\"success\":false,\"error\":\"slot 4 reader not available\"}");
    logMsg("[REG] Slot 4 reader not available");
    return;
  }

  selectSlot(REGISTER_SLOT);

  if (SLOT_MUX[REGISTER_SLOT].pca == PCA2_ADDR) {
    nfc.begin();
    nfc.SAMConfig();
  }

  uint8_t uid[7];
  uint8_t uidLen;
  bool tagPresent = nfc.readPassiveTargetID(PN532_MIFARE_ISO14443A, uid, &uidLen, 200);

  if (!tagPresent) {
    pcaDeselectAll();
    server.send(200, "application/json", "{\"success\":false,\"error\":\"no tag on slot 4\"}");
    logMsg("[REG] No tag detected on slot 4");
    return;
  }

  String uidHex = uidToHexString(uid, uidLen);
  logMsgf("[REG] Tag found: %s — writing type '%s'...", uidHex.c_str(), type.c_str());

  bool writeOk = writeTypeToTag(type);
  if (!writeOk) {
    pcaDeselectAll();
    server.send(200, "application/json", "{\"success\":false,\"error\":\"write failed\"}");
    logMsg("[REG] FAILED to write type to tag");
    return;
  }

  // Verify write
  String readBack = readTypeFromTag();
  pcaDeselectAll();

  if (readBack != type) {
    logMsgf("[REG] VERIFY FAILED: wrote '%s', read back '%s'", type.c_str(), readBack.c_str());
    String json = "{\"success\":false,\"error\":\"verify failed\"}";
    server.send(200, "application/json", json);
    return;
  }

  // Update slot state if tag is currently active
  if (slotActive[REGISTER_SLOT] && slotUid[REGISTER_SLOT] == uidHex) {
    slotType[REGISTER_SLOT] = type;
  }

  logMsgf("[REG] SUCCESS: written as %s (verified)", type.c_str());

  String json = "{\"success\":true,\"type\":\"" + type + "\"}";
  server.send(200, "application/json", json);
}

// =============================================================================
// Game Reset Handler
// =============================================================================
void handleReset() {
  resetGame();
  server.send(200, "application/json", "{\"success\":true,\"message\":\"Game reset\"}");
}

// =============================================================================
// Recipes Handler — returns all recipes as JSON
// =============================================================================
void handleRecipes() {
  String json = "[";
  for (int r = 0; r < NUM_RECIPES; r++) {
    json += "{\"name\":\"";
    json += RECIPES[r].name;
    json += "\",\"door\":";
    json += RECIPES[r].doorIndex;
    json += ",\"pattern\":[";
    for (int i = 0; i < NUM_SLOTS; i++) {
      if (strlen(RECIPES[r].pattern[i]) > 0) {
        json += "\"";
        json += RECIPES[r].pattern[i];
        json += "\"";
      } else {
        json += "null";
      }
      if (i < NUM_SLOTS - 1) json += ",";
    }
    json += "]}";
    if (r < NUM_RECIPES - 1) json += ",";
  }
  json += "]";
  server.send(200, "application/json", json);
}

// =============================================================================
// Volume Handler
// =============================================================================
void handleVolume() {
  int v = server.arg("v").toInt();
  if (v < 0) v = 0;
  if (v > 30) v = 30;
  if (dfPlayerReady) {
    dfPlayer.volume(v);
  }
  logMsgf("[SOUND] Volume set to %d/30", v);
  server.send(200, "text/plain", "OK");
}

// =============================================================================
// Setup
// =============================================================================
void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println();
  Serial.println("========================================");
  Serial.println("  Crafting Table — Recipe Mode");
  Serial.println("========================================");
  Serial.println("  Touch 3s hold -> evaluate recipes");
  Serial.println("  RFID tags     -> colored ring + sound");
  Serial.println("  WiFi AP       -> web control panel");
  Serial.println("  Tag Reg       -> type written to tag");
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
  server.on("/register", handleRegister);
  server.on("/reset", handleReset);
  server.on("/recipes", handleRecipes);
  server.on("/volume", handleVolume);
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
    dfPlayer.volume(30);
    dfPlayerReady = true;
    logMsg("[SOUND] DFPlayer OK, volume 30/30");
    // Start background music (sweden — folder 03, track 001, looping)
    dfPlayer.enableLoop();
    dfPlayer.playFolder(3, 1);
    logMsg("[SOUND] Background music started (folder 03/001 — looping)");
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
    slotUid[i] = "";
    slotType[i] = "";
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

  // --- Recipe state ---
  for (int i = 0; i < NUM_RECIPES; i++) {
    recipeCrafted[i] = false;
  }
  logMsg("[CRAFT] 6 recipes loaded, none crafted");

  // --- Touch baseline ---
  logMsgf("[TOUCH] Threshold=%d, hold %dms to craft", TOUCH_THRESHOLD, CRAFT_HOLD_MS);

  logMsg("");
  logMsg("Running! Place blocks and hold touch pad 3s to craft.");
  logMsgf("  Web: http://%s/", WiFi.softAPIP().toString().c_str());
  logMsg("  Serial: 'L' = light test, 'P' = pixel crawl");
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

  // ----- CAPACITIVE TOUCH → 2-SECOND HOLD TO CRAFT (with vibration ramp-up) -----
  int touchVal = touchRead(TOUCH_PAD);
  int touchVal2 = touchRead(TOUCH_PAD_2);
  currentTouchVal1 = touchVal;
  currentTouchVal2 = touchVal2;
  bool isTouched = (touchVal < TOUCH_THRESHOLD) || (touchVal2 < TOUCH_THRESHOLD);
  currentTouchState = isTouched;

  if (isTouched) {
    if (!wasTouched) {
      // Touch just started — play start sound
      touchStartMs = millis();
      craftTriggered = false;
      if (dfPlayerReady) dfPlayer.playFolder(2, 3);  // Folder 02, track 003 = toast_in
      logMsgf("[TOUCH] Touched (val=%d) — hold 2s to craft", touchVal);
    }

    // Ramp up vibration: exponential curve for smooth perceived acceleration
    // Starts at ~50 (enough to spin the motor) and ramps to 255 over 3 seconds
    unsigned long elapsed = millis() - touchStartMs;
    if (!craftTriggered) {
      float progress = constrain((float)elapsed / CRAFT_HOLD_MS, 0.0, 1.0);
      // Exponential curve: progress^2 gives slow start, fast finish
      int duty = 50 + (int)(progress * progress * 205);
      analogWrite(MOTOR_PIN, duty);
    }

    // Check if held long enough to trigger craft
    if (!craftTriggered && (elapsed >= CRAFT_HOLD_MS)) {
      craftTriggered = true;
      analogWrite(MOTOR_PIN, 0);  // Motor off before evaluation
      logMsg("[TOUCH] 2s hold complete — evaluating recipes...");

      // Evaluate recipes
      int matchedRecipe = checkRecipes();
      if (matchedRecipe >= 0) {
        executeCraft(matchedRecipe);
      } else {
        executeCraftFail();
      }
    }
  } else {
    if (wasTouched) {
      // Released
      analogWrite(MOTOR_PIN, 0);
      if (!craftTriggered) {
        logMsgf("[TOUCH] Released early (val=%d) — no craft", touchVal);
      }
      craftTriggered = false;
      touchStartMs = 0;
    }
  }
  wasTouched = isTouched;

  // ----- RFID SCANNING → LIGHT + SOUND + TYPE READ FROM TAG -----
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

      // Store UID
      String uidHex = uidToHexString(uid, uidLen);
      slotUid[i] = uidHex;

      // Read type from tag memory
      String tagType = readTypeFromTag();
      if (tagType.length() > 0 && isValidBlockType(tagType)) {
        slotType[i] = tagType;
      } else {
        slotType[i] = "";
      }

      int8_t ring = SLOT_TO_RING[i];
      if (ring >= 0) {
        uint32_t color;
        if (slotType[i].length() > 0) {
          color = getTypeColor(slotType[i]);
        } else {
          color = 0xFFFFFF;  // White for unregistered
        }
        setRing(ring, color);
        strip.show();
      }

      playSound(i + 1);

      String uidDisp = uidToDisplayString(uid, uidLen);
      if (slotType[i].length() > 0) {
        logMsgf("[SLOT %d] Tag %s -> type: %s (ring %d)",
                i, uidDisp.c_str(), slotType[i].c_str(), ring);
      } else {
        logMsgf("[SLOT %d] Tag %s -> UNREGISTERED (ring %d)",
                i, uidDisp.c_str(), ring);
      }

    } else if (!tagPresent && slotActive[i]) {
      slotActive[i] = false;
      slotUid[i] = "";
      slotType[i] = "";
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
