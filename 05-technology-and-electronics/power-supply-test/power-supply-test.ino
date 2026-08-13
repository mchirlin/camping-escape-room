/*
 * Power Supply Test — Visual heartbeat for testing DeWalt + buck converter
 * 
 * Upload this, then disconnect USB and power from DeWalt battery.
 * If the ring blinks every 3 seconds, power is good.
 * Motor buzzes every 10 seconds to add a current spike.
 * Servo sweeps every 15 seconds for additional load.
 * 
 * Total draw simulates real-world usage:
 *   - ESP32 idle: ~80mA
 *   - NeoPixel blink: ~200mA peak
 *   - Motor buzz: ~150mA peak
 *   - Servo sweep: ~500mA peak
 */

#include <Adafruit_NeoPixel.h>
#include <ESP32Servo.h>

#define NEOPIXEL_PIN    18
#define NEOPIXEL_COUNT  24
#define MOTOR_PIN       26
#define SERVO_PIN       4

Adafruit_NeoPixel strip(NEOPIXEL_COUNT, NEOPIXEL_PIN, NEO_GRB + NEO_KHZ800);
Servo servo0;

unsigned long lastBlink = 0;
unsigned long lastBuzz = 0;
unsigned long lastServo = 0;
unsigned long bootTime = 0;

void setup() {
  strip.begin();
  strip.clear();
  strip.show();
  
  pinMode(MOTOR_PIN, OUTPUT);
  digitalWrite(MOTOR_PIN, LOW);
  
  servo0.attach(SERVO_PIN);
  servo0.write(0);
  
  bootTime = millis();
  
  // Startup flash — confirms boot
  for (int i = 0; i < 3; i++) {
    for (int j = 0; j < NEOPIXEL_COUNT; j++)
      strip.setPixelColor(j, strip.Color(0, 50, 0));
    strip.show();
    delay(200);
    strip.clear();
    strip.show();
    delay(200);
  }
}

void loop() {
  unsigned long now = millis();
  
  // Blink ring green every 3 seconds
  if (now - lastBlink >= 3000) {
    lastBlink = now;
    for (int i = 0; i < NEOPIXEL_COUNT; i++)
      strip.setPixelColor(i, strip.Color(0, 40, 0));
    strip.show();
    delay(300);
    strip.clear();
    strip.show();
  }
  
  // Buzz motor every 10 seconds
  if (now - lastBuzz >= 10000) {
    lastBuzz = now;
    digitalWrite(MOTOR_PIN, HIGH);
    delay(200);
    digitalWrite(MOTOR_PIN, LOW);
  }
  
  // Sweep servo every 15 seconds
  if (now - lastServo >= 15000) {
    lastServo = now;
    servo0.write(90);
    delay(500);
    servo0.write(0);
  }
}
