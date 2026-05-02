#!/usr/bin/env python3
"""Generate prop sticker/stencil pages from Minecraft item texture PNGs.

Reads 16x16 item textures, scales each pixel to the physical prop size,
and splits into printable 8.5x11" pages.

Usage:
    python3 generate_stencils.py --pixel-inches 1.09375
    python3 generate_stencils.py --pixel-inches 1.09375 --props golden_sword
"""

import argparse
import os
import struct
import subprocess
import zlib

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
TEXTURE_DIR = os.path.join(os.path.dirname(SCRIPT_DIR), "textures", "item")

# Props to generate: (display_name, short_name, texture_filename)
PROPS = [
    ("Gold Sword", "Sword", "golden_sword.png"),
    ("Wooden Pickaxe", "Pickaxe", "wooden_pickaxe.png"),
    ("Fishing Rod", "Rod", "fishing_rod.png"),
]

PAGE_W = 612.0  # 8.5" in points
PAGE_H = 792.0  # 11" in points
MARGIN = 36.0   # 0.5"


def read_png_pixels(path):
    """Read a PNG file and return list of (col, row, r, g, b) for non-transparent pixels.

    Minimal PNG reader — handles 8-bit RGBA, 8-bit colormap, and 4-bit colormap.
    """
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

    # Parse transparency for colormapped images
    trns = chunks.get(b"tRNS", b"")

    pixels = []
    pos = 0
    for row in range(height):
        filter_byte = raw_data[pos]
        pos += 1

        if color_type == 6:  # RGBA
            row_bytes = []
            for col in range(width):
                r, g, b, a = raw_data[pos], raw_data[pos+1], raw_data[pos+2], raw_data[pos+3]
                pos += 4
                if a > 0:
                    pixels.append((col, row, r, g, b))
        elif color_type == 3:  # Indexed color
            if bit_depth == 8:
                for col in range(width):
                    idx = raw_data[pos]
                    pos += 1
                    if idx < len(trns) and trns[idx] == 0:
                        continue
                    if idx < len(palette):
                        r, g, b = palette[idx]
                        pixels.append((col, row, r, g, b))
            elif bit_depth == 4:
                byte_idx = 0
                for col in range(width):
                    if col % 2 == 0:
                        idx = (raw_data[pos] >> 4) & 0x0F
                    else:
                        idx = raw_data[pos] & 0x0F
                        pos += 1
                    if idx < len(trns) and trns[idx] == 0:
                        if col % 2 == 1 or col == width - 1:
                            pass
                        continue
                    if idx < len(palette):
                        r, g, b = palette[idx]
                        pixels.append((col, row, r, g, b))
                if width % 2 == 1:
                    pos += 1
        elif color_type == 2:  # RGB
            for col in range(width):
                r, g, b = raw_data[pos], raw_data[pos+1], raw_data[pos+2]
                pos += 3
                pixels.append((col, row, r, g, b))

    return width, height, pixels


def split_into_sections(pixels, pixel_pt, short_name):
    """Split pixel grid into page-sized sections (half-page each)."""
    if not pixels:
        return []

    max_col = max(p[0] for p in pixels)
    max_row = max(p[1] for p in pixels)

    cols_per = max(1, int((PAGE_W - 2 * MARGIN) / pixel_pt))
    rows_per = max(1, int((PAGE_H / 2 - MARGIN - 10) / pixel_pt))

    sections = []
    for sc in range((max_col // cols_per) + 1):
        for sr in range((max_row // rows_per) + 1):
            c0, c1 = sc * cols_per, (sc + 1) * cols_per - 1
            r0, r1 = sr * rows_per, (sr + 1) * rows_per - 1
            sec = [(c - c0, r - r0, rgb) for c, r, rgb in pixels if c0 <= c <= c1 and r0 <= r <= r1]
            if sec:
                sections.append((f"{short_name} [{sc+1},{sr+1}]", sec))
    return sections


def render_page_svg(page_sections, pixel_pt, footer):
    """Render 1-2 sections onto an 8.5x11 SVG page."""
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        f'<svg xmlns="http://www.w3.org/2000/svg" width="8.5in" height="11in" viewBox="0 0 {PAGE_W} {PAGE_H}">',
        '<rect width="100%" height="100%" fill="white"/>',
    ]

    for label, pixels, zone in page_sections:
        lines.append(f"<!-- {label} -->")
        base_y = MARGIN if zone == "top" else PAGE_H / 2
        max_c = max(p[0] for p in pixels)
        max_r = max(p[1] for p in pixels)
        ox = PAGE_W - MARGIN - (max_c + 1) * pixel_pt
        oy = base_y

        for c, r, rgb in pixels:
            x = ox + c * pixel_pt
            y = oy + r * pixel_pt
            lines.append(
                f'<rect x="{x}" y="{y}" width="{pixel_pt}" height="{pixel_pt}" '
                f'fill="rgb({rgb})" stroke="#555" stroke-width="0.5"/>'
            )
        lines.append(
            f'<text x="{MARGIN}" y="{oy + (max_r + 1) * pixel_pt + 8}" '
            f'font-size="6" fill="#333">{label}</text>'
        )

    lines.append(
        f'<text x="{MARGIN}" y="{PAGE_H - MARGIN + 9}" font-size="8" fill="#999">{footer}</text>'
    )
    lines.append("</svg>")
    return "\n".join(lines)


def render_reference_svg(all_props, pixel_inches):
    """Thumbnail reference sheet showing all props."""
    thumb = 13.5
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        f'<svg xmlns="http://www.w3.org/2000/svg" width="8.5in" height="11in" viewBox="0 0 {PAGE_W} {PAGE_H}">',
        '<rect width="100%" height="100%" fill="white"/>',
        f'<text x="{PAGE_W/2}" y="57.6" font-size="16" fill="#333" text-anchor="middle" '
        f'font-family="sans-serif" font-weight="bold">Prop Reference Sheet</text>',
        f'<text x="{PAGE_W/2}" y="79.2" font-size="9" fill="#666" text-anchor="middle" '
        f'font-family="sans-serif">1 pixel = {pixel_inches:.4g}" at full scale</text>',
    ]

    positions = [(0, 0), (1, 0), (0, 1), (1, 1)]
    cell_w, cell_h = PAGE_W / 2, (PAGE_H - 100) / 2

    for i, (display_name, pixels) in enumerate(all_props):
        if i >= 4:
            break
        gx, gy = positions[i]
        cx = gx * cell_w + cell_w / 2
        cy = 100 + gy * cell_h + 10

        if not pixels:
            continue
        max_c = max(p[0] for p in pixels)
        max_r = max(p[1] for p in pixels)
        ox = cx - (max_c + 1) * thumb / 2
        oy = cy

        for c, r, rgb in pixels:
            x = ox + c * thumb
            y = oy + r * thumb
            lines.append(
                f'<rect x="{x}" y="{y}" width="{thumb}" height="{thumb}" '
                f'fill="rgb({rgb})" stroke="#888" stroke-width="0.3"/>'
            )
        lines.append(
            f'<text x="{cx}" y="{oy + (max_r + 1) * thumb + 25}" font-size="10" '
            f'fill="#333" text-anchor="middle" font-family="sans-serif">{display_name}</text>'
        )

    lines.append("</svg>")
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="Generate prop stencil pages from Minecraft textures")
    parser.add_argument("--pixel-inches", type=float, default=1.25, help="Pixel size in inches (default: 1.25)")
    parser.add_argument("--props", nargs="*", help="Filter by short name (e.g., Sword Pickaxe Rod)")
    parser.add_argument("--output-dir", default=SCRIPT_DIR)
    args = parser.parse_args()

    pixel_pt = args.pixel_inches * 72.0
    print(f"Pixel size: {args.pixel_inches}\" = {pixel_pt}pt")

    # Load textures
    props_data = []
    all_sections = []
    for display_name, short_name, filename in PROPS:
        if args.props and not any(p.lower() in short_name.lower() for p in args.props):
            continue
        tex_path = os.path.join(TEXTURE_DIR, filename)
        if not os.path.exists(tex_path):
            print(f"  WARNING: {tex_path} not found, skipping {display_name}")
            continue

        w, h, raw_pixels = read_png_pixels(tex_path)
        # Convert to "r,g,b" string format
        pixels = [(c, r, f"{red},{green},{blue}") for c, r, red, green, blue in raw_pixels]
        print(f"  {display_name}: {w}x{h} texture, {len(pixels)} opaque pixels")

        props_data.append((display_name, pixels))
        sections = split_into_sections(pixels, pixel_pt, short_name)
        print(f"    → {len(sections)} stencil sections")
        all_sections.extend(sections)

    # Pack sections into pages (two per page where possible)
    pages = []
    pending = list(all_sections)
    half_h = PAGE_H / 2 - MARGIN - 10

    while pending:
        label1, pix1 = pending.pop(0)
        fits1 = (max(p[1] for p in pix1) + 1) * pixel_pt <= half_h
        page = [(label1, pix1, "top")]
        names = {label1.split("[")[0].strip()}

        if fits1 and pending:
            for j, (label2, pix2) in enumerate(pending):
                if (max(p[1] for p in pix2) + 1) * pixel_pt <= half_h:
                    page.append((label2, pix2, "bottom"))
                    names.add(label2.split("[")[0].strip())
                    pending.pop(j)
                    break

        footer = " + ".join(sorted(names)) + f' — 1 sq = {args.pixel_inches:.4g}"'
        pages.append((page, footer))

    print(f"\nTotal: {len(pages)} stencil pages + 1 reference")

    # Write SVGs
    svg_files = []

    ref_svg = render_reference_svg(props_data, args.pixel_inches)
    ref_path = os.path.join(args.output_dir, "stencil-reference.svg")
    with open(ref_path, "w") as f:
        f.write(ref_svg)
    svg_files.append(ref_path)
    print(f"  Wrote {ref_path}")

    for i, (page_secs, footer) in enumerate(pages):
        svg = render_page_svg(page_secs, pixel_pt, footer)
        path = os.path.join(args.output_dir, f"stencil-page{i+1}.svg")
        with open(path, "w") as f:
            f.write(svg)
        svg_files.append(path)
        labels = [s[0] for s in page_secs]
        print(f"  Wrote {path} ({', '.join(labels)})")

    # Clean up old pages
    for old in sorted(os.listdir(args.output_dir)):
        if old.startswith("stencil-page") and old.endswith(".svg"):
            p = os.path.join(args.output_dir, old)
            if p not in svg_files:
                os.remove(p)
                print(f"  Removed old {old}")

    # Also remove old generated reference
    old_gen = os.path.join(args.output_dir, "stencil-reference-generated.svg")
    if os.path.exists(old_gen):
        os.remove(old_gen)

    # PDF
    pdf_path = os.path.join(args.output_dir, "stencils-all.pdf")
    try:
        subprocess.run(["rsvg-convert", "-f", "pdf", "-o", pdf_path] + svg_files,
                        check=True, capture_output=True)
        print(f"\nPDF: {pdf_path}")
    except (FileNotFoundError, subprocess.CalledProcessError):
        print(f"\nFor PDF: brew install librsvg && re-run")

    print("Done!")


if __name__ == "__main__":
    main()
