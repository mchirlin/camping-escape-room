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
//   - 9x WS2812B NeoPixel 24-LED rings (daisy-chained) + 24 door LEDs
//     (8 per door, chained after the rings: door 0, then 1, then 2)
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
// Recipes (storyline order):
//   1. Compass (door 2): iron_ingot cross + redstone center
//   2. Stone Pickaxe (door 0): cobblestone×3 top + stick×2 center column
//   3. Map (door 1): paper×8 + compass center
//   4. Fishing Rod (door 2): sticks diagonal + strings right column
//   5. Diamond Pickaxe (door 0): diamond×3 top + stick×2 center column
//   6. Torch (door 1): coal directly above stick, any of 6 grid positions
//   7. Iron Sword (door 2): iron_ingot×2 + stick center column
//   8. Spyglass (door 0): amethyst + copper×2 center column
//   9. TNT (door 1): gunpowder/sand checkerboard
//
// Pin assignments:
//   GPIO 18 — NeoPixel DIN
//   GPIO 4  — Servo 0 (door 0)
//   GPIO 16 — Servo 1 (door 1)
//   GPIO 17 — Servo 2 (door 2)
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
//     GET /reset      — Reset game (all recipes unlocked, close doors)
//     GET /recipes    — JSON array of recipes (index, name, door, pattern)
//     GET /recipestate?r=N&s=locked|unlocked — Lock/unlock a recipe
//     GET /craft?r=N  — Force-fire a recipe (door + sound + lights), ignores grid
//
// SD Card Sound Layout:
//   Folder 01: slot placement sounds (tracks 001-009)
//   Folder 02: recipe sounds (004 = craft-success fanfare, 006 = TNT, 010 = error)
//   Folder 03: background music (001-010). Plays in sequence — each track
//              auto-advances to the next when it ends; wraps 010 -> 001.
//              Steve figurine jumps to the next track; after ~15s of silence
//              (MUSIC_IDLE_MS) background music resumes on its own.
//   Folder 04: celebration songs — gold_ingot cycles 001/003, dragon_egg plays 002
//
// =============================================================================

#include <Wire.h>
#include <Adafruit_PN532.h>
#include <Adafruit_NeoPixel.h>
#include <ESP32Servo.h>
#include <DFRobotDFPlayerMini.h>
#include <WiFi.h>
#include <WebServer.h>
#include <Preferences.h>

// =============================================================================
// Pin Definitions
// =============================================================================
#define NEOPIXEL_PIN    18
#define SERVO_PIN_0     4    // Servo 0 — J16 (door 0)
#define SERVO_PIN_1     16   // Servo 1 — J15 (door 1)
#define SERVO_PIN_2     17   // Servo 2 — J14 (door 2)
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
#define RING_LEDS       (NUM_SLOTS * LEDS_PER_RING)   // 216 grid ring LEDs
#define NUM_DOORS       3
#define DOOR_LEDS       8                             // LEDs inside each door
#define DOOR_LEDS_TOTAL (NUM_DOORS * DOOR_LEDS)       // 24 door LEDs
#define TOTAL_LEDS      (RING_LEDS + DOOR_LEDS_TOTAL) // 240 total on the chain
// Door LEDs are chained AFTER the 9 grid rings, 8 per door in door order 0,1,2.
// Door d occupies chain indices [RING_LEDS + d*DOOR_LEDS .. +DOOR_LEDS-1].
#define DOOR_LED_START(d)  (RING_LEDS + (d) * DOOR_LEDS)
#define LED_SKIP        2    // Light every-other LED
#define BRIGHTNESS      25

// PCA9548A addresses
#define PCA1_ADDR       0x70  // Slots 0-7
#define PCA2_ADDR       0x71  // Slot 8

// WiFi AP Config
#define WIFI_SSID       "CraftingTable"

// Registration slot (middle of the grid)
#define REGISTER_SLOT   4

// NDEF URI tag format — enables iPhone scanning + ESP32 reading
// URL: https://mchirlin.github.io/camping-escape-room/?scan=BLOCK_TYPE
// Uses NDEF URI prefix code 0x04 = "https://"
#define TAG_URL_PREFIX_CODE  0x04
#define TAG_NDEF_PAGES       18   // Pages to read when parsing (4 through 21)
#define TAG_CC_PAGE          3    // Capability Container page
#define TAG_DATA_START_PAGE  4    // NDEF message starts here
const char* TAG_URL_BASE = "mchirlin.github.io/camping-escape-room/?scan=";
#define TAG_URL_BASE_LEN     45   // strlen of TAG_URL_BASE
#define TAG_TYPE_MAX_LEN     14   // "amethyst_shard" = 14 chars

// Touch config
#define TOUCH_THRESHOLD  700  // Below this = touched
#define CRAFT_HOLD_MS    2000 // Hold 2 seconds to trigger crafting

// Servo config
#define SERVO_REST_DEG   90   // Resting: perpendicular (blocking door)
#define SERVO_PUSH_DEG   180  // Activated: rotated away (door released)
#define SERVO_HOLD_MS    500

// Tag read timeout (ms)
#define TAG_READ_TIMEOUT 50

// Number of recipes
#define NUM_RECIPES      20

// =============================================================================
// Block Types — valid types for tag registration
// =============================================================================
const char* BLOCK_TYPES[] = {
  "wood_plank", "sand", "stick", "iron_ingot", "string",
  "redstone", "diamond", "gold_ingot", "gunpowder", "coal",
  "copper_ingot", "amethyst_shard", "paper", "cobblestone", "tripwire_hook", "emerald",
  "compass", "steve", "tnt", "dragon_egg"
};
#define NUM_BLOCK_TYPES 20

// Abbreviated display names (for web grid)
const char* BLOCK_ABBREV[] = {
  "wood", "sand", "stick", "iron", "str",
  "red", "dia", "gold", "gun", "coal",
  "cop", "ame", "paper", "cob", "trip", "emer",
  "comp", "steve", "tnt", "egg"
};

// Colors for each block type (RGB) — average pixel color from texture
const uint32_t BLOCK_COLORS[] = {
  0xC8820A,  // wood_plank — warm oak brown
  0xE8D44D,  // sand — bright sandy yellow
  0x6B3A00,  // stick — dark brown
  0xD0D0D0,  // iron_ingot — bright silver
  0x40B0B0,  // string — teal/cyan
  0xFF0000,  // redstone — pure red
  0x00E5CC,  // diamond — bright cyan/aqua
  0xFFD700,  // gold_ingot — rich gold
  0x404040,  // gunpowder — dark grey
  0x1A1A1A,  // coal — near black (dim warm white on LEDs)
  0xE05820,  // copper_ingot — bright copper orange
  0xAA44FF,  // amethyst_shard — vivid purple
  0xF0F0E0,  // paper — warm white
  0x808080,  // cobblestone — medium grey
  0x8B7355,  // tripwire_hook — tan/khaki
  0x00FF40,  // emerald — vivid green
  0xE02020,  // compass — deep red
  0x00AAFF,  // steve — bright blue (Steve's shirt)
  0xFF2200,  // tnt — red
  0x9B30FF,  // dragon_egg — deep violet/purple
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
  uint8_t doorIndex;               // Which door to open (0, 1, 2, or 255=none)
  int8_t craftGroup;               // Recipes with same group share crafted state (-1 = standalone)
  uint32_t color;                  // Color of the item produced — used to light the door LEDs
};

const Recipe RECIPES[NUM_RECIPES] = {
  // === Storyline order (matches FLOW-v2.md) ===

  // Recipe 0-3: Crafting Table — 4 wood planks in any 2×2 corner (no door, Step 1)
  // All 4 share craftGroup 0 — crafting any one marks them all as crafted
  {
    "Crafting Table",
    {"wood_plank", "wood_plank", "", "wood_plank", "wood_plank", "", "", "", ""},
    255, 0, 0xC8820A   // oak brown
  },
  {
    "Crafting Table",
    {"", "wood_plank", "wood_plank", "", "wood_plank", "wood_plank", "", "", ""},
    255, 0, 0xC8820A
  },
  {
    "Crafting Table",
    {"", "", "", "wood_plank", "wood_plank", "", "wood_plank", "wood_plank", ""},
    255, 0, 0xC8820A
  },
  {
    "Crafting Table",
    {"", "", "", "", "wood_plank", "wood_plank", "", "wood_plank", "wood_plank"},
    255, 0, 0xC8820A
  },
  // Recipe 4: Compass → door 2 (Step 2)
  {
    "Compass",
    {"", "iron_ingot", "", "iron_ingot", "redstone", "iron_ingot", "", "iron_ingot", ""},
    2, -1, 0xE02020   // compass red
  },
  // Recipe 5: Stone Pickaxe → door 0 (Step 4 — "Cobblestone Pickaxe")
  {
    "Stone Pickaxe",
    {"", "stick", "", "", "stick", "", "cobblestone", "cobblestone", "cobblestone"},
    0, -1, 0x808080   // cobblestone grey
  },
  // Recipe 6: Map → door 1 (Step 6)
  {
    "Map",
    {"paper", "paper", "paper", "paper", "compass", "paper", "paper", "paper", "paper"},
    1, -1, 0xF0F0E0   // paper/parchment white
  },
  // Recipe 7: Fishing Rod → door 2 (Step 8)
  {
    "Fishing Rod",
    {"stick", "", "string", "", "stick", "string", "", "", "stick"},
    2, -1, 0x40B0B0   // string teal
  },
  // Recipe 8: Diamond Pickaxe → door 0 (Step 10)
  {
    "Diamond Pickaxe",
    {"", "stick", "", "", "stick", "", "diamond", "diamond", "diamond"},
    0, -1, 0x00E5CC   // diamond aqua
  },
  // Recipe 9-14: Torch → door 1 (Step 13)
  // Coal directly above a stick, valid in any of 6 grid positions
  // (3 columns × 2 vertical row-pairs). Orientation still matters —
  // coal must be on top, stick immediately below. All share craftGroup 1.
  {
    "Torch",  // left column, top pair: coal@6 / stick@3
    {"", "", "", "stick", "", "", "coal", "", ""},
    1, 1, 0xFF7000   // flame orange
  },
  {
    "Torch",  // left column, bottom pair: coal@3 / stick@0
    {"stick", "", "", "coal", "", "", "", "", ""},
    1, 1, 0xFF7000
  },
  {
    "Torch",  // center column, top pair: coal@7 / stick@4
    {"", "", "", "", "stick", "", "", "coal", ""},
    1, 1, 0xFF7000
  },
  {
    "Torch",  // center column, bottom pair: coal@4 / stick@1
    {"", "stick", "", "", "coal", "", "", "", ""},
    1, 1, 0xFF7000
  },
  {
    "Torch",  // right column, top pair: coal@8 / stick@5
    {"", "", "", "", "", "stick", "", "", "coal"},
    1, 1, 0xFF7000
  },
  {
    "Torch",  // right column, bottom pair: coal@5 / stick@2
    {"", "", "stick", "", "", "coal", "", "", ""},
    1, 1, 0xFF7000
  },
  // Recipe 15: Iron Sword → door 2 (Step 14)
  {
    "Iron Sword",
    {"", "stick", "", "", "iron_ingot", "", "", "iron_ingot", ""},
    2, -1, 0xD0D0D0   // iron silver
  },
  // Recipe 16: Spyglass → door 0 (Step 16)
  {
    "Spyglass",
    {"", "copper_ingot", "", "", "copper_ingot", "", "", "amethyst_shard", ""},
    0, -1, 0xAA44FF   // amethyst purple
  },
  // Recipe 17: TNT → door 1 (Step 20)
  {
    "TNT",
    {"gunpowder", "sand", "gunpowder", "sand", "gunpowder", "sand", "gunpowder", "sand", "gunpowder"},
    1, -1, 0xFF2200   // TNT red
  },
  // Recipe 18: Bow (no door — bonus)
  {
    "Bow",
    {"", "stick", "string", "stick", "", "string", "", "stick", "string"},
    255, -1, 0x8B5A2B   // bow wood brown
  },
  // Recipe 19: Crossbow (no door — bonus)
  {
    "Crossbow",
    {"", "stick", "", "string", "tripwire_hook", "string", "stick", "iron_ingot", "stick"},
    255, -1, 0x8B5A2B
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
bool musicPlaying = true;           // Background music is the current audio
bool celebrationPlaying = false;    // A long one-shot song (gold/dragon) is playing;
                                    // suppresses idle restart until it finishes
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

// Recipe state — two states: LOCKED (not craftable) and UNLOCKED (ready to craft).
// A successful (or manually triggered) craft returns the recipe to LOCKED, which
// both prevents an immediate re-fire and reads as "done" in the UI.
enum RecipeState : uint8_t { RECIPE_LOCKED = 0, RECIPE_UNLOCKED = 1 };
RecipeState recipeState[NUM_RECIPES];   // Persisted to flash via Preferences

// Preferences for persistent state (survives power cycle)
Preferences prefs;

// Jukebox state (Steve figurine cycles through music tracks)
#define JUKEBOX_NUM_TRACKS 10
uint8_t jukeboxTrack = 1;          // Current track (1-10, folder 03)
String lastSteveUid = "";          // Prevent re-trigger while Steve stays on table

// Background music is advanced on a TIMER, not the DFPlayer "track finished"
// event: the DFPlayer is wired TX-only (ESP32 -> module), so the module's
// status messages can't be received. Instead we track when the current track
// started and how long it runs, and move to the next track when it elapses.
// Exact measured folder-03 track lengths in milliseconds (from ffprobe on the
// SD-card files). A small pad is added at playback time so the song fully ends
// before we advance (the DFPlayer is TX-only, so we time from the play command
// and can't detect the true end). Index 0 = track 1, etc.
#define JUKEBOX_ADVANCE_PAD_MS  1500
const uint32_t JUKEBOX_TRACK_MS[JUKEBOX_NUM_TRACKS] = {
  229773,  // 001 sweden
   89714,  // 002 wet_hands
  280894,  // 003 mice_on_venus
  191053,  // 004 haggstrom
  188000,  // 005 living_mice
  209190,  // 006 subwoofer_lullaby
  255260,  // 007 danny
   68116,  // 008 dry_hands
  201585,  // 009 clark
  260544,  // 010 minecraft_calm
};
unsigned long musicTrackStartMs = 0;   // millis() when the current bg track began
unsigned long celebrationEndMs = 0;    // millis() when the current celebration song should be considered done

// Door LED auto-off — each door light turns off this long after it lights up
#define DOOR_LED_ON_MS  30000
// millis() at which each door's light should turn off (0 = off / no timer)
unsigned long doorLedOffAt[NUM_DOORS] = {0, 0, 0};

// Background music auto-advance + idle restart
// - When a background track finishes, the next one in sequence starts.
// - After MUSIC_IDLE_MS of silence (music stopped, nothing happening),
//   background music restarts on its own.
#define MUSIC_IDLE_MS   15000      // Idle time before background music resumes
unsigned long lastActivityMs = 0;  // millis() of the last notable activity
bool musicStoppedByUser = false;   // True after an explicit Stop (suppresses idle restart)

// Dragon egg state (plays a single song on folder 04, track 002)
String lastDragonEggUid = "";      // Prevent re-trigger while egg stays on table

// Gold ingot state (cycles through folder 04 tracks 001 and 003)
const uint8_t GOLD_TRACKS[] = {1, 3};   // Folder 04 tracks to cycle through
#define GOLD_NUM_TRACKS 2
uint8_t goldTrackIdx = 0;          // Index into GOLD_TRACKS
String lastGoldUid = "";           // Prevent re-trigger while gold stays on table

// Exact measured folder-04 (celebration song) durations in ms, by track number.
// Index 0 = track 1. Used to time when a gold/dragon song has finished.
const uint32_t CELEBRATION_TRACK_MS[3] = {
  180000,  // 001 gold victory song A
  180240,  // 002 dragon egg song
  170240,  // 003 gold victory song B
};

// LED spin mode — disabled, using solid color
// (spin code removed — too slow due to NFC scan cycle timing)

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
// Persistent Recipe State (NVS Flash)
// =============================================================================
void saveRecipeState() {
  prefs.begin("craft", false);
  for (int i = 0; i < NUM_RECIPES; i++) {
    char key[8];
    snprintf(key, sizeof(key), "r%d", i);
    prefs.putUChar(key, (uint8_t)recipeState[i]);
  }
  prefs.end();
}

void loadRecipeState() {
  prefs.begin("craft", true);  // read-only
  for (int i = 0; i < NUM_RECIPES; i++) {
    char key[8];
    snprintf(key, sizeof(key), "r%d", i);
    recipeState[i] = (RecipeState)prefs.getUChar(key, RECIPE_UNLOCKED);
  }
  prefs.end();
}

// Get the "unique recipe index" (skipping craftGroup duplicates) for status display
int getUniqueRecipeIndex(int rawIndex) {
  bool seenGroup[10];
  memset(seenGroup, 0, sizeof(seenGroup));
  int unique = 0;
  for (int i = 0; i < NUM_RECIPES; i++) {
    if (RECIPES[i].craftGroup >= 0) {
      if (seenGroup[RECIPES[i].craftGroup]) continue;
      seenGroup[RECIPES[i].craftGroup] = true;
    }
    if (i == rawIndex) return unique;
    unique++;
  }
  return -1;
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

// -----------------------------------------------------------------------------
// Door LED helpers — 5 LEDs per door, chained after the 9 grid rings.
// -----------------------------------------------------------------------------

// Scale an 0xRRGGBB color by a 0-255 brightness factor.
uint32_t scaleColor(uint32_t color, uint8_t factor) {
  uint8_t r = ((color >> 16) & 0xFF) * factor / 255;
  uint8_t g = ((color >> 8) & 0xFF) * factor / 255;
  uint8_t b = (color & 0xFF) * factor / 255;
  return strip.Color(r, g, b);
}

// Set all LEDs of one door to a solid color (does not call show()).
void setDoor(uint8_t door, uint32_t color) {
  if (door >= NUM_DOORS) return;
  uint16_t start = DOOR_LED_START(door);
  for (uint8_t i = 0; i < DOOR_LEDS; i++) strip.setPixelColor(start + i, color);
}

void clearDoor(uint8_t door) {
  setDoor(door, 0);
  if (door < NUM_DOORS) doorLedOffAt[door] = 0;  // cancel any pending auto-off
}

void clearAllDoorLeds() {
  for (uint8_t d = 0; d < NUM_DOORS; d++) clearDoor(d);
  strip.show();
}

// Playful reveal for the door that just opened: a quick fill-chase in the
// item's color, a couple of cheerful sparkle pulses, then leave the
// compartment lit steady in that color so the prop is illuminated.
void lightDoorReveal(uint8_t door, uint32_t color) {
  if (door >= NUM_DOORS) return;
  uint16_t start = DOOR_LED_START(door);
  logMsgf("[DOOR-LED] Door %d reveal (color 0x%06X)", door, color);

  // 1. Chase: light the 5 LEDs one at a time, bright, with a white leading spark.
  clearDoor(door);
  strip.show();
  for (uint8_t i = 0; i < DOOR_LEDS; i++) {
    // Trail already-lit LEDs in the item color
    for (uint8_t j = 0; j < i; j++) strip.setPixelColor(start + j, color);
    // Leading LED as a bright white-ish spark
    strip.setPixelColor(start + i, scaleColor(0xFFFFFF, 200));
    strip.show();
    delay(70);
  }

  // 2. Two cheerful sparkle pulses — alternate LEDs bright/dim in the item color.
  for (uint8_t pulse = 0; pulse < 2; pulse++) {
    for (uint8_t phase = 0; phase < 2; phase++) {
      for (uint8_t i = 0; i < DOOR_LEDS; i++) {
        bool bright = ((i + phase) % 2) == 0;
        strip.setPixelColor(start + i, scaleColor(color, bright ? 255 : 60));
      }
      strip.show();
      delay(120);
    }
  }

  // 3. Settle: leave the whole door lit steady in the item color.
  setDoor(door, color);
  strip.show();

  // Arm the auto-off timer — the light will turn off after DOOR_LED_ON_MS.
  doorLedOffAt[door] = millis() + DOOR_LED_ON_MS;
}

// Called every loop: turn off any door light whose auto-off time has passed.
void serviceDoorLeds() {
  unsigned long now = millis();
  bool changed = false;
  for (uint8_t d = 0; d < NUM_DOORS; d++) {
    if (doorLedOffAt[d] != 0 && (long)(now - doorLedOffAt[d]) >= 0) {
      setDoor(d, 0);
      doorLedOffAt[d] = 0;
      changed = true;
      logMsgf("[DOOR-LED] Door %d light auto-off", d);
    }
  }
  if (changed) strip.show();
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
  // Run for ~2 seconds, advancing hue each frame.
  // Only paints the grid ring LEDs (0..RING_LEDS-1) — never the door LEDs,
  // which are driven solely by the door functions.
  while (millis() - startTime < 2000) {
    for (uint16_t i = 0; i < RING_LEDS; i++) {
      // Spread hue across the rings + offset for animation
      uint16_t pixelHue = hueOffset + (i * 65536L / RING_LEDS);
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
// Animation: Victory Flash (gold_ingot scan — golden sparkle + sweep)
// =============================================================================
void victoryFlash() {
  logMsg("[ANIM] Victory flash (gold_ingot)");
  unsigned long startTime = millis();
  while (millis() - startTime < 2500) {
    // Alternating gold/white sparkle across all rings (grid LEDs only)
    for (uint16_t i = 0; i < RING_LEDS; i++) {
      uint32_t c;
      unsigned long t = millis() - startTime;
      int phase = (i + (int)(t / 80)) % 6;
      if (phase < 2) c = strip.Color(255, 215, 0);      // Gold
      else if (phase < 3) c = strip.Color(255, 255, 200); // Bright gold-white
      else if (phase < 4) c = strip.Color(200, 150, 0);  // Darker gold
      else c = 0;
      strip.setPixelColor(i, c);
    }
    strip.show();
    delay(30);
  }
  // Restore slot ring colors
  for (uint8_t i = 0; i < NUM_SLOTS; i++) {
    int8_t ring = SLOT_TO_RING[i];
    if (ring >= 0) {
      if (slotActive[i] && slotType[i].length() > 0) setRing(ring, getTypeColor(slotType[i]));
      else if (slotActive[i]) setRing(ring, 0xFFFFFF);
      else clearRing(ring);
    }
  }
  strip.show();
}

// =============================================================================
// Animation: Dragon Egg Shimmer (dragon_egg scan — purple sparkle + sweep)
// Mirrors victoryFlash() but in the amethyst/violet/magenta family so the
// End-dragon egg reads as mysterious rather than golden.
// =============================================================================
void dragonEggFlash() {
  logMsg("[ANIM] Dragon egg shimmer (dragon_egg)");
  unsigned long startTime = millis();
  while (millis() - startTime < 2500) {
    // Alternating purple/magenta sparkle across all rings (grid LEDs only)
    for (uint16_t i = 0; i < RING_LEDS; i++) {
      uint32_t c;
      unsigned long t = millis() - startTime;
      int phase = (i + (int)(t / 80)) % 6;
      if (phase < 2) c = strip.Color(155, 48, 255);       // Deep violet
      else if (phase < 3) c = strip.Color(220, 130, 255);  // Bright lavender
      else if (phase < 4) c = strip.Color(90, 0, 160);     // Darker purple
      else c = 0;
      strip.setPixelColor(i, c);
    }
    strip.show();
    delay(30);
  }
  // Restore slot ring colors
  for (uint8_t i = 0; i < NUM_SLOTS; i++) {
    int8_t ring = SLOT_TO_RING[i];
    if (ring >= 0) {
      if (slotActive[i] && slotType[i].length() > 0) setRing(ring, getTypeColor(slotType[i]));
      else if (slotActive[i]) setRing(ring, 0xFFFFFF);
      else clearRing(ring);
    }
  }
  strip.show();
}

// =============================================================================
// Animation: TNT Fuse + Explosion (synced to combined fuse+explosion audio)
// Phase 1 (0–2800ms): Fuse burns through rings in order, yellow spark on active ring
// Phase 2 (2800ms+): Bright white flash → expanding fireball → fade out
// =============================================================================
void explosionFlash() {
  logMsg("[ANIM] TNT fuse + explosion");

  // Fuse burn order (ring indices)
  const uint8_t fuseOrder[] = {8, 7, 6, 5, 0, 1, 2, 3, 4};
  const uint8_t fuseSteps = 9;
  const unsigned long fuseDuration = 2800;
  const unsigned long stepTime = fuseDuration / fuseSteps;  // ~311ms per step

  // === Phase 1: Start with all rings orange, ring 8 as bright fuse spark ===
  for (uint8_t ring = 0; ring < NUM_SLOTS; ring++) {
    uint16_t offset = ring * LEDS_PER_RING;
    uint32_t color = (ring == 8) ? strip.Color(255, 34, 0) : strip.Color(255, 100, 0);
    for (uint16_t i = 0; i < LEDS_PER_RING; i++) {
      strip.setPixelColor(offset + i, color);
    }
  }
  strip.show();

  // Burn through the fuse order
  unsigned long startTime = millis();
  for (uint8_t step = 0; step < fuseSteps; step++) {
    // Wait for this step's time slot
    while (millis() - startTime < (step + 1) * stepTime) {
      delay(10);
    }

    // Turn off the ring we just left (fuse burned away)
    uint8_t burnedRing = fuseOrder[step];
    uint16_t burnedOffset = burnedRing * LEDS_PER_RING;
    for (uint16_t i = 0; i < LEDS_PER_RING; i++) {
      strip.setPixelColor(burnedOffset + i, 0);
    }

    // Light the next ring as bright fuse spark (if there is one)
    if (step + 1 < fuseSteps) {
      uint8_t nextRing = fuseOrder[step + 1];
      uint16_t nextOffset = nextRing * LEDS_PER_RING;
      for (uint16_t i = 0; i < LEDS_PER_RING; i++) {
        strip.setPixelColor(nextOffset + i, strip.Color(255, 34, 0));
      }
    }

    strip.show();
  }

  // === Phase 2: Explosion (2800ms+) === (grid ring LEDs only, never doors)
  // Bright white flash
  for (uint16_t i = 0; i < RING_LEDS; i++) {
    strip.setPixelColor(i, strip.Color(255, 255, 255));
  }
  strip.show();
  delay(100);

  // Expanding fireball — reds, oranges, yellows
  unsigned long explodeStart = millis();
  while (millis() - explodeStart < 2000) {
    unsigned long t = millis() - explodeStart;
    for (uint16_t i = 0; i < RING_LEDS; i++) {
      int phase = (i * 7 + (int)(t / 40)) % 12;
      uint32_t c;
      if (phase < 3) c = strip.Color(255, 0, 0);        // Red
      else if (phase < 5) c = strip.Color(255, 100, 0);  // Orange
      else if (phase < 7) c = strip.Color(255, 200, 0);  // Yellow-orange
      else if (phase < 9) c = strip.Color(255, 255, 50); // Bright yellow
      else c = strip.Color(200, 50, 0);                   // Deep orange
      // Fade out over time
      uint8_t fade = (t > 1500) ? map(t, 1500, 2000, 255, 0) : 255;
      uint8_t r = ((c >> 16) & 0xFF) * fade / 255;
      uint8_t g = ((c >> 8) & 0xFF) * fade / 255;
      uint8_t b = (c & 0xFF) * fade / 255;
      strip.setPixelColor(i, strip.Color(r, g, b));
    }
    strip.show();
    delay(25);
  }

  // Restore slot ring colors
  for (uint8_t i = 0; i < NUM_SLOTS; i++) {
    int8_t ring = SLOT_TO_RING[i];
    if (ring >= 0) {
      if (slotActive[i] && slotType[i].length() > 0) setRing(ring, getTypeColor(slotType[i]));
      else if (slotActive[i]) setRing(ring, 0xFFFFFF);
      else clearRing(ring);
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

// Mark that something happened (resets the idle-restart timer). Also clears the
// "stopped by user" flag so activity re-enables the idle auto-resume.
void noteActivity() {
  lastActivityMs = millis();
  musicStoppedByUser = false;
}

// Start (or resume) background music on the current jukebox track, once (no
// single-track loop — the main loop advances to the next track when it ends).
void startBackgroundMusic() {
  if (!dfPlayerReady) return;
  dfPlayer.disableLoop();
  dfPlayer.playFolder(3, jukeboxTrack);
  musicPlaying = true;
  celebrationPlaying = false;
  musicStoppedByUser = false;
  musicTrackStartMs = millis();   // start the play-time timer for auto-advance
  lastActivityMs = millis();
  logMsgf("[SOUND] Background music playing — track %d/%d", jukeboxTrack, JUKEBOX_NUM_TRACKS);
}

// Advance to the next background track in sequence (wraps around) and play it.
void advanceBackgroundMusic() {
  jukeboxTrack = (jukeboxTrack % JUKEBOX_NUM_TRACKS) + 1;
  startBackgroundMusic();
}

// Play a long one-shot celebration song (gold ingot / dragon egg) from the
// given folder/track, with its known duration (ms). The idle timer will NOT
// interrupt it — it plays to completion (timed, since the module is TX-only),
// after which background music resumes on the normal idle timer.
void playCelebrationSong(uint8_t folder, uint8_t track, uint32_t durationMs) {
  if (!dfPlayerReady) return;
  dfPlayer.disableLoop();
  musicPlaying = false;
  celebrationPlaying = true;
  celebrationEndMs = millis() + durationMs + JUKEBOX_ADVANCE_PAD_MS;
  dfPlayer.playFolder(folder, track);
}

// Called every loop. Advances/resumes background music on TIMERS (the DFPlayer
// is TX-only, so we can't receive its "track finished" event):
//   1. Auto-advance: when the current background track's measured duration has
//      elapsed, roll to the next track in sequence.
//   2. Celebration end: when a long gold/dragon song's duration elapses, mark
//      it done so the idle timer can bring background music back.
//   3. Idle restart: after MUSIC_IDLE_MS of silence (and not stopped by the
//      user), resume background music on the current track.
void serviceBackgroundMusic() {
  if (!dfPlayerReady) return;

  unsigned long now = millis();

  // 1. Background track auto-advance (timed).
  if (musicPlaying) {
    uint32_t trackLen = JUKEBOX_TRACK_MS[jukeboxTrack - 1] + JUKEBOX_ADVANCE_PAD_MS;
    if (now - musicTrackStartMs >= trackLen) {
      advanceBackgroundMusic();
      return;  // startBackgroundMusic reset the timer; done for this pass
    }
  }

  // 2. Celebration song end (timed).
  if (celebrationPlaying && (long)(now - celebrationEndMs) >= 0) {
    celebrationPlaying = false;
    lastActivityMs = now;  // begin the idle countdown from the song's end
  }

  // 3. Idle restart: quiet long enough, not deliberately stopped, and no long
  // celebration song currently playing (those must finish uninterrupted).
  if (!musicPlaying && !celebrationPlaying && !musicStoppedByUser &&
      (millis() - lastActivityMs >= MUSIC_IDLE_MS)) {
    logMsg("[SOUND] Idle timeout — resuming background music");
    startBackgroundMusic();
  }
}

void playSound(uint8_t track) {
  if (dfPlayerReady) {
    dfPlayer.disableLoop();
    musicPlaying = false;       // A one-shot effect is now playing (not background music)
    celebrationPlaying = false; // ...and it's short, so the idle timer governs resume
    dfPlayer.playFolder(1, 1);  // Folder 01, track 001 = block_place
  }
}

void playCraftSound(uint8_t recipeIndex) {
  if (dfPlayerReady) {
    dfPlayer.disableLoop();
    musicPlaying = false;
    celebrationPlaying = false;
    dfPlayer.playFolder(2, 4);  // Folder 02, track 004 = victory fanfare (craft success)
  }
}

void playErrorSound() {
  if (dfPlayerReady) {
    dfPlayer.disableLoop();
    musicPlaying = false;       // A one-shot effect is now playing (not background music)
    celebrationPlaying = false;
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
// Tag Type Read/Write Helpers (NDEF URI format for iPhone + ESP32)
// =============================================================================
// Writes an NDEF URI record to the tag so iPhones can scan and open the URL:
//   https://mchirlin.github.io/camping-escape-room/?scan=BLOCK_TYPE
//
// NDEF structure on NTAG215 (pages 3+):
//   Page 3 (CC):   E1 10 3E 00
//   Page 4+:       03 LL D1 01   (TLV type=03, len=LL, NDEF hdr: MB|ME|SR, type_len=1)
//                  PP 55 04 xx   (payload_len=PP, type='U', prefix=0x04, URL bytes...)
//                  ...URL...
//                  FE            (terminator TLV)
// =============================================================================
bool writeTypeToTag(const String &type, const String &uid) {
  uint8_t typeLen = type.length();
  if (typeLen > TAG_TYPE_MAX_LEN) typeLen = TAG_TYPE_MAX_LEN;

  // Build the URI payload: prefix code + base URL + type + "&uid=" + uid
  // URI payload = 0x04 + "mchirlin.github.io/camping-escape-room/?scan=" + type + "&uid=" + uid
  const char* uidParam = "&uid=";
  uint8_t uidParamLen = 5;
  uint8_t uidLen = uid.length();
  uint8_t uriPayloadLen = 1 + TAG_URL_BASE_LEN + typeLen + uidParamLen + uidLen;

  // NDEF record: header(1) + type_len(1) + payload_len(1) + type(1) + payload
  // Since SR (Short Record) flag is set, payload_len is 1 byte
  uint8_t ndefRecordLen = 1 + 1 + 1 + 1 + uriPayloadLen;  // = 4 + uriPayloadLen

  // TLV: type(1) + length(1) + NDEF record + terminator(1)
  // Total bytes starting at page 4:
  //   03 LL [NDEF record bytes...] FE
  uint8_t ndefMsgLen = ndefRecordLen;  // Length field in TLV = size of NDEF record

  // Build the full byte buffer (page 4 onward)
  uint8_t buf[100];  // Max ~88 bytes needed (type + uid)
  memset(buf, 0, sizeof(buf));
  uint8_t idx = 0;

  // TLV header
  buf[idx++] = 0x03;            // NDEF Message TLV type
  buf[idx++] = ndefMsgLen;      // Length of NDEF message

  // NDEF record header
  buf[idx++] = 0xD1;            // MB=1, ME=1, CF=0, SR=1, IL=0, TNF=001 (Well-Known)
  buf[idx++] = 0x01;            // Type length = 1
  buf[idx++] = uriPayloadLen;   // Payload length (short record, 1 byte)
  buf[idx++] = 0x55;            // Type = 'U' (URI record)

  // URI payload
  buf[idx++] = TAG_URL_PREFIX_CODE;  // 0x04 = "https://"
  memcpy(&buf[idx], TAG_URL_BASE, TAG_URL_BASE_LEN);
  idx += TAG_URL_BASE_LEN;
  for (uint8_t i = 0; i < typeLen; i++) {
    buf[idx++] = (uint8_t)type.charAt(i);
  }
  // Append &uid=XXXX
  memcpy(&buf[idx], uidParam, uidParamLen);
  idx += uidParamLen;
  for (uint8_t i = 0; i < uidLen; i++) {
    buf[idx++] = (uint8_t)uid.charAt(i);
  }

  // Terminator TLV
  buf[idx++] = 0xFE;

  // Pad with zeros to fill 2 extra pages after terminator (iOS compatibility)
  while (idx % 4 != 0) buf[idx++] = 0x00;
  // Add 2 more empty pages
  for (int i = 0; i < 8; i++) buf[idx++] = 0x00;

  uint8_t totalBytes = idx;
  uint8_t numPages = (totalBytes + 3) / 4;  // Round up to full pages

  // Write NDEF data starting at page 4
  for (uint8_t p = 0; p < numPages; p++) {
    uint8_t pageData[4];
    memcpy(pageData, &buf[p * 4], 4);
    if (!nfc.ntag2xx_WritePage(TAG_DATA_START_PAGE + p, pageData)) {
      logMsgf("[TAG-WR] Failed writing page %d", TAG_DATA_START_PAGE + p);
      return false;
    }
    delay(5);
  }

  logMsgf("[TAG-WR] Wrote NDEF URI (%d bytes, %d pages) type=%s",
          totalBytes, numPages, type.c_str());
  return true;
}

String readTypeFromTag() {
  // The type string starts at a known offset in the NDEF URI:
  // Header (7 bytes) + base URL (46 bytes) = byte 53 from page 4
  // "?scan=" (6 bytes) at byte 47, type starts at byte 53
  // Byte 53 from page 4 = page 4 + (53/4) = page 17, offset 1
  // Read pages 17-20 (16 bytes) to get the type string
  
  #define TYPE_START_PAGE 17  // Page where "?scan=" region begins
  #define TYPE_PAGES 4        // 4 pages = 16 bytes (more than enough)
  
  uint8_t buf[16];
  memset(buf, 0, sizeof(buf));

  for (uint8_t p = 0; p < TYPE_PAGES; p++) {
    uint8_t pageData[16];
    memset(pageData, 0, sizeof(pageData));
    if (!nfc.ntag2xx_ReadPage(TYPE_START_PAGE + p, pageData)) {
      logMsgf("[TAG-RD] Failed reading page %d", TYPE_START_PAGE + p);
      return "";
    }
    memcpy(&buf[p * 4], pageData, 4);
  }

  // Debug: print what we read
  String hexDump = "[TAG-RD] Pg17+: ";
  for (uint8_t i = 0; i < 16; i++) {
    if (buf[i] < 0x10) hexDump += "0";
    hexDump += String(buf[i], HEX);
    hexDump += " ";
  }
  logMsg(hexDump);

  // Type string starts at byte 1 of page 17 (known fixed offset)
  // Header(7) + base_url(46) + "?scan="(6) = byte 59 from page 4
  // Page 17 starts at byte (17-4)*4 = 52 from page 4
  // So type starts at byte 59 - 52 = 7... but we see it at byte 1.
  // Just find the first printable lowercase/underscore char after any null/padding
  int startPos = -1;
  for (uint8_t i = 0; i < 16; i++) {
    if (buf[i] >= 'a' && buf[i] <= 'z') {
      startPos = i;
      break;
    }
  }

  if (startPos < 0) return "";

  // Extract type string (stop at '&' which starts the uid parameter)
  String type = "";
  for (uint8_t i = startPos; i < 16; i++) {
    uint8_t c = buf[i];
    if (c == '&' || c == 0xFE || c == 0x00 || c < 0x20 || c > 0x7E) break;
    type += (char)c;
    if (type.length() >= TAG_TYPE_MAX_LEN) break;
  }

  return type;
}

// =============================================================================
// Recipe Evaluation
// =============================================================================
// Returns recipe index (0-5) if grid matches a recipe, or -1 if no match.
int checkRecipes() {
  for (int r = 0; r < NUM_RECIPES; r++) {
    // Only unlocked recipes are craftable
    if (recipeState[r] != RECIPE_UNLOCKED) continue;

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
  noteActivity();  // A craft happened — resets the idle-restart timer
  logMsgf("[CRAFT] === RECIPE MATCHED: %s (door %d) ===",
          RECIPES[recipeIndex].name, RECIPES[recipeIndex].doorIndex);

  // Return to LOCKED (and all recipes in the same craftGroup). Locked means
  // "not craftable right now" — prevents immediate re-fire and reads as done.
  recipeState[recipeIndex] = RECIPE_LOCKED;
  if (RECIPES[recipeIndex].craftGroup >= 0) {
    for (int i = 0; i < NUM_RECIPES; i++) {
      if (RECIPES[i].craftGroup == RECIPES[recipeIndex].craftGroup) {
        recipeState[i] = RECIPE_LOCKED;
      }
    }
  }
  saveRecipeState();

  // Play success sound
  playCraftSound(recipeIndex);

  // Rainbow sweep animation (~2 seconds)
  rainbowSweep();

  // Open the corresponding door (skip if no door assigned)
  if (RECIPES[recipeIndex].doorIndex < NUM_DOORS) {
    uint8_t door = RECIPES[recipeIndex].doorIndex;
    servoSweepN(door);
    // Light the opened compartment playfully, in the produced item's color
    lightDoorReveal(door, RECIPES[recipeIndex].color);
  }

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
  // Reset all recipe states to UNLOCKED
  for (int i = 0; i < NUM_RECIPES; i++) {
    recipeState[i] = RECIPE_UNLOCKED;
  }
  saveRecipeState();
  // Close all doors (return servos to rest)
  for (uint8_t i = 0; i < 3; i++) {
    servos[i]->attach(SERVO_PINS[i]);
    servos[i]->write(SERVO_REST_DEG);
  }
  delay(300);
  for (uint8_t i = 0; i < 3; i++) {
    servos[i]->detach();
  }
  // Turn off all door compartment LEDs
  clearAllDoorLeds();
  logMsg("[GAME] All recipes unlocked, doors closed");
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
.tabs{display:flex;gap:0;margin-bottom:16px;border-bottom:2px solid #333}
.tab{flex:1;padding:10px 4px;text-align:center;cursor:pointer;color:#666;font-size:0.85em;font-weight:bold;border-bottom:2px solid transparent;margin-bottom:-2px}
.tab.active{color:#5b8731;border-bottom-color:#5b8731}
.panel{display:none}
.panel.active{display:block}
.btn-row{display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap}
button{flex:1;min-width:100px;min-height:52px;border:3px solid #3d3d3d;background:#2d2d2d;color:#c8c8c8;font-family:'Courier New',monospace;font-size:1em;font-weight:bold;cursor:pointer;border-radius:0}
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
.rcard{background:#222;border:1px solid #444;padding:6px}
.rcard.locked{border-color:#8b2020}
.rcard.unlocked{border-color:#5b8731}
.rcard .rhead{display:flex;justify-content:space-between;align-items:center;margin-bottom:4px}
.rcard .rname{font-size:0.75em;color:#5b8731;font-weight:bold}
.rcard .rbadge{font-size:0.6em;padding:1px 5px;border:1px solid;border-radius:2px;text-transform:uppercase;letter-spacing:1px}
.rcard .rbadge.locked{color:#e08080;border-color:#8b2020;background:#2a1414}
.rcard .rbadge.unlocked{color:#7ec842;border-color:#5b8731;background:#1d2913}
.rcard .rgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:2px;margin-bottom:5px}
.rcard .rcell{padding:2px;text-align:center;font-size:0.55em;min-height:18px;color:#aaa}
.rcard .ract{display:flex;gap:3px}
.rcard .ract button{flex:1;min-width:0;min-height:28px;font-size:0.6em;padding:2px;border-width:2px}
.rcard .b-lock{border-color:#8b2020}
.rcard .b-unlock{border-color:#5b8731}
.rcard .b-craft{border-color:#4a9fa5;color:#7ecfd6}
#log{background:#111;border:1px solid #333;padding:8px;height:180px;overflow-y:auto;font-size:0.7em;line-height:1.4;white-space:pre-wrap;word-break:break-all}
</style></head><body>
<h1>&#x2B1C; Crafting Table</h1>
<p class="subtitle">Escape Room Control Panel</p>
<div class="tabs">
<div class="tab active" onclick="showTab(0)">Game</div>
<div class="tab" onclick="showTab(1)">Admin</div>
<div class="tab" onclick="showTab(2)">Test</div>
</div>
<div class="panel active" id="tab0">
<h2>Slot Status</h2>
<div class="grid" id="grid"></div>
<div class="info"><span>Touch1: <span id="tv1" class="off">-</span></span><span>Touch2: <span id="tv2" class="off">-</span></span></div>
<h2>Recipes</h2>
<p style="font-size:0.7em;color:#666;margin-bottom:8px">Each recipe shows its state. Lock/Unlock to control whether the table will craft it; Craft force-fires it (door + sound + lights) if a piece is lost.</p>
<div id="recipes" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;margin-bottom:12px"></div>
<div class="btn-row"><button class="btn-reset" onclick="resetGame()">&#x1F504; Reset Game (unlock all)</button></div>
</div>
<div class="panel" id="tab1">
<h2>Register Tags</h2>
<div class="reg-box">
<p style="font-size:0.8em;color:#888">Place tag on <b>slot 4</b> (center), select type, tap Program.</p>
<p style="font-size:0.85em;margin:6px 0;color:#7ec842" id="regcurrent">Current: —</p>
<select id="btype"><option value="amethyst_shard">amethyst_shard</option><option value="coal">coal</option><option value="cobblestone">cobblestone</option><option value="compass">compass</option><option value="copper_ingot">copper_ingot</option><option value="diamond">diamond</option><option value="dragon_egg">dragon_egg</option><option value="emerald">emerald</option><option value="gold_ingot">gold_ingot</option><option value="gunpowder">gunpowder</option><option value="iron_ingot">iron_ingot</option><option value="paper">paper</option><option value="redstone">redstone</option><option value="sand">sand</option><option value="steve">steve</option><option value="stick">stick</option><option value="string">string</option><option value="tnt">tnt</option><option value="tripwire_hook">tripwire_hook</option><option value="wood_plank">wood_plank</option></select>
<div class="btn-row"><button class="btn-reg" onclick="regTag()">&#x1F4BE; Program</button></div>
<div class="result" id="regres"></div>
</div>
<h2>Music</h2>
<div class="btn-row"><input type="range" id="vol" min="0" max="30" value="30" style="flex:1;accent-color:#5b8731" oninput="setVol(this.value)"><span id="volval" style="min-width:30px;text-align:center;color:#c8c8c8">30</span></div>
<div id="tracklist" style="margin-top:6px;display:flex;flex-wrap:wrap;gap:3px;"></div>
<script>
var trackNames=['Sweden','Wet Hands','Mice on Venus','Haggstrom','Living Mice','Subwoofer Lullaby','Danny','Dry Hands','Clark','Minecraft Calm'];
var currentTrackNum=0;
function buildTracks(){var h='';for(var i=0;i<trackNames.length;i++){var n=i+1;var cls=n===currentTrackNum?'background:#5b8731;color:#fff;border-color:#5b8731':'background:#333;color:#aaa;border-color:#555';h+='<button style="font-family:var(--mc-font,monospace);font-size:7px;padding:4px 6px;cursor:pointer;border:1px solid;border-radius:2px;'+cls+'" onclick="playTrack('+n+')">'+n+'. '+trackNames[i]+'</button>';}document.getElementById('tracklist').innerHTML=h;}
function playTrack(n){fetch('/cmd?c=trk'+n).then(function(){currentTrackNum=n;buildTracks();});}
buildTracks();
</script>
<h2>Status</h2>
<div class="info"><span>DFPlayer: <span id="dfp" class="off">-</span></span></div>
<h2>Log</h2>
<div id="log">Connecting...</div>
</div>
<div class="panel" id="tab2">
<h2>LED Tests</h2>
<div class="btn-row"><button class="btn-light" onclick="cmd('L')">&#x1F4A1; Light Test</button><button class="btn-crawl" onclick="cmd('P')">&#x1F41B; Pixel Crawl</button><button class="btn-off" onclick="cmd('off')">&#x26AB; All Off</button></div>
<h2>Door Lights</h2>
<div class="btn-row"><button class="btn-light" onclick="cmd('dr0')">&#x1F6AA; Door 0</button><button class="btn-light" onclick="cmd('dr1')">&#x1F6AA; Door 1</button><button class="btn-light" onclick="cmd('dr2')">&#x1F6AA; Door 2</button></div>
<div class="btn-row"><button class="btn-off" onclick="cmd('droff')">&#x26AB; Door Lights Off</button></div>
<h2>Motors</h2>
<div class="btn-row"><button class="btn-motor" onclick="cmd('sv0')">Servo 0</button><button class="btn-motor" onclick="cmd('sv1')">Servo 1</button><button class="btn-motor" onclick="cmd('sv2')">Servo 2</button></div>
<div class="btn-row"><button class="btn-motor vibe" onclick="cmd('von')">&#x1F4F3; Vibe ON</button><button class="btn-off" onclick="cmd('voff')">Vibe OFF</button></div>
<div class="btn-row"><input type="range" id="mtr" min="0" max="255" value="0" style="flex:1;accent-color:#6b4fa5" oninput="setMtr(this.value)"><span id="mtrval" style="min-width:30px;text-align:center;color:#c8c8c8">0</span></div>
<h2>Simulate Slots</h2>
<p style="font-size:0.75em;color:#666;margin-bottom:8px">Tap to toggle LEDs:</p>
<div class="grid" id="grid2"></div>
</div>
<script>
function showTab(n){document.querySelectorAll('.tab').forEach((t,i)=>{t.className='tab'+(i===n?' active':'')});document.querySelectorAll('.panel').forEach((p,i)=>{p.className='panel'+(i===n?' active':'')});}
function cmd(c){fetch('/cmd?c='+c).then(r=>r.text()).then(t=>{refresh()})}
function setVol(v){document.getElementById('volval').textContent=v;fetch('/volume?v='+v);}
function setMtr(v){document.getElementById('mtrval').textContent=v;fetch('/motor?pwm='+v);}
function regTag(){let t=document.getElementById('btype').value;let el=document.getElementById('regres');el.textContent='Programming...';el.className='result';fetch('/register?type='+t).then(r=>r.json()).then(d=>{if(d.success){el.textContent='Written: '+d.type;el.className='result';}else{el.textContent='FAIL: '+(d.error||'no tag');el.className='result err';}refresh();}).catch(e=>{el.textContent='Error: '+e;el.className='result err';});}
function resetGame(){if(confirm('Unlock all recipes and close doors?')){fetch('/reset').then(r=>r.json()).then(d=>{refresh();});}}
var recipeIndexOrder=[];
function setState(idx,s){fetch('/recipestate?r='+idx+'&s='+s).then(r=>r.json()).then(function(){refresh();});}
function forceCraft(idx,name){if(confirm('Force craft "'+name+'"? This opens the door and plays the sound/lights.')){fetch('/craft?r='+idx).then(r=>r.json()).then(function(){refresh();});}}
var ABBR={'wood_plank':'wood','sand':'sand','stick':'stick','iron_ingot':'iron','string':'str','redstone':'red','diamond':'dia','gold_ingot':'gold','gunpowder':'gun','coal':'coal','copper_ingot':'cop','amethyst_shard':'ame','paper':'paper','cobblestone':'cob','tripwire_hook':'trip','compass':'comp','emerald':'emer','dragon_egg':'egg'};
function buildRecipes(recipes){recipeIndexOrder=[];var h='';var order=[6,7,8,3,4,5,0,1,2];recipes.forEach(function(r){recipeIndexOrder.push(r.index);var door=(r.door<3)?('D'+r.door):'—';h+='<div class="rcard locked" id="rc'+r.index+'"><div class="rhead"><span class="rname">'+r.name+' ('+door+')</span><span class="rbadge locked" id="rb'+r.index+'">locked</span></div><div class="rgrid">';for(var k=0;k<9;k++){var i=order[k];var p=r.pattern[i];var bg=p?'#3a3a2a':'#1a1a1a';var txt=p?(ABBR[p]||p.slice(0,4)):'';h+='<div class="rcell" style="background:'+bg+'">'+txt+'</div>';}h+='</div><div class="ract"><button class="b-lock" onclick="setState('+r.index+',\'locked\')">Lock</button><button class="b-unlock" onclick="setState('+r.index+',\'unlocked\')">Unlock</button><button class="b-craft" onclick="forceCraft('+r.index+',\''+r.name.replace(/'/g,"")+'\')">Craft</button></div></div>';});document.getElementById('recipes').innerHTML=h;}
function applyRecipeStates(states){if(!states)return;for(var i=0;i<recipeIndexOrder.length&&i<states.length;i++){var idx=recipeIndexOrder[i];var s=states[i];var card=document.getElementById('rc'+idx);var badge=document.getElementById('rb'+idx);if(card){card.className='rcard '+s;}if(badge){badge.className='rbadge '+s;badge.textContent=s;}}}
function refresh(){fetch('/status').then(r=>r.json()).then(d=>{let g='',g2='';let order=[6,7,8,3,4,5,0,1,2];for(let k=0;k<9;k++){let j=order[k];let cls='slot';if(!d.readers[j])cls+=' no-reader';else if(d.slots[j])cls+=' active';let label=j+(d.slots[j]?' &#x2705;':d.readers[j]?' .':' &#x274C;');let typeHtml='';if(d.slots[j]&&d.types){let tp=d.types[j];if(tp)typeHtml='<div class="stype">'+tp+'</div>';else typeHtml='<div class="stype unreg">???</div>';}g+='<div class="'+cls+'">'+label+typeHtml+'</div>';g2+='<div class="'+cls+'" onclick="cmd(\'s'+j+'\')">'+j+'</div>';}document.getElementById('grid').innerHTML=g;let g2el=document.getElementById('grid2');if(g2el)g2el.innerHTML=g2;let te=document.getElementById('tv1');te.textContent=d.touchVal1;te.className=d.touch?'on':'off';let t2=document.getElementById('tv2');t2.textContent=d.touchVal2;t2.className=d.touchVal2<700?'on':'off';let df=document.getElementById('dfp');if(df){df.textContent=d.dfplayer?'OK':'--';df.className=d.dfplayer?'on':'off';}let rc=document.getElementById('regcurrent');if(rc){rc.textContent=d.regSlotType?'Current: '+d.regSlotType:'Current: (no tag)';}applyRecipeStates(d.recipeStates);if(typeof d.musicTrack!=='undefined'){currentTrackNum=d.musicTrack;buildTracks();}});fetch('/log').then(r=>r.json()).then(arr=>{document.getElementById('log').textContent=arr.join('\n');let el=document.getElementById('log');el.scrollTop=el.scrollHeight;});}
fetch('/recipes').then(r=>r.json()).then(function(recipes){buildRecipes(recipes);setInterval(refresh,2000);refresh();});
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
    clearAllDoorLeds();
    for (uint8_t i = 0; i < NUM_SLOTS; i++) {
      slotActive[i] = false;
      slotUid[i] = "";
      slotType[i] = "";
    }
    logMsg("[WEB] All LEDs off");
    server.send(200, "text/plain", "OK: All off");
  } else if (c == "droff") {
    // Turn off all door compartment LEDs
    clearAllDoorLeds();
    logMsg("[WEB] Door LEDs off");
    server.send(200, "text/plain", "OK: Door LEDs off");
  } else if (c.startsWith("dr")) {
    // Door light test: dr0/dr1/dr2 — run the reveal animation for that door.
    int n = c.substring(2).toInt();
    if (n >= 0 && n < NUM_DOORS) {
      // Distinct test color per door so they're easy to tell apart.
      const uint32_t testColors[NUM_DOORS] = {0x00E5CC, 0xFF7000, 0xAA44FF};  // aqua / orange / purple
      server.send(200, "text/plain", "OK: Door light test");
      lightDoorReveal((uint8_t)n, testColors[n]);
    } else {
      server.send(400, "text/plain", "Invalid door (0-2)");
    }
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
    // Music on — play current jukebox track (auto-advances when it ends)
    startBackgroundMusic();
    server.send(200, "text/plain", "OK: Music ON");
  } else if (c == "moff") {
    // Music off — stays off (idle restart is suppressed until next activity)
    if (dfPlayerReady) {
      dfPlayer.disableLoop();
      dfPlayer.stop();
      musicPlaying = false;
      celebrationPlaying = false;
      musicStoppedByUser = true;
      logMsg("[SOUND] Music OFF (by user)");
    }
    server.send(200, "text/plain", "OK: Music OFF");
  } else if (c.startsWith("trk")) {
    // Play specific track: trk1, trk2, ..., trk10 (auto-advances afterward)
    int trackNum = c.substring(3).toInt();
    if (trackNum >= 1 && trackNum <= JUKEBOX_NUM_TRACKS) {
      jukeboxTrack = trackNum;
      startBackgroundMusic();
      server.send(200, "text/plain", "OK: Track " + String(trackNum));
    } else {
      server.send(400, "text/plain", "Invalid track number");
    }
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
  json += "],\"recipeStates\":[";
  {
    bool seenGroup[10];
    memset(seenGroup, 0, sizeof(seenGroup));
    bool first = true;
    for (uint8_t i = 0; i < NUM_RECIPES; i++) {
      if (RECIPES[i].craftGroup >= 0) {
        if (seenGroup[RECIPES[i].craftGroup]) continue;
        seenGroup[RECIPES[i].craftGroup] = true;
      }
      if (!first) json += ",";
      first = false;
      // Report state as string: "locked" or "unlocked"
      json += (recipeState[i] == RECIPE_UNLOCKED) ? "\"unlocked\"" : "\"locked\"";
    }
  }
  json += "],\"dfplayer\":";
  json += dfPlayerReady ? "true" : "false";
  json += ",\"regSlotType\":";
  if (slotActive[REGISTER_SLOT] && slotType[REGISTER_SLOT].length() > 0) {
    json += "\"" + slotType[REGISTER_SLOT] + "\"";
  } else if (slotActive[REGISTER_SLOT]) {
    json += "\"unregistered\"";
  } else {
    json += "null";
  }
  json += ",\"musicTrack\":";
  json += musicPlaying ? String(jukeboxTrack) : "0";
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

  bool writeOk = writeTypeToTag(type, uidHex);
  if (!writeOk) {
    pcaDeselectAll();
    server.send(200, "application/json", "{\"success\":false,\"error\":\"write failed\"}");
    logMsg("[REG] FAILED to write type to tag");
    return;
  }

  // Verify write — re-detect tag first (PN532 may need re-selection after multi-page write)
  delay(50);
  uint8_t uid2[7];
  uint8_t uidLen2;
  nfc.readPassiveTargetID(PN532_MIFARE_ISO14443A, uid2, &uidLen2, 200);
  delay(10);
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

  // Immediately show the new block color on the register slot ring
  int8_t ring = SLOT_TO_RING[REGISTER_SLOT];
  if (ring >= 0) {
    setRing(ring, getTypeColor(type));
    strip.show();
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
// Recipe State Handler — lock/unlock individual recipes
// GET /recipestate?r=5&s=locked    (lock recipe index 5)
// GET /recipestate?r=5&s=unlocked  (unlock recipe index 5)
// GET /recipestate?name=Compass&s=locked (by name, affects all variants)
// =============================================================================
void handleRecipeState() {
  String state = server.arg("s");
  RecipeState newState;
  if (state == "locked") newState = RECIPE_LOCKED;
  else if (state == "unlocked") newState = RECIPE_UNLOCKED;
  else {
    server.send(400, "application/json", "{\"error\":\"invalid state (locked/unlocked)\"}");
    return;
  }

  // Find recipe by index or name
  String rArg = server.arg("r");
  String nameArg = server.arg("name");
  int count = 0;

  if (rArg.length() > 0) {
    int idx = rArg.toInt();
    if (idx >= 0 && idx < NUM_RECIPES) {
      recipeState[idx] = newState;
      // Also apply to craftGroup siblings
      if (RECIPES[idx].craftGroup >= 0) {
        for (int i = 0; i < NUM_RECIPES; i++) {
          if (RECIPES[i].craftGroup == RECIPES[idx].craftGroup) {
            recipeState[i] = newState;
            count++;
          }
        }
      } else {
        count = 1;
      }
    }
  } else if (nameArg.length() > 0) {
    for (int i = 0; i < NUM_RECIPES; i++) {
      if (nameArg.equalsIgnoreCase(String(RECIPES[i].name))) {
        recipeState[i] = newState;
        count++;
      }
    }
  } else {
    server.send(400, "application/json", "{\"error\":\"provide r=INDEX or name=NAME\"}");
    return;
  }

  saveRecipeState();
  logMsgf("[ADMIN] Recipe state: %s -> %s (%d variants)",
          nameArg.length() > 0 ? nameArg.c_str() : rArg.c_str(),
          state.c_str(), count);

  String json = "{\"success\":true,\"updated\":";
  json += count;
  json += ",\"state\":\"";
  json += state;
  json += "\"}";
  server.send(200, "application/json", json);
}

// =============================================================================
// Manual Craft Trigger — force-fires a recipe's full effect chain
// GET /craft?r=INDEX      (trigger by recipe index — the index from /recipes)
// GET /craft?name=Compass (trigger the first recipe matching this name)
//
// Runs the exact same executeCraft() path as a real grid match: opens the
// assigned door, plays the success sound, runs the animation, and returns the
// recipe to LOCKED. This is the "a kid lost a piece" escape hatch.
// =============================================================================
void handleCraft() {
  String rArg = server.arg("r");
  String nameArg = server.arg("name");
  int target = -1;

  if (rArg.length() > 0) {
    int idx = rArg.toInt();
    if (idx >= 0 && idx < NUM_RECIPES) target = idx;
  } else if (nameArg.length() > 0) {
    for (int i = 0; i < NUM_RECIPES; i++) {
      if (nameArg.equalsIgnoreCase(String(RECIPES[i].name))) { target = i; break; }
    }
  } else {
    server.send(400, "application/json", "{\"error\":\"provide r=INDEX or name=NAME\"}");
    return;
  }

  if (target < 0) {
    server.send(404, "application/json", "{\"error\":\"recipe not found\"}");
    return;
  }

  logMsgf("[ADMIN] Manual craft trigger: %s", RECIPES[target].name);
  // Respond before running effects — executeCraft blocks ~several seconds on
  // animation + servo, and we don't want the phone's fetch to time out.
  server.send(200, "application/json",
              "{\"success\":true,\"name\":\"" + String(RECIPES[target].name) + "\"}");
  executeCraft(target);
}

// =============================================================================
// Recipes Handler — returns all recipes as JSON
// =============================================================================
void handleRecipes() {
  String json = "[";
  bool seenGroup[10];
  memset(seenGroup, 0, sizeof(seenGroup));
  bool first = true;
  for (int r = 0; r < NUM_RECIPES; r++) {
    // Skip duplicate craftGroup entries (only show first variant)
    if (RECIPES[r].craftGroup >= 0) {
      if (seenGroup[RECIPES[r].craftGroup]) continue;
      seenGroup[RECIPES[r].craftGroup] = true;
    }
    if (!first) json += ",";
    first = false;
    json += "{\"index\":";
    json += r;
    json += ",\"name\":\"";
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
// Motor PWM Handler
// =============================================================================
void handleMotorPWM() {
  int pwm = server.arg("pwm").toInt();
  if (pwm < 0) pwm = 0;
  if (pwm > 255) pwm = 255;
  analogWrite(MOTOR_PIN, pwm);
  logMsgf("[MOTOR] PWM set to %d/255", pwm);
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
  server.on("/recipestate", handleRecipeState);
  server.on("/craft", handleCraft);
  server.on("/volume", handleVolume);
  server.on("/motor", handleMotorPWM);
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
  logMsgf("[LED] %d LEDs initialized (%d ring + %d door)", TOTAL_LEDS, RING_LEDS, DOOR_LEDS_TOTAL);

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
    // Start background music (folder 03, track 001). Plays once; the main loop
    // auto-advances to the next track when each one finishes.
    jukeboxTrack = 1;
    startBackgroundMusic();
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

  // --- Recipe state (load from flash) ---
  loadRecipeState();
  {
    int locked = 0, unlocked = 0;
    for (int i = 0; i < NUM_RECIPES; i++) {
      if (recipeState[i] == RECIPE_LOCKED) locked++;
      else unlocked++;
    }
    logMsgf("[CRAFT] State loaded: %d locked, %d unlocked", locked, unlocked);
  }

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

  // ----- BACKGROUND MUSIC SERVICE (auto-advance + idle restart) -----
  serviceBackgroundMusic();

  // ----- DOOR LED AUTO-OFF (turn off each door light after 30s) -----
  serviceDoorLeds();

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
      noteActivity();
      if (dfPlayerReady) { musicPlaying = false; celebrationPlaying = false; dfPlayer.playFolder(2, 3); }  // Folder 02/003 = toast_in
      logMsgf("[TOUCH] Touched (val=%d) — hold 2s to craft", touchVal);
    }

    // Motor ON during hold (full power, no PWM = no whine)
    digitalWrite(MOTOR_PIN, HIGH);

    // No motor during hold — just wait for 3 seconds
    unsigned long elapsed = millis() - touchStartMs;

    // Check if held long enough to trigger craft
    if (!craftTriggered && (elapsed >= CRAFT_HOLD_MS)) {
      craftTriggered = true;
      digitalWrite(MOTOR_PIN, LOW);  // Motor off before evaluation
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
      digitalWrite(MOTOR_PIN, LOW);
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
      noteActivity();  // A block was placed — resets the idle-restart timer

      // Store UID
      String uidHex = uidToHexString(uid, uidLen);
      slotUid[i] = uidHex;

      // Read type from tag memory (need brief delay after detection for reliable page reads)
      delay(30);
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

      if (slotType[i] != "steve" && slotType[i] != "gold_ingot" &&
          slotType[i] != "tnt" && slotType[i] != "dragon_egg") {
        playSound(i + 1);
      }

      // Jukebox mode: Steve figurine jumps background music to the next track
      if (slotType[i] == "steve" && slotUid[i] != lastSteveUid) {
        lastSteveUid = slotUid[i];
        noteActivity();
        logMsg("[JUKEBOX] Steve detected — next track");
        advanceBackgroundMusic();  // bump to next track and play it (auto-advances after)
      }

      // Gold ingot: victory celebration on any slot — cycles folder 04 tracks {1, 3}
      if (slotType[i] == "gold_ingot" && slotUid[i] != lastGoldUid) {
        lastGoldUid = slotUid[i];
        uint8_t goldTrack = GOLD_TRACKS[goldTrackIdx];
        logMsgf("[SCAN] Gold ingot — victory! Playing folder 04 track %d", goldTrack);
        playCelebrationSong(4, goldTrack, CELEBRATION_TRACK_MS[goldTrack - 1]);  // cycled 001/003, plays to completion
        // Advance to next track for the next placement
        goldTrackIdx = (goldTrackIdx + 1) % GOLD_NUM_TRACKS;
        victoryFlash();
      }

      // TNT: fuse hiss + explosion effect on any slot
      if (slotType[i] == "tnt") {
        logMsg("[SCAN] TNT — BOOM!");
        if (dfPlayerReady) {
          dfPlayer.disableLoop();
          musicPlaying = false;
          celebrationPlaying = false;
          dfPlayer.playFolder(2, 6);  // Folder 02, track 006 = tnt_fuse + explosion (combined)
        }
        explosionFlash();  // Fuse spark animation (2.8s) + explosion flash, synced to audio
      }

      // Dragon egg: play its song (folder 04, track 002) + purple shimmer on any slot
      if (slotType[i] == "dragon_egg" && slotUid[i] != lastDragonEggUid) {
        lastDragonEggUid = slotUid[i];
        logMsg("[SCAN] Dragon egg — playing folder 04 track 2");
        playCelebrationSong(4, 2, CELEBRATION_TRACK_MS[1]);  // Folder 04 track 002 — plays to completion
        dragonEggFlash();
      }

      String uidDisp = uidToDisplayString(uid, uidLen);
      if (slotType[i].length() > 0) {
        logMsgf("[SLOT %d] Tag %s -> type: %s (ring %d)",
                i, uidDisp.c_str(), slotType[i].c_str(), ring);
      } else {
        logMsgf("[SLOT %d] Tag %s -> UNREGISTERED (ring %d)",
                i, uidDisp.c_str(), ring);
      }

    } else if (!tagPresent && slotActive[i]) {
      // Clear Steve jukebox state if Steve was removed
      if (slotType[i] == "steve") {
        lastSteveUid = "";
      }
      // Clear dragon egg state if the egg was removed
      if (slotType[i] == "dragon_egg") {
        lastDragonEggUid = "";
      }
      // Clear gold state if the gold ingot was removed
      if (slotType[i] == "gold_ingot") {
        lastGoldUid = "";
      }
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
