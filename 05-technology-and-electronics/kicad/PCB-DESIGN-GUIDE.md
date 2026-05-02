# Crafting Table PCB Design Guide

## Project Files

The `kicad/` directory contains two KiCad 10 projects:

```
kicad/
├── motherboard/
│   └── motherboard.kicad_pcb    ← Generated via Python API, opens in KiCad 10
└── daughter-board/
    └── daughter-board.kicad_pcb ← Generated via Python API, opens in KiCad 10
```

The PCB files have board outlines, mounting holes, component placement guides, and
silkscreen labels already placed. You need to create the schematics in KiCad's
schematic editor, then import the netlist to connect everything.

## Quick Start

1. Open KiCad 10 → File → New Project → point to `kicad/motherboard/`
2. Open the Schematic Editor
3. Follow the schematic instructions below
4. Tools → Update PCB from Schematic to push the netlist into the PCB
5. Route traces
6. Repeat for `daughter-board/`

---

## Motherboard Schematic

### Bill of Materials

| Ref | Part | Package | Value | Notes |
|-----|------|---------|-------|-------|
| J1 | Barrel jack | BarrelJack_Horizontal | 5.5x2.1mm | 5V input |
| J2 | Pin socket 1x19 | PinSocket_1x19_P2.54mm | ESP32_Left | ESP32 left header |
| J3 | Pin socket 1x19 | PinSocket_1x19_P2.54mm | ESP32_Right | ESP32 right header |
| U1 | PCA9548A + DIP socket | DIP-24_W7.62mm | PCA9548A | I2C mux, addr 0x70, slots 0-7 (socketed) |
| U2 | PCA9548A + DIP socket | DIP-24_W7.62mm | PCA9548A | I2C mux, addr 0x71, slot 8 (socketed) |
| R1 | Resistor 0805 | R_0805 | 4.7kΩ | SDA pull-up |
| R2 | Resistor 0805 | R_0805 | 4.7kΩ | SCL pull-up |
| R3 | Resistor 0805 | R_0805 | 300Ω | NeoPixel data protection |
| R4 | Resistor 0805 | R_0805 | 1kΩ | DFPlayer TX series resistor |
| C1 | Electrolytic cap | CP_Radial_D10.0mm_P5.00mm | 1000µF/10V | 5V bulk decoupling |
| C2 | Ceramic cap 0805 | C_0805 | 100nF | U1 decoupling |
| C3 | Ceramic cap 0805 | C_0805 | 100nF | U2 decoupling |
| J4-J12 | JST-XH 4-pin | JST_XH_B4B-XH-A | SLOT0-8_I2C | I2C to daughter boards |
| J13 | JST-XH 3-pin | JST_XH_B3B-XH-A | NEOPIXEL_OUT | NeoPixel chain start |
| J14-J16 | Pin header 1x3 | PinHeader_1x03_P2.54mm | SERVO_0-2 | Servo connectors |
| J17 | Pin socket 1x8 | PinSocket_1x08_P2.54mm | DFPlayer_L | DFPlayer left |
| J18 | Pin socket 1x8 | PinSocket_1x08_P2.54mm | DFPlayer_R | DFPlayer right |
| J19 | Screw terminal 2-pin | TerminalBlock_P5.08mm | SPEAKER | Speaker output |
| H1-H4 | Mounting hole | MountingHole_3.2mm_M3 | M3 | Corner mounting |

### Net Connections

#### Power
```
J1 pin 1 (tip, +5V) → +5V rail
J1 pin 2 (sleeve, GND) → GND rail
C1: +5V to GND (near barrel jack)
+5V → J2 pin 1 (ESP32 VIN)
GND → J2 pin 2 (ESP32 GND)
```

#### ESP32 Pin Mapping (38-pin DevKit V1)

Left header (J2), top to bottom:
```
Pin 1:  3V3        → +3.3V rail (powers PCA9548A)
Pin 2:  GND        → GND
Pin 3:  GPIO15
Pin 4:  GPIO2
Pin 5:  GPIO4      → J14 pin 1 (Servo 0 signal)
Pin 6:  GPIO16/RX2 → J15 pin 1 (Servo 1 signal)
Pin 7:  GPIO17/TX2 → J16 pin 1 (Servo 2 signal)
Pin 8:  GPIO5
Pin 9:  GPIO18     → R3 → J13 pin 3 (NeoPixel DIN)
Pin 10: GPIO19
Pin 11: GPIO21     → SDA bus (to U1 pin 23)
Pin 12: GPIO3/RX0
Pin 13: GPIO1/TX0
Pin 14: GPIO22     → SCL bus (to U1 pin 22)
Pin 15: GPIO23
Pin 16: EN
Pin 17: GPIO36/VP
Pin 18: GPIO39/VN
Pin 19: GPIO34
```

Right header (J3), top to bottom:
```
Pin 1:  VIN        → +5V rail
Pin 2:  GND        → GND
Pin 3:  GPIO13
Pin 4:  GPIO12
Pin 5:  GPIO14
Pin 6:  GPIO27
Pin 7:  GPIO26
Pin 8:  GPIO25     → R4 → J17 pin 2 (DFPlayer RX)
Pin 9:  GPIO33
Pin 10: GPIO32
Pin 11: GPIO35
Pin 12: GPIO34
Pin 13: GPIO39/VN
Pin 14: GPIO36/VP
Pin 15: EN
Pin 16: 3V3
Pin 17: GND
Pin 18: GPIO15
Pin 19: GPIO2
```

#### PCA9548A U1 (addr 0x70) — Slots 0-7

```
Pin 1:  A0  → GND (address bit 0)
Pin 2:  A1  → GND (address bit 1)
Pin 3:  A2  → GND (address bit 2)
                    → I2C address = 0x70

Pin 4:  SD0 → J4 pin 3  (Slot 0 SDA)
Pin 5:  SC0 → J4 pin 4  (Slot 0 SCL)
Pin 6:  SD1 → J5 pin 3  (Slot 1 SDA)
Pin 7:  SC1 → J5 pin 4  (Slot 1 SCL)
Pin 8:  SD2 → J6 pin 3  (Slot 2 SDA)
Pin 9:  SC2 → J6 pin 4  (Slot 2 SCL)
Pin 10: SD3 → J7 pin 3  (Slot 3 SDA)
Pin 11: SC3 → J7 pin 4  (Slot 3 SCL)
Pin 12: GND → GND

Pin 13: SD4 → J8 pin 3  (Slot 4 SDA)
Pin 14: SC4 → J8 pin 4  (Slot 4 SCL)
Pin 15: SD5 → J9 pin 3  (Slot 5 SDA)
Pin 16: SC5 → J9 pin 4  (Slot 5 SCL)
Pin 17: SD6 → J10 pin 3 (Slot 6 SDA)
Pin 18: SC6 → J10 pin 4 (Slot 6 SCL)
Pin 19: SD7 → J11 pin 3 (Slot 7 SDA)
Pin 20: SC7 → J11 pin 4 (Slot 7 SCL)

Pin 21: ~RESET → +3.3V (active low, tie high)
Pin 22: SCL    → SCL bus (ESP32 GPIO22) + R2 to +3.3V
Pin 23: SDA    → SDA bus (ESP32 GPIO21) + R1 to +3.3V
Pin 24: VCC    → +3.3V + C2 (100nF to GND)
```

#### PCA9548A U2 (addr 0x71) — Slot 8

```
Pin 1:  A0  → +3.3V (address bit 0 = 1)
Pin 2:  A1  → GND   (address bit 1 = 0)
Pin 3:  A2  → GND   (address bit 2 = 0)
                      → I2C address = 0x71

Pin 4:  SD0 → J12 pin 3 (Slot 8 SDA)
Pin 5:  SC0 → J12 pin 4 (Slot 8 SCL)
Pin 6-11:  SD1-SC3 → unconnected (channels 1-3 unused)
Pin 12: GND → GND

Pin 13-20: SD4-SC7 → unconnected (channels 4-7 unused)

Pin 21: ~RESET → +3.3V (active low, tie high)
Pin 22: SCL    → SCL bus (shared with U1)
Pin 23: SDA    → SDA bus (shared with U1)
Pin 24: VCC    → +3.3V + C3 (100nF to GND)
```

#### JST-XH I2C Connectors (J4-J12) — all same pinout
```
Pin 1: +5V
Pin 2: GND
Pin 3: SDA (from PCA channel SDx)
Pin 4: SCL (from PCA channel SCx)
```

#### NeoPixel Output (J13)
```
Pin 1: +5V
Pin 2: GND
Pin 3: DIN (from ESP32 GPIO18 via R3 300Ω)
```

#### Servo Headers (J14-J16) — standard servo pinout
```
Pin 1: Signal (GPIO4 / GPIO16 / GPIO17)
Pin 2: +5V
Pin 3: GND
```

#### DFPlayer Mini (J17 left, J18 right)
DFPlayer Mini pinout (looking from top, USB slot facing up):
```
Left (J17):          Right (J18):
Pin 1: VCC (+5V)     Pin 1: BUSY
Pin 2: RX  ← R4 ←   Pin 2: USB-
        ESP32 GPIO25  Pin 3: USB+
Pin 3: TX            Pin 4: ADKEY2
Pin 4: DAC_R         Pin 5: ADKEY1
Pin 5: DAC_L         Pin 6: SPK1 → J19 pin 1
Pin 6: SPK2 → J19.2  Pin 7: GND
Pin 7: GND           Pin 8: IO2
Pin 8: IO1
```

### Schematic Build Order

1. Place power symbols (+5V, +3.3V, GND)
2. Place J1 (barrel jack), C1
3. Place J2, J3 (ESP32 headers) — use generic 1x19 connectors
4. Place U1 (PCA9548A, addr 0x70) — search "PCA9548" in symbol library
5. Place R1, R2 (I2C pull-ups), C2
6. Place J4-J11 (8x JST-XH 4-pin for slots 0-7, wired to U1)
7. Place U2 (PCA9548A, addr 0x71), C3
8. Place J12 (JST-XH 4-pin for slot 8, wired to U2 CH0)
9. Place R3, J13 (NeoPixel)
10. Place J14-J16 (servos)
11. Place R4, J17, J18 (DFPlayer)
12. Place J19 (speaker)
13. Place H1-H4 (mounting holes)
14. Wire everything per the net connections above
15. Run ERC (Electrical Rules Check)

---

## Daughter Board Schematic

### Bill of Materials

| Ref | Part | Package | Value | Notes |
|-----|------|---------|-------|-------|
| J1 | Pin socket 1x8 | PinSocket_1x08_P2.54mm | PN532_MODULE | PN532 red board socket |
| J2 | JST-XH 4-pin | JST_XH_B4B-XH-A | I2C_TO_MB | I2C back to motherboard |
| J3 | Pin header 1x6 | PinHeader_1x06_P2.54mm | NEOPIXEL_RING | Ring mount header |
| J4 | JST-XH 3-pin | JST_XH_B3B-XH-A | NEO_IN | NeoPixel chain input |
| J5 | JST-XH 3-pin | JST_XH_B3B-XH-A | NEO_OUT | NeoPixel chain output |
| C1 | Ceramic cap 0805 | C_0805 | 100nF | PN532 decoupling |
| H1-H4 | Mounting hole | MountingHole_3.2mm_M3 | M3 | Corner mounting |

### Net Connections

#### I2C Connector (J2) ↔ PN532 Module (J1)
```
J2 pin 1 (+5V)  → J1 pin 1 (VCC) + C1 to GND
J2 pin 2 (GND)  → J1 pin 2 (GND) + C1
J2 pin 3 (SDA)  → J1 pin 3 (SDA)
J2 pin 4 (SCL)  → J1 pin 4 (SCL)
J1 pins 5-8: unconnected (IRQ, RST, NC, NC)
```

#### NeoPixel Ring (J3) ↔ Chain connectors (J4, J5)
```
J4 pin 1 (+5V)  → J3 pin 1 (5V IN)  → J3 pin 5 (5V OUT)  → J5 pin 1 (+5V)
J4 pin 2 (GND)  → J3 pin 2 (GND IN) → J3 pin 6 (GND OUT) → J5 pin 2 (GND)
J4 pin 3 (DIN)  → J3 pin 3 (DIN)
                   J3 pin 4 (DOUT)    → J5 pin 3 (DOUT)
```

#### Power
```
+5V rail: J2.1, J4.1, J3.1, J3.5, J5.1, J1.1, C1+
GND rail: J2.2, J4.2, J3.2, J3.6, J5.2, J1.2, C1-
```

---

## PCB Layout Tips

### Motherboard
- Board size: 120mm × 100mm (already set in PCB file)
- ESP32 headers centered-left, U1 (PCA9548A) below them, U2 beside U1
- 9x JST-XH connectors along the right edge (easy cable access)
- Servo/NeoPixel/DFPlayer connectors along the top-right
- Use 1.0mm traces for power, 0.25mm for signals
- Pour ground plane on back copper layer

### Daughter Board
- Board size: 65mm × 65mm (fits inside 3" grid slot)
- PN532 header centered (module sits in the middle)
- NeoPixel ring guide circles on Dwgs.User layer (already in PCB)
- JST connectors on edges (I2C on left, NeoPixel IN on left, OUT on right)
- Keep traces short — this is a simple routing job

### Manufacturing (JLCPCB)
- 2-layer board, 1.6mm thickness
- HASL finish (cheapest)
- Green solder mask (or black if you want it to look cool under the table)
- Minimum order: 5 boards (~$2-5 for motherboard, ~$2-5 for daughter board)
- Order 10 daughter boards (9 needed + 1 spare)

## Generating Gerbers

1. Open PCB in KiCad
2. File → Plot
3. Select layers: F.Cu, B.Cu, F.SilkS, B.SilkS, F.Mask, B.Mask, Edge.Cuts
4. Plot format: Gerber
5. Generate drill file (Excellon format)
6. Zip all files → upload to JLCPCB
