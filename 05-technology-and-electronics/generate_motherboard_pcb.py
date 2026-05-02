#!/usr/bin/env python3
"""Generate Crafting Table Motherboard schematic + PCB using KiCad 10 Python API."""

import pcbnew
import os

# Output path
KICAD_DIR = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "kicad", "motherboard"
)
os.makedirs(KICAD_DIR, exist_ok=True)
PCB_PATH = os.path.join(KICAD_DIR, "motherboard.kicad_pcb")

# --- Create board ---
board = pcbnew.BOARD()

# --- Board outline: 120mm x 100mm ---
rect = pcbnew.PCB_SHAPE(board)
rect.SetShape(pcbnew.SHAPE_T_RECT)
rect.SetStart(pcbnew.VECTOR2I(0, 0))
rect.SetEnd(pcbnew.VECTOR2I(pcbnew.FromMM(120), pcbnew.FromMM(100)))
rect.SetLayer(pcbnew.Edge_Cuts)
rect.SetWidth(pcbnew.FromMM(0.15))
board.Add(rect)

# --- Helper functions ---
def add_text(board, text, x_mm, y_mm, size_mm=1.5, layer=pcbnew.F_SilkS):
    t = pcbnew.PCB_TEXT(board)
    t.SetText(text)
    t.SetPosition(pcbnew.VECTOR2I(pcbnew.FromMM(x_mm), pcbnew.FromMM(y_mm)))
    t.SetLayer(layer)
    t.SetTextSize(pcbnew.VECTOR2I(pcbnew.FromMM(size_mm), pcbnew.FromMM(size_mm)))
    t.SetTextThickness(pcbnew.FromMM(size_mm * 0.15))
    board.Add(t)

def add_mounting_hole(board, x_mm, y_mm, ref):
    fp = pcbnew.FOOTPRINT(board)
    fp.SetReference(ref)
    fp.SetValue("M3")
    fp.SetPosition(pcbnew.VECTOR2I(pcbnew.FromMM(x_mm), pcbnew.FromMM(y_mm)))
    fp.SetLayer(pcbnew.F_Cu)
    # Add pad (mounting hole)
    pad = pcbnew.PAD(fp)
    pad.SetShape(pcbnew.PAD_SHAPE_CIRCLE)
    pad.SetAttribute(pcbnew.PAD_ATTRIB_NPTH)
    pad.SetDrillSize(pcbnew.VECTOR2I(pcbnew.FromMM(3.2), pcbnew.FromMM(3.2)))
    pad.SetSize(pcbnew.VECTOR2I(pcbnew.FromMM(6.4), pcbnew.FromMM(6.4)))
    pad.SetLayerSet(pcbnew.LSET.AllCuMask())
    pad.SetPosition(pcbnew.VECTOR2I(pcbnew.FromMM(x_mm), pcbnew.FromMM(y_mm)))
    fp.Add(pad)
    board.Add(fp)

def add_tht_header(board, x_mm, y_mm, pins, ref, value, pitch_mm=2.54, vertical=True):
    """Add a through-hole pin header footprint."""
    fp = pcbnew.FOOTPRINT(board)
    fp.SetReference(ref)
    fp.SetValue(value)
    fp.SetPosition(pcbnew.VECTOR2I(pcbnew.FromMM(x_mm), pcbnew.FromMM(y_mm)))
    fp.SetLayer(pcbnew.F_Cu)
    for i in range(pins):
        pad = pcbnew.PAD(fp)
        pad.SetName(str(i + 1))
        pad.SetShape(pcbnew.PAD_SHAPE_OVAL)
        pad.SetAttribute(pcbnew.PAD_ATTRIB_PTH)
        pad.SetDrillSize(pcbnew.VECTOR2I(pcbnew.FromMM(1.0), pcbnew.FromMM(1.0)))
        pad.SetSize(pcbnew.VECTOR2I(pcbnew.FromMM(1.7), pcbnew.FromMM(1.7)))
        pad.SetLayerSet(pcbnew.LSET.AllCuMask())
        if vertical:
            offset_y = i * pitch_mm
            pad.SetPosition(pcbnew.VECTOR2I(
                pcbnew.FromMM(x_mm),
                pcbnew.FromMM(y_mm + offset_y)
            ))
        else:
            offset_x = i * pitch_mm
            pad.SetPosition(pcbnew.VECTOR2I(
                pcbnew.FromMM(x_mm + offset_x),
                pcbnew.FromMM(y_mm)
            ))
        fp.Add(pad)
    board.Add(fp)
    return fp

# --- Mounting holes (4 corners) ---
add_mounting_hole(board, 3.5, 3.5, "H1")
add_mounting_hole(board, 116.5, 3.5, "H2")
add_mounting_hole(board, 3.5, 96.5, "H3")
add_mounting_hole(board, 116.5, 96.5, "H4")

# --- Title ---
add_text(board, "CRAFTING TABLE MOTHERBOARD v1.0", 60, 5, 2.0)

# --- ESP32 DevKit V1 headers (2x 19-pin) ---
add_tht_header(board, 22, 15, 19, "J2", "ESP32_Left")
add_tht_header(board, 22 + 25.4, 15, 19, "J3", "ESP32_Right")
add_text(board, "ESP32", 35, 12, 1.5)

# --- Barrel jack placeholder ---
add_tht_header(board, 8, 20, 3, "J1", "Barrel_Jack_5V", pitch_mm=5.0)
add_text(board, "5V IN", 8, 15, 1.2)

# --- PCA9548A (SOIC-24W, placed as THT adapter for hand soldering) ---
# Using a wide SOIC-24 footprint area
add_text(board, "PCA9548A", 35, 68, 1.2)
add_text(board, "U1 (0x70)", 35, 71, 1.0)

# --- Second PCA9548A for slot 8 ---
add_text(board, "PCA9548A", 55, 68, 1.2)
add_text(board, "U2 (0x71)", 55, 71, 1.0)

# --- I2C pull-up resistors ---
add_text(board, "R1 4.7k SDA", 20, 65, 0.8)
add_text(board, "R2 4.7k SCL", 20, 67, 0.8)

# --- 9x JST-XH 4-pin I2C connectors (SLOT 0-8) ---
slot_y_start = 18
slot_spacing = 8
for i in range(9):
    y = slot_y_start + i * slot_spacing
    ref = f"J{i + 4}"
    val = f"SLOT{i}_I2C"
    add_tht_header(board, 85, y, 4, ref, val, pitch_mm=2.5, vertical=False)
    add_text(board, f"SLOT {i}", 75, y, 1.0)

# --- NeoPixel output (3-pin JST-XH) ---
add_tht_header(board, 108, 18, 3, "J13", "NEOPIXEL_OUT", pitch_mm=2.5, vertical=False)
add_text(board, "NEOPIXEL", 108, 14, 1.0)
add_text(board, "R3 300R", 102, 18, 0.8)

# --- 3x Servo headers (3-pin) ---
for i in range(3):
    y = 30 + i * 8
    ref = f"J{14 + i}"
    val = f"SERVO_{i}"
    add_tht_header(board, 108, y, 3, ref, val, pitch_mm=2.54, vertical=False)
add_text(board, "SERVOS", 108, 26, 1.0)

# --- DFPlayer Mini (2x 8-pin socket) ---
add_tht_header(board, 100, 58, 8, "J17", "DFPlayer_L")
add_tht_header(board, 100 + 17.78, 58, 8, "J18", "DFPlayer_R")
add_text(board, "DFPlayer Mini", 109, 55, 1.0)
add_text(board, "R4 1k TX", 95, 55, 0.8)

# --- Speaker screw terminal (2-pin) ---
add_tht_header(board, 108, 82, 2, "J19", "SPEAKER", pitch_mm=5.08, vertical=False)
add_text(board, "SPEAKER", 108, 78, 1.0)

# --- Capacitor labels ---
add_text(board, "C1 1000uF", 15, 30, 0.8)
add_text(board, "C2 100nF (U1)", 50, 65, 0.8)
add_text(board, "C3 100nF (U2)", 65, 65, 0.8)

# --- Design notes on fab layer ---
add_text(board, "U1 PCA9548A (0x70): 8 channels → slots 0-7", 5, 92, 1.0, pcbnew.F_Fab)
add_text(board, "U2 PCA9548A (0x71): CH0 → slot 8", 5, 95, 1.0, pcbnew.F_Fab)

# --- Pin assignment notes on fab layer ---
notes = [
    "GPIO21 = SDA (to U1 + U2 PCA9548A)",
    "GPIO22 = SCL (to U1 + U2 PCA9548A)",
    "GPIO18 = NeoPixel DIN (via 300R)",
    "GPIO4  = Servo 0",
    "GPIO16 = Servo 1",
    "GPIO17 = Servo 2",
    "GPIO25 = DFPlayer TX (via 1k)",
    "VIN    = 5V from barrel jack",
]
for i, note in enumerate(notes):
    add_text(board, note, 5, 80 + i * 2.5, 0.8, pcbnew.F_Fab)

# --- Save ---
board.Save(PCB_PATH)
print(f"Motherboard PCB saved to: {PCB_PATH}")
