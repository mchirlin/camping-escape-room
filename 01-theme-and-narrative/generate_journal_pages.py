#!/usr/bin/env python3
"""Generate Explorer's Journal pages for the Minecraft escape room.

Each page is rendered in the Minecraft bitmap font (black on white)
at half-letter size (5.5" x 8.5") for printing and tea-staining.

Usage:
    python3 generate_journal_pages.py
"""

import base64
import os
import subprocess

from PIL import Image

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
FONT_ATLAS = os.path.join(PROJECT_DIR, "minecraft", "textures", "font", "ascii.png")

# Page dimensions (5.5" x 8.5" half-letter, portrait)
PAGE_W = 396   # 5.5" * 72pt
PAGE_H = 612   # 8.5" * 72pt
MARGIN = 36    # 0.5" margin

TEXT_COLOR = "#1A1A1A"
CONTENT_W = PAGE_W - MARGIN * 2

# --- Minecraft "colored background" styling (print in color, then cut out) ---
# Sand — uniform speckled tan.  We tile a 3x3 pre-stitched texture so seams
# are pushed far apart and barely visible at print scale.
BG_TEXTURE = os.path.join(PROJECT_DIR, "minecraft", "textures", "block", "sand.png")
BG_TILE = 192         # each 16px texture tile rendered at 192pt (~12pt/pixel) — big chunky pixels
BG_STITCH = 3         # stitch NxN copies before tiling (pushes seams apart)
BORDER_DARK = "#4A2E0A"    # dark leather-brown frame
BORDER_LIGHT = "#E8C992"   # highlight edge
ACCENT = "#6B5836"         # muted brown for page number / separators

CARD_MARGIN = 9    # white bleed around the card (room for scissors)
CORNER_P = 12      # size of one corner "pixel" step (bigger to match tile scale)
CORNER_N = 3       # number of steps per corner


_tex_b64 = None


def bg_tex_b64():
    """Base64-encode the background texture, pre-stitched NxN and pre-scaled
    to final pixel dimensions using nearest-neighbor so renderers that ignore
    image-rendering='pixelated' still show crisp pixels."""
    global _tex_b64
    if _tex_b64 is None:
        if not os.path.exists(BG_TEXTURE):
            print(f"  WARNING: missing texture {BG_TEXTURE}")
            _tex_b64 = ""
        else:
            from PIL import Image as PILImage
            import io
            img = PILImage.open(BG_TEXTURE).convert("RGBA")
            w, h = img.size  # 16x16
            # Stitch NxN grid at native resolution
            n = BG_STITCH
            stitched = PILImage.new("RGBA", (w * n, h * n))
            for row in range(n):
                for col in range(n):
                    stitched.paste(img, (col * w, row * h))
            # Pre-scale to final render size using NEAREST (crisp pixels)
            final_size = int(BG_TILE * n)
            stitched = stitched.resize((final_size, final_size), PILImage.NEAREST)
            buf = io.BytesIO()
            stitched.save(buf, format="PNG")
            _tex_b64 = base64.b64encode(buf.getvalue()).decode()
    return _tex_b64


def pixel_round_rect_path(x0, y0, w, h, p, n):
    """SVG path for a rectangle with pixel-stepped ("Minecraft-rounded") corners.

    Each corner is a staircase of `n` steps, each step `p` x `p`. Traversed
    clockwise starting at the left end of the top edge.
    """
    pts = [(x0 + n * p, y0), (x0 + w - n * p, y0)]
    # top-right corner
    for i in range(n):
        pts.append((x0 + w - n * p + (i + 1) * p, y0 + i * p))
        pts.append((x0 + w - n * p + (i + 1) * p, y0 + (i + 1) * p))
    pts.append((x0 + w, y0 + h - n * p))
    # bottom-right corner
    for i in range(n):
        pts.append((x0 + w - i * p, y0 + h - n * p + (i + 1) * p))
        pts.append((x0 + w - (i + 1) * p, y0 + h - n * p + (i + 1) * p))
    pts.append((x0 + n * p, y0 + h))
    # bottom-left corner
    for i in range(n):
        pts.append((x0 + n * p - (i + 1) * p, y0 + h - i * p))
        pts.append((x0 + n * p - (i + 1) * p, y0 + h - (i + 1) * p))
    pts.append((x0, y0 + n * p))
    # top-left corner
    for i in range(n):
        pts.append((x0 + i * p, y0 + n * p - (i + 1) * p))
        pts.append((x0 + (i + 1) * p, y0 + n * p - (i + 1) * p))

    d = f"M {pts[0][0]:.1f} {pts[0][1]:.1f} "
    d += " ".join(f"L {px:.1f} {py:.1f}" for px, py in pts[1:])
    d += " Z"
    return d

# --- Journal page content ---
# Each page: title, lines of body text (story only, no recipes)
PAGES = [
    {
        "num": 1,
        "title": "The Explorer's Journal",
        "lines": [
            "",
            "Day 1.",
            "",
            "They said no one ever found",
            "what the old crafter left",
            "behind. I intend to prove",
            "them wrong.",
            "",
            "The forest is quiet. Somewhere",
            "out here a chest waits, sealed",
            "tight against thieves and time.",
            "",
            "I have nothing yet but my wits",
            "and these two empty hands.",
        ],
    },
    {
        "num": 2,
        "title": "The Explorer Tent",
        "lines": [
            "",
            "An old tent, half-swallowed by",
            "the brush. Someone lived here",
            "once, and left in a hurry.",
            "",
            "A little iron. Some odds and",
            "ends. And a lump of something",
            "red tucked beneath the pillow.",
            "Strange thing to hide. I'll",
            "keep it.",
            "",
            "In the corner, a chest wrapped",
            "tight in chains.",
        ],
    },
    {
        "num": 3,
        "title": "The Compass",
        "lines": [
            "",
            "A traveler is lost without a",
            "needle to trust.",
            "",
            "The old notes speak of markers",
            "in the trees. I'll follow them",
            "and see where they lead.",
            "",
            "The path from here:",
            "",
            "",
            "",
            "",
        ],
    },
    {
        "num": 4,
        "title": "The Waypoint",
        "lines": [
            "",
            "The markers led true.",
            "A cache, hidden well beneath",
            "the roots -- someone stocked",
            "this place and never returned.",
            "",
            "Rough stone, cool and heavy,",
            "and a thick bundle of blank",
            "paper, still dry after all",
            "this time.",
            "",
            "The woods grow thicker here,",
            "and quieter.",
        ],
    },
    {
        "num": 5,
        "title": "The Old Mine",
        "lines": [
            "",
            "The dark smells of cold rock",
            "and older things.",
            "",
            "Deep in the tunnels: cobwebbed",
            "string, a warm glint of copper,",
            "and a seam of black coal in the",
            "stone.",
            "",
            "Scratched by the entrance, a",
            "drawing -- the whole valley,",
            "laid flat as a page.",
        ],
    },
    {
        "num": 6,
        "title": "The Map Awakens",
        "lines": [
            "",
            "The drawing came alive in my",
            "hands. Ink spreading like",
            "water, showing me everything.",
            "",
            "A stream. A cave mouth. A scar",
            "of stone where the earth was",
            "dug deep. And a figure, far",
            "off, waiting.",
            "",
            "Odd -- pale grains scattered",
            "along the water's edge.",
        ],
    },
    {
        "num": 7,
        "title": "The Stream",
        "lines": [
            "",
            "The map led me to the water's",
            "edge.",
            "",
            "Someone fished here once -- their",
            "tacklebox still rests on the",
            "bank, half-rotted. A length of",
            "line inside, and a note on how",
            "to build a rod.",
            "",
            "The water is deep and dark.",
            "Something glints beneath the",
            "surface, just out of reach.",
        ],
    },
    {
        "num": 8,
        "title": "Diamonds!",
        "lines": [
            "",
            "The water gave up its secret.",
            "",
            "Diamonds -- three of them, cold",
            "and bright as ice, dripping in",
            "my palm.",
            "",
            "I have never held anything so",
            "hard, or so beautiful.",
        ],
    },
    {
        "num": 9,
        "title": "The Ancient Quarry",
        "lines": [
            "",
            "The deep stone yielded at last.",
            "",
            "A green jewel, bright as spring,",
            "and iron besides -- good, heavy",
            "iron for a blade.",
            "",
            "The trader will want to see",
            "this green one, I think.",
        ],
    },
    {
        "num": 10,
        "title": "The Villager's Trade",
        "lines": [
            "",
            "He took the green jewel gladly,",
            "and pressed something into my",
            "hand in return -- a shard of",
            "purple crystal, cold and",
            "glittering.",
            "",
            "Then he spoke plainly for once.",
            "\"Darkness guards what you seek.",
            "Bring light, and bring a",
            "blade.\"",
            "",
            "Light I can manage -- coal, and",
            "the old torch note from the",
            "tent. But an edge worthy of the",
            "dark? That I still need.",
        ],
    },
    {
        "num": 11,
        "title": "The Dark Cave",
        "lines": [
            "",
            "Old marks cover these walls,",
            "cut deep by a frightened hand.",
            "",
            "They warn of a creature -- a",
            "silent, swollen thing that",
            "keeps to the trails and does",
            "not sleep.",
            "",
            "They say it can be seen from a",
            "height, by one with the eyes",
            "for distance.",
        ],
    },
    {
        "num": 12,
        "title": "The Creeper Falls",
        "lines": [
            "",
            "There -- on the path below,",
            "green and waiting.",
            "",
            "My blade ended it. What it left",
            "behind: a fine black powder,",
            "the kind that sleeps until it",
            "wakes all at once.",
            "",
            "The pale grains by the stream.",
            "The chains on that chest.",
            "I am beginning to understand.",
        ],
    },
]


# --- Minecraft bitmap font ---
_glyphs = None


def load_font():
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
    glyphs = load_font()
    total = 0
    for ch in text:
        code = ord(ch) if ord(ch) < 256 else ord('?')
        total += glyphs[code]["width"] + 1
    return (total - 1) * pixel_size


def render_text_left(text, x, y, pixel_size, color=TEXT_COLOR):
    """Render text left-aligned at (x, y)."""
    glyphs = load_font()
    els = []
    cursor = 0
    for ch in text:
        code = ord(ch) if ord(ch) < 256 else ord('?')
        glyph = glyphs[code]
        for (px, py) in glyph["pixels"]:
            rx = x + (cursor + px) * pixel_size
            ry = y + py * pixel_size
            els.append(
                f'<rect x="{rx:.1f}" y="{ry:.1f}" '
                f'width="{pixel_size:.1f}" height="{pixel_size:.1f}" '
                f'fill="{color}"/>'
            )
        cursor += glyph["width"] + 1
    return "\n".join(els)


def render_text_center(text, center_x, y, pixel_size, color=TEXT_COLOR):
    """Render text centered horizontally."""
    w = get_text_width(text, pixel_size)
    return render_text_left(text, center_x - w / 2, y, pixel_size, color)


def fit_pixel_size(text, max_width, desired):
    """Scale pixel_size down if text doesn't fit."""
    w = get_text_width(text, desired)
    if w <= max_width:
        return desired
    return desired * (max_width / w)


def generate_page(page):
    """Generate a single journal page SVG."""
    pid = page["num"]
    cx, cy = CARD_MARGIN, CARD_MARGIN
    cw, ch = PAGE_W - CARD_MARGIN * 2, PAGE_H - CARD_MARGIN * 2
    outline = pixel_round_rect_path(cx, cy, cw, ch, CORNER_P, CORNER_N)
    fin = 6  # inset of the decorative frame from the cut edge
    frame = pixel_round_rect_path(cx + fin, cy + fin, cw - fin * 2, ch - fin * 2,
                                  CORNER_P, CORNER_N)
    tex = bg_tex_b64()

    els = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        f'<svg xmlns="http://www.w3.org/2000/svg" width="5.5in" height="8.5in" '
        f'viewBox="0 0 {PAGE_W} {PAGE_H}" shape-rendering="crispEdges">',
        '<defs>',
        f'<pattern id="bgTex{pid}" patternUnits="userSpaceOnUse" '
        f'width="{BG_TILE * BG_STITCH}" height="{BG_TILE * BG_STITCH}">',
        f'<image href="data:image/png;base64,{tex}" width="{BG_TILE * BG_STITCH}" height="{BG_TILE * BG_STITCH}" '
        f'image-rendering="pixelated"/>',
        '</pattern>',
        f'<clipPath id="clipRound{pid}"><path d="{outline}"/></clipPath>',
        '</defs>',
        # White paper outside the card (giving scissors room)
        f'<rect x="0" y="0" width="{PAGE_W}" height="{PAGE_H}" fill="white"/>',
        # Sandstone card fill, clipped to the pixel-rounded shape
        f'<g clip-path="url(#clipRound{pid})">'
        f'<rect x="{cx}" y="{cy}" width="{cw}" height="{ch}" fill="url(#bgTex{pid})"/></g>',
        # Decorative inner frame
        f'<path d="{frame}" fill="none" stroke="{BORDER_DARK}" stroke-width="3"/>',
        f'<path d="{frame}" fill="none" stroke="{BORDER_LIGHT}" stroke-width="1" opacity="0.5"/>',
        # Cut guide along the pixel-rounded outer edge
        f'<path d="{outline}" fill="none" stroke="{BORDER_DARK}" stroke-width="0.75" '
        f'stroke-dasharray="4,3" opacity="0.7"/>',
    ]

    # Page number (top center, small)
    page_num_text = f"- {page['num']} -"
    els.append(render_text_center(page_num_text, PAGE_W / 2, MARGIN / 2, 1.8, ACCENT))

    # Title (centered, larger)
    title_px = fit_pixel_size(page["title"], CONTENT_W, 3.5)
    els.append(render_text_center(page["title"], PAGE_W / 2, MARGIN + 8, title_px))

    # Separator line under title
    sep_y = MARGIN + 8 + 8 * title_px + 6
    els.append(f'<line x1="{MARGIN + 20}" y1="{sep_y}" x2="{PAGE_W - MARGIN - 20}" y2="{sep_y}" '
               f'stroke="{ACCENT}" stroke-width="0.75"/>')

    # Body text — find a uniform size that fits all lines AND fits on the page
    body_px = 2.5
    # Check longest line fits width
    longest = max(page["lines"], key=lambda l: get_text_width(l, body_px) if l else 0)
    body_px = fit_pixel_size(longest, CONTENT_W, body_px)

    line_height = 8 * body_px + 4  # 8 pixel rows + spacing
    total_body_height = len(page["lines"]) * line_height
    available_height = PAGE_H - sep_y - 16 - MARGIN

    # If body doesn't fit vertically, shrink further
    if total_body_height > available_height:
        scale = available_height / total_body_height
        body_px *= scale
        line_height = 8 * body_px + 4

    start_y = sep_y + 14

    for i, line in enumerate(page["lines"]):
        ly = start_y + i * line_height
        if not line:
            continue
        els.append(render_text_left(line, MARGIN, ly, body_px))

    els.append('</svg>')
    return "\n".join(els)


def main():
    print("Generating Explorer's Journal pages...\n")

    if not os.path.exists(FONT_ATLAS):
        print(f"  ERROR: font atlas not found: {FONT_ATLAS}")
        return

    svg_files = []
    for page in PAGES:
        svg = generate_page(page)
        svg_path = os.path.join(SCRIPT_DIR, f"journal-page-{page['num']:02d}.svg")
        with open(svg_path, "w") as f:
            f.write(svg)
        svg_files.append(svg_path)
        print(f"  ✓ Page {page['num']:2d}: {page['title']}")

    # Combined 1-up PDF (one page per sheet)
    pdf_path = os.path.join(SCRIPT_DIR, "journal-pages-1up.pdf")
    try:
        subprocess.run(
            ["rsvg-convert", "-f", "pdf", "-o", pdf_path] + svg_files,
            check=True, capture_output=True,
        )
        print(f"\n  PDF (1-up): {pdf_path}")
    except FileNotFoundError:
        print("\n  rsvg-convert not found. Install with: brew install librsvg")
        return
    except subprocess.CalledProcessError as e:
        print(f"\n  PDF failed: {e.stderr.decode()}")
        return

    # 2-up PDF: two half-letter portrait pages side by side on a landscape
    # letter sheet (11" x 8.5" = 792 x 612 pt). Each page is 396 x 612.
    import re
    LETTER_W, LETTER_H = 792, 612
    pairs = []
    for i in range(0, len(svg_files), 2):
        pairs.append(svg_files[i:i + 2])

    sheet_svgs = []
    for pi, pair in enumerate(pairs):
        parts = [
            '<?xml version="1.0" encoding="UTF-8"?>',
            f'<svg xmlns="http://www.w3.org/2000/svg" '
            f'width="11in" height="8.5in" '
            f'viewBox="0 0 {LETTER_W} {LETTER_H}" shape-rendering="crispEdges">',
            '<rect width="100%" height="100%" fill="white"/>',
        ]
        for ci, svg_path in enumerate(pair):
            with open(svg_path, "r") as f:
                content = f.read()
            inner = re.search(r'<svg[^>]*>(.*)</svg>', content, re.DOTALL)
            if inner:
                tx = ci * PAGE_W  # 0 or 396
                parts.append(f'<g transform="translate({tx},0)">')
                parts.append(inner.group(1))
                parts.append('</g>')
        # Center fold / cut line between the two pages
        parts.append(f'<line x1="{PAGE_W}" y1="0" x2="{PAGE_W}" y2="{LETTER_H}" '
                     f'stroke="#000000" stroke-width="1" stroke-dasharray="4,4"/>')
        parts.append('</svg>')

        sheet_path = os.path.join(SCRIPT_DIR, f"journal-sheet-{pi+1}.svg")
        with open(sheet_path, "w") as f:
            f.write("\n".join(parts))
        sheet_svgs.append(sheet_path)

    pdf_2up = os.path.join(SCRIPT_DIR, "journal-pages-all.pdf")
    try:
        subprocess.run(
            ["rsvg-convert", "-f", "pdf", "-o", pdf_2up] + sheet_svgs,
            check=True, capture_output=True,
        )
        print(f"  PDF (2-up): {pdf_2up}")
    except subprocess.CalledProcessError as e:
        print(f"\n  2-up PDF failed: {e.stderr.decode()}")

    # Clean up temp sheet SVGs
    for p in sheet_svgs:
        os.unlink(p)

    print("\nDone!")


if __name__ == "__main__":
    main()
