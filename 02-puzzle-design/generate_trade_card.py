#!/usr/bin/env python3
"""Generate the villager trade card — 1 Emerald → 1 Bag.

Reuses the recipe-card styling (leather texture, pixel arrow, Minecraft
bitmap font) but with a single input slot → arrow → single output slot
instead of a 3x3 crafting grid.

Usage:
    python3 generate_trade_card.py
"""

import os
import subprocess

import generate_recipe_cards as rc

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT = os.path.dirname(SCRIPT_DIR)
TEX = os.path.join(PROJECT, "minecraft", "textures", "item")

# Register the two icons we need in the shared texture dict
rc.T["emerald"] = os.path.join(TEX, "emerald.png")
rc.T["bag"] = os.path.join(TEX, "bundle.png")


def generate_trade_card():
    # Same postcard size as the recipe cards (148x100mm landscape)
    W, H = 419.5, 283.5

    els = []

    # Background — tiled Minecraft texture (same as recipe cards)
    tex_data = rc.b64(rc.BG_TEXTURE)
    tile_size = 64
    if tex_data:
        els.append('<defs>')
        els.append(f'  <pattern id="bgTex" patternUnits="userSpaceOnUse" '
                   f'width="{tile_size}" height="{tile_size}">')
        els.append(f'    <image href="data:image/png;base64,{tex_data}" '
                   f'width="{tile_size}" height="{tile_size}" '
                   f'image-rendering="pixelated"/>')
        els.append('  </pattern>')
        els.append('</defs>')
        els.append('<rect width="100%" height="100%" fill="url(#bgTex)"/>')
    else:
        els.append(f'<rect width="100%" height="100%" fill="{rc.BG_COLOR}"/>')

    # Outer border (dark leather frame) + inner highlight
    bdr = 12
    b = 4
    els.append(f'<rect x="{bdr}" y="{bdr}" width="{W - bdr*2}" height="{H - bdr*2}" '
               f'fill="none" stroke="{rc.BORDER_DARK}" stroke-width="{b}"/>')
    els.append(f'<rect x="{bdr + b}" y="{bdr + b}" '
               f'width="{W - bdr*2 - b*2}" height="{H - bdr*2 - b*2}" '
               f'fill="none" stroke="{rc.BORDER_LIGHT}" stroke-width="2" opacity="0.5"/>')

    # Title
    title_y = 45
    els.append(rc.minecraft_title("Villager Trade", W / 2, title_y, size=22))

    # Layout: [emerald slot] -> arrow -> [bag slot], centered
    slot_sz = 96
    arrow_gap = 28
    arrow_w = 12 * 4   # arrow pixel width
    out_gap = 28
    total_w = slot_sz + arrow_gap + arrow_w + out_gap + slot_sz
    start_x = (W - total_w) / 2

    row_center_y = title_y + 20 + (H - title_y - 20 - bdr) / 2

    # Input slot — emerald
    in_x = start_x
    in_y = row_center_y - slot_sz / 2
    els.append(rc.slot_svg(in_x, in_y, slot_sz, "emerald"))

    # Arrow
    arrow_x = in_x + slot_sz + arrow_gap
    arrow_y = row_center_y - (9 * 4) / 2
    els.append(rc.pixel_arrow(arrow_x, arrow_y, scale=1))

    # Output slot — bag
    out_x = arrow_x + arrow_w + out_gap
    out_y = row_center_y - slot_sz / 2
    els.append(rc.slot_svg(out_x, out_y, slot_sz, "bag"))

    return (f'<?xml version="1.0" encoding="UTF-8"?>\n'
            f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
            f'width="{W}pt" height="{H}pt" viewBox="0 0 {W} {H}" shape-rendering="crispEdges">\n'
            + "\n".join(els) + "\n</svg>")


def main():
    print("Generating villager trade card...\n")

    svg = generate_trade_card()
    svg_path = os.path.join(SCRIPT_DIR, "trade-card-emerald.svg")
    with open(svg_path, "w") as f:
        f.write(svg)
    print(f"  SVG: {svg_path}")

    pdf_path = os.path.join(SCRIPT_DIR, "trade-card-emerald.pdf")
    try:
        subprocess.run(
            ["rsvg-convert", "-f", "pdf", "-o", pdf_path, svg_path],
            check=True, capture_output=True,
        )
        print(f"  PDF: {pdf_path}")
    except FileNotFoundError:
        print("\n  rsvg-convert not found. Install with: brew install librsvg")
    except subprocess.CalledProcessError as e:
        print(f"\n  PDF failed: {e.stderr.decode()}")

    print("\nDone!")


if __name__ == "__main__":
    main()
