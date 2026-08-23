#!/usr/bin/env python3
"""Generate TNT block stickers for printing — individual face stickers.

Generates 5 stickers (4 sides + 1 top) laid out on a page following
the same pattern as generate_block_stickers.py:
  - 180pt (2.5") per face
  - Black outline around each sticker
  - Gap between stickers
  - White page background

Usage:
    python3 generate_tnt_sticker.py
"""

import os
import subprocess

from PIL import Image

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
BLOCK_TEX_DIR = os.path.join(PROJECT_DIR, "minecraft", "textures", "block")

# Textures
TEX_SIDE = os.path.join(BLOCK_TEX_DIR, "tnt_side.png")
TEX_TOP = os.path.join(BLOCK_TEX_DIR, "tnt_top.png")

# Page layout (8.5x11" in points) — matches generate_block_stickers.py
PAGE_W = 612.0
PAGE_H = 792.0
MARGIN = 18.0
BLOCK_SIZE = 180.0  # 2.5" per face
GAP = 4.0

# Grid: 3 columns x 4 rows
COLS = 3
ROWS = 4


def read_png_pixels(path):
    """Read a PNG and return list of (col, row, r, g, b)."""
    img = Image.open(path).convert("RGBA")
    width, height = img.size
    pixels = []
    for row in range(height):
        for col in range(width):
            r, g, b, a = img.getpixel((col, row))
            if a > 0:
                pixels.append((col, row, r, g, b))
    return width, height, pixels


def render_face(pixels, tex_size):
    """Render a single face as SVG rects with a border (same as block stickers)."""
    px_pt = BLOCK_SIZE / tex_size
    lines = []
    for col, row, r, g, b in pixels:
        x = col * px_pt
        y = row * px_pt
        color = f"#{r:02X}{g:02X}{b:02X}"
        lines.append(
            f'<rect x="{x:.2f}" y="{y:.2f}" '
            f'width="{px_pt:.2f}" height="{px_pt:.2f}" fill="{color}"/>'
        )
    # Black border around the full sticker
    lines.append(
        f'<rect x="0" y="0" width="{BLOCK_SIZE:.2f}" height="{BLOCK_SIZE:.2f}" '
        f'fill="none" stroke="#333" stroke-width="0.5"/>'
    )
    return "\n".join(lines)


def generate_page_svg(stickers):
    """Generate a full SVG page with positioned stickers."""
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        f'<svg xmlns="http://www.w3.org/2000/svg" width="8.5in" height="11in" '
        f'viewBox="0 0 {PAGE_W} {PAGE_H}">',
        '<rect width="100%" height="100%" fill="white"/>',
    ]

    for i, (sticker_svg, label) in enumerate(stickers):
        col = i % COLS
        row = i // COLS
        tx = MARGIN + col * (BLOCK_SIZE + GAP)
        ty = MARGIN + row * (BLOCK_SIZE + GAP)
        lines.append(f'<g transform="translate({tx},{ty})">')
        lines.append(sticker_svg)
        lines.append('</g>')
        # Label below sticker
        lx = tx + BLOCK_SIZE / 2
        ly = ty + BLOCK_SIZE + 10
        lines.append(
            f'<text x="{lx:.1f}" y="{ly:.1f}" '
            f'font-family="monospace" font-size="8" fill="#666" '
            f'text-anchor="middle">{label}</text>'
        )

    lines.append('</svg>')
    return "\n".join(lines)


def main():
    print("Generating TNT block stickers...\n")

    if not os.path.exists(TEX_SIDE):
        print(f"  ERROR: {TEX_SIDE} not found")
        return
    if not os.path.exists(TEX_TOP):
        print(f"  ERROR: {TEX_TOP} not found")
        return

    sw, sh, side_pixels = read_png_pixels(TEX_SIDE)
    tw, th, top_pixels = read_png_pixels(TEX_TOP)
    print(f"  Side: {sw}x{sh}, {len(side_pixels)} pixels")
    print(f"  Top:  {tw}x{th}, {len(top_pixels)} pixels")

    side_svg = render_face(side_pixels, max(sw, sh))
    top_svg = render_face(top_pixels, max(tw, th))

    # 4 sides + 1 top = 5 stickers
    stickers = [
        (side_svg, "TNT Side"),
        (side_svg, "TNT Side"),
        (side_svg, "TNT Side"),
        (side_svg, "TNT Side"),
        (top_svg, "TNT Top"),
    ]

    svg = generate_page_svg(stickers)
    svg_path = os.path.join(SCRIPT_DIR, "sticker-tnt.svg")
    with open(svg_path, "w") as f:
        f.write(svg)
    print(f"  SVG: {svg_path}")

    # Convert to PDF
    pdf_path = os.path.join(SCRIPT_DIR, "sticker-tnt.pdf")
    try:
        subprocess.run(
            ["rsvg-convert", "-f", "pdf", "-o", pdf_path, svg_path],
            check=True, capture_output=True,
        )
        print(f"  PDF: {pdf_path}")
    except FileNotFoundError:
        print("\n  rsvg-convert not found. Install with: brew install librsvg")
    except subprocess.CalledProcessError as e:
        print(f"\n  PDF conversion failed: {e.stderr.decode()}")

    print("\nDone!")


if __name__ == "__main__":
    main()
