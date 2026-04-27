# Puzzle Design — Notes

Project: 2026-camping-minecraft
Created: 2026-04-18

## Decisions

### Crafting Table Grid
- Full 3x3 grid with PN532 reader per slot (9 readers)
- Slightly recessed slots — small lip on top of flat surface
- 3" × 3" footprint per slot (fits both blocks and items)
- Blocks are 3" tall cubes, items are 1.5" tall slabs — both fit the same grid
- Stretch goal: magnetic door that pops open to dispense crafted item prop

### Table Feedback
- Continuous scanning — ESP32 sweeps all 9 slots every few hundred ms
- Any valid recipe triggers immediately when the pattern is detected — no button, no submit
- Sound effect on successful craft (Minecraft crafting sound via speaker)
- NeoPixel rings glow when blocks are in slots, all go green on valid recipe match
- Game master takes blocks back and hands over physical item + next recipe card
- **No quest order tracking in software** — sequencing is handled physically (kids don't have the blocks for later recipes until earlier steps are completed)
- Table must detect empty grid before it can fire the same recipe again (prevents re-triggering)

### Recipe Grid Patterns

**1. Wooden Pickaxe** (3 wood plank + 2 stick)
```
WPK  WPK  WPK
 _   STK   _
 _   STK   _
```

**2. Fishing Rod** (3 stick + 2 string + 1 iron)
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

**4. TNT** (5 gunpowder + 4 sand)
```
GNP  SND  GNP
SND  GNP  SND
GNP  SND  GNP
```

**5. Compass** (4 iron + 1 redstone)
```
 _   IRN   _
IRN  RED  IRN
 _   IRN   _
```

**6. Diamond Shovel** (1 diamond + 2 stick)
```
 _   DIA   _
 _   STK   _
 _   STK   _
```

### Block & Item Inventory

**Blocks (3" × 3" × 3" cubes):**

| Type | Tag ID | Color | Qty | Spares | Total |
|---|---|---|---|---|---|
| Wood Plank | `wood_plank` | Brown | 7 (4 trade + 3 pickaxe) | 1 | 8 |
| Gold Ingot | `gold_ingot` | Yellow/gold | 2 | 1 | 3 |
| Gunpowder | `gunpowder` | Dark grey/black | 5 | 0 | 5 |
| Sand | `sand` | Tan/beige | 4 | 1 | 5 |
| **Block subtotal** | | | **18** | **3** | **21** |

**Items (3" × 3" × 1.5" flat slabs):**

| Type | Tag ID | Color | Qty | Spares | Total |
|---|---|---|---|---|---|
| Stick | `stick` | Tan/light brown | 8 (2+3+1+2) | 2 | 10 |
| Iron Ingot | `iron_ingot` | Silver/grey | 5 (1 rod + 4 compass) | 1 | 6 |
| String | `string` | White | 2 | 1 | 3 |
| Redstone | `redstone` | Red | 1 | 1 | 2 |
| Diamond | `diamond` | Light blue | 1 | 1 | 2 |
| **Item subtotal** | | | **17** | **6** | **23** |

**Grand total: 21 blocks + 23 items = 44 pieces to print**

### Where Blocks Are Found

| Step | Source | Blocks/Items Found |
|---|---|---|
| Start | Forest/nearby | 4 wood plank (trade for crafting table) |
| Step 1 | Crafting room + nearby | 3 wood plank, 2 stick (some pre-placed, rest on map) |
| Step 1 | Mine (bathroom) | 1 iron, 2 string |
| Step 2 | Stream fishing | 2 gold |
| Step 3 | Creeper loot | 5 gunpowder |
| Ongoing | Scattered around campsite | 4 sand, extra sticks |
| Step 4 | TNT chest | 1 diamond, 1 redstone, 4 iron |
| Step 5 | Already found | sticks from forest |

### Recipe Cards
- 6 recipe cards total (one per craft)
- Scroll format — rolled parchment-style paper
- Printed Minecraft 3x3 grid pattern showing which blocks go where
- Recipe Card #1 given with crafting table
- #2 revealed after pickaxe craft
- #3 found with gold in stream container
- #4 found in creeper loot
- #5 and #6 found in TNT chest

### Creeper
- Adult height (~5–6 feet) — 4 stacked cardboard boxes painted creeper green
- Iconic face on the top box (head)
- Loot inside head box — 5 gunpowder blocks + Recipe Card #4 (TNT)
- Pre-scored tape so it falls apart on a sword hit
- Easy to re-stack for second run

### TNT Chest
- Locked/chained chest or box with "⚠ TNT Required" sign
- Kids craft TNT, bring it to the chest
- Game master plays explosion sound, removes chain/tape
- Inside: diamond, redstone, 4 iron ingots, Recipe Cards #5 + #6

## Open Questions
- Exact creeper box dimensions (what sizes stack to ~5.5 feet?)
- Recipe card template design
- TNT chest design — what container, how to lock it
- Whether to reuse stick blocks across recipes (saves prints) or keep all unique
- Magnetic door mechanism for crafting table (stretch goal)
