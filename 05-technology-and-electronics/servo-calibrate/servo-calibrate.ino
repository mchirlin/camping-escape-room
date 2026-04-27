// Servo Calibration — type a pulse width in microseconds to move servo
// Standard SG90 range: ~500-2500µs
// 500µs = full one direction, 1500µs = center, 2500µs = full other direction
//
// You can also type "d90" to use degrees (0-180)

#include <Servo.h>

#define SERVO_PIN D4

Servo servo;

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("Servo Calibration (microseconds mode)");
  Serial.println("Type a number like 1500 for center");
  Serial.println("Try: 400, 500, 600, ... 2400, 2500, 2600");
  Serial.println("Or type d0, d90, d180 for degree mode");
  Serial.println("Note where it stops moving and where it buzzes");
  Serial.println();

  servo.attach(SERVO_PIN);
  servo.writeMicroseconds(1500); // start at center
  delay(1000);
  Serial.println("Starting at 1500µs (center)");
}

void loop() {
  if (Serial.available()) {
    String input = Serial.readStringUntil('\n');
    input.trim();

    if (input.startsWith("d")) {
      // Degree mode
      int angle = input.substring(1).toInt();
      servo.write(constrain(angle, 0, 180));
      Serial.print("Degrees: ");
      Serial.println(angle);
    } else {
      // Microseconds mode
      int us = input.toInt();
      if (us >= 200 && us <= 3000) {
        servo.writeMicroseconds(us);
        Serial.print("Pulse: ");
        Serial.print(us);
        Serial.println("µs");
      }
    }
  }
}
