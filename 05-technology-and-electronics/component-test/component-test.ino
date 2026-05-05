/*
 * Component Test — One-by-one hardware verification
 * 
 * Tests: NeoPixel, Servo, DFPlayer/Speaker, PCA9548A + PN532, Capacitive Touch
 * 
 * Pin assignments (from PCB-DESIGN-GUIDE.md):
 *   GPIO 18 — NeoPixel DIN (via 300Ω resistor)
 *   GPIO 17 — Servo 0 signal
 *   GPIO 25 — DFPlayer RX (via 1kΩ resistor)
 *   GPIO 21 — I2C SDA
 *   GPIO 22 — I2C SCL
 *   GPIO 27 — Capacitive touch pad 1 (Touch7)
 *   GPIO 33 — Capacitive touch pad 2 (Touch8)
 * 
 * Libraries needed:
 *   - Adafruit NeoPixel
 *   - ESP32Servo
 *   - DFRobotDFPlayerMini
 *   - Adafruit PN532 (I2C)
 *   - Wire (built-in)
 * 
 * Usage:
 *   Open Serial Monitor at 115200 baud.
 *   Send a number 1-6 to run each test:
 *     1 = NeoPixel
 *     2 = Servo
 *     3 = DFPlayer / Speaker
 *     4 = PCA9548A + PN532 (I2C scan + tag read)
 *     5 = Capacitive Touch
 *     6 = Run all tests in sequence
 */

#include <Wire.h>
#include <Adafruit_NeoPixel.h>
#include <ESP32Servo.h>
#include <DFRobotDFPlayerMini.h>
#include <Adafruit_PN532.h>

// --- Pin Definitions ---
#define NEOPIXEL_PIN    18
#define NEOPIXEL_COUNT  24
#define SERVO_PIN       4
#define DFPLAYER_TX_PIN 25  // ESP32 TX → DFPlayer RX
#define I2C_SDA         21
#define I2C_SCL         22
#define TOUCH_PAD_1     27  // Touch7
#define TOUCH_PAD_2     33  // Touch8

// --- PCA9548A ---
#define PCA9548A_ADDR   0x70

// --- Objects ---
Adafruit_NeoPixel strip(NEOPIXEL_COUNT, NEOPIXEL_PIN, NEO_GRB + NEO_KHZ800);
Servo servo0;
HardwareSerial dfSerial(1);  // Use UART1 for DFPlayer
DFRobotDFPlayerMini dfPlayer;

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("=================================");
  Serial.println("  Component Test — Send 1-6");
  Serial.println("=================================");
  Serial.println("  1 = NeoPixel (24 LEDs on GPIO 18)");
  Serial.println("  2 = Servo (GPIO 17)");
  Serial.println("  3 = DFPlayer / Speaker (GPIO 25)");
  Serial.println("  4 = PCA9548A + PN532 (I2C)");
  Serial.println("  5 = Capacitive Touch (GPIO 27, 33)");
  Serial.println("  6 = Run ALL tests");
  Serial.println("=================================");
  Serial.println();

  // Init I2C
  Wire.begin(I2C_SDA, I2C_SCL);
  
  // Init NeoPixel (off by default)
  strip.begin();
  strip.clear();
  strip.show();
}

void loop() {
  if (Serial.available()) {
    char c = Serial.read();
    // Flush remaining chars
    while (Serial.available()) Serial.read();
    
    switch (c) {
      case '1': testNeoPixel(); break;
      case '2': testServo(); break;
      case '3': testDFPlayer(); break;
      case '4': testPCA_PN532(); break;
      case '5': testCapTouch(); break;
      case '6':
        testNeoPixel();
        testServo();
        testDFPlayer();
        testPCA_PN532();
        testCapTouch();
        break;
      default:
        Serial.println("Send 1-6");
        break;
    }
  }
}

// ============================================================
// TEST 1: NeoPixel
// ============================================================
void testNeoPixel() {
  Serial.println("\n--- TEST 1: NeoPixel ---");
  Serial.println("Cycling: Red → Green → Blue → White → Off");
  
  // Red
  for (int i = 0; i < NEOPIXEL_COUNT; i++) strip.setPixelColor(i, strip.Color(50, 0, 0));
  strip.show();
  Serial.println("  RED");
  delay(1000);
  
  // Green
  for (int i = 0; i < NEOPIXEL_COUNT; i++) strip.setPixelColor(i, strip.Color(0, 50, 0));
  strip.show();
  Serial.println("  GREEN");
  delay(1000);
  
  // Blue
  for (int i = 0; i < NEOPIXEL_COUNT; i++) strip.setPixelColor(i, strip.Color(0, 0, 50));
  strip.show();
  Serial.println("  BLUE");
  delay(1000);
  
  // White
  for (int i = 0; i < NEOPIXEL_COUNT; i++) strip.setPixelColor(i, strip.Color(50, 50, 50));
  strip.show();
  Serial.println("  WHITE");
  delay(1000);
  
  // Off
  strip.clear();
  strip.show();
  Serial.println("  OFF");
  Serial.println("--- NeoPixel DONE ---\n");
}

// ============================================================
// TEST 2: Servo
// ============================================================
void testServo() {
  Serial.println("\n--- TEST 2: Servo ---");
  Serial.println("Sweeping: 0° → 90° → 180° → 90° → 0°");
  
  servo0.attach(SERVO_PIN);
  delay(100);
  
  servo0.write(0);
  Serial.println("  0°");
  delay(1000);
  
  servo0.write(90);
  Serial.println("  90°");
  delay(1000);
  
  servo0.write(180);
  Serial.println("  180°");
  delay(1000);
  
  servo0.write(90);
  Serial.println("  90°");
  delay(1000);
  
  servo0.write(0);
  Serial.println("  0°");
  delay(500);
  
  servo0.detach();
  Serial.println("--- Servo DONE ---\n");
}

// ============================================================
// TEST 3: DFPlayer / Speaker
// ============================================================
void testDFPlayer() {
  Serial.println("\n--- TEST 3: DFPlayer ---");
  Serial.println("Initializing UART...");
  
  // DFPlayer uses TX only from ESP32 (GPIO25 → DFPlayer RX)
  // We don't read from DFPlayer, so RX can be -1
  dfSerial.begin(9600, SERIAL_8N1, -1, DFPLAYER_TX_PIN);
  delay(500);
  
  if (!dfPlayer.begin(dfSerial, false)) {
    Serial.println("  ERROR: DFPlayer not detected!");
    Serial.println("  Check: SD card inserted? Wiring correct?");
    Serial.println("--- DFPlayer FAILED ---\n");
    return;
  }
  
  Serial.println("  DFPlayer connected!");
  dfPlayer.volume(20);  // 0-30
  Serial.println("  Volume set to 20/30");
  Serial.println("  Playing track 1...");
  dfPlayer.play(1);
  delay(3000);
  
  dfPlayer.stop();
  Serial.println("  Stopped.");
  Serial.println("--- DFPlayer DONE ---\n");
}

// ============================================================
// TEST 4: PCA9548A + PN532
// ============================================================
void testPCA_PN532() {
  Serial.println("\n--- TEST 4: PCA9548A + PN532 ---");
  
  // Step 1: Check if PCA9548A responds
  Serial.print("  Checking PCA9548A at 0x");
  Serial.print(PCA9548A_ADDR, HEX);
  Serial.print("... ");
  
  Wire.beginTransmission(PCA9548A_ADDR);
  uint8_t err = Wire.endTransmission();
  
  if (err != 0) {
    Serial.println("NOT FOUND!");
    Serial.println("  Check: I2C wiring, pull-up resistors (4.7kΩ to 3.3V), PCA power");
    Serial.println("--- PCA9548A FAILED ---\n");
    return;
  }
  Serial.println("OK!");
  
  // Step 2: Scan each PCA channel for PN532
  Serial.println("  Scanning channels for PN532 (addr 0x24)...");
  
  int found = 0;
  for (uint8_t ch = 0; ch < 8; ch++) {
    // Select channel
    Wire.beginTransmission(PCA9548A_ADDR);
    Wire.write(1 << ch);
    Wire.endTransmission();
    delay(10);
    
    // Check for PN532 at 0x24
    Wire.beginTransmission(0x24);
    err = Wire.endTransmission();
    
    if (err == 0) {
      Serial.print("    CH");
      Serial.print(ch);
      Serial.println(": PN532 found!");
      found++;
      
      // Try to read a tag on this channel
      Serial.print("    Attempting tag read on CH");
      Serial.print(ch);
      Serial.println("... (hold a tag near the reader)");
      
      Adafruit_PN532 nfc(I2C_SDA, I2C_SCL);
      nfc.begin();
      
      uint32_t versiondata = nfc.getFirmwareVersion();
      if (versiondata) {
        Serial.print("    PN532 firmware: ");
        Serial.print((versiondata >> 24) & 0xFF, HEX);
        Serial.print(".");
        Serial.println((versiondata >> 16) & 0xFF, HEX);
        
        nfc.SAMConfig();
        
        uint8_t uid[7];
        uint8_t uidLength;
        Serial.println("    Waiting 5 seconds for a tag...");
        
        // Non-blocking wait with timeout
        unsigned long start = millis();
        bool tagFound = false;
        while (millis() - start < 5000) {
          if (nfc.readPassiveTargetID(PN532_MIFARE_ISO14443A, uid, &uidLength, 500)) {
            Serial.print("    TAG DETECTED! UID: ");
            for (uint8_t i = 0; i < uidLength; i++) {
              if (uid[i] < 0x10) Serial.print("0");
              Serial.print(uid[i], HEX);
              if (i < uidLength - 1) Serial.print(":");
            }
            Serial.println();
            tagFound = true;
            break;
          }
        }
        if (!tagFound) {
          Serial.println("    No tag detected (timeout).");
        }
      } else {
        Serial.println("    Could not get PN532 firmware version.");
      }
    }
  }
  
  // Deselect all channels
  Wire.beginTransmission(PCA9548A_ADDR);
  Wire.write(0);
  Wire.endTransmission();
  
  if (found == 0) {
    Serial.println("  No PN532 found on any channel.");
    Serial.println("  Check: PN532 set to I2C mode? Wired to PCA channel pins (not ESP32)?");
  } else {
    Serial.print("  Found ");
    Serial.print(found);
    Serial.println(" PN532 reader(s).");
  }
  Serial.println("--- PCA + PN532 DONE ---\n");
}

// ============================================================
// TEST 5: Capacitive Touch
// ============================================================
void testCapTouch() {
  Serial.println("\n--- TEST 5: Capacitive Touch ---");
  Serial.println("Reading touch values for 10 seconds.");
  Serial.println("Touch the pads to see values drop.");
  Serial.println("  Pad 1 = GPIO 27 (Touch7)");
  Serial.println("  Pad 2 = GPIO 33 (Touch8)");
  Serial.println("  Typical: untouched > 40, touched < 20");
  Serial.println();
  
  unsigned long start = millis();
  while (millis() - start < 10000) {
    int val1 = touchRead(TOUCH_PAD_1);
    int val2 = touchRead(TOUCH_PAD_2);
    
    Serial.print("  Pad1(GPIO27): ");
    Serial.print(val1);
    Serial.print("  |  Pad2(GPIO33): ");
    Serial.print(val2);
    
    if (val1 < 20) Serial.print("  ← TOUCHED!");
    if (val2 < 20) Serial.print("  ← PAD2 TOUCHED!");
    Serial.println();
    
    delay(200);
  }
  
  Serial.println("--- Capacitive Touch DONE ---\n");
}
