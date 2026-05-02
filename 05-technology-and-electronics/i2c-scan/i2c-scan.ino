// I2C Scanner — finds all devices on the bus
// Upload this, open Serial Monitor at 9600 baud, press EN on the ESP32.
//
// Expected results for the crafting table POC:
//   0x70 = PCA9548A multiplexer
//   0x24 = PN532 (if wired directly to ESP32, not through PCA)
//
// If you see 0x70 but not 0x24, the PCA is working but the PN532
// isn't in I2C mode or isn't wired to the PCA channel correctly.
//
// If you see nothing at all, check SDA/SCL wiring and power.

#include <Wire.h>

#define SDA_PIN 21
#define SCL_PIN 22

void setup() {
  Serial.begin(9600);
  delay(2000);
  
  // Enable internal pull-ups on I2C pins
  pinMode(SDA_PIN, INPUT_PULLUP);
  pinMode(SCL_PIN, INPUT_PULLUP);
  delay(100);
  
  Wire.begin(SDA_PIN, SCL_PIN);
  Wire.setClock(50000);  // Slower clock — more tolerant of weak pull-ups

  Serial.println();
  Serial.println("=== I2C Bus Scanner ===");
  Serial.println();
}

void loop() {
  Serial.println("Scanning...");
  int found = 0;

  for (uint8_t addr = 1; addr < 127; addr++) {
    Wire.beginTransmission(addr);
    uint8_t error = Wire.endTransmission();

    if (error == 0) {
      Serial.printf("  Found device at 0x%02X", addr);

      // Label known devices
      if (addr == 0x70) Serial.print("  ← PCA9548A multiplexer (A0=A1=A2=GND)");
      if (addr == 0x40) Serial.print("  ← PCA9548A multiplexer (A0=high)");
      if (addr == 0x24) Serial.print("  ← PN532 (I2C mode)");
      if (addr == 0x48) Serial.print("  ← PN532 (alternate addr)");

      Serial.println();
      found++;
    }
  }

  if (found == 0) {
    Serial.println("  No devices found! Check wiring and power.");
  } else {
    Serial.printf("  %d device(s) found.\n", found);
  }

  Serial.println();
  delay(3000);
}
