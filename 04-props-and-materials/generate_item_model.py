#!/usr/bin/env python3
"""Generate OpenSCAD 3D model + printable sticker SVG from a Minecraft item texture PNG.

Reads the 16×16 item texture, extracts opaque pixels, and produces:
  1. An OpenSCAD .scad file — pixelated silhouette extruded to configurable depth,
     with a cylindrical cavity for a 1" NTAG215 NFC coin tag.
  2. A sticker SVG — pixel-accurate color map sized to match the 3D print,
     with cut-line outline, on an 8.5×11" sheet with multiple copies.

Usage:
    python3 generate_item_model.py redstone
    python3 generate_item_model.py redstone --depth 0.5
    python3 generate_item_model.py diamond --depth 0.75 --copies 4
    python3 generate_item_model.py stick iron_ingot string redstone diamond
    python3 generate_item_model.py --all

Options:
    --depth INCHES    Extrusion depth in inches (default: 0.5)
    --grid INCHES     Grid slot size in inches (default: 3)
    --copies N        Sticker copies per sheet (default: 4)
    --no-tag          Omit the NFC tag cavity
    --no-sticker      Skip sticker SVG generation
    --no-scad         Skip OpenSCAD file generation
    --all             Generate all 5 game items (stick, iron_ingot, string, redstone, diamond)
"""

import argparse
import os
import struct
import subprocess
import sys
import zlib

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
TEXTURE_DIR = os.path.join(PROJECT_DIR, "minecraft", "textures", "item")

# The 5 item types needed for the escape room game
GAME_ITEMS = ["stick", "iron_ingot", "string", "redstone", "diamond"]


# ============================================================
# PNG reader (from generate_stencils.py — no PIL dependency)
# ============================================================

def read_png_pixels(path):
    """Read a PNG file and return (width, height, [(col, row, r, g, b), ...]) for opaque pixels."""
    with open(path, "rb") as f:
        sig = f.read(8)
        assert sig == b"\x89PNG\r\n\x1a\n", f"Not a PNG: {path}"

        chunks = {}
        palette = []
        while True:
            raw = f.read(8)
            if len(raw) < 8:
                break
            length = struct.unpack(">I", raw[:4])[0]
            ctype = raw[4:8]
            data = f.read(length)
            f.read(4)  # CRC
            if ctype == b"IHDR":
                width = struct.unpack(">I", data[0:4])[0]
                height = struct.unpack(">I", data[4:8])[0]
                bit_depth = data[8]
                color_type = data[9]
            elif ctype == b"PLTE":
                for i in range(0, len(data), 3):
                    palette.append((data[i], data[i + 1], data[i + 2]))
            elif ctype == b"tRNS":
                chunks[b"tRNS"] = data
            elif ctype == b"IDAT":
                chunks.setdefault(b"IDAT", b"")
                chunks[b"IDAT"] += data
            elif ctype == b"IEND":
                break

    raw_data = zlib.decompress(chunks[b"IDAT"])
    trns = chunks.get(b"tRNS", b"")

    # PNG filtering: reconstruct scanlines
    # Each row starts with a filter byte, then the raw pixel data.
    # We need to undo the filter to get actual pixel values.
    def bytes_per_pixel():
        samples = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}
        s = samples.get(color_type, 1)
        return max(1, (s * bit_depth + 7) // 8)

    bpp = bytes_per_pixel()
    if color_type == 3:  # indexed — 1 sample, pack multiple per byte
        stride = (width * bit_depth + 7) // 8
    else:
        stride = width * bpp

    def paeth(a, b, c):
        p = a + b - c
        pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
        if pa <= pb and pa <= pc:
            return a
        elif pb <= pc:
            return b
        return c

    # Unfilter all rows
    rows_data = []
    pos = 0
    prev_row = bytes(stride)
    for row in range(height):
        filt = raw_data[pos]
        pos += 1
        cur_raw = bytearray(raw_data[pos:pos + stride])
        pos += stride

        if filt == 0:  # None
            pass
        elif filt == 1:  # Sub
            for i in range(stride):
                left = cur_raw[i - bpp] if i >= bpp else 0
                cur_raw[i] = (cur_raw[i] + left) & 0xFF
        elif filt == 2:  # Up
            for i in range(stride):
                cur_raw[i] = (cur_raw[i] + prev_row[i]) & 0xFF
        elif filt == 3:  # Average
            for i in range(stride):
                left = cur_raw[i - bpp] if i >= bpp else 0
                cur_raw[i] = (cur_raw[i] + (left + prev_row[i]) // 2) & 0xFF
        elif filt == 4:  # Paeth
            for i in range(stride):
                left = cur_raw[i - bpp] if i >= bpp else 0
                up = prev_row[i]
                up_left = prev_row[i - bpp] if i >= bpp else 0
                cur_raw[i] = (cur_raw[i] + paeth(left, up, up_left)) & 0xFF

        rows_data.append(bytes(cur_raw))
        prev_row = cur_raw

    # Grayscale transparency: tRNS holds a 2-byte value for the transparent gray level
    gray_trans = None
    if color_type == 0 and len(trns) >= 2:
        gray_trans = struct.unpack(">H", trns[:2])[0]

    pixels = []
    for row in range(height):
        data = rows_data[row]

        if color_type == 6:  # RGBA
            for col in range(width):
                off = col * 4
                r, g, b, a = data[off], data[off + 1], data[off + 2], data[off + 3]
                if a > 0:
                    pixels.append((col, row, r, g, b))

        elif color_type == 4:  # Grayscale + Alpha
            for col in range(width):
                off = col * 2
                v, a = data[off], data[off + 1]
                if a > 0:
                    pixels.append((col, row, v, v, v))

        elif color_type == 0:  # Grayscale
            for col in range(width):
                v = data[col]
                if gray_trans is not None and v == gray_trans:
                    continue
                pixels.append((col, row, v, v, v))

        elif color_type == 2:  # RGB
            for col in range(width):
                off = col * 3
                r, g, b = data[off], data[off + 1], data[off + 2]
                pixels.append((col, row, r, g, b))

        elif color_type == 3:  # Indexed color
            if bit_depth == 8:
                for col in range(width):
                    idx = data[col]
                    if idx < len(trns) and trns[idx] == 0:
                        continue
                    if idx < len(palette):
                        r, g, b = palette[idx]
                        pixels.append((col, row, r, g, b))
            elif bit_depth == 4:
                for col in range(width):
                    byte_pos = col // 2
                    if col % 2 == 0:
                        idx = (data[byte_pos] >> 4) & 0x0F
                    else:
                        idx = data[byte_pos] & 0x0F
                    if idx < len(trns) and trns[idx] == 0:
                        continue
                    if idx < len(palette):
                        r, g, b = palette[idx]
                        pixels.append((col, row, r, g, b))
            elif bit_depth == 2:
                for col in range(width):
                    byte_pos = col // 4
                    shift = 6 - (col % 4) * 2
                    idx = (data[byte_pos] >> shift) & 0x03
                    if idx < len(trns) and trns[idx] == 0:
                        continue
                    if idx < len(palette):
                        r, g, b = palette[idx]
                        pixels.append((col, row, r, g, b))
            elif bit_depth == 1:
                for col in range(width):
                    byte_pos = col // 8
                    shift = 7 - (col % 8)
                    idx = (data[byte_pos] >> shift) & 0x01
                    if idx < len(trns) and trns[idx] == 0:
                        continue
                    if idx < len(palette):
                        r, g, b = palette[idx]
                        pixels.append((col, row, r, g, b))

    return width, height, pixels


# ============================================================
# OpenSCAD generator
# ============================================================

def generate_scad(item_name, pixels, tex_w, tex_h, grid_in, depth_in, include_tag, fit=False):
    """Generate an OpenSCAD file string for the item shape."""
    # Build pixel coordinate list
    coords = sorted(set((col, row) for col, row, r, g, b in pixels))

    # Find bounding box
    min_col = min(c for c, r in coords)
    max_col = max(c for c, r in coords)
    min_row = min(r for c, r in coords)
    max_row = max(r for c, r in coords)

    shape_w = max_col - min_col + 1
    shape_h = max_row - min_row + 1

    if fit:
        # Scale pixel size so the largest shape dimension fills the grid
        largest = max(shape_w, shape_h)
        effective_pixels = largest
        # Shift coords so the shape is centered in the grid
        # Center of shape in original coords
        shape_cx = (min_col + max_col + 1) / 2.0
        shape_cy = (min_row + max_row + 1) / 2.0
        # Center of the new grid (largest x largest)
        grid_cx = largest / 2.0
        grid_cy = largest / 2.0
        # Offset to apply
        off_col = grid_cx - shape_cx
        off_row = grid_cy - shape_cy
        coords = sorted(set((c + off_col, r + off_row) for c, r in coords))
        # Recalculate center for tag placement
        center_col = (min(c for c, r in coords) + max(c for c, r in coords)) / 2.0
        center_row = (min(r for c, r in coords) + max(r for c, r in coords)) / 2.0
    else:
        effective_pixels = tex_w
        center_col = (min_col + max_col) / 2.0
        center_row = (min_row + max_row) / 2.0

    pixel_list = ",\n    ".join(
        ", ".join(f"[{c},{r}]" for c, r in coords[i:i + 8])
        for i in range(0, len(coords), 8)
    )

    tag_section = ""
    if include_tag:
        tag_section = f"""
// NFC tag (NTAG215 25mm coin)
TAG_DIAMETER    = 26;           // mm — slightly oversized for easy drop-in
TAG_THICKNESS   = 1.2;         // mm
TAG_CLEARANCE   = 0.4;         // mm extra around tag

cavity_d = TAG_DIAMETER + TAG_CLEARANCE * 2;
cavity_h = TAG_THICKNESS + TAG_CLEARANCE;

echo(str("Tag cavity: ", cavity_d, "mm dia × ", cavity_h, "mm deep"));
echo(str("PAUSE AT: ", DEPTH_MM / 2 + cavity_h / 2, "mm to insert tag"));

module tag_cavity() {{
    cx = ({center_col:.1f} + 0.5) * PIXEL_MM;
    cy = (PIXELS - 1 - {center_row:.1f} + 0.5) * PIXEL_MM;
    translate([cx, cy, DEPTH_MM / 2 - cavity_h / 2])
        cylinder(d = cavity_d, h = cavity_h + 0.1, $fn = 48);
}}

module tag_shelf() {{
    cx = ({center_col:.1f} + 0.5) * PIXEL_MM;
    cy = (PIXELS - 1 - {center_row:.1f} + 0.5) * PIXEL_MM;
    translate([cx, cy, DEPTH_MM / 2 - cavity_h / 2 - 1.0])
        cylinder(d = cavity_d + 4, h = 1.0, $fn = 48);
}}"""

    if include_tag:
        render_block = """
module item_final() {
    difference() {
        union() {
            item_shape();
            intersection() {
                item_shape();
                tag_shelf();
            }
        }
        tag_cavity();
    }
}

item_final();

// Cross-section view (uncomment to see tag cavity):
// difference() {
//     item_final();
//     translate([8 * PIXEL_MM + 50, 0, 0])
//         cube([100, 200, 100]);
// }"""
    else:
        render_block = """
item_shape();"""

    return f"""// {item_name} — Minecraft Item Shape 3D Model
// Auto-generated from minecraft/textures/item/{item_name}.png
//
// Open in OpenSCAD → F5 preview → F6 render → F7 export STL

// ============================================================
// PARAMETERS
// ============================================================

GRID_SIZE_IN    = {grid_in};           // crafting table slot size
PIXELS          = {effective_pixels};              // grid divisions (shape-fitted)
PIXEL_MM        = (GRID_SIZE_IN * 25.4) / PIXELS;  // mm per pixel

DEPTH_IN        = {depth_in};          // extrusion depth in inches
DEPTH_MM        = DEPTH_IN * 25.4;
{tag_section}

echo(str("Pixel size: ", PIXEL_MM, "mm"));
echo(str("Footprint: ", PIXELS * PIXEL_MM, "mm = ", GRID_SIZE_IN, " in"));
echo(str("Depth: ", DEPTH_MM, "mm = ", DEPTH_IN, " in"));

// ============================================================
// PIXEL MAP — {len(coords)} opaque pixels
// ============================================================

item_pixels = [
    {pixel_list}
];

// ============================================================
// MODULES
// ============================================================

module pixel_block(col, row) {{
    translate([col * PIXEL_MM, (PIXELS - 1 - row) * PIXEL_MM, 0])
        cube([PIXEL_MM, PIXEL_MM, DEPTH_MM]);
}}

module item_shape() {{
    for (i = [0 : len(item_pixels) - 1])
        pixel_block(item_pixels[i][0], item_pixels[i][1]);
}}
{render_block}
"""


# ============================================================
# Sticker SVG generator
# ============================================================

PAGE_W_PT = 612.0   # 8.5"
PAGE_H_PT = 792.0   # 11"
MARGIN_PT = 36.0    # 0.5"


def generate_sticker_svg(item_name, pixels, tex_w, grid_in, copies, fit=False):
    """Generate an SVG sticker sheet with colored pixels and cut outlines."""
    # Build color map and occupied set
    color_map = {}
    occupied = set()

    if fit:
        coords_only = set((c, r) for c, r, _, _, _ in pixels)
        min_col = min(c for c, r in coords_only)
        max_col = max(c for c, r in coords_only)
        min_row = min(r for c, r in coords_only)
        max_row = max(r for c, r in coords_only)
        shape_w = max_col - min_col + 1
        shape_h = max_row - min_row + 1
        largest = max(shape_w, shape_h)
        effective_pixels = largest
        shape_cx = (min_col + max_col + 1) / 2.0
        shape_cy = (min_row + max_row + 1) / 2.0
        grid_cx = largest / 2.0
        grid_cy = largest / 2.0
        off_col = grid_cx - shape_cx
        off_row = grid_cy - shape_cy
        for col, row, r, g, b in pixels:
            nc, nr = col + off_col, row + off_row
            color_map[(nc, nr)] = f"#{r:02X}{g:02X}{b:02X}"
            occupied.add((nc, nr))
    else:
        effective_pixels = tex_w
        for col, row, r, g, b in pixels:
            color_map[(col, row)] = f"#{r:02X}{g:02X}{b:02X}"
            occupied.add((col, row))

    pixel_in = grid_in / effective_pixels
    pixel_pt = pixel_in * 72.0
    grid_pt = effective_pixels * pixel_pt

    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        f'<svg xmlns="http://www.w3.org/2000/svg" width="8.5in" height="11in" '
        f'viewBox="0 0 {PAGE_W_PT} {PAGE_H_PT}">',
        '<rect width="100%" height="100%" fill="white"/>',
        '',
        f'<!-- {item_name} sticker sheet -->',
        f'<!-- pixel = {pixel_in:.4f}" = {pixel_pt:.2f}pt, grid = {grid_pt:.1f}pt = {grid_in}" -->',
        '',
        f'<text x="{PAGE_W_PT / 2}" y="{MARGIN_PT}" font-size="12" fill="#333" '
        f'text-anchor="middle" font-family="sans-serif" font-weight="bold">'
        f'{item_name} — Item Stickers (cut along outline)</text>',
    ]

    # How many fit on the page
    usable_w = PAGE_W_PT - 2 * MARGIN_PT
    usable_h = PAGE_H_PT - 2 * MARGIN_PT - 20
    gap = 18  # pt between copies
    cols = max(1, int((usable_w + gap) / (grid_pt + gap)))
    rows = max(1, int((usable_h + gap) / (grid_pt + gap)))
    actual = min(copies, cols * rows)

    copy_idx = 0
    for gr in range(rows):
        for gc in range(cols):
            if copy_idx >= actual:
                break
            ox = MARGIN_PT + gc * (grid_pt + gap)
            oy = MARGIN_PT + 20 + gr * (grid_pt + gap)

            lines.append(f'')
            lines.append(f'<g transform="translate({ox:.1f},{oy:.1f})">')

            # Colored pixels
            for (col, row), color in sorted(color_map.items()):
                x = col * pixel_pt
                y = row * pixel_pt
                lines.append(
                    f'  <rect x="{x:.2f}" y="{y:.2f}" '
                    f'width="{pixel_pt:.2f}" height="{pixel_pt:.2f}" fill="{color}"/>'
                )

            # Cut outline — edges bordering empty space
            for col, row in sorted(occupied):
                x = col * pixel_pt
                y = row * pixel_pt
                edges = []
                if (col, row - 1) not in occupied:
                    edges.append((x, y, x + pixel_pt, y))
                if (col, row + 1) not in occupied:
                    edges.append((x, y + pixel_pt, x + pixel_pt, y + pixel_pt))
                if (col - 1, row) not in occupied:
                    edges.append((x, y, x, y + pixel_pt))
                if (col + 1, row) not in occupied:
                    edges.append((x + pixel_pt, y, x + pixel_pt, y + pixel_pt))
                for x1, y1, x2, y2 in edges:
                    lines.append(
                        f'  <line x1="{x1:.2f}" y1="{y1:.2f}" '
                        f'x2="{x2:.2f}" y2="{y2:.2f}" '
                        f'stroke="#333" stroke-width="0.75"/>'
                    )

            lines.append('</g>')
            copy_idx += 1

    lines.append(
        f'<text x="{MARGIN_PT}" y="{PAGE_H_PT - MARGIN_PT + 12}" font-size="8" '
        f'fill="#999" font-family="sans-serif">'
        f'{item_name} — 1 pixel = {pixel_in:.4f}" — print at 100% on vinyl sticker paper</text>'
    )
    lines.append('</svg>')
    return '\n'.join(lines)


# ============================================================
# Main
# ============================================================

def process_item(item_name, args):
    """Process a single item: read PNG, generate .scad and/or sticker SVG."""
    tex_path = os.path.join(TEXTURE_DIR, f"{item_name}.png")
    if not os.path.exists(tex_path):
        print(f"  ERROR: {tex_path} not found")
        return False

    tex_w, tex_h, pixels = read_png_pixels(tex_path)
    print(f"  {item_name}: {tex_w}×{tex_h} texture, {len(pixels)} opaque pixels")

    output_dir = args.output_dir

    # OpenSCAD
    if not args.no_scad:
        scad = generate_scad(item_name, pixels, tex_w, tex_h,
                             args.grid, args.depth, not args.no_tag, args.fit)
        scad_path = os.path.join(output_dir, f"{item_name}-item.scad")
        with open(scad_path, "w") as f:
            f.write(scad)
        print(f"    SCAD:    {scad_path}")

    # Sticker SVG
    if not args.no_sticker:
        svg = generate_sticker_svg(item_name, pixels, tex_w, args.grid, args.copies, args.fit)
        svg_path = os.path.join(output_dir, f"sticker-{item_name}.svg")
        with open(svg_path, "w") as f:
            f.write(svg)
        print(f"    Sticker: {svg_path}")

        # Try PDF conversion
        pdf_path = os.path.join(output_dir, f"sticker-{item_name}.pdf")
        try:
            subprocess.run(
                ["rsvg-convert", "-f", "pdf", "-o", pdf_path, svg_path],
                check=True, capture_output=True,
            )
            print(f"    PDF:     {pdf_path}")
        except (FileNotFoundError, subprocess.CalledProcessError):
            pass

    return True


def main():
    parser = argparse.ArgumentParser(
        description="Generate OpenSCAD model + sticker SVG from Minecraft item textures"
    )
    parser.add_argument("items", nargs="*",
                        help="Item names (e.g. redstone diamond stick)")
    parser.add_argument("--all", action="store_true",
                        help="Generate all 5 game items")
    parser.add_argument("--depth", type=float, default=0.5,
                        help="Extrusion depth in inches (default: 0.5)")
    parser.add_argument("--grid", type=float, default=3.0,
                        help="Grid slot size in inches (default: 3)")
    parser.add_argument("--copies", type=int, default=4,
                        help="Sticker copies per sheet (default: 4)")
    parser.add_argument("--no-tag", action="store_true",
                        help="Omit NFC tag cavity from SCAD model")
    parser.add_argument("--no-sticker", action="store_true",
                        help="Skip sticker SVG generation")
    parser.add_argument("--no-scad", action="store_true",
                        help="Skip OpenSCAD file generation")
    parser.add_argument("--fit", action="store_true",
                        help="Scale shape to fill the grid slot (removes transparent padding)")
    parser.add_argument("--output-dir", default=SCRIPT_DIR,
                        help="Output directory (default: same as script)")
    args = parser.parse_args()

    if args.all:
        items = GAME_ITEMS
    elif args.items:
        items = args.items
    else:
        parser.error("Specify item names or use --all")

    print(f"Settings: depth={args.depth}\", grid={args.grid}\", copies={args.copies}")
    print(f"Texture dir: {TEXTURE_DIR}")
    print()

    ok = 0
    for item in items:
        if process_item(item, args):
            ok += 1
    print(f"\nDone — {ok}/{len(items)} items processed.")


if __name__ == "__main__":
    main()
