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
| J2 | Pin socket 1x15 | PinSocket_1x15_P2.54mm | ESP32_Left | ESP32 left header (30-pin board, socketed) |
| J3 | Pin socket 1x15 | PinSocket_1x15_P2.54mm | ESP32_Right | ESP32 right header (30-pin board, socketed) |
| J19 | Pin socket 1x12 | PinSocket_1x12_P2.54mm | PCA9548A_1_L | PCA9548A breakout #1 left side (socketed) |
| J20 | Pin socket 1x12 | PinSocket_1x12_P2.54mm | PCA9548A_1_R | PCA9548A breakout #1 right side (socketed) |
| J21 | Pin socket 1x12 | PinSocket_1x12_P2.54mm | PCA9548A_2_L | PCA9548A breakout #2 left side (socketed) |
| J22 | Pin socket 1x12 | PinSocket_1x12_P2.54mm | PCA9548A_2_R | PCA9548A breakout #2 right side (socketed) |
| R1 | Resistor axial | R_Axial_DIN0207_L6.3mm | 4.7kΩ | SDA pull-up |
| R2 | Resistor axial | R_Axial_DIN0207_L6.3mm | 4.7kΩ | SCL pull-up |
| R3 | Resistor axial | R_Axial_DIN0207_L6.3mm | 300Ω | NeoPixel data protection |
| R4 | Resistor axial | R_Axial_DIN0207_L6.3mm | 1kΩ | DFPlayer TX series resistor |
| C1 | Electrolytic cap | CP_Radial_D10.0mm_P5.00mm | 1000µF/10V | 5V bulk decoupling |
| J4-J12 | JST-XH 4-pin | JST_XH_B4B-XH-A | SLOT0-8_I2C | I2C to daughter boards |
| J13 | JST-XH 3-pin | JST_XH_B3B-XH-A | NEOPIXEL_OUT | NeoPixel chain start |
| J14-J16 | JST-XH 3-pin | JST_XH_B3B-XH-A | SERVO_0-2 | Servo connectors (locking, custom extension cables) |
| J17 | Pin socket 1x8 | PinSocket_1x08_P2.54mm | DFPlayer_L | DFPlayer left (socketed — swap without desoldering) |
| J18 | Pin socket 1x8 | PinSocket_1x08_P2.54mm | DFPlayer_R | DFPlayer right (socketed — swap without desoldering) |
| J23 | Screw terminal 2-pin | TerminalBlock_P5.08mm | SPEAKER | Speaker output |
| J24 | Screw terminal 2-pin | TerminalBlock_P5.08mm | TOUCH_PAD | Capacitive touch input (game master door override) |
| J25 | Screw terminal 2-pin | TerminalBlock_P5.08mm | VIBE_MOTOR | Vibration motor output |
| Q1 | N-channel MOSFET | TO-92 | 2N7000 | Vibration motor driver (gate from ESP32, drain to motor) |
| R5 | Resistor axial | R_Axial_DIN0207_L6.3mm | 10kΩ | Q1 gate pull-down (keeps motor off at boot) |
| D1 | Schottky diode | DO-41 | 1N5819 | Flyback protection across motor |
| J26 | Pin header 1x9 | PinHeader_1x09_P2.54mm | GPIO_BREAKOUT | Unused GPIOs for future use |
| H1-H4 | Mounting hole | MountingHole_3.2mm_M3 | M3 | Corner mounting |

### KiCad Footprint Reference

Exact `Library : Footprint` names to use in KiCad 10's footprint browser when
assigning footprints to schematic symbols.

**Connectors:**
- J1 (barrel jack) — `Connector_BarrelJack : BarrelJack_Horizontal`
- J2, J3 (ESP32 1×15 sockets) — `Connector_PinSocket_2.54mm : PinSocket_1x15_P2.54mm_Vertical`
- J19–J22 (PCA9548A 1×12 sockets) — `Connector_PinSocket_2.54mm : PinSocket_1x12_P2.54mm_Vertical`
- J17, J18 (DFPlayer 1×8 sockets) — `Connector_PinSocket_2.54mm : PinSocket_1x08_P2.54mm_Vertical`
- J4–J12 (JST-XH 4-pin, I2C) — `Connector_JST : JST_XH_B4B-XH-A_1x04_P2.50mm_Vertical`
- J13 (JST-XH 3-pin, NeoPixel) — `Connector_JST : JST_XH_B3B-XH-A_1x03_P2.50mm_Vertical`
- J14–J16 (servo 1×3, JST-XH) — `Connector_JST : JST_XH_B3B-XH-A_1x03_P2.50mm_Vertical`
- J23–J25 (screw terminals 2-pin) — `TerminalBlock_Phoenix : TerminalBlock_Phoenix_MKDS-1,5-2-5.08_1x02_P5.08mm_Horizontal`
- J26 (GPIO breakout 1×9 header) — `Connector_PinHeader_2.54mm : PinHeader_1x09_P2.54mm_Vertical`

**Passives:**
- R1–R5 (axial resistors) — `Resistor_THT : R_Axial_DIN0207_L6.3mm_D2.5mm_P10.16mm_Horizontal`
- C1 (1000µF electrolytic cap) — `Capacitor_THT : CP_Radial_D10.0mm_P5.00mm`

**Semiconductors:**
- Q1 (2N7000 MOSFET) — `Package_TO_SOT_THT : TO-92_Inline`
- D1 (1N5819 Schottky) — `Diode_THT : D_DO-41_SOD81_P10.16mm_Horizontal`

**Mechanical:**
- H1–H4 (M3 mounting holes) — `MountingHole : MountingHole_3.2mm_M3`

**Tips:**
- Use the `_Vertical` variants for JST-XH (pins straight through the board). Pick `_Horizontal` only if you want side-entry connectors.
- The Phoenix MKDS 5.08mm screw terminal is a safe generic choice. `TerminalBlock_bornier : TerminalBlock_bornier-2_P5.08mm` also works if you prefer a different brand — just match the 5.08mm pitch.
- All passives and semiconductors are through-hole. No SMD soldering required.
- The 2N7000 is the through-hole equivalent of the 2N7002 — same logic-level N-channel MOSFET, just in a TO-92 package. Pinout is D-G-S (drain, gate, source) left to right with the flat side facing you.

### Net Connections

#### Power [x]
```
J1 pin 1 (tip, +5V) → +5V rail
J1 pin 2 (sleeve, GND) → GND rail
C1: +5V to GND (near barrel jack)
+5V → J2 pin 15 (ESP32 VIN, left side bottom)
GND → J2 pin 14 (ESP32 GND, left side)
```

#### ESP32 Pin Mapping (30-pin DevKit, 15 per side) [x]

Orientation: USB port at bottom, antenna at top.

Left header (J2), top to bottom:
```
Pin 1:  EN
Pin 2:  VP  (GPIO36, input only)
Pin 3:  VN  (GPIO39, input only)
Pin 4:  D34 (GPIO34, input only)
Pin 5:  D35 (GPIO35, input only)
Pin 6:  D32 (GPIO32)     → J26 pin 9 (GPIO breakout)
Pin 7:  D33 (GPIO33)     → J24 pin 2 (Capacitive touch pad 2, Touch8)
Pin 8:  D25 (GPIO25)    → R4 → J17 pin 2 (DFPlayer RX)
Pin 9:  D26 (GPIO26)     →   pull-down + Q1 gate (Vibration motor)
Pin 10: D27 (GPIO27)     → J24 pin 1 (Capacitive touch pad, Touch7)
Pin 11: D14 (GPIO14)     → J26 pin 5 (GPIO breakout)
Pin 12: D12 (GPIO12)     → J26 pin 3 (GPIO breakout)
Pin 13: D13 (GPIO13)     → J26 pin 4 (GPIO breakout)
Pin 14: GND              → GND
Pin 15: VIN              → +5V rail
```

Right header (J3), top to bottom:
```
Pin 1:  D23 (GPIO23)     → J26 pin 8 (GPIO breakout)
Pin 2:  D22 (GPIO22)    → SCL bus (to J19 pin 4 SCL)
Pin 3:  TX0 (GPIO1)
Pin 4:  RX0 (GPIO3)
Pin 5:  D21 (GPIO21)    → SDA bus (to J19 pin 3 SDA)
Pin 6:  D19 (GPIO19)     → J26 pin 7 (GPIO breakout)
Pin 7:  D18 (GPIO18)    → R3 → J13 pin 3 (NeoPixel DIN)
Pin 8:  D5  (GPIO5)      → J26 pin 6 (GPIO breakout)
Pin 9:  TX2 (GPIO17)    → J14 pin 1 (Servo 0 signal)
Pin 10: RX2 (GPIO16)    → J15 pin 1 (Servo 1 signal)
Pin 11: D4  (GPIO4)     → J16 pin 1 (Servo 2 signal)
Pin 12: D2  (GPIO2)      → J26 pin 1 (GPIO breakout)
Pin 13: D15 (GPIO15)     → J26 pin 2 (GPIO breakout)
Pin 14: GND              → GND
Pin 15: 3V3              → +3.3V rail (powers PCA9548A)
```

**Servo pin assignments:**
```
Servo 0: GPIO17  / TX2  (J14)
Servo 1: GPIO16 / RX2 (J15)
Servo 2: GPIO4 / D4 (J16)
```

#### PCA9548A #1 (addr 0x70) — Slots 0-7 [x]

Breakout board, left side (J19), top to bottom:
```
Pin 1:  VIN → +3.3V
Pin 2:  GND → GND
Pin 3:  SDA → SDA bus (ESP32 GPIO21) + R1 to +3.3V
Pin 4:  SCL → SCL bus (ESP32 GPIO22) + R2 to +3.3V
Pin 5:  RST → +3.3V (active low, tie high)
Pin 6:  A0  → GND
Pin 7:  A1  → GND
Pin 8:  A2  → GND
               → I2C address = 0x70
Pin 9:  SD0 → J4 pin 3  (Slot 0 SDA)
Pin 10: SC0 → J4 pin 4  (Slot 0 SCL)
Pin 11: SD1 → J5 pin 3  (Slot 1 SDA)
Pin 12: SC1 → J5 pin 4  (Slot 1 SCL)
```

Breakout board, right side (J20), top to bottom:
```
Pin 1:  SC7 → J11 pin 4 (Slot 7 SCL)
Pin 2:  SD7 → J11 pin 3 (Slot 7 SDA)
Pin 3:  SC6 → J10 pin 4 (Slot 6 SCL)
Pin 4:  SD6 → J10 pin 3 (Slot 6 SDA)
Pin 5:  SC5 → J9 pin 4  (Slot 5 SCL)
Pin 6:  SD5 → J9 pin 3  (Slot 5 SDA)
Pin 7:  SC4 → J8 pin 4  (Slot 4 SCL)
Pin 8:  SD4 → J8 pin 3  (Slot 4 SDA)
Pin 9:  SC3 → J7 pin 4  (Slot 3 SCL)
Pin 10: SD3 → J7 pin 3  (Slot 3 SDA)
Pin 11: SC2 → J6 pin 4  (Slot 2 SCL)
Pin 12: SD2 → J6 pin 3  (Slot 2 SDA)
```

#### PCA9548A #2 (addr 0x71) — Slot 8 [x]

Breakout board, left side (J21), top to bottom:
```
Pin 1:  VIN → +3.3V
Pin 2:  GND → GND
Pin 3:  SDA → SDA bus (shared with PCA #1)
Pin 4:  SCL → SCL bus (shared with PCA #1)
Pin 5:  RST → +3.3V (active low, tie high)
Pin 6:  A0  → +3.3V (address bit 0 = 1)
Pin 7:  A1  → GND   (address bit 1 = 0)
Pin 8:  A2  → GND   (address bit 2 = 0)
               → I2C address = 0x71
Pin 9:  SD0 → J12 pin 3 (Slot 8 SDA)
Pin 10: SC0 → J12 pin 4 (Slot 8 SCL)
Pin 11: SD1 → unconnected
Pin 12: SC1 → unconnected
```

Breakout board, right side (J22), top to bottom:
```
Pin 1-12: SC7-SD2 → all unconnected (channels 2-7 unused)
```

#### JST-XH I2C Connectors (J4-J12) — all same pinout [x]
```
Pin 1: +5V
Pin 2: GND
Pin 3: SDA (from PCA channel SDx)
Pin 4: SCL (from PCA channel SCx)
```

#### NeoPixel Output (J13) [x]
```
Pin 1: +5V
Pin 2: GND
Pin 3: DIN (from ESP32 GPIO18 via R3 300Ω)
```

#### Servo Headers (J14-J16) — standard servo pinout [x]
```
Pin 1: Signal (GPIO4 / GPIO16 / GPIO17)
Pin 2: +5V
Pin 3: GND
```

#### DFPlayer Mini (J17 left, J18 right) [x]
DFPlayer Mini pinout (looking from top, SD card slot facing down):
```
Left (J17):          Right (J18):
Pin 1: VCC (+5V)     Pin 1: BUSY
Pin 2: RX  ← R4 ←   Pin 2: USB-
        ESP32 GPIO25  Pin 3: USB+
Pin 3: TX            Pin 4: ADKEY2
Pin 4: DAC_R         Pin 5: ADKEY1
Pin 5: DAC_L         Pin 6: IO2
Pin 6: SPK1 → J23.1  Pin 7: GND
Pin 7: GND           Pin 8: IO1
Pin 8: SPK2 → J23.2
```

#### Capacitive Touch Pads (J24) — Game Master Door Override [x]
```
Pin 1: GPIO27 (Touch7) — wire to copper/aluminum tape pad #1
Pin 2: GPIO33 (Touch8) — wire to copper/aluminum tape pad #2
```

Two independent touch inputs. Each can trigger a different action in firmware
(e.g., pad 1 = open all doors, pad 2 = reset all doors). Or wire both pads
to do the same thing in code — up to you.

Each pad should be a small isolated piece of conductive material (copper tape,
aluminum tape) hidden on the table — underside of an edge, back panel, etc.
Keep the wires from GPIO to pad short to reduce noise.
No external components needed — ESP32 touch sensing is built in.

#### Vibration Motor (J25, Q1, R5, D1) — Tactile Craft Feedback [x]

```
ESP32 GPIO26 ──► R5 (10kΩ to GND, pull-down) ──► Q1 gate (2N7002)
                                                   Q1 source → GND
                                                   Q1 drain  → J25 pin 1 (motor -)
                                                   J25 pin 2 → +5V (motor +)
                                                   D1 across J25: cathode to pin 2, anode to pin 1
```

The MOSFET acts as a switch. GPIO26 HIGH = motor on, LOW = motor off.
R5 keeps the gate pulled low during ESP32 boot so the motor doesn't buzz randomly.
D1 absorbs the voltage spike when the motor turns off (flyback protection).

The coin vibration motor wires go into the J25 screw terminal — polarity
doesn't matter for a basic DC motor, but match the diagram for the diode to work.

#### GPIO Breakout Header (J26) — Future Expansion

```
Pin 1: D2  (GPIO2)
Pin 2: D5  (GPIO5)
Pin 3: D12 (GPIO12)
Pin 4: D13 (GPIO13)
Pin 5: D14 (GPIO14)
Pin 6: D15 (GPIO15)
Pin 7: D19 (GPIO19)
Pin 8: D23 (GPIO23)
Pin 9: D32 (GPIO32)
```

Unused GPIOs broken out to a pin header along the board edge.
Use for future additions — extra sensors, LEDs, buttons, etc.
Each pin connects directly to the ESP32 GPIO with no other components.

### Schematic Build Order

1. Place power symbols (+5V, +3.3V, GND)
2. Place J1 (barrel jack), C1
3. Place J2, J3 (ESP32 headers) — use generic 1x15 connectors (30-pin board, 15 per side)
4. Place J19, J20 (PCA9548A breakout #1 pin sockets, addr 0x70)
5. Place R1, R2 (I2C pull-ups)
6. Place J4-J11 (8x JST-XH 4-pin for slots 0-7, wired to PCA #1)
7. Place J21, J22 (PCA9548A breakout #2 pin sockets, addr 0x71)
8. Place J12 (JST-XH 4-pin for slot 8, wired to PCA #2 CH0)
9. Place R3, J13 (NeoPixel)
10. Place J14-J16 (servos)
11. Place R4, J17, J18 (DFPlayer)
12. Place J23 (speaker)
13. Place J24 (capacitive touch pads)
14. Place Q1, R5, D1, J25 (vibration motor circuit)
15. Place J26 (GPIO breakout header)
16. Place H1-H4 (mounting holes)
17. Wire everything per the net connections above
18. Run ERC (Electrical Rules Check)

---

## Daughter Board Schematic

### Bill of Materials

| Ref | Part | Package | Value | Notes |
|-----|------|---------|-------|-------|
| J1 | Pin header 1x4 | PinHeader_1x04_P2.54mm | PN532_I2C | PN532 I2C connection (soldered directly — VCC, GND, SDA, SCL) |
| J2 | JST-XH 4-pin | JST_XH_B4B-XH-A | I2C_TO_MB | I2C back to motherboard |
| J3 | Pin header 1x1 | PinHeader_1x01_P2.54mm | NEO_5V_IN | NeoPixel ring 5V in (place manually to match ring pad) |
| J6 | Pin header 1x1 | PinHeader_1x01_P2.54mm | NEO_GND_IN | NeoPixel ring GND in (place manually) |
| J7 | Pin header 1x1 | PinHeader_1x01_P2.54mm | NEO_DIN | NeoPixel ring data in (place manually) |
| J8 | Pin header 1x1 | PinHeader_1x01_P2.54mm | NEO_DOUT | NeoPixel ring data out (place manually) |
| J9 | Pin header 1x1 | PinHeader_1x01_P2.54mm | NEO_5V_OUT | NeoPixel ring 5V out (place manually) |
| J10 | Pin header 1x1 | PinHeader_1x01_P2.54mm | NEO_GND_OUT | NeoPixel ring GND out (place manually) |
| J4 | JST-XH 3-pin | JST_XH_B3B-XH-A | NEO_IN | NeoPixel chain input |
| J5 | JST-XH 3-pin | JST_XH_B3B-XH-A | NEO_OUT | NeoPixel chain output |
| H1-H4 | Mounting hole | MountingHole_3.2mm_M3 | M3 | Corner mounting |

### KiCad Footprint Reference

- J1 (PN532 1×4 header) — `Connector_PinHeader_2.54mm : PinHeader_1x04_P2.54mm_Vertical`
- J2 (JST-XH 4-pin, I2C) — `Connector_JST : JST_XH_B4B-XH-A_1x04_P2.50mm_Vertical`
- J3, J6–J10 (NeoPixel ring 1×1 pins) — `Connector_PinHeader_2.54mm : PinHeader_1x01_P2.54mm_Vertical`
- J4, J5 (JST-XH 3-pin, NeoPixel) — `Connector_JST : JST_XH_B3B-XH-A_1x03_P2.50mm_Vertical`
- H1–H4 (M3 mounting holes) — `MountingHole : MountingHole_3.2mm_M3`

### Net Connections

#### I2C Connector (J2) ↔ PN532 Module (J1)
```
J2 pin 1 (+5V)  → J1 pin 1 (VCC)
J2 pin 2 (GND)  → J1 pin 2 (GND)
J2 pin 3 (SDA)  → J1 pin 3 (SDA)
J2 pin 4 (SCL)  → J1 pin 4 (SCL)
```

#### NeoPixel Ring (J3, J6-J10) ↔ Chain connectors (J4, J5)
```
J4 pin 1 (+5V)  → J3 (5V IN)   → J9 (5V OUT)   → J5 pin 1 (+5V)
J4 pin 2 (GND)  → J6 (GND IN)  → J10 (GND OUT)  → J5 pin 2 (GND)
J4 pin 3 (DIN)  → J7 (DIN)
                   J8 (DOUT)    → J5 pin 3 (DOUT)
```

Place J3, J6–J10 individually in the PCB editor to match the pad positions on your
NeoPixel ring. Measure the ring's pad locations and position each 1×1 pin to align.

#### Power
```
+5V rail: J2.1, J4.1, J3, J9, J5.1, J1.1
GND rail: J2.2, J4.2, J6, J10, J5.2, J1.2
```

---

## PCB Layout Tips

### Lessons from POC Build

These were discovered during breadboard prototyping — make sure the PCB accounts for them:

- **PN532 modules need 5V power.** The ESP32's 3.3V rail can't supply enough current.
  Most PN532 boards have an onboard regulator and accept 5V. The daughter board I2C
  connector carries 5V, not 3.3V.
- **PCA9548A ~RESET must be tied high.** Leaving it floating can hold the chip in reset.
  Both PCA breakout boards have ~RESET pulled to +3.3V in the schematic.
- **PCA9548A needs I2C pull-ups on the main bus.** The PN532 boards have their own
  pull-ups on the downstream channels, but the main SDA/SCL bus between the ESP32
  and PCA needs R1/R2 (4.7kΩ to 3.3V). Without them the bus is unreliable.
- **Test every PCA9548A breakout board before soldering.** One of two boards from a
  2-pack was dead on arrival. Pin sockets let you swap without desoldering.
- **All four module types use pin sockets, not direct soldering.** ESP32 (1x15 pin
  sockets), PCA9548A breakout (1x12 + 1x12 pin sockets), DFPlayer Mini (1x8 pin
  sockets). This lets you swap any dead or damaged module without rework. Solder
  the sockets to the PCB, then plug the modules in.
- **PN532 modules are soldered directly to the daughter boards.** The PN532 has
  headers at right angles (8-pin + 4-pin perpendicular), making socketing awkward.
  Since daughter boards are cheap and PN532 modules are inexpensive, direct
  soldering is simpler. Only 4 pins are wired (VCC, GND, SDA, SCL).

### Socket Row Spacings (measured from breadboard)

These are center-to-center distances between the left and right pin socket rows
for each socketed module. Set these exactly when placing footprints.

| Module | Left Socket | Right Socket | Row Spacing |
|--------|-------------|--------------|-------------|
| ESP32 DevKit 30-pin | J2 (1×15) | J3 (1×15) | 25.4mm (1000mil) |
| PCA9548A breakout #1 | J19 (1×12) | J20 (1×12) | 17.78mm (700mil) |
| PCA9548A breakout #2 | J21 (1×12) | J22 (1×12) | 17.78mm (700mil) |
| DFPlayer Mini | J17 (1×8) | J18 (1×8) | 17.78mm (700mil) |

To set the spacing in KiCad's PCB editor:
1. Place both sockets for a module
2. Select one socket, press `E` to open properties, note its X position
3. Select the other socket, press `E`, set its X position to exactly the row spacing apart
4. Use the measurement tool to verify (see below)

### How to Measure in the PCB Editor

- Press `Ctrl+Shift+M` (or Inspect → Measure Tool) to activate the ruler
- Click on the center of one pad, then click on the center of the target pad
- The distance shows in the bottom status bar and as an overlay on the board
- Press `Esc` to exit the measurement tool

### Motherboard
- Board size: 120mm × 100mm (already set in PCB file)
- ESP32 headers centered-left, PCA9548A #1 (J19/J20) below them, PCA9548A #2 (J21/J22) beside it
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

---

## Power Supply & Off-Board NeoPixel Wiring

### Power Supply

Use a **5V 10A (50W) switching power supply** with screw terminal outputs.
These are sold as "LED power supplies" on Amazon for ~$10–15. 10A gives plenty
of headroom for all components at peak draw.

### Why NeoPixel Power Runs Off-Board

9 NeoPixel rings × 24 LEDs = 216 LEDs. At moderate brightness with colored
effects, that's ~3–4A just for the LEDs. A standard 1oz copper PCB trace would
need to be 3mm+ wide to carry that safely, and it still concentrates all the
current through the barrel jack and one trace. Running NeoPixel power directly
from the PSU avoids this entirely.

### Wiring Diagram

```
5V 10A PSU (screw terminal output)
    │
    ├──► [+5V] Motherboard barrel jack J1 (tip)
    │    [GND] Motherboard barrel jack J1 (sleeve)
    │       Powers: ESP32, PCA9548As, DFPlayer, servos,
    │       PN532s (via I2C cables), vibration motor
    │       Peak draw: ~3–4A
    │
    └──► [+5V] NeoPixel power bus (18AWG wire, direct to rings)
         [GND] NeoPixel ground bus (18AWG wire, direct to rings)
            Powers: all 9 NeoPixel rings
            Peak draw: ~3–4A at moderate brightness
```

### Motherboard J13 (NeoPixel Output) — Data Only

With off-board power, J13 only carries the data signal:
```
Pin 1: +5V  — leave unconnected at the ring end (or connect for redundancy)
Pin 2: GND  — MUST connect (common ground reference for data signal)
Pin 3: DIN  — data from ESP32 GPIO18 via R3
```

The GND connection between the motherboard and the first NeoPixel ring is
essential — without a common ground, the data signal won't be read correctly.

### NeoPixel Power Injection

For 9 rings daisy-chained, inject power at multiple points to avoid voltage
drop at the far end of the chain:
- Connect PSU +5V/GND directly to ring 1 (start of chain)
- Optionally inject again at ring 5 (middle of chain)
- If the last rings look dim or discolored, inject at ring 9 too

Use 18AWG or thicker wire for the power bus. Thinner wire (22AWG+) is fine
for the short jumps between rings on the data line.

### Common Ground — Critical

The PSU ground, motherboard ground, and NeoPixel ground must all be connected.
Since both the barrel jack and the NeoPixel bus connect to the same PSU, this
happens naturally. Do NOT use separate power supplies for the motherboard and
NeoPixels unless you tie their grounds together.
