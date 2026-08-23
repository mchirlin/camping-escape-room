#!/usr/bin/env python3
"""Generate a PDF of block stickers for the Minecraft escape room.

Reads 16×16 block textures and tiles them as pixel-art squares on 8.5×11" pages.
Each block is rendered at 180pt (2.5") with a thin border.

Usage:
    python3 generate_block_stickers.py
"""

import os
import subprocess

from PIL import Image

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
BLOCK_TEX_DIR = os.path.join(PROJECT_DIR, "minecraft", "textures", "block")
ICONS_DIR = os.path.join(PROJECT_DIR, "02-puzzle-design", "block-icons")

# Page layout (8.5×11" in points)
PAGE_W = 612.0
PAGE_H = 792.0
MARGIN = 18.0
BLOCK_SIZE = 180.0  # 16px × 11.25pt/px
GAP = 4.0
PIXEL_PT = 11.25   # size of each minecraft pixel in points

# Grid: 3 columns × 4 rows = 12 per page
COLS = 3
ROWS = 4
PER_PAGE = COLS * ROWS

# --- Blocks to generate ---
# (count, display_name, texture_path)
BLOCKS = [
    (1, "oak_planks", os.path.join(BLOCK_TEX_DIR, "oak_planks.png")),
    (3, "cobblestone", os.path.join(BLOCK_TEX_DIR, "cobblestone.png")),
    (8, "sand", os.path.join(BLOCK_TEX_DIR, "sand.png")),
]


def read_png_pixels(path):
    """Read a PNG file and return (width, height, [(col, row, r, g, b), ...])."""
    img = Image.open(path).convert("RGBA")
    width, height = img.size
    pixels = []
    for row in range(height):
        for col in range(width):
            r, g, b, a = img.getpixel((col, row))
            if a > 0:
                pixels.append((col, row, r, g, b))
    return width, height, pixels


def render_block(pixels, tex_size):
    """Render a single block as SVG rect elements (relative coords).

    Scales pixel size so the full texture fits within BLOCK_SIZE.
    """
    px_pt = BLOCK_SIZE / tex_size
    lines = []
    for col, row, r, g, b in pixels:
        x = col * px_pt
        y = row * px_pt
        color = f"#{r:02X}{g:02X}{b:02X}"
        lines.append(
            f'<rect x="{x:.2f}" y="{y:.2f}" '
            f'width="{px_pt}" height="{px_pt}" fill="{color}"/>'
        )
    # Border around the full block
    lines.append(
        f'<rect x="0" y="0" width="{BLOCK_SIZE:.2f}" height="{BLOCK_SIZE:.2f}" '
        f'fill="none" stroke="#333" stroke-width="0.5"/>'
    )
    return "\n".join(lines)


def generate_page_svg(blocks_on_page):
    """Generate a full SVG page with positioned blocks."""
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        f'<svg xmlns="http://www.w3.org/2000/svg" width="8.5in" height="11in" '
        f'viewBox="0 0 {PAGE_W} {PAGE_H}">',
        '<rect width="100%" height="100%" fill="white"/>',
    ]

    for i, block_svg in enumerate(blocks_on_page):
        col = i % COLS
        row = i // COLS
        tx = MARGIN + col * (BLOCK_SIZE + GAP)
        ty = MARGIN + row * (BLOCK_SIZE + GAP)
        lines.append(f'<g transform="translate({tx},{ty})">')
        lines.append(block_svg)
        lines.append('</g>')

    lines.append('</svg>')
    return "\n".join(lines)


def main():
    # Build the flat list of block SVG snippets
    all_blocks = []
    for count, name, tex_path in BLOCKS:
        if not os.path.exists(tex_path):
            print(f"  ERROR: texture not found: {tex_path}")
            return
        w, h, pixels = read_png_pixels(tex_path)
        tex_size = max(w, h)
        print(f"  {name}: {w}×{h} texture, {len(pixels)} pixels — ×{count}")
        block_svg = render_block(pixels, tex_size)
        for _ in range(count):
            all_blocks.append(block_svg)

    total = len(all_blocks)
    print(f"\n  Total stickers: {total}")

    # Split into pages
    svg_files = []
    page_num = 0
    for i in range(0, total, PER_PAGE):
        page_num += 1
        page_blocks = all_blocks[i:i + PER_PAGE]
        svg = generate_page_svg(page_blocks)
        svg_path = os.path.join(SCRIPT_DIR, f"sticker-blocks-mixed-p{page_num}.svg")
        with open(svg_path, "w") as f:
            f.write(svg)
        svg_files.append(svg_path)
        print(f"  Wrote {os.path.basename(svg_path)} ({len(page_blocks)} blocks)")

    # Convert to PDF
    pdf_path = os.path.join(SCRIPT_DIR, "sticker-blocks-mixed.pdf")
    try:
        subprocess.run(
            ["rsvg-convert", "-f", "pdf", "-o", pdf_path] + svg_files,
            check=True, capture_output=True,
        )
        print(f"\n  PDF: {pdf_path}")
    except FileNotFoundError:
        print("\n  rsvg-convert not found. Install with: brew install librsvg")
    except subprocess.CalledProcessError as e:
        print(f"\n  PDF conversion failed: {e.stderr.decode()}")


if __name__ == "__main__":
    main()
