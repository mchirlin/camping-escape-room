#!/usr/bin/env python3
"""Generate a high-level Co-Host Briefing PDF for the Minecraft Camping Escape Room.

A shareable, at-a-glance summary for the helper running the event alongside the
game master. Themed with the Minecraftia font + oak plank texture, auto-paginated
so content never overflows. Renders via rsvg-convert (same pipeline as the diary).
"""

import base64
import os
import subprocess

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT = os.path.dirname(SCRIPT_DIR)
TEX = os.path.join(PROJECT, "minecraft", "textures", "block", "oak_planks.png")
FONT = os.path.expanduser("~/Library/Fonts/Minecraftia-Regular.ttf")
OUT = os.path.join(SCRIPT_DIR, "cohost-briefing.pdf")

with open(TEX, "rb") as f:
    planks_b64 = base64.b64encode(f.read()).decode()
with open(FONT, "rb") as f:
    font_b64 = base64.b64encode(f.read()).decode()

# ---- Minecraft item icons for the cover --------------------------------------
# Pixel-art PNGs from the bundled resource pack, embedded as base64 so the SVG
# is self-contained. These are the tools/items the kids actually craft & use.
ITEM_DIR = os.path.join(PROJECT, "minecraft", "textures", "item")
COVER_ICONS = [
    "stone_pickaxe.png",   # cobblestone pickaxe
    "compass_16.png",      # compass (needle up)
    "fishing_rod.png",     # fishing pole
    "diamond.png",         # diamond
    "iron_sword.png",      # iron sword
    "spyglass.png",        # spyglass
]


def _b64(path):
    with open(path, "rb") as fh:
        return base64.b64encode(fh.read()).decode()


icon_b64 = {name: _b64(os.path.join(ITEM_DIR, name)) for name in COVER_ICONS}

# ---- Page geometry (US Letter) ------------------------------------------------
W, H = 612, 792
ML, MR = 54, 54            # left/right margins
MT, MB = 60, 54            # top/bottom margins
CONTENT_W = W - ML - MR
BODY = "'DejaVu Sans', 'Helvetica', sans-serif"
HEAD = "'Minecraftia', monospace"

# ---- Colors -------------------------------------------------------------------
INK = "#2b2016"
INK_SOFT = "#4a3826"
GREEN = "#3c8527"
GREEN_DK = "#2e6b1e"
STONE = "#6d6d6d"
ACCENT = "#7a5a2f"
RULE = "#b79b6e"

# ---- Approx text width for wrapping (DejaVu Sans metrics) --------------------
# Average glyph advance ~0.52em for sans; use a slightly generous factor so we
# never clip on the right edge.
def text_width(s, size, bold=False):
    factor = 0.60 if bold else 0.56
    return len(s) * size * factor


def wrap(text, size, max_w, bold=False):
    words = text.split()
    lines, cur = [], ""
    for w in words:
        trial = (cur + " " + w).strip()
        if text_width(trial, size, bold) <= max_w or not cur:
            cur = trial
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines or [""]


def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


# ---- Content model -----------------------------------------------------------
# Each block is a tuple: (kind, payload). The layout engine measures then draws.
# kinds: h1, h2, para, bullet, num, table, spacer, rule, callout, pagebreak

def h1(t): return ("h1", t)
def h2(t): return ("h2", t)
def para(t): return ("para", t)
def bullet(t): return ("bullet", t)
def num(n, t): return ("num", (n, t))
def spacer(px=10): return ("spacer", px)
def rule(): return ("rule", None)
def callout(title, body): return ("callout", (title, body))
def table(cols, rows, widths): return ("table", (cols, rows, widths))
def pagebreak(): return ("pagebreak", None)


CONTENT = [
    # ------------------------------------------------------------------ intro
    h1("The Big Picture"),
    para("Thanks for helping run this. It's a Minecraft-themed adventure for a group "
         "of kids at Lake Fairfax campsite. The kids play as explorers hunting for a "
         "hidden Ender Dragon egg. The core idea: they start with nothing but an "
         "explorer's diary, and every tool has to be crafted before they can use it. "
         "They explore the campsite, collect hidden \"blocks,\" and craft their way "
         "forward one tool at a time until they can open the locked treasure chest."),
    spacer(4),
    table(
        ["", ""],
        [
            ["Players", "Up to 6 kids, ages roughly 7-10"],
            ["Length", "About 75-100 minutes, start to finish"],
            ["Vibe", "Adventurous and silly, never scary. Daytime, outdoors"],
            ["Setting", "The campsite, tent, stream, trail, and bathroom (\"the mine\")"],
            ["Goal", "Craft your way to the Ender Dragon egg in the chest + treats"],
        ],
        [0.20, 0.80],
    ),
    spacer(6),
    para("The whole thing runs on one core loop: find blocks out in the world, bring "
         "them back to the crafting table, place them in the right pattern, and craft "
         "the next tool. Each craft unlocks the next location or clue. The very first "
         "craft is the crafting table itself (that's the tutorial), and from there we "
         "repeat the loop about ten crafts total until the final craft (TNT) opens "
         "the treasure chest."),

    # ------------------------------------------------------------------ story
    spacer(8),
    h1("The Story"),
    para("A long-lost explorer detected an Ender Dragon egg hidden near the campsite, "
         "then vanished. All they left behind is a diary. The kids pick up the trail. "
         "We read the diary's final entry aloud to kick things off, hand them the "
         "journal, and send them out to find 4 oak planks. Those planks are the \"key\" "
         "that gets them into the tent and lets them craft the crafting table, and the "
         "adventure builds from there."),

    # ------------------------------------------------------------------ pieces
    spacer(8),
    h1("The Moving Pieces"),
    para("These are the props and gadgets that make it work. You don't need to know "
         "how any of the electronics are built, just what each thing is for."),
    bullet("Crafting Table: the centerpiece, and the kids' first craft. A real 3x3 "
           "grid table with sensors in each slot. Kids place blocks and press to "
           "craft. It lights up, plays a sound, and pops a little door open to "
           "dispense the crafted tool. It lives in the tent for the whole game."),
    bullet("Blocks & Items: about 50 3D-printed Minecraft blocks (wood, iron, sand, "
           "diamond, etc.). Each has a hidden tag the table reads. We hide these "
           "around the site before each run."),
    bullet("MCompass: a real working compass they craft early on (step 2). Points the "
           "way for direction-card navigation."),
    bullet("Fog-of-War Map (iPad/phone): not handed out at the start, it's crafted "
           "around the middle of the game (8 paper + a compass). Once crafted it "
           "\"awakens\" and reveals terrain as the kids walk, and we reveal block and "
           "location markers on it at the right moments."),
    bullet("Recipe Cards & Explorer's Journal: printed cards show each craft's block "
           "pattern; journal pages are story flavor handed out as rewards along the way."),
    bullet("Creeper: a stack of boxes painted green out on the trail. It's pre-scored "
           "so it falls apart when the kids \"attack\" it with the iron sword, dropping "
           "the gunpowder and TNT recipe. Not locked, just waiting to be found."),
    bullet("Treasure chest: the finale prize, sitting locked in the tent in plain "
           "sight the whole game. The crafted TNT is what opens it, revealing the "
           "Ender Dragon egg and treats."),

    # ------------------------------------------------------------------ role
    pagebreak(),
    h1("Your Role"),
    para("You'll play the Villager, an in-world character the kids meet and trade "
         "with. No script to memorize, just a friendly camp character. If there's "
         "time we may add a simple villager nose to sell the part, but that's "
         "optional. Alongside the character, you're the game master's second set of "
         "hands. Your main jobs:"),
    bullet("The Villager trade: this is the one time you hand something to the kids. "
           "They bring you an emerald; you give them the amethyst shard and the Iron "
           "Sword recipe card. Otherwise the kids find things themselves, you don't "
           "hand out journal pages or other rewards."),
    bullet("Reload the crafting-table doors: the table has 3 little doors that pop "
           "open to dispense a crafted prop, but there are more crafts than doors. "
           "After each craft, reload the next prop into that door so there's only "
           "ever one prop per slot at a time. Load order per door is below."),
    bullet("Gatekeeper: several locations have signs like \"Cobblestone Pickaxe "
           "Required.\" When the kids show up with the right crafted tool, let them "
           "in and point them to the loot hidden there."),
    bullet("Sound & drama: play the creeper hiss and explosion sounds at the right "
           "moments, and \"blow open\" the locked treasure chest by unlocking it."),
    bullet("Gentle nudges: if a group stalls, just wander over and drop a hint. Keep "
           "it casual, this is friends and family, not a competition."),
    spacer(6),
    h2("Crafting-Table Door Reload Order"),
    para("Each door is reused for several crafts. Start with the first prop loaded, "
         "then swap in the next one after each craft fires that door (one prop per "
         "slot at a time):"),
    table(
        ["Door", "Load in this order (craft #)"],
        [
            ["Door 0", "Diamond Pickaxe (6)  ->  Spyglass (9)"],
            ["Door 1", "Cobblestone Pickaxe (3)  ->  Torch (7)  ->  TNT (10)"],
            ["Door 2", "MCompass (2)  ->  Fishing Pole (5)  ->  Iron Sword (8)"],
        ],
        [0.22, 0.78],
    ),
    para("(The Crafting Table itself (1) and the Map (4) don't use a door, the table "
         "craft is the tutorial and the map lights up the iPad.)"),

    # ------------------------------------------------------------------ flow
    spacer(8),
    h1("The Game Flow at a Glance"),
    para("Ten crafts drive the adventure. Kids often gather blocks for several steps "
         "at once, so the exact order can wander, but this is the intended spine."),
    num(1, "Crafting Table (tutorial): find 4 oak planks near camp, bring them to us. "
            "We let them into the tent and teach the craft mechanic. Tent holds iron, "
            "sticks, redstone, coal, the Compass recipe, and the chest they'll open at "
            "the very end."),
    num(2, "Compass (4 iron + 1 redstone): crafting it hands them the MCompass plus "
            "the first direction card for waypoint navigation."),
    num(3, "Cobblestone Pickaxe (3 cobblestone + 2 sticks): they gather cobblestone "
            "from the compass waypoints, then craft the pickaxe to unlock the Old Mine."),
    num(4, "Map (8 paper + 1 compass): the big moment. The iPad map \"awakens\" and "
            "the world opens up. The compass block is consumed into the map."),
    num(5, "Fishing Pole (3 sticks + 2 string): string comes from the mine and stream "
            "tacklebox. Lets them fish the stream."),
    num(6, "Diamond Pickaxe (3 diamonds + 2 sticks): diamonds are fished out of the "
            "stream. Unlocks the Ancient Quarry."),
    num(7, "Torch (1 coal + 1 stick): opens the Dark Cave (the bathroom stall)."),
    num(8, "Iron Sword (2 iron + 1 stick): the weapon for the creeper. Iron comes from "
            "the quarry; the sword recipe comes from trading an emerald to the villager."),
    num(9, "Spyglass (1 amethyst + 2 copper): copper from the mine, amethyst from the "
            "villager trade. Used to spot the creeper's hiding spot."),
    num(10, "TNT (5 gunpowder + 4 sand): gunpowder drops from the smashed creeper, sand "
            "from the stream shore. TNT \"blows open\" the treasure chest. Finale!"),
    spacer(4),
    callout("Finale",
            "Kids bring the TNT to the locked chest in the tent. Play the explosion "
            "sound, unlock it, and reveal the 3D-printed Ender Dragon egg plus "
            "candy and treats for everyone."),

    # ------------------------------------------------------------------ map triggers
    pagebreak(),
    h1("Map Reveal Cues"),
    para("The map starts almost blank and fills in as they progress. On the admin "
         "screen, reveal the next markers at these four beats:"),
    table(
        ["When", "Reveal on the map"],
        [
            ["Game start", "Crafting table / start area"],
            ["Map is crafted (step 4)", "Mine, villager, stream, sand, key points"],
            ["Spyglass moment (step 9)", "Creeper location"],
            ["Creeper defeated", "The 5 gunpowder drop locations"],
        ],
        [0.42, 0.58],
    ),

    # ------------------------------------------------------------------ locations
    spacer(10),
    h1("Where Things Are"),
    para("The natural setting doubles as Minecraft biomes. Rough layout:"),
    bullet("Campsite + Tent: home base. Crafting table and the finale chest live here."),
    bullet("Forest (around camp): wood planks and sticks."),
    bullet("Old Mine (bathroom stall, up the hill): paper, string, copper, coal. "
           "Pickaxe required."),
    bullet("Stream: fishing spot for diamonds; sand along the shore."),
    bullet("Ancient Quarry (rocks near camp): iron, emerald. Diamond pickaxe required."),
    bullet("Villager (nearby clearing): trade an emerald for amethyst + sword recipe."),
    bullet("Dark Cave (bathroom): spyglass recipe. Torch required."),
    bullet("Trail / creeper spot: hidden until the spyglass sends them looking."),
    bullet("Treasure chest (in the tent): holds the Ender Dragon egg + treats. Stays "
           "locked and in view the whole game until the TNT craft opens it."),

    # ------------------------------------------------------------------ locked signs
    spacer(8),
    h1("Locked Locations"),
    para("Each of these has a sign and stays \"locked\" until the kids arrive with the "
         "right crafted tool. That's your cue to let them in:"),
    table(
        ["Location", "Requires"],
        [
            ["Explorer Tent", "Crafting Table (the 4 oak planks)"],
            ["Old Mine", "Cobblestone Pickaxe"],
            ["Ancient Quarry", "Diamond Pickaxe"],
            ["Dark Cave", "Torch"],
            ["Creeper", "Iron Sword"],
            ["Treasure Chest", "TNT"],
        ],
        [0.45, 0.55],
    ),

    # ------------------------------------------------------------------ reset
    pagebreak(),
    h1("Running It Twice"),
    para("We plan to run the adventure for two groups. Between runs we reset everything "
         "to its starting state. The short version:"),
    bullet("Collect all the blocks back and re-hide them in the same spots."),
    bullet("Re-stock the tent (iron, redstone, coal, sticks) and re-lock the chest."),
    bullet("Re-stack the creeper boxes (pre-scored, so they snap back together) and "
           "reload the 5 gunpowder + TNT recipe inside the head."),
    bullet("Re-place the fishing container in the stream and reload the journal pages "
           "at each stop."),
    bullet("Reset the map fog and re-hide all markers; reset the crafting table."),
    bullet("Re-lock the chest with a fresh egg + treats inside so it's ready for the "
           "next group."),

    # ------------------------------------------------------------------ safety
    spacer(10),
    h1("Safety Notes"),
    para("Nothing here is risky, but a few things to keep an eye on:"),
    bullet("Stream is ankle-deep only. Fine for fishing, just keep it supervised."),
    bullet("Sword and TNT are foam/props only, nothing that can actually hurt anyone."),
    bullet("The creeper is built to fall apart when hit, not tip onto anyone, but give "
           "it a quick stability check before each run."),
    bullet("Standard outdoor stuff: water, sunscreen, and a glance at the trail for "
           "poison ivy and trip hazards."),
    spacer(8),
    callout("If in doubt",
            "Find the game master. Home base is the tent with the crafting table. When "
            "you're not sure what unlocks next, the recipe cards and the map markers "
            "tell the story."),
]


# ---- Layout engine -----------------------------------------------------------
class Page:
    def __init__(self):
        self.els = []

    def add(self, s):
        self.els.append(s)


pages = [Page()]
y = MT


def new_page():
    global y
    pages.append(Page())
    y = MT


def ensure(space):
    """Start a new page if `space` px won't fit in the remaining column."""
    global y
    if y + space > H - MB:
        new_page()


def draw_text(x, yy, s, size, color, family, weight="normal", extra=""):
    pages[-1].add(
        f'<text x="{x:.1f}" y="{yy:.1f}" font-size="{size}" fill="{color}" '
        f'font-family="{family}" font-weight="{weight}" {extra}>{esc(s)}</text>'
    )


for kind, payload in CONTENT:
    if kind == "pagebreak":
        new_page()
        continue

    if kind == "spacer":
        y += payload
        continue

    if kind == "rule":
        ensure(16)
        pages[-1].add(
            f'<line x1="{ML}" y1="{y:.1f}" x2="{W-MR}" y2="{y:.1f}" '
            f'stroke="{RULE}" stroke-width="1.5"/>'
        )
        y += 14
        continue

    if kind == "h1":
        # generous lead-in so the header separates clearly from prior content,
        # but no extra gap when the header is the first thing on a page
        ensure(64)
        if y > MT:
            y += 30
        # blocky accent square + heading
        pages[-1].add(
            f'<rect x="{ML}" y="{y-13:.1f}" width="13" height="13" fill="{GREEN}" '
            f'stroke="{GREEN_DK}" stroke-width="1"/>'
        )
        draw_text(ML + 22, y, payload, 20, INK, HEAD)
        y += 8
        pages[-1].add(
            f'<line x1="{ML}" y1="{y:.1f}" x2="{W-MR}" y2="{y:.1f}" '
            f'stroke="{RULE}" stroke-width="2"/>'
        )
        y += 22
        continue

    if kind == "h2":
        ensure(40)
        y += 16
        draw_text(ML, y, payload, 14, GREEN_DK, HEAD)
        y += 20
        continue

    if kind == "para":
        lines = wrap(payload, 12.5, CONTENT_W)
        lh = 17
        for ln in lines:
            ensure(lh)
            draw_text(ML, y, ln, 12.5, INK_SOFT, BODY)
            y += lh
        y += 10
        continue

    if kind == "bullet":
        indent = 20
        lines = wrap(payload, 12.5, CONTENT_W - indent)
        lh = 17
        for i, ln in enumerate(lines):
            ensure(lh)
            if i == 0:
                # square minecraft bullet
                pages[-1].add(
                    f'<rect x="{ML+2}" y="{y-8:.1f}" width="7" height="7" '
                    f'fill="{ACCENT}"/>'
                )
            draw_text(ML + indent, y, ln, 12.5, INK_SOFT, BODY)
            y += lh
        y += 4
        continue

    if kind == "num":
        n, txt = payload
        indent = 26
        lines = wrap(txt, 12.5, CONTENT_W - indent)
        lh = 17
        for i, ln in enumerate(lines):
            ensure(lh)
            if i == 0:
                draw_text(ML, y, f"{n}.", 12.5, GREEN_DK, BODY, weight="bold")
            draw_text(ML + indent, y, ln, 12.5, INK_SOFT, BODY)
            y += lh
        y += 8
        continue

    if kind == "callout":
        title, body = payload
        pad = 12
        inner_w = CONTENT_W - 2 * pad
        body_lines = wrap(body, 12, inner_w)
        box_h = pad + 20 + len(body_lines) * 16 + pad
        ensure(box_h + 8)
        top = y
        pages[-1].add(
            f'<rect x="{ML}" y="{top:.1f}" width="{CONTENT_W}" height="{box_h}" '
            f'rx="4" fill="#f2e4c6" stroke="{GREEN}" stroke-width="2"/>'
        )
        pages[-1].add(
            f'<rect x="{ML}" y="{top:.1f}" width="6" height="{box_h}" fill="{GREEN}"/>'
        )
        ty = top + pad + 12
        draw_text(ML + pad + 6, ty, title, 13, GREEN_DK, HEAD)
        ty += 20
        for ln in body_lines:
            draw_text(ML + pad + 6, ty, ln, 12, INK_SOFT, BODY)
            ty += 16
        y = top + box_h + 12
        continue

    if kind == "table":
        cols, rows, widths = payload
        col_x = [ML]
        for wfrac in widths[:-1]:
            col_x.append(col_x[-1] + wfrac * CONTENT_W)
        colw = [f * CONTENT_W for f in widths]
        row_pad = 6
        line_h = 16
        has_header = any(c.strip() for c in cols)

        # pre-wrap every cell to compute row heights
        def cell_lines(txt, w):
            return wrap(txt, 12, w - 12)

        def row_height(cells):
            n = max(len(cell_lines(c, colw[i])) for i, c in enumerate(cells))
            return n * line_h + 2 * row_pad

        # header
        if has_header:
            hh = row_height(cols)
            ensure(hh)
            pages[-1].add(
                f'<rect x="{ML}" y="{y:.1f}" width="{CONTENT_W}" height="{hh}" '
                f'fill="{GREEN}"/>'
            )
            for i, c in enumerate(cols):
                ty = y + row_pad + 12
                for ln in cell_lines(c, colw[i]):
                    draw_text(col_x[i] + 6, ty, ln, 12, "#ffffff", HEAD)
                    ty += line_h
            y += hh

        for r_idx, cells in enumerate(rows):
            rh = row_height(cells)
            ensure(rh)
            bg = "#efe3c8" if r_idx % 2 == 0 else "#e6d6b3"
            pages[-1].add(
                f'<rect x="{ML}" y="{y:.1f}" width="{CONTENT_W}" height="{rh}" '
                f'fill="{bg}"/>'
            )
            for i, c in enumerate(cells):
                ty = y + row_pad + 11
                first_col_bold = (i == 0 and not has_header)
                for ln in cell_lines(c, colw[i]):
                    draw_text(
                        col_x[i] + 6, ty, ln, 12,
                        INK if first_col_bold else INK_SOFT, BODY,
                        weight="bold" if first_col_bold else "normal",
                    )
                    ty += line_h
            y += rh
        # outer border
        # (drawn as a light frame around the whole table would require tracking
        #  start y; skipped for simplicity — striped rows read cleanly on their own)
        y += 10
        continue


# ---- Cover page (prepended) --------------------------------------------------
cover = Page()
cover.add(f'<rect x="0" y="0" width="{W}" height="{H}" fill="#c9b184"/>')
# top grass band
cover.add(f'<rect x="0" y="150" width="{W}" height="150" fill="{GREEN}"/>')
cover.add(f'<rect x="0" y="150" width="{W}" height="16" fill="#54a334"/>')
cover.add(f'<rect x="0" y="292" width="{W}" height="8" fill="{GREEN_DK}"/>')
# title
cover.add(
    f'<text x="{W/2}" y="215" font-size="34" fill="#ffffff" font-family="{HEAD}" '
    f'text-anchor="middle" style="filter: drop-shadow(2px 2px 0 rgba(0,0,0,0.35))">'
    f'CO-HOST BRIEFING</text>'
)
cover.add(
    f'<text x="{W/2}" y="258" font-size="16" fill="#eaffe0" font-family="{HEAD}" '
    f'text-anchor="middle">Minecraft Camping Escape Room</text>'
)
# subtitle block
for i, line in enumerate([
    "A high-level guide to running the event.",
    "Everything you need, none of the wiring diagrams.",
]):
    cover.add(
        f'<text x="{W/2}" y="{360 + i*26}" font-size="14" fill="{INK_SOFT}" '
        f'font-family="{BODY}" text-anchor="middle">{esc(line)}</text>'
    )
# row of craftable item icons, each on a little inventory-slot tile
SLOT = 60
GAP = 12
n_icons = len(COVER_ICONS)
row_w = n_icons * SLOT + (n_icons - 1) * GAP
sx = (W - row_w) / 2
sy = 430
icon_pad = 8  # inset of the pixel art within its slot
for i, name in enumerate(COVER_ICONS):
    tx = sx + i * (SLOT + GAP)
    # slot tile (Minecraft inventory look: light fill, dark border)
    cover.add(
        f'<rect x="{tx:.1f}" y="{sy}" width="{SLOT}" height="{SLOT}" fill="#d8c9a8" '
        f'stroke="{INK}" stroke-width="2"/>'
    )
    cover.add(
        f'<image href="data:image/png;base64,{icon_b64[name]}" '
        f'x="{tx + icon_pad:.1f}" y="{sy + icon_pad}" '
        f'width="{SLOT - 2*icon_pad}" height="{SLOT - 2*icon_pad}" '
        f'image-rendering="pixelated"/>'
    )
cover.add(
    f'<text x="{W/2}" y="640" font-size="12" fill="{INK_SOFT}" font-family="{BODY}" '
    f'text-anchor="middle">Lake Fairfax campsite  -  up to 6 explorers  -  ~75-100 min</text>'
)
pages.insert(0, cover)


# ---- Emit SVG files & convert ------------------------------------------------
svg_files = []
for idx, page in enumerate(pages):
    is_cover = (idx == 0)
    if is_cover:
        bg = ""  # cover paints its own background
        footer = ""
    else:
        bg = (
            f'<rect width="100%" height="100%" fill="url(#planks)" opacity="0.18"/>'
            f'<rect width="100%" height="100%" fill="rgba(226,208,168,0.80)"/>'
        )
        footer = (
            f'<text x="{ML}" y="{H-30}" font-size="9" fill="{STONE}" '
            f'font-family="{BODY}">Minecraft Camping Escape Room - Co-Host Briefing</text>'
            f'<text x="{W-MR}" y="{H-30}" font-size="9" fill="{STONE}" '
            f'font-family="{BODY}" text-anchor="end">Page {idx} of {len(pages)-1}</text>'
        )

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
{bg}
{"".join(page.els)}
{footer}
</svg>'''
    path = os.path.join(SCRIPT_DIR, f"_cohost_p{idx:02d}.svg")
    with open(path, "w") as f:
        f.write(svg)
    svg_files.append(path)

subprocess.run(["rsvg-convert", "-f", "pdf", "-o", OUT] + svg_files,
               check=True, capture_output=True)

if os.environ.get("DEBUG_PNG"):
    for p in svg_files:
        png = p.replace(".svg", ".png")
        subprocess.run(["rsvg-convert", "-f", "png", "-z", "1.5", "-o", png, p],
                       check=True, capture_output=True)

for p in svg_files:
    os.remove(p)

print(f"Done: {OUT}  ({len(pages)} pages incl. cover)")
