#!/usr/bin/env python3
"""Generate Minecraft recipe cards — landscape, grey crafting UI style."""

import base64
import os
import subprocess
import tempfile

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT = os.path.dirname(SCRIPT_DIR)
TEX = os.path.join(PROJECT, "minecraft", "textures")
ICONS = os.path.join(SCRIPT_DIR, "block-icons")

T = {
    "WPK": f"{ICONS}/oak_planks.png",
    "STK": f"{TEX}/item/stick.png",
    "IRN": f"{TEX}/item/iron_ingot.png",
    "STR": f"{TEX}/item/string.png",
    "GLD": f"{TEX}/item/gold_ingot.png",
    "GNP": f"{TEX}/item/gunpowder.png",
    "SND": f"{ICONS}/sand.png",
    "RED": f"{TEX}/item/redstone.png",
    "DIA": f"{TEX}/item/diamond.png",
    "wooden_pickaxe": f"{TEX}/item/wooden_pickaxe.png",
    "fishing_rod": f"{TEX}/item/fishing_rod.png",
    "golden_sword": f"{TEX}/item/golden_sword.png",
    "tnt": f"{ICONS}/tnt.png",
    "compass": f"{TEX}/item/compass_00.png",
    "diamond_shovel": f"{TEX}/item/diamond_shovel.png",
}

_ = None
RECIPES = [
    {"num": 1, "name": "wooden-pickaxe", "output": "wooden_pickaxe",
     "grid": [["WPK","WPK","WPK"],[_,"STK",_],[_,"STK",_]]},
    {"num": 2, "name": "fishing-rod", "output": "fishing_rod",
     "grid": [[_,_,"STK"],[_,"STK","STR"],["IRN",_,"STR"]]},
    {"num": 3, "name": "gold-sword", "output": "golden_sword",
     "grid": [[_,"GLD",_],[_,"GLD",_],[_,"STK",_]]},
    {"num": 4, "name": "tnt", "output": "tnt",
     "grid": [["GNP","SND","GNP"],["SND","GNP","SND"],["GNP","SND","GNP"]]},
    {"num": 5, "name": "compass", "output": "compass",
     "grid": [[_,"IRN",_],["IRN","RED","IRN"],[_,"IRN",_]]},
    {"num": 6, "name": "diamond-shovel", "output": "diamond_shovel",
     "grid": [[_,"DIA",_],[_,"STK",_],[_,"STK",_]]},
]

_b64 = {}
def b64(path, scale_to=None):
    key = (path, scale_to)
    if key not in _b64:
        if scale_to:
            tmp = tempfile.NamedTemporaryFile(suffix=".png", delete=False); tmp.close()
            subprocess.run(["ffmpeg", "-y", "-i", path, "-vf",
                           f"scale={scale_to}:{scale_to}:flags=neighbor",
                           "-pix_fmt", "rgba", tmp.name], capture_output=True)
            with open(tmp.name, "rb") as f:
                _b64[key] = base64.b64encode(f.read()).decode()
            os.unlink(tmp.name)
        else:
            with open(path, "rb") as f:
                _b64[key] = base64.b64encode(f.read()).decode()
    return _b64[key]


def slot(x, y, sz, item=None):
    els = []
    b = 2
    els.append(f'<rect x="{x}" y="{y}" width="{sz}" height="{sz}" fill="#8b8b8b"/>')
    els.append(f'<rect x="{x}" y="{y}" width="{sz}" height="{b}" fill="#373737"/>')
    els.append(f'<rect x="{x}" y="{y}" width="{b}" height="{sz}" fill="#373737"/>')
    els.append(f'<rect x="{x}" y="{y+sz-b}" width="{sz}" height="{b}" fill="#ffffff"/>')
    els.append(f'<rect x="{x+sz-b}" y="{y}" width="{b}" height="{sz}" fill="#ffffff"/>')
    if item:
        pad = sz * 0.1
        img_sz = int(sz - 4 - pad * 2)
        els.append(f'<image href="data:image/png;base64,{b64(T[item], img_sz)}" '
                   f'x="{x+2+pad}" y="{y+2+pad}" width="{img_sz}" height="{img_sz}" '
                   f'image-rendering="pixelated"/>')
    return "\n".join(els)


def generate_card(recipe):
    W, H = 612, 396
    CELL = 80
    GAP = 4
    GRID_W = CELL * 3 + GAP * 2
    els = []

    els.append(f'<rect width="100%" height="100%" fill="#c6c6c6"/>')

    bdr, b, p = 16, 4, 4
    def prp(x0, y0, x1, y1, p):
        return (f"M{x0+p*2},{y0} L{x1-p*2},{y0} "
                f"L{x1-p*2},{y0+p} L{x1-p},{y0+p} L{x1-p},{y0+p*2} L{x1},{y0+p*2} "
                f"L{x1},{y1-p*2} "
                f"L{x1-p},{y1-p*2} L{x1-p},{y1-p} L{x1-p*2},{y1-p} L{x1-p*2},{y1} "
                f"L{x0+p*2},{y1} "
                f"L{x0+p*2},{y1-p} L{x0+p},{y1-p} L{x0+p},{y1-p*2} L{x0},{y1-p*2} "
                f"L{x0},{y0+p*2} "
                f"L{x0+p},{y0+p*2} L{x0+p},{y0+p} L{x0+p*2},{y0+p} Z")

    outer = prp(bdr, bdr, W-bdr, H-bdr, p)
    ix, iy = bdr+b, bdr+b
    inner = prp(ix, iy, W-bdr-b, H-bdr-b, p)
    iw, ih = W-bdr*2-b*2, H-bdr*2-b*2

    els.append(f'<path d="{outer}" fill="#000000"/>')
    els.append(f'<path d="{inner}" fill="#c6c6c6"/>')
    els.append(f'<defs><clipPath id="ic"><path d="{inner}"/></clipPath></defs>')
    els.append(f'<g clip-path="url(#ic)">')
    els.append(f'<rect x="{ix}" y="{iy}" width="{iw}" height="{b}" fill="#ffffff"/>')
    els.append(f'<rect x="{ix}" y="{iy}" width="{b}" height="{ih}" fill="#ffffff"/>')
    els.append(f'<rect x="{ix}" y="{iy+ih-b}" width="{iw}" height="{b}" fill="#555555"/>')
    els.append(f'<rect x="{ix+iw-b}" y="{iy}" width="{b}" height="{ih}" fill="#555555"/>')
    els.append(f'</g>')

    cy = (H - GRID_W) / 2
    gx = W * 0.15
    for row in range(3):
        for col in range(3):
            els.append(slot(gx + col*(CELL+GAP), cy + row*(CELL+GAP), CELL, recipe["grid"][row][col]))

    ax = gx + GRID_W + 30
    ay = H / 2
    els.append(f'<rect x="{ax}" y="{ay-8}" width="40" height="16" fill="#a0a0a0"/>')
    els.append(f'<polygon points="{ax+40},{ay-20} {ax+65},{ay} {ax+40},{ay+20}" fill="#a0a0a0"/>')
    els.append(f'<rect x="{ax}" y="{ay-8}" width="40" height="16" fill="none" stroke="#888" stroke-width="1.5"/>')
    els.append(f'<polygon points="{ax+40},{ay-20} {ax+65},{ay} {ax+40},{ay+20}" fill="none" stroke="#888" stroke-width="1.5"/>')

    ox = W * 0.72
    out_sz = CELL + 16
    els.append(slot(ox, H/2 - out_sz/2, out_sz, recipe["output"]))

    return (f'<?xml version="1.0" encoding="UTF-8"?>\n'
            f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
            f'width="{W}pt" height="{H}pt" viewBox="0 0 {W} {H}">\n'
            + "\n".join(els) + "\n</svg>")


svg_files = []
for r in RECIPES:
    svg = generate_card(r)
    path = os.path.join(SCRIPT_DIR, f"recipe-{r['num']}-{r['name']}.svg")
    with open(path, "w") as f:
        f.write(svg)
    svg_files.append(path)
    print(f"  ✓ Recipe #{r['num']}: {r['name']}")

pdf_path = os.path.join(SCRIPT_DIR, "recipe-cards-all.pdf")
subprocess.run(["rsvg-convert", "-f", "pdf", "-o", pdf_path] + svg_files,
               check=True, capture_output=True)
print(f"\nPDF: {pdf_path}")
