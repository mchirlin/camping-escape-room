# Puzzle Design — Notes

Project: 2026-camping-minecraft
Created: 2026-04-18

## Decisions

### Crafting Table Grid
- Full 3x3 grid with PN532 reader per slot (9 readers)
- Slightly recessed slots — small lip on top of flat surface
- 3-inch cube blocks

### Table Feedback
- Continuous scanning — ESP32 sweeps all 9 slots every few hundred ms
- Any valid recipe triggers immediately when the pattern is detected — no button, no submit
- Sound effect on successful craft (Minecraft crafting sound via speaker)
- NeoPixel rings glow when blocks are in slots, all go green on valid recipe match
- Screen or tablet showing the crafted item (stretch goal)
- Game master takes blocks back and hands over physical item + next recipe scroll
- **No quest order tracking in software** — sequencing is handled physically (kids don't have the blocks for later recipes until earlier steps are completed)
- Table must detect empty grid before it can fire the same recipe again (prevents re-triggering)

### Blocks
- 3-inch cubes, black PLA, spray painted
- Primer (grey/white) then color coat, clear matte sealer
- NTAG215 coin tags embedded mid-print (cavity near bottom, pause at layer, drop in, resume)
- Block type written to tag data (Option B) — no UID lookup table needed
- Registration program on ESP32 to write block types to tags

### Recipe Grid Patterns

**1. Wooden Pickaxe** (3 wood plank + 2 stick)
```
WPK  WPK  WPK
 _   STK   _
 _   STK   _
```

**2. Fishing Rod** (2 stick + 2 string + 1 iron)
```
 _    _   STK
 _   STK  STR
IRN   _   STR
```

**3. Gold Sword** (2 gold + 1 stick)
```
 _   GLD   _
 _   GLD   _
 _   STK   _
```

**4. Map** (8 paper + 1 compass)
```
PPR  PPR  PPR
PPR  CMP  PPR
PPR  PPR  PPR
```

**5. Diamond Shovel** (1 diamond + 2 stick)
```
 _   DIA   _
 _   STK   _
 _   STK   _
```

### Block Inventory

| Block Type | Tag ID | Color | Qty | Spares | Total Print |
|---|---|---|---|---|---|
| Wood Plank | `wood_plank` | Brown | 3 | 1 | 4 |
| Stick | `stick` | Tan/light brown | 7 | 2 | 9 |
| Iron Ingot | `iron_ingot` | Silver/grey | 1 | 1 | 2 |
| String | `string` | White | 2 | 1 | 3 |
| Gold Ingot | `gold_ingot` | Yellow/gold | 2 | 1 | 3 |
| Paper | `paper` | Cream/off-white | 8 | 1 | 9 |
| Compass | `compass` | Red/grey | 1 | 1 | 2 |
| Diamond | `diamond` | Light blue | 1 | 1 | 2 |
| **Totals** | | | **25** | **9** | **34** |

34 blocks to print. ~2–3 per overnight print = done in under 2 weeks.

### Recipe Cards
- Scroll format — rolled parchment-style paper
- Printed Minecraft 3x3 grid pattern showing which blocks go where
- Each successful craft → game master hands over next scroll

### Map Output
- Hand-drawn on tea-stained parchment paper
- X marks the dig site
- Written directions on the back

### Creeper
- Adult height (~5–6 feet) — 4 stacked cardboard boxes painted creeper green
- Iconic face on the top box (head)
- Loot inside head box — paper blocks + compass block spill out
- Pre-scored tape so it falls apart on a sword hit
- Easy to re-stack for second run

## Open Questions
- Exact creeper box dimensions (what sizes stack to ~5.5 feet?)
- Recipe scroll template design
- Whether to reuse stick blocks across recipes (saves 5 prints) or keep all unique
