#!/usr/bin/env python3
"""Generate Explorer's Diary PDF with Minecraft oak plank background and Minecraftia font."""

import subprocess
import os
import base64

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT = os.path.dirname(SCRIPT_DIR)
TEX = os.path.join(PROJECT, "minecraft", "textures", "block", "oak_planks.png")
FONT = os.path.expanduser("~/Library/Fonts/Minecraftia-Regular.ttf")
OUT = os.path.join(SCRIPT_DIR, "explorers-diary.pdf")

# Encode the oak planks texture as base64 for embedding in SVG
with open(TEX, "rb") as f:
    planks_b64 = base64.b64encode(f.read()).decode()

with open(FONT, "rb") as f:
    font_b64 = base64.b64encode(f.read()).decode()

PAGES = [
    # Page 1
    [
        ("Explorer's Log", 36, True),
        ("", 16, False),
        ("Day 47", 20, True),
        ("", 8, False),
        ("We've been tracking strange energy", 16, False),
        ("readings across the forest biomes", 16, False),
        ("near Lake Fairfax for weeks now.", 16, False),
        ("Enderman sightings. Purple particles", 16, False),
        ("in the air at night. Something big", 16, False),
        ("is happening.", 16, False),
        ("", 16, False),
        ("Day 51", 20, True),
        ("", 8, False),
        ("Found it. The readings are off the", 16, False),
        ("charts. There is an Ender Dragon", 16, False),
        ("egg buried somewhere in this area.", 16, False),
        ("An actual egg. I don't know how it", 16, False),
        ("got here - maybe a portal opened,", 16, False),
        ("maybe it's been here for centuries.", 16, False),
        ("But it's real, and it's close.", 16, False),
    ],
    # Page 2
    [
        ("Day 52", 20, True),
        ("", 8, False),
        ("I've been exploring the biomes", 16, False),
        ("around the campsite. There's a", 16, False),
        ("forest thick with oak and birch.", 16, False),
        ("A stream that runs through the", 16, False),
        ("valley. I even found what looks", 16, False),
        ("like an old abandoned mine near", 16, False),
        ("the north end - boarded up, dark", 16, False),
        ("inside. I'm not going in there", 16, False),
        ("without a pickaxe.", 16, False),
        ("", 12, False),
        ("I've started gathering wood planks", 16, False),
        ("from fallen trees in the forest.", 16, False),
        ("I've hidden 4 of them nearby in", 16, False),
        ("case I need them later. Marked", 16, False),
        ("their locations on my map.", 16, False),
    ],
    # Page 3
    [
        ("Day 53", 20, True),
        ("", 8, False),
        ("Bad news. My compass broke crossing", 16, False),
        ("the stream and I lost most of my", 16, False),
        ("tools. I can't dig, I can't mine,", 16, False),
        ("I can't fish. I'll need to craft", 16, False),
        ("everything from scratch.", 16, False),
        ("", 12, False),
        ("Worse news - I spotted a Creeper", 16, False),
        ("on the trail this morning. A big", 16, False),
        ("one. It hasn't seen me yet, but", 16, False),
        ("I'm going to need a sword before", 16, False),
        ("I deal with that thing.", 16, False),
        ("", 12, False),
        ("Good news - I found an old crafting", 16, False),
        ("table in a storage tent. Still", 16, False),
        ("works. If I can find the right", 16, False),
        ("blocks, I can craft everything", 16, False),
        ("I need.", 16, False),
    ],
    # Page 4
    [
        ("Day 54 - FINAL ENTRY", 20, True),
        ("", 8, False),
        ("I can't do this alone. I'm leaving", 16, False),
        ("this diary, my map, and the", 16, False),
        ("crafting table for whoever finds", 16, False),
        ("them. The egg is out there.", 16, False),
        ("", 12, False),
        ("Here's what you need to know:", 16, False),
        ("", 10, False),
        ("* The MAP will reveal terrain as", 15, False),
        ("  you explore. I've marked where", 15, False),
        ("  I hid the wood planks.", 15, False),
        ("", 8, False),
        ("* Find 4 WOOD PLANKS and bring", 15, False),
        ("  them to the Villager at camp.", 15, False),
        ("", 8, False),
        ("* CRAFT tools, explore biomes,", 15, False),
        ("  collect blocks. Each craft", 15, False),
        ("  unlocks the next step.", 15, False),
        ("", 8, False),
        ("* Watch out for the CREEPER.", 15, False),
        ("", 8, False),
        ("* The egg is BURIED. You'll need", 15, False),
        ("  a compass and a shovel.", 15, False),
        ("", 16, False),
        ("Good luck, explorers.", 16, False),
        ("", 12, False),
        ("                        - S.", 16, False),
    ],
]

W, H = 396, 612  # 5.5" x 8.5" in points (half letter)
MARGIN = 36
svg_files = []

for i, lines in enumerate(PAGES):
    y = MARGIN + 10
    text_els = []
    for text, size, bold in lines:
        if text == "":
            y += size
            continue
        weight = "bold" if bold else "normal"
        # Escape XML entities
        text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        text_els.append(
            f'<text x="{MARGIN}" y="{y}" font-size="{size}" fill="#3b2a12" '
            f'font-weight="{weight}" font-family="Minecraftia, monospace" '
            f'style="filter: drop-shadow(1px 1px 0px rgba(0,0,0,0.15))">{text}</text>'
        )
        y += size + 6

    svg = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="{W}pt" height="{H}pt" viewBox="0 0 {W} {H}">
<defs>
  <style>
    @font-face {{
      font-family: 'Minecraftia';
      src: url('data:font/truetype;base64,{font_b64}') format('truetype');
    }}
  </style>
  <pattern id="planks" patternUnits="userSpaceOnUse" width="48" height="48">
    <image href="data:image/png;base64,{planks_b64}" width="48" height="48"
           image-rendering="pixelated"/>
  </pattern>
</defs>
<rect width="100%" height="100%" fill="url(#planks)" opacity="0.35"/>
<rect width="100%" height="100%" fill="rgba(210,180,140,0.45)"/>
{"".join(text_els)}
</svg>'''

    path = os.path.join(SCRIPT_DIR, f"diary-page{i+1}.svg")
    with open(path, "w") as f:
        f.write(svg)
    svg_files.append(path)

# Combine into PDF
subprocess.run(["rsvg-convert", "-f", "pdf", "-o", OUT] + svg_files,
               check=True, capture_output=True)

# Clean up SVGs
for p in svg_files:
    os.remove(p)

print(f"Done: {OUT}")
