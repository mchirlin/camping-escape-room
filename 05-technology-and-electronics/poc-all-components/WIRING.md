# POC Wiring Guide — ESP32 + PCA9548A + 2x PN532 + 2x NeoPixel + MG90S

## Overview

```
                         ┌──────────────┐
                         │   ESP32 Dev  │
                         │              │
                    3V3 ─┤ 3V3     GND  ├─ GND bus
                         │              │
              I2C SDA  ──┤ GPIO 21      │
              I2C SCL  ──┤ GPIO 22      │
                         │              │
         NeoPixel DIN ──┤ GPIO 18      │
                         │              │
          Servo signal ──┤ GPIO 4       │
                         │              │
                    5V  ─┤ VIN          │  ← USB power (or external 5V)
                         └──────────────┘
```

## Power Rails

| Rail | Source | Feeds |
|------|--------|-------|
| 3.3V | ESP32 3V3 pin | PCA9548A VCC |
| 5V | ESP32 VIN pin (USB) or external 5V | PN532 VCC, NeoPixel rings, MG90S servo |
| GND | Common ground bus | Everything |

**Important:** PN532 modules need 5V — the ESP32's 3.3V rail can't supply enough current,
especially with multiple readers. Most PN532 boards have an onboard 3.3V regulator and accept 5V.
For the full 9-slot build, use a separate 5V supply for readers, servos, and NeoPixels.

## PCA9548A I2C Multiplexer

| PCA9548A Pin | Connect To |
|--------------|------------|
| VIN | 3.3V |
| GND | GND |
| SDA | ESP32 GPIO 21 |
| SCL | ESP32 GPIO 22 |
| A0, A1, A2 | GND (address = 0x70) |

| PCA Channel | Device |
|-------------|--------|
| CH0 (SD0/SC0) | PN532 Reader #0 |
| CH1 (SD1/SC1) | PN532 Reader #1 |

## PN532 NFC Readers (x2)

Both PN532 modules must be set to **I2C mode**. Check the DIP switches or solder jumpers on your specific board:

| Common Board Types | I2C Setting |
|---|---|
| Red board (DIP switches) | SEL0 = OFF, SEL1 = ON |
| Blue/purple board (solder jumpers) | Short the I2C pads |

Both readers use the **same I2C address (0x24)** — the PCA9548A isolates them.

| PN532 Pin | Connect To |
|-----------|------------|
| VCC | 5V (not 3.3V — PN532 needs more current) |
| GND | GND |
| SDA | PCA9548A SD0 (reader 0) or SD1 (reader 1) |
| SCL | PCA9548A SC0 (reader 0) or SC1 (reader 1) |

**Do NOT connect PN532 SDA/SCL directly to the ESP32.** They go to the PCA's channel pins.

## NeoPixel WS2812B 24-LED Rings (x2, daisy-chained)

```
ESP32 GPIO 18 ──► Ring 0 DIN
                  Ring 0 DOUT ──► Ring 1 DIN
                                  Ring 1 DOUT ──► (unused, or next ring)
```

| NeoPixel Pin | Connect To |
|--------------|------------|
| VCC (5V) | 5V rail |
| GND | GND |
| DIN (Ring 0) | ESP32 GPIO 18 |
| DOUT (Ring 0) → DIN (Ring 1) | Short wire between rings |

**Tip:** Add a 300-470Ω resistor between GPIO 18 and Ring 0 DIN to protect the data line.
Add a 100-1000µF capacitor across the 5V/GND rail near the first ring.

## MG90S Servo

| Servo Wire | Connect To |
|------------|------------|
| Orange (signal) | ESP32 GPIO 4 |
| Red (VCC) | 5V rail |
| Brown (GND) | GND |

**Note:** The MG90S draws ~500mA under load. Fine on USB for one servo, but the full
3-servo build needs a dedicated 5V supply with a shared ground to the ESP32.

## Breadboard Layout Suggestion

```
┌─────────────────────────────────────────────────────────────┐
│  [ESP32 Dev Board — straddling center channel]              │
│                                                             │
│  Left rail: 3.3V + GND                                     │
│  Right rail: 5V + GND                                      │
│                                                             │
│  ┌──────────┐                                               │
│  │ PCA9548A │ ← near ESP32, short I2C wires                │
│  └──────────┘                                               │
│       │  │                                                  │
│  ┌────┘  └────┐                                             │
│  │ PN532 #0   │  PN532 #1  │  ← off to the side or on      │
│  │ (CH0)      │  (CH1)     │    separate mini breadboards   │
│  └────────────┘────────────┘                                │
│                                                             │
│  [NeoPixel Ring 0] ──► [NeoPixel Ring 1]                    │
│  (5V + GND from right rail, DIN from GPIO 18)               │
│                                                             │
│  [MG90S Servo]                                              │
│  (5V + GND from right rail, signal from GPIO 27)            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## PN532 I2C Mode — DIP Switch Reference

Most PN532 boards have two switches or solder jumpers labeled SEL0 and SEL1:

| Mode | SEL0 | SEL1 |
|------|------|------|
| UART | OFF | OFF |
| SPI | ON | OFF |
| **I2C** | **OFF** | **ON** |

If your board has solder jumpers instead of DIP switches, bridge the I2C pads
and leave the others open. Check your specific board's documentation.

## Checklist Before Uploading

- [x] PN532 boards set to I2C mode (DIP switches / solder jumpers)
- [x] PCA9548A A0, A1, A2 all tied to GND
- [x] PN532 SDA/SCL go to PCA channel pins, NOT directly to ESP32
- [x] NeoPixel 5V comes from 5V rail, not 3.3V
- [x] Common GND between ESP32, PCA, PN532s, NeoPixels, and servo
- [x] 300Ω resistor on NeoPixel data line (recommended)
- [x] Arduino IDE board set to "ESP32 Dev Module"
- [x] Libraries installed: Adafruit PN532, Adafruit NeoPixel, ESP32Servo
