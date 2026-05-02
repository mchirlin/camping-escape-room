#!/usr/bin/env python3
"""Generate Crafting Table Daughter Board PCB using KiCad 10 Python API."""

import pcbnew
import os
import math

# Output path
KICAD_DIR = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "kicad", "daughter-board"
)
os.makedirs(KICAD_DIR, exist_ok=True)
PCB_PATH = os.path.join(KICAD_DIR, "daughter-board.kicad_pcb")

# --- Create board ---
board = pcbnew.BOARD()

# --- Board outline: 65mm x 65mm ---
rect = pcbnew.PCB_SHAPE(board)
rect.SetShape(pcbnew.SHAPE_T_RECT)
rect.SetStart(pcbnew.VECTOR2I(0, 0))
rect.SetEnd(pcbnew.VECTOR2I(pcbnew.FromMM(65), pcbnew.FromMM(65)))
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
            pad.SetPosition(pcbnew.VECTOR2I(
                pcbnew.FromMM(x_mm),
                pcbnew.FromMM(y_mm + i * pitch_mm)
            ))
        else:
            pad.SetPosition(pcbnew.VECTOR2I(
                pcbnew.FromMM(x_mm + i * pitch_mm),
                pcbnew.FromMM(y_mm)
            ))
        fp.Add(pad)
    board.Add(fp)

def add_circle(board, cx_mm, cy_mm, radius_mm, layer=pcbnew.Dwgs_User):
    c = pcbnew.PCB_SHAPE(board)
    c.SetShape(pcbnew.SHAPE_T_CIRCLE)
    center = pcbnew.VECTOR2I(pcbnew.FromMM(cx_mm), pcbnew.FromMM(cy_mm))
    end = pcbnew.VECTOR2I(pcbnew.FromMM(cx_mm + radius_mm), pcbnew.FromMM(cy_mm))
    c.SetStart(center)
    c.SetEnd(end)
    c.SetLayer(layer)
    c.SetWidth(pcbnew.FromMM(0.15))
    board.Add(c)

# --- Mounting holes (4 corners) ---
add_mounting_hole(board, 3.5, 3.5, "H1")
add_mounting_hole(board, 61.5, 3.5, "H2")
add_mounting_hole(board, 3.5, 61.5, "H3")
add_mounting_hole(board, 61.5, 61.5, "H4")

# --- Title ---
add_text(board, "DAUGHTER BOARD v1.0", 32.5, 3, 1.5)

# --- NeoPixel ring placement guide circles ---
# Ring center at board center (32.5, 32.5)
# 24-LED ring: ~52mm outer diameter, ~37mm inner diameter
CX, CY = 32.5, 32.5
add_circle(board, CX, CY, 26.0)   # Outer ring guide (52mm OD)
add_circle(board, CX, CY, 18.5)   # Inner ring guide (37mm ID)
add_text(board, "NeoPixel Ring", 32.5, 60, 1.0, pcbnew.Dwgs_User)

# --- PN532 module socket (1x8 pin header, centered) ---
# PN532 red board is ~43mm wide, pins along one edge
# Place header centered horizontally, inside the ring inner diameter
add_tht_header(board, CX - 3 * 2.54 / 2, CY - 5, 8, "J1", "PN532_MODULE", pitch_mm=2.54, vertical=False)
add_text(board, "PN532", CX, CY - 9, 1.2)

# Pin labels on fab layer
labels = ["VCC", "GND", "SDA", "SCL", "IRQ", "RST", "NC", "NC"]
for i, lbl in enumerate(labels):
    add_text(board, lbl, CX - 3 * 2.54 / 2 + i * 2.54, CY - 2, 0.6, pcbnew.F_Fab)

# --- I2C connector to motherboard (4-pin JST-XH) ---
add_tht_header(board, 5, 15, 4, "J2", "I2C_TO_MB", pitch_mm=2.5, vertical=True)
add_text(board, "I2C", 5, 10, 1.0)
# Pin labels
for i, lbl in enumerate(["5V", "GND", "SDA", "SCL"]):
    add_text(board, lbl, 10, 15 + i * 2.5, 0.6, pcbnew.F_Fab)

# --- NeoPixel IN (3-pin JST-XH, left side) ---
add_tht_header(board, 5, 42, 3, "J4", "NEO_IN", pitch_mm=2.5, vertical=True)
add_text(board, "NEO IN", 5, 38, 1.0)
for i, lbl in enumerate(["5V", "GND", "DIN"]):
    add_text(board, lbl, 10, 42 + i * 2.5, 0.6, pcbnew.F_Fab)

# --- NeoPixel OUT (3-pin JST-XH, right side) ---
add_tht_header(board, 60, 42, 3, "J5", "NEO_OUT", pitch_mm=2.5, vertical=True)
add_text(board, "NEO OUT", 57, 38, 1.0)
for i, lbl in enumerate(["5V", "GND", "DOUT"]):
    add_text(board, lbl, 53, 42 + i * 2.5, 0.6, pcbnew.F_Fab)

# --- NeoPixel ring header (6-pin, arranged around the ring) ---
# Place as a 1x6 header near the bottom for the ring's solder pads
add_tht_header(board, CX - 2.5 * 2.54 / 2, CY + 12, 6, "J3", "NEOPIXEL_RING", pitch_mm=2.54, vertical=False)
ring_labels = ["5Vin", "GNDin", "DIN", "DOUT", "5Vout", "GNDout"]
for i, lbl in enumerate(ring_labels):
    add_text(board, lbl, CX - 2.5 * 2.54 / 2 + i * 2.54, CY + 16, 0.5, pcbnew.F_Fab)

# --- Decoupling cap label ---
add_text(board, "C1 100nF", 50, 20, 0.8)

# --- Design notes on fab layer ---
add_text(board, "Board: 65x65mm, fits inside 3\" grid slot", 32.5, 63, 0.8, pcbnew.F_Fab)

# --- Save ---
board.Save(PCB_PATH)
print(f"Daughter board PCB saved to: {PCB_PATH}")
