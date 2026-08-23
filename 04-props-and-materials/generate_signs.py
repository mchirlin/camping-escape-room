#!/usr/bin/env python3
"""Generate Minecraft-style signs for the escape room.

Each sign has:
  - Oak plank texture background (tiled pixel art)
  - Line 1: Location name (large, centered)
  - Line 2: Requirement in italics (smaller, centered)
  - Rendered using the Minecraft bitmap font (ascii.png)
  - Output: 8"×4" landscape SVG + PDF

Usage:
    python3 generate_signs.py
"""

import os
import subprocess

from PIL import Image

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
BLOCK_TEX_DIR = os.path.join(PROJECT_DIR, "minecraft", "textures", "block")
FONT_ATLAS = os.path.join(PROJECT_DIR, "minecraft", "textures", "font", "ascii.png")
OAK_PLANKS = os.path.join(BLOCK_TEX_DIR, "oak_planks.png")

# Sign dimensions (8"×4" at 72dpi)
SIGN_W = 576
SIGN_H = 288

# Background tile size (each 16px texture pixel = this many SVG units)
BG_PIXEL = 24.0  # 576 / 24 = 24 tiles across, 288 / 24 = 12 tiles down... actually 16px texture

# Font pixel size for text (max — will be auto-scaled down to fit)
FONT_PX_LINE1 = 5.0   # Title
FONT_PX_LINE2 = 4.0   # Requirement (italic)
SIGN_PADDING = 40.0    # Horizontal padding on each side

# Text color
TEXT_COLOR = "#1A1A1A"

# Signs to generate
SIGNS = [
    {
        "filename": "sign-explorer-tent",
        "line1": "Explorer Tent",
        "line2": "4 Oak Planks Required",
    },
    {
        "filename": "sign-abandoned-mine",
        "line1": "Abandoned Mine",
        "line2": "Cobblestone Pickaxe Required",
    },
    {
        "filename": "sign-ancient-quarry",
        "line1": "Ancient Quarry",
        "line2": "Diamond Pickaxe Required",
    },
    {
        "filename": "sign-dark-cave",
        "line1": "Dark Cave",
        "line2": "Torch Required",
    },
    {
        "filename": "sign-creeper-lair",
        "line1": "Creeper Lair",
        "line2": "Iron Sword Required",
    },
    {
        "filename": "sign-treasure-chest",
        "line1": "Treasure Chest",
        "line2": "TNT Required",
    },
]


# --- Minecraft bitmap font loader ---
_glyphs = None


def load_font():
    """Load the Minecraft bitmap font atlas (128x128, 16x16 grid of 8x8 glyphs)."""
    global _glyphs
    if _glyphs is not None:
        return _glyphs

    img = Image.open(FONT_ATLAS).convert("RGBA")
    glyphs = {}
    for code in range(256):
        col = code % 16
        row = code // 16
        gx = col * 8
        gy = row * 8
        pixels = []
        max_col = 0
        for py in range(8):
            for px in range(8):
                r, g, b, a = img.getpixel((gx + px, gy + py))
                if a > 0:
                    pixels.append((px, py))
                    max_col = max(max_col, px)
        width = max_col + 2 if pixels else 4
        glyphs[code] = {"pixels": pixels, "width": width}
    _glyphs = glyphs
    return glyphs


def get_text_width(text, pixel_size):
    """Calculate the total rendered width of text at a given pixel size."""
    glyphs = load_font()
    spacing = 1
    total_width = 0
    for ch in text:
        code = ord(ch) if ord(ch) < 256 else ord('?')
        total_width += glyphs[code]["width"] + spacing
    total_width -= spacing
    return total_width * pixel_size


def fit_pixel_size(text, max_width, desired_size):
    """Return a pixel size that fits text within max_width, capped at desired_size."""
    width_at_desired = get_text_width(text, desired_size)
    if width_at_desired <= max_width:
        return desired_size
    # Scale down proportionally
    return desired_size * (max_width / width_at_desired)


def render_text(text, center_x, center_y, pixel_size, color=TEXT_COLOR, italic=False):
    """Render text as SVG rects using the Minecraft bitmap font.
    
    If italic=True, applies a 1px shear per row (top rows shift right).
    """
    glyphs = load_font()
    spacing = 1  # 1 font-pixel gap between chars

    # Calculate total width
    total_width = 0
    for ch in text:
        code = ord(ch) if ord(ch) < 256 else ord('?')
        total_width += glyphs[code]["width"] + spacing
    total_width -= spacing
    total_width_px = total_width * pixel_size

    start_x = center_x - total_width_px / 2
    start_y = center_y - (8 * pixel_size) / 2

    els = []
    cursor_x = 0

    for ch in text:
        code = ord(ch) if ord(ch) < 256 else ord('?')
        glyph = glyphs[code]

        for (px, py) in glyph["pixels"]:
            rx = start_x + (cursor_x + px) * pixel_size
            ry = start_y + py * pixel_size
            # Italic: shift x based on row (top rows shift more right)
            if italic:
                rx += (7 - py) * pixel_size * 0.2
            els.append(
                f'<rect x="{rx:.1f}" y="{ry:.1f}" '
                f'width="{pixel_size:.1f}" height="{pixel_size:.1f}" '
                f'fill="{color}"/>'
            )

        cursor_x += glyph["width"] + spacing

    return "\n".join(els)


def generate_background():
    """Generate the oak plank texture background as SVG rects."""
    img = Image.open(OAK_PLANKS).convert("RGBA")
    tex_w, tex_h = img.size  # 16x16

    # Tile size in SVG units
    tile_px = SIGN_W / tex_w  # 576/16 = 36... but original uses 24
    # Match original: 24 tiles across (each minecraft pixel = 24pt-ish)
    # Original sign is 576 wide with 24.5pt pixels... let's match that
    # 576 / 24.5 ≈ 23.5 pixels across — they used 16 wide with overlap
    # Looking at the original: 16 columns × 24pt = 384... but sign is 576
    # Actually the original tiles the texture at 24pt per pixel, 24 cols × 12 rows
    # Let's just match: 24 columns across, 12 rows down
    cols = 24
    rows = 12
    px_w = SIGN_W / cols
    px_h = SIGN_H / rows

    els = []
    for row in range(rows):
        for col in range(cols):
            # Map to texture pixel (wrap)
            tx = col % tex_w
            ty = row % tex_h
            r, g, b, a = img.getpixel((tx, ty))
            if a > 0:
                x = col * px_w
                y = row * px_h
                color = f"#{r:02X}{g:02X}{b:02X}"
                els.append(
                    f'<rect x="{x}" y="{y}" width="{px_w + 0.5}" '
                    f'height="{px_h + 0.5}" fill="{color}"/>'
                )
    return "\n".join(els)


def generate_sign(sign):
    """Generate a single sign SVG (rotated 90° for portrait printing)."""
    bg = generate_background()

    max_text_w = SIGN_W - 2 * SIGN_PADDING
    px1 = fit_pixel_size(sign["line1"], max_text_w, FONT_PX_LINE1)
    px2 = fit_pixel_size(sign["line2"], max_text_w, FONT_PX_LINE2)

    # Position lines vertically (in the original landscape orientation)
    line1_y = SIGN_H * 0.33
    line2_y = SIGN_H * 0.70

    line1_svg = render_text(sign["line1"], SIGN_W / 2, line1_y, px1)
    line2_svg = render_text(sign["line2"], SIGN_W / 2, line2_y, px2, italic=True)

    # Rotate 90° CW: the sign becomes 288 wide × 576 tall (4"×8" portrait)
    svg = f"""<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="4in" height="8in" viewBox="0 0 {SIGN_H} {SIGN_W}" shape-rendering="crispEdges">
<g transform="translate({SIGN_H}, 0) rotate(90)">
{bg}
{line1_svg}
{line2_svg}
</g>
</svg>"""

    return svg


def main():
    print("Generating Minecraft signs...\n")

    if not os.path.exists(FONT_ATLAS):
        print(f"  ERROR: font atlas not found: {FONT_ATLAS}")
        return
    if not os.path.exists(OAK_PLANKS):
        print(f"  ERROR: oak planks texture not found: {OAK_PLANKS}")
        return

    svg_files = []
    for sign in SIGNS:
        svg = generate_sign(sign)
        svg_path = os.path.join(SCRIPT_DIR, f"{sign['filename']}.svg")
        with open(svg_path, "w") as f:
            f.write(svg)
        svg_files.append(svg_path)
        print(f"  ✓ {sign['filename']}: \"{sign['line1']}\" / \"{sign['line2']}\"")

    # Generate individual PDFs
    for svg_path in svg_files:
        pdf_path = svg_path.replace(".svg", ".pdf")
        try:
            subprocess.run(
                ["rsvg-convert", "-f", "pdf", "-o", pdf_path, svg_path],
                check=True, capture_output=True,
            )
        except (FileNotFoundError, subprocess.CalledProcessError):
            pass

    # Combined PDF
    pdf_all = os.path.join(SCRIPT_DIR, "signs-all.pdf")
    try:
        subprocess.run(
            ["rsvg-convert", "-f", "pdf", "-o", pdf_all] + svg_files,
            check=True, capture_output=True,
        )
        print(f"\n  Combined PDF: {pdf_all}")
    except FileNotFoundError:
        print("\n  rsvg-convert not found. Install with: brew install librsvg")
    except subprocess.CalledProcessError as e:
        print(f"\n  PDF failed: {e.stderr.decode()}")

    print("\nDone!")


if __name__ == "__main__":
    main()
