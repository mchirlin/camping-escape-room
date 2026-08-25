# Puzzle Design — Notes

Project: 2026-camping-minecraft
Updated: 2026-08-22

## Decisions

### Crafting Table Grid
- Full 3x3 grid with PN532 reader per slot (9 readers)
- Slightly recessed slots — small lip on top of flat surface
- 3" x 3" footprint per slot (fits both blocks and items)
- Blocks are 3" tall cubes, items are 1.5" tall slabs — both fit the same grid
- 3 servo-controlled doors that pop open to dispense crafted item props

### Table Feedback
- 2-second capacitive touch hold triggers recipe evaluation
- Sound effect on successful craft (via DFPlayer Mini speaker)
- NeoPixel rings glow with block-type color when placed, rainbow sweep on success, red flash on fail
- Vibration motor buzzes on craft (3 pulses success, 1 pulse fail)
- Servo door pops open to reveal the crafted prop
- Table detects empty grid before it can fire the same recipe again

### Door Assignments
- **Door 0 (GPIO 4):** Pickaxes (Stone, Diamond)
- **Door 1 (GPIO 16):** Fishing Rod, Iron Sword, TNT
- **Door 2 (GPIO 17):** Compass, Torch, Spyglass
- **No door:** Crafting Table, Map (iPad activates instead)

### Recipe Grid Patterns (storyline order)

**0. Crafting Table** (4 wood plank — any 2x2 corner, no door)
```
WPK  WPK   _        _   WPK  WPK
WPK  WPK   _        _   WPK  WPK
 _    _    _         _    _    _
```

**1. Compass** (4 iron + 1 redstone, door 2)
```
 _   IRN   _
IRN  RED  IRN
 _   IRN   _
```

**2. Cobblestone Pickaxe** (3 cobblestone + 2 stick, door 0)
```
COB  COB  COB
 _   STK   _
 _   STK   _
```

**3. Map** (8 paper + 1 compass, no door)
```
PAP  PAP  PAP
PAP  CMP  PAP
PAP  PAP  PAP
```

**4. Fishing Rod** (3 stick + 2 string, door 1)
```
 _    _   STK
 _   STK  STR
STK   _   STR
```

**5. Diamond Pickaxe** (3 diamond + 2 stick, door 0)
```
DIA  DIA  DIA
 _   STK   _
 _   STK   _
```

**6. Torch** (1 coal + 1 stick, door 2)
```
 _   COL   _
 _   STK   _
 _    _    _
```

**7. Iron Sword** (2 iron + 1 stick, door 1)
```
 _   IRN   _
 _   IRN   _
 _   STK   _
```

**8. Spyglass** (1 amethyst + 2 copper, door 2)
```
 _   AME   _
 _   COP   _
 _   COP   _
```

**9. TNT** (5 gunpowder + 4 sand, door 1)
```
GNP  SND  GNP
SND  GNP  SND
GNP  SND  GNP
```

### Block & Item Inventory (54 pieces)

| Type | Qty | Form | Where Found |
|------|-----|------|-------------|
| Stick | 11 | Item slab | Scattered everywhere |
| Paper | 8 | Item slab | Old Mine |
| Iron Ingot | 6 | Item slab | 4 tent + 2 quarry |
| Gunpowder | 5 | Item slab | Creeper drop |
| Wood Plank | 4 | Block cube | Start area |
| Sand | 4 | Block cube | Stream shore |
| Diamond | 3 | Item slab | Stream fishing |
| Cobblestone | 3 | Block cube | Waypoint chest |
| String | 3 | Item slab | 2 waypoint chest + 1 mine |
| Copper Ingot | 2 | Item slab | Old Mine |
| Redstone | 1 | Item slab | Tent pillow |
| Coal | 1 | Item slab | Tent pillow |
| Compass | 1 | Item slab | Crafted, then consumed into Map |
| Emerald | 1 | Item slab | Ancient Quarry (villager trade) |
| Amethyst Shard | 1 | Item slab | Ancient Quarry |

### Creeper
- Adult height (~5-6 feet) — 4 stacked cardboard boxes painted creeper green
- Iconic face on the top box (head)
- Loot inside head box — 5 gunpowder blocks + Journal Page (TNT recipe)
- Pre-scored tape so it falls apart on a sword hit
- Easy to re-stack for second run

### Treasure Chest
- Locked box inside the tent (visible from Step 1)
- "💥 TNT Required" sign
- Kids craft TNT, bring it to the chest
- Game master plays explosion sound, unlocks it
- Inside: Ender Dragon Egg + candy/treats

### Recipe Scrolls (Journal Pages)
- 12 journal pages total found throughout the adventure
- Tea-stained parchment paper, rolled into scroll format
- Each contains a recipe grid and/or story lore
- Pages are added to the Explorer's Journal as kids find them

## Physical Props Needed
- Cobblestone Pickaxe (painted plywood cutout)
- Diamond Pickaxe (painted plywood cutout)
- Fishing Pole (stick + string + magnet)
- Torch (stick + painted foam/paper)
- Iron Sword (painted plywood cutout)
- Spyglass (cardboard tube, painted copper/purple)
- TNT (3D printed or cardboard box, painted red/white)
- MCompass (points north — for direction card navigation)
- Explorer's Journal (notebook with starter pages)
- Ender Dragon Egg (3D printed keepsake)
