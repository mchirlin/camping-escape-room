// =============================================================================
// POC: ESP32 + PCA9548A + PN532 (I2C) + NeoPixel Ring + MG90S Servo
// =============================================================================
//
// Purpose: Prove all component types work together on one ESP32 before
//          scaling up to the full 9-slot crafting table.
//
// Hardware (current POC):
//   - ESP32 DevKit v1 (or similar 38-pin board)
//   - PCA9548A I2C multiplexer
//   - 1x PN532 NFC/RFID module (set to I2C mode)
//   - 1x WS2812B NeoPixel 24-LED ring
//   - 1x MG90S micro servo
//
// To scale up: bump NUM_READERS and NUM_RINGS, add channels to READER_CHANNELS[].
//
// Wiring — see WIRING.md in this folder for full pinout.
//
// Libraries needed (install via Arduino Library Manager):
//   - Adafruit PN532       (also installs Adafruit BusIO)
//   - Adafruit NeoPixel
//   - ESP32Servo
//
// Board: "ESP32 Dev Module" in Arduino IDE
// =============================================================================

#include <Wire.h>
#include <Adafruit_PN532.h>
#include <Adafruit_NeoPixel.h>
#include <ESP32Servo.h>

// -----------------------------------------------------------------------------
// Pin assignments
// -----------------------------------------------------------------------------
#define SDA_PIN        21    // ESP32 default I2C SDA
#define SCL_PIN        22    // ESP32 default I2C SCL
#define NEOPIXEL_PIN   18    // Data line for daisy-chained NeoPixel rings
#define SERVO_PIN      4     // MG90S signal wire

// -----------------------------------------------------------------------------
// PCA9548A I2C multiplexer
// -----------------------------------------------------------------------------
#define PCA_ADDR       0x70  // Default address (A0-A2 all low)

// -----------------------------------------------------------------------------
// Slot config — change these to scale up
// -----------------------------------------------------------------------------
#define NUM_READERS    1     // How many PN532 readers are wired up
#define NUM_RINGS      1     // How many NeoPixel rings are wired up

// PCA channel for each reader (index 0 = slot 0, etc.)
const uint8_t READER_CHANNELS[NUM_READERS] = { 0 };

// -----------------------------------------------------------------------------
// NeoPixel config
// -----------------------------------------------------------------------------
#define LEDS_PER_RING  24
#define TOTAL_LEDS     (NUM_RINGS * LEDS_PER_RING)

// We only light every-other LED for even glow + lower power (per your notes)
#define LED_SKIP       2
#define BRIGHTNESS     25    // 0-255, keep low for battery life

// -----------------------------------------------------------------------------
// Servo config
// -----------------------------------------------------------------------------
#define SERVO_REST_US  500   // Retracted (door closed)
#define SERVO_PUSH_US  2200  // Extended (pushes door open)
#define SERVO_PUSH_MS  600   // How long to hold the push

// -----------------------------------------------------------------------------
// Globals
// -----------------------------------------------------------------------------
Adafruit_NeoPixel strip(TOTAL_LEDS, NEOPIXEL_PIN, NEO_GRB + NEO_KHZ800);
Servo doorServo;

// We create ONE PN532 object and reuse it by switching PCA channels.
// All PN532 modules use the same I2C address (0x24) — the PCA isolates them.
Adafruit_PN532 nfc(SDA_PIN, SCL_PIN);

// Track what's on each slot
String slotTag[NUM_READERS];  // UID string per slot ("" = empty)

// =============================================================================
// PCA9548A channel select
// =============================================================================
void pcaSelect(uint8_t channel) {
  if (channel > 7) return;
  Wire.beginTransmission(PCA_ADDR);
  Wire.write(1 << channel);
  Wire.endTransmission();
}

// Disable all PCA channels (good practice between reads)
void pcaDeselectAll() {
  Wire.beginTransmission(PCA_ADDR);
  Wire.write(0);
  Wire.endTransmission();
}

// =============================================================================
// PN532 helpers
// =============================================================================

// Initialize a PN532 on the given PCA channel. Returns true on success.
bool initReader(uint8_t channel) {
  pcaSelect(channel);
  delay(10);

  nfc.begin();
  uint32_t versiondata = nfc.getFirmwareVersion();
  if (!versiondata) {
    Serial.printf("  PN532 on PCA ch %d: NOT FOUND\n", channel);
    return false;
  }

  uint8_t ic   = (versiondata >> 24) & 0xFF;
  uint8_t ver  = (versiondata >> 16) & 0xFF;
  uint8_t rev  = (versiondata >> 8)  & 0xFF;
  Serial.printf("  PN532 on PCA ch %d: IC=0x%02X  FW=%d.%d\n", channel, ic, ver, rev);

  // Configure for reading ISO14443A (NTAG215) tags
  nfc.SAMConfig();
  return true;
}

// Try to read a tag on the given PCA channel.
// Returns the UID as a hex string, or "" if no tag present.
String readTag(uint8_t channel) {
  pcaSelect(channel);
  delay(5);

  uint8_t uid[7];
  uint8_t uidLength;

  // Short timeout so we don't block — 100ms is plenty for a tag sitting there
  bool success = nfc.readPassiveTargetID(PN532_MIFARE_ISO14443A, uid, &uidLength, 100);

  if (!success) return "";

  // Build hex string from UID bytes
  String s = "";
  for (uint8_t i = 0; i < uidLength; i++) {
    if (uid[i] < 0x10) s += "0";
    s += String(uid[i], HEX);
  }
  s.toUpperCase();
  return s;
}

// =============================================================================
// NeoPixel helpers
// =============================================================================

// Set all LEDs in a ring to a color (only every-other LED for even glow)
void setRing(uint8_t ring, uint32_t color) {
  if (ring >= NUM_RINGS) return;  // No ring wired for this slot
  uint16_t offset = ring * LEDS_PER_RING;
  for (uint16_t i = 0; i < LEDS_PER_RING; i++) {
    if (i % LED_SKIP == 0) {
      strip.setPixelColor(offset + i, color);
    } else {
      strip.setPixelColor(offset + i, 0);
    }
  }
}

// Clear a single ring
void clearRing(uint8_t ring) {
  setRing(ring, 0);
}

// Rainbow sweep across all rings (success animation)
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
  strip.clear();
  strip.show();
}

// Green flash on all rings
void greenFlash(uint8_t flashes) {
  uint32_t green = strip.Color(0, 80, 0);
  for (uint8_t f = 0; f < flashes; f++) {
    for (uint8_t r = 0; r < NUM_RINGS; r++) setRing(r, green);
    strip.show();
    delay(200);
    strip.clear();
    strip.show();
    delay(150);
  }
}

// =============================================================================
// Servo helpers
// =============================================================================

void servoPush() {
  Serial.println("[SERVO] Pushing door open...");
  doorServo.writeMicroseconds(SERVO_PUSH_US);
  delay(SERVO_PUSH_MS);
  Serial.println("[SERVO] Returning to rest.");
  doorServo.writeMicroseconds(SERVO_REST_US);
}

// =============================================================================
// Setup
// =============================================================================
void setup() {
  Serial.begin(9600);
  delay(2000);
  Serial.println();
  Serial.println("========================================");
  Serial.println("  Crafting Table POC — All Components");
  Serial.println("========================================");
  Serial.printf("  Readers: %d   Rings: %d\n", NUM_READERS, NUM_RINGS);
  Serial.println();

  // --- I2C ---
  Wire.begin(SDA_PIN, SCL_PIN);
  Wire.setClock(100000);  // 100kHz — safe for PN532 over multiplexer
  Serial.println("[I2C] Bus initialized at 100kHz");

  // --- PN532 readers ---
  Serial.println("[RFID] Initializing readers via PCA9548A...");
  uint8_t readersOk = 0;
  for (uint8_t i = 0; i < NUM_READERS; i++) {
    if (initReader(READER_CHANNELS[i])) readersOk++;
  }
  pcaDeselectAll();

  Serial.printf("[RFID] %d of %d readers initialized OK\n", readersOk, NUM_READERS);
  if (readersOk < NUM_READERS) {
    Serial.println("       Check wiring and PN532 I2C mode (DIP switches).");
  }

  // --- NeoPixels ---
  strip.begin();
  strip.setBrightness(BRIGHTNESS);
  strip.clear();
  strip.show();
  Serial.printf("[LED] NeoPixel strip initialized (%d LEDs across %d ring(s))\n", TOTAL_LEDS, NUM_RINGS);

  // Startup animation — brief white pulse on each ring
  uint32_t white = strip.Color(60, 60, 60);
  for (uint8_t r = 0; r < NUM_RINGS; r++) {
    setRing(r, white);
    strip.show();
    delay(300);
    clearRing(r);
    strip.show();
  }

  // --- Servo ---
  doorServo.attach(SERVO_PIN);
  doorServo.writeMicroseconds(SERVO_REST_US);
  delay(500);
  Serial.printf("[SERVO] Attached on GPIO %d, resting at %dµs\n", SERVO_PIN, SERVO_REST_US);

  Serial.println();
  Serial.println("Ready! Place an NFC tag on the reader.");
  Serial.println("Tag detected → white glow + green flash + servo push + rainbow.");
  Serial.println("Type 's' in Serial Monitor to manually trigger servo.");
  Serial.println();
}

// =============================================================================
// Main loop
// =============================================================================
void loop() {
  // --- Serial command: manual servo test ---
  if (Serial.available()) {
    char c = Serial.read();
    if (c == 's' || c == 'S') {
      servoPush();
    }
  }

  // --- Scan all readers sequentially ---
  bool changed = false;

  for (uint8_t i = 0; i < NUM_READERS; i++) {
    String uid = readTag(READER_CHANNELS[i]);

    if (uid != slotTag[i]) {
      changed = true;
      slotTag[i] = uid;

      if (uid.length() > 0) {
        Serial.printf("[SLOT %d] Tag detected: %s\n", i, uid.c_str());
        setRing(i, strip.Color(60, 60, 60));  // White glow = block present
      } else {
        Serial.printf("[SLOT %d] Empty\n", i);
        clearRing(i);
      }
    }
  }

  pcaDeselectAll();

  if (changed) {
    strip.show();
  }

  // --- Check if all slots are occupied (simulates a "recipe match") ---
  bool allFilled = true;
  for (uint8_t i = 0; i < NUM_READERS; i++) {
    if (slotTag[i].length() == 0) {
      allFilled = false;
      break;
    }
  }

  if (allFilled && changed) {
    Serial.println();
    Serial.println("*** TAG DETECTED — Simulating successful craft! ***");
    Serial.println();

    // Green flash
    greenFlash(3);

    // Servo push (open door)
    servoPush();

    // Rainbow celebration
    rainbowSweep(2000);

    // Reset slot tracking so it can trigger again after tag is removed and replaced
    for (uint8_t i = 0; i < NUM_READERS; i++) {
      slotTag[i] = "";
    }
  }

  delay(50);  // Small delay between scan cycles
}
