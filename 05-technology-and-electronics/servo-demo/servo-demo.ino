#include <Servo.h>

// --- Pin assignments (ESP8266) ---
#define SERVO_PIN   D4  // GPIO2 — orange wire
#define BTN_OPEN    D1  // GPIO5 — open button (press to unlatch)
#define REED_CLOSE  D2  // GPIO4 — reed switch (magnet = door closed)

// --- Servo pulse widths (microseconds) ---
// Use the calibration tool to find these values for your servo.
// Type microsecond values until you find the two positions you want.
#define POS_LOCKED    500   // latch engaged — adjust this
#define POS_UNLOCKED  2400  // latch retracted — adjust this

// --- State ---
Servo latch;
bool isLocked = true;

void setup() {
  Serial.begin(115200);
  Serial.println("Servo latch demo — button open, reed close");

  pinMode(BTN_OPEN, INPUT_PULLUP);
  pinMode(REED_CLOSE, INPUT_PULLUP);

  latch.attach(SERVO_PIN);
  latch.writeMicroseconds(POS_LOCKED);
  delay(1000);
  Serial.println("Servo locked");
}

void loop() {
  // --- OPEN: button press ---
  if (isLocked && digitalRead(BTN_OPEN) == LOW) {
    Serial.println("OPEN — unlocking");
    latch.writeMicroseconds(POS_UNLOCKED);
    isLocked = false;
    delay(300);
    while (digitalRead(BTN_OPEN) == LOW) delay(10);
  }

  // --- CLOSE: reed switch detects door shut ---
  if (!isLocked && digitalRead(REED_CLOSE) == LOW) {
    delay(100);
    if (digitalRead(REED_CLOSE) == LOW) {
      Serial.println("CLOSE — reed triggered, locking");
      latch.writeMicroseconds(POS_LOCKED);
      isLocked = true;
      delay(500);
    }
  }
}
