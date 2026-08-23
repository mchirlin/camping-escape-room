#!/usr/bin/env python3
"""Generate Minecraft recipe cards — leather book style with pixel font title.

Style:
  - Parchment/leather brown palette (no grays)
  - No gaps between grid squares (borders touch directly)
  - Pixelated solid gray arrow
  - Minecraft-style pixel font title at top
  - Generates individual SVGs + a combined PDF for printing
"""

import base64
import os
import re
import subprocess
import tempfile

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT = os.path.dirname(SCRIPT_DIR)
TEX = os.path.join(PROJECT, "minecraft", "textures")
ICONS = os.path.join(SCRIPT_DIR, "block-icons")
FONT_PATH = os.path.join(SCRIPT_DIR, "Minecraft-Regular.otf")
MC_FONT_ATLAS = os.path.join(PROJECT, "minecraft", "textures", "font", "ascii.png")

# Texture paths for grid items
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
    "COB": f"{ICONS}/cobblestone.png" if os.path.exists(f"{ICONS}/cobblestone.png") else f"{TEX}/block/cobblestone.png",
    "COL": f"{TEX}/item/coal.png",
    "COP": f"{TEX}/item/copper_ingot.png",
    "AME": f"{TEX}/item/amethyst_shard.png",
    "PAP": f"{TEX}/item/paper.png",
    "CMP": f"{TEX}/item/compass_00.png",
    # Output items
    "crafting_table": f"{ICONS}/crafting_table.png",
    "compass": f"{TEX}/item/compass_00.png",
    "stone_pickaxe": f"{TEX}/item/stone_pickaxe.png",
    "map": f"{TEX}/item/filled_map.png",
    "fishing_rod": f"{TEX}/item/fishing_rod.png",
    "diamond_pickaxe": f"{TEX}/item/diamond_pickaxe.png",
    "torch": f"{TEX}/block/torch.png" if os.path.exists(f"{TEX}/block/torch.png") else f"{TEX}/item/torch.png",
    "iron_sword": f"{TEX}/item/iron_sword.png",
    "spyglass": f"{TEX}/item/spyglass.png",
    "tnt": f"{ICONS}/tnt.png",
}

_ = None

# Recipes in storyline order
RECIPES = [
    {"num": 1, "name": "crafting-table", "title": "Crafting Table", "output": "crafting_table",
     "grid": [["WPK", "WPK", _], ["WPK", "WPK", _], [_, _, _]]},
    {"num": 2, "name": "compass", "title": "Compass", "output": "compass",
     "grid": [[_, "IRN", _], ["IRN", "RED", "IRN"], [_, "IRN", _]]},
    {"num": 3, "name": "stone-pickaxe", "title": "Stone Pickaxe", "output": "stone_pickaxe",
     "grid": [["COB", "COB", "COB"], [_, "STK", _], [_, "STK", _]]},
    {"num": 4, "name": "map", "title": "Map", "output": "map",
     "grid": [["PAP", "PAP", "PAP"], ["PAP", "CMP", "PAP"], ["PAP", "PAP", "PAP"]]},
    {"num": 5, "name": "fishing-rod", "title": "Fishing Rod", "output": "fishing_rod",
     "grid": [[_, _, "STK"], [_, "STK", "STR"], ["STK", _, "STR"]]},
    {"num": 6, "name": "diamond-pickaxe", "title": "Diamond Pickaxe", "output": "diamond_pickaxe",
     "grid": [["DIA", "DIA", "DIA"], [_, "STK", _], [_, "STK", _]]},
    {"num": 7, "name": "torch", "title": "Torch", "output": "torch",
     "grid": [[_, "COL", _], [_, "STK", _], [_, _, _]]},
    {"num": 8, "name": "iron-sword", "title": "Iron Sword", "output": "iron_sword",
     "grid": [[_, "IRN", _], [_, "IRN", _], [_, "STK", _]]},
    {"num": 9, "name": "spyglass", "title": "Spyglass", "output": "spyglass",
     "grid": [[_, "AME", _], [_, "COP", _], [_, "COP", _]]},
    {"num": 10, "name": "tnt", "title": "TNT", "output": "tnt",
     "grid": [["GNP", "SND", "GNP"], ["SND", "GNP", "SND"], ["GNP", "SND", "GNP"]]},
]

# --- Color palette (leather book theme) ---
BG_COLOR = "#D4A96A"         # Parchment/leather tan (fallback)
BG_TEXTURE = os.path.join(PROJECT, "minecraft", "textures", "block", "orange_terracotta.png")
BORDER_DARK = "#4A2E0A"     # Dark leather brown
BORDER_LIGHT = "#E8C992"    # Highlight edge
SLOT_BG = "#6B4226"         # Slot fill — dark brown
SLOT_DARK = "#3A1F0A"       # Slot top/left border (shadow)
SLOT_LIGHT = "#9C6B3A"      # Slot bottom/right border (highlight)
ARROW_COLOR = "#6B4226"     # Same as slot background brown
TITLE_COLOR = "#D4A96A"     # Light brown for title text
TITLE_SHADOW = "#3A1F0A"    # Dark brown shadow


# --- Base64 texture helpers ---
_b64 = {}


def b64(path, scale_to=None):
    key = (path, scale_to)
    if key not in _b64:
        if not os.path.exists(path):
            print(f"  WARNING: missing texture {path}")
            _b64[key] = ""
            return ""
        if scale_to:
            tmp = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
            tmp.close()
            subprocess.run(
                ["ffmpeg", "-y", "-i", path, "-vf",
                 f"scale={scale_to}:{scale_to}:flags=neighbor",
                 "-pix_fmt", "rgba", tmp.name],
                capture_output=True)
            with open(tmp.name, "rb") as f:
                _b64[key] = base64.b64encode(f.read()).decode()
            os.unlink(tmp.name)
        else:
            with open(path, "rb") as f:
                _b64[key] = base64.b64encode(f.read()).decode()
    return _b64[key]


def slot_svg(x, y, sz, item=None):
    """Generate a single crafting grid slot with beveled 3D border (no gaps)."""
    els = []
    b = 3  # border width

    # Main slot fill
    els.append(f'<rect x="{x}" y="{y}" width="{sz}" height="{sz}" fill="{SLOT_BG}"/>')
    # Top & left border (dark — shadow/inset)
    els.append(f'<rect x="{x}" y="{y}" width="{sz}" height="{b}" fill="{SLOT_DARK}"/>')
    els.append(f'<rect x="{x}" y="{y}" width="{b}" height="{sz}" fill="{SLOT_DARK}"/>')
    # Bottom & right border (light — highlight)
    els.append(f'<rect x="{x}" y="{y + sz - b}" width="{sz}" height="{b}" fill="{SLOT_LIGHT}"/>')
    els.append(f'<rect x="{x + sz - b}" y="{y}" width="{b}" height="{sz}" fill="{SLOT_LIGHT}"/>')

    # Item texture
    if item and item in T:
        pad = sz * 0.12
        img_sz = int(sz - b * 2 - pad * 2)
        data = b64(T[item], img_sz)
        if data:
            els.append(
                f'<image href="data:image/png;base64,{data}" '
                f'x="{x + b + pad}" y="{y + b + pad}" '
                f'width="{img_sz}" height="{img_sz}" '
                f'image-rendering="pixelated"/>')
    return "\n".join(els)


def pixel_arrow(x, y, scale=1):
    """Generate a pixelated arrow pointing right, matching Minecraft crafting UI style."""
    s = 4 * scale  # pixel size
    els = []
    # Arrow on a 12x9 grid (3px shaft, stepped triangular head)
    # Row 0:                      X
    # Row 1:                     XX
    # Row 2:                    XXX
    # Row 3:  XXXXXXX          XXXX
    # Row 4:  XXXXXXXX        XXXXX
    # Row 5:  XXXXXXX          XXXX
    # Row 6:                    XXX
    # Row 7:                     XX
    # Row 8:                      X
    arrow_pixels = [
        # Shaft (rows 3-5, cols 0-6) — 3 pixels tall
        *[(c, 3) for c in range(7)],
        *[(c, 4) for c in range(7)],
        *[(c, 5) for c in range(7)],
        # Head
        (7, 0),
        (7, 1), (8, 1),
        (7, 2), (8, 2), (9, 2),
        (7, 3), (8, 3), (9, 3), (10, 3),
        (7, 4), (8, 4), (9, 4), (10, 4), (11, 4),
        (7, 5), (8, 5), (9, 5), (10, 5),
        (7, 6), (8, 6), (9, 6),
        (7, 7), (8, 7),
        (7, 8),
    ]

    for (px, py) in arrow_pixels:
        els.append(f'<rect x="{x + px * s}" y="{y + py * s}" '
                   f'width="{s}" height="{s}" fill="{ARROW_COLOR}"/>')
    return "\n".join(els)


def load_mc_font():
    """Load the Minecraft bitmap font atlas and extract glyph pixel data."""
    from PIL import Image
    img = Image.open(MC_FONT_ATLAS).convert("RGBA")
    # 128x128 image, 16x16 grid of 8x8 glyphs
    glyphs = {}
    for code in range(256):
        col = code % 16
        row = code // 16
        glyph_x = col * 8
        glyph_y = row * 8
        pixels = []
        # Find the actual width of this glyph (trim trailing empty columns)
        max_col = 0
        for py in range(8):
            for px in range(8):
                r, g, b, a = img.getpixel((glyph_x + px, glyph_y + py))
                if a > 0:
                    pixels.append((px, py))
                    max_col = max(max_col, px)
        # Width is the rightmost pixel + 1, minimum 2 for space
        width = max_col + 2 if pixels else 4
        glyphs[code] = {"pixels": pixels, "width": width}
    return glyphs


_mc_glyphs = None


def get_mc_glyphs():
    global _mc_glyphs
    if _mc_glyphs is None:
        _mc_glyphs = load_mc_font()
    return _mc_glyphs


def minecraft_title(text, x, y, size=28, color=None, shadow_color=None):
    """Render title text as pixel rectangles from the Minecraft bitmap font atlas.
    
    Renders each character pixel-by-pixel, scaled to `size` height (8 pixels tall
    in the font, so pixel_size = size / 8).
    """
    if color is None:
        color = TITLE_COLOR
    if shadow_color is None:
        shadow_color = TITLE_SHADOW

    glyphs = get_mc_glyphs()
    pixel_size = size / 8.0
    spacing = 1  # 1 font-pixel gap between characters

    # Calculate total width to center
    total_width = 0
    for ch in text:
        code = ord(ch)
        if code < 256:
            total_width += glyphs[code]["width"] + spacing
    total_width -= spacing  # No trailing space
    total_width_px = total_width * pixel_size

    # Start position (centered at x)
    start_x = x - total_width_px / 2
    # y is center — offset to top
    start_y = y - (8 * pixel_size) / 2

    els = []
    cursor_x = 0  # in font pixels

    for ch in text:
        code = ord(ch)
        if code >= 256:
            code = ord('?')
        glyph = glyphs[code]

        for (px, py) in glyph["pixels"]:
            # Shadow pixel (offset +1, +1 in font pixels)
            sx = start_x + (cursor_x + px + 1) * pixel_size
            sy = start_y + (py + 1) * pixel_size
            els.append(f'<rect x="{sx:.1f}" y="{sy:.1f}" '
                       f'width="{pixel_size:.1f}" height="{pixel_size:.1f}" '
                       f'fill="{shadow_color}"/>')

        for (px, py) in glyph["pixels"]:
            # Main pixel
            rx = start_x + (cursor_x + px) * pixel_size
            ry = start_y + py * pixel_size
            els.append(f'<rect x="{rx:.1f}" y="{ry:.1f}" '
                       f'width="{pixel_size:.1f}" height="{pixel_size:.1f}" '
                       f'fill="{color}"/>')

        cursor_x += glyph["width"] + spacing

    return "\n".join(els)


def generate_card(recipe):
    """Generate a single recipe card SVG."""
    W, H = 612, 396
    CELL = 72
    GRID_W = CELL * 3  # No gaps!
    GRID_H = CELL * 3

    els = []

    # Background — tiled Minecraft texture (scaled up pixelated)
    # The texture is 16x16 pixels, we tile it across the card at a larger scale
    tex_data = b64(BG_TEXTURE)
    tile_size = 64  # Each 16px texture tile rendered at 64px
    if tex_data:
        # Define pattern for tiling
        els.append(f'<defs>')
        els.append(f'  <pattern id="bgTex" patternUnits="userSpaceOnUse" '
                   f'width="{tile_size}" height="{tile_size}">')
        els.append(f'    <image href="data:image/png;base64,{tex_data}" '
                   f'width="{tile_size}" height="{tile_size}" '
                   f'image-rendering="pixelated"/>')
        els.append(f'  </pattern>')
        els.append(f'</defs>')
        els.append(f'<rect width="100%" height="100%" fill="url(#bgTex)"/>')
    else:
        els.append(f'<rect width="100%" height="100%" fill="{BG_COLOR}"/>')

    # Outer border (dark leather frame)
    bdr = 12
    b = 4
    els.append(f'<rect x="{bdr}" y="{bdr}" width="{W - bdr*2}" height="{H - bdr*2}" '
               f'fill="none" stroke="{BORDER_DARK}" stroke-width="{b}"/>')
    # Inner highlight
    els.append(f'<rect x="{bdr + b}" y="{bdr + b}" '
               f'width="{W - bdr*2 - b*2}" height="{H - bdr*2 - b*2}" '
               f'fill="none" stroke="{BORDER_LIGHT}" stroke-width="2" opacity="0.5"/>')

    # Title at top
    title_y = 55
    els.append(minecraft_title(recipe["title"], W / 2, title_y, size=26))

    # Grid — centered vertically below title, horizontally centered with arrow + output
    grid_top = title_y + 15
    grid_y = grid_top + (H - grid_top - bdr - GRID_H) / 2

    # Calculate total assembly width to center everything
    arrow_gap = 30       # gap between grid and arrow
    arrow_w = 12 * 4     # arrow pixel width (12 cols * 4px)
    out_gap = 20         # gap between arrow and output slot
    out_sz = CELL + 20   # output slot size
    total_w = GRID_W + arrow_gap + arrow_w + out_gap + out_sz
    grid_x = (W - total_w) / 2

    for row in range(3):
        for col in range(3):
            cell_x = grid_x + col * CELL
            cell_y = grid_y + row * CELL
            item = recipe["grid"][row][col]
            els.append(slot_svg(cell_x, cell_y, CELL, item))

    # Pixelated arrow — positioned right of grid
    arrow_x = grid_x + GRID_W + arrow_gap
    arrow_y = grid_y + GRID_H / 2 - (9 * 4) / 2  # Center vertically (9 rows * 4px)
    els.append(pixel_arrow(arrow_x, arrow_y, scale=1))

    # Output slot — right of arrow
    out_x = arrow_x + arrow_w + out_gap
    out_y = grid_y + GRID_H / 2 - out_sz / 2
    els.append(slot_svg(out_x, out_y, out_sz, recipe["output"]))

    # No font embedding needed — text is rendered as pixel rectangles
    font_css = ""

    return (f'<?xml version="1.0" encoding="UTF-8"?>\n'
            f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
            f'width="{W}pt" height="{H}pt" viewBox="0 0 {W} {H}" shape-rendering="crispEdges">\n'
            + "\n".join(els) + "\n</svg>")


# --- Main ---
if __name__ == "__main__":
    print("Generating recipe cards (leather book style)...\n")

    svg_files = []
    for r in RECIPES:
        svg = generate_card(r)
        path = os.path.join(SCRIPT_DIR, f"recipe-{r['num']}-{r['name']}.svg")
        with open(path, "w") as f:
            f.write(svg)
        svg_files.append(path)
        print(f"  ✓ Recipe #{r['num']}: {r['title']}")

    # Generate individual-card PDF (one per page)
    pdf_path = os.path.join(SCRIPT_DIR, "recipe-cards-all.pdf")
    try:
        subprocess.run(
            ["rsvg-convert", "-f", "pdf", "-o", pdf_path] + svg_files,
            check=True, capture_output=True)
        print(f"\n  PDF (1-up): {pdf_path}")
    except FileNotFoundError:
        print("\n  ⚠ rsvg-convert not found — install librsvg to generate PDF")
        print("    brew install librsvg")
    except subprocess.CalledProcessError as e:
        print(f"\n  ⚠ PDF generation failed: {e.stderr.decode()}")

    # Generate 2-up PDF (two cards per US letter page, 612x792pt)
    PAGE_W, PAGE_H = 612, 792
    CARD_H = 396
    pairs = []
    for i in range(0, len(svg_files), 2):
        pair = svg_files[i:i+2]
        pairs.append(pair)

    two_up_svgs = []
    for pi, pair in enumerate(pairs):
        # Create a combined SVG with two cards stacked
        page_els = []
        page_els.append(f'<?xml version="1.0" encoding="UTF-8"?>')
        page_els.append(f'<svg xmlns="http://www.w3.org/2000/svg" '
                        f'xmlns:xlink="http://www.w3.org/1999/xlink" '
                        f'width="{PAGE_W}pt" height="{PAGE_H}pt" '
                        f'viewBox="0 0 {PAGE_W} {PAGE_H}">')
        page_els.append(f'<rect width="100%" height="100%" fill="#FFFFFF"/>')

        for ci, svg_path in enumerate(pair):
            with open(svg_path, "r") as f:
                content = f.read()
            # Extract inner SVG content (skip the xml declaration and svg open/close tags)
            inner = re.search(r'<svg[^>]*>(.*)</svg>', content, re.DOTALL)
            if inner:
                y_offset = ci * CARD_H
                page_els.append(f'<g transform="translate(0,{y_offset})">')
                page_els.append(inner.group(1))
                page_els.append(f'</g>')

        # Cut line between the two cards
        if len(pair) == 2:
            page_els.append(f'<line x1="0" y1="{CARD_H}" x2="{PAGE_W}" y2="{CARD_H}" '
                            f'stroke="#000000" stroke-width="1" stroke-dasharray="4,4"/>')

        page_els.append(f'</svg>')
        page_svg = "\n".join(page_els)

        page_path = os.path.join(SCRIPT_DIR, f"recipe-cards-page-{pi+1}.svg")
        with open(page_path, "w") as f:
            f.write(page_svg)
        two_up_svgs.append(page_path)

    pdf_2up_path = os.path.join(SCRIPT_DIR, "recipe-cards-2up.pdf")
    try:
        subprocess.run(
            ["rsvg-convert", "-f", "pdf", "-o", pdf_2up_path] + two_up_svgs,
            check=True, capture_output=True)
        print(f"  PDF (2-up): {pdf_2up_path}")
    except FileNotFoundError:
        pass
    except subprocess.CalledProcessError as e:
        print(f"\n  ⚠ 2-up PDF generation failed: {e.stderr.decode()}")

    # Clean up temp page SVGs
    for p in two_up_svgs:
        os.unlink(p)

    # Generate 4-up PDF (four cards per US letter page, rotated 90° to fit)
    # Each card is 612x396 (landscape). Rotated 90° → 396x612.
    # Two rotated cards side by side: 396*2 = 792 wide (perfect for letter width... almost)
    # Actually letter is 612 wide portrait. So use landscape letter: 792x612
    # Two cards across: each 396 wide = 792 total. Two rows: each 306 tall = 612 total. Perfect!
    PAGE_4_W, PAGE_4_H = 792, 612  # Landscape letter
    CARD_ORIG_W, CARD_ORIG_H = 612, 396
    # After 90° rotation, card becomes 396 wide x 612 tall
    # Scale to fit: half page width = 396, half page height = 306
    # Scale factor: min(396/612, 306/396) = min(0.647, 0.773) = 0.647
    card_scale = min((PAGE_4_W / 2) / CARD_ORIG_W, (PAGE_4_H / 2) / CARD_ORIG_H)
    scaled_w = CARD_ORIG_W * card_scale
    scaled_h = CARD_ORIG_H * card_scale

    quads = []
    for i in range(0, len(svg_files), 4):
        quads.append(svg_files[i:i+4])

    four_up_svgs = []
    for pi, quad in enumerate(quads):
        page_els = []
        page_els.append(f'<?xml version="1.0" encoding="UTF-8"?>')
        page_els.append(f'<svg xmlns="http://www.w3.org/2000/svg" '
                        f'xmlns:xlink="http://www.w3.org/1999/xlink" '
                        f'width="{PAGE_4_W}pt" height="{PAGE_4_H}pt" '
                        f'viewBox="0 0 {PAGE_4_W} {PAGE_4_H}">')
        page_els.append(f'<rect width="100%" height="100%" fill="#FFFFFF"/>')

        # 2x2 grid positions (top-left corner of each scaled card)
        positions = [
            (0, 0),                          # top-left
            (scaled_w, 0),                   # top-right
            (0, scaled_h),                   # bottom-left
            (scaled_w, scaled_h),            # bottom-right
        ]

        for ci, svg_path in enumerate(quad):
            with open(svg_path, "r") as f:
                content = f.read()
            inner = re.search(r'<svg[^>]*>(.*)</svg>', content, re.DOTALL)
            if inner:
                tx, ty = positions[ci]
                page_els.append(f'<g transform="translate({tx},{ty}) scale({card_scale:.4f})">')
                page_els.append(inner.group(1))
                page_els.append(f'</g>')

        # Cut lines — at the actual card boundaries (dotted)
        # Horizontal line between top and bottom rows
        page_els.append(f'<line x1="0" y1="{scaled_h}" x2="{PAGE_4_W}" y2="{scaled_h}" '
                        f'stroke="#000000" stroke-width="1" stroke-dasharray="4,4"/>')
        # Vertical line between left and right columns
        page_els.append(f'<line x1="{scaled_w}" y1="0" x2="{scaled_w}" y2="{PAGE_4_H}" '
                        f'stroke="#000000" stroke-width="1" stroke-dasharray="4,4"/>')
        # Bottom trim line (below bottom row cards)
        page_els.append(f'<line x1="0" y1="{scaled_h * 2}" x2="{PAGE_4_W}" y2="{scaled_h * 2}" '
                        f'stroke="#000000" stroke-width="1" stroke-dasharray="4,4"/>')
        # Right trim line (right of right column cards)
        page_els.append(f'<line x1="{scaled_w * 2}" y1="0" x2="{scaled_w * 2}" y2="{PAGE_4_H}" '
                        f'stroke="#000000" stroke-width="1" stroke-dasharray="4,4"/>')

        page_els.append(f'</svg>')
        page_svg = "\n".join(page_els)

        page_path = os.path.join(SCRIPT_DIR, f"recipe-cards-4up-page-{pi+1}.svg")
        with open(page_path, "w") as f:
            f.write(page_svg)
        four_up_svgs.append(page_path)

    pdf_4up_path = os.path.join(SCRIPT_DIR, "recipe-cards-4up.pdf")
    try:
        subprocess.run(
            ["rsvg-convert", "-f", "pdf", "-o", pdf_4up_path] + four_up_svgs,
            check=True, capture_output=True)
        print(f"  PDF (4-up): {pdf_4up_path}")
    except FileNotFoundError:
        pass
    except subprocess.CalledProcessError as e:
        print(f"\n  ⚠ 4-up PDF generation failed: {e.stderr.decode()}")

    # Clean up temp page SVGs
    for p in four_up_svgs:
        os.unlink(p)

    print("\nDone!")
