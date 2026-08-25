# Theme & Narrative — Notes

Project: 2026-camping-minecraft
Created: 2026-04-18
Updated: 2026-08-25

> **Source of truth for the step-by-step flow:** `02-puzzle-design/flowchart.md`.
> This file covers theme, story, and tone. If the two ever disagree, the
> flowchart wins — it tracks the current 10-craft design.

## Setting
- Lake Fairfax park campsite
- Real outdoor campsite with rocks, streams, trail loop, trees, bathrooms
- Natural "biomes": trees = forest, rocks = mountains, stream = river/ocean, bathroom = abandoned mine

## Audience & Tone
- Kids ages 7–10, up to 6 kids
- Friends and family, not commercial
- Adventurous, silly, fun — not scary
- ~75–100 minutes

## Story
An Ender Dragon egg has been detected hidden somewhere near the campsite. A
lost explorer tracked it down, then vanished — all they left behind is a diary.
The kids are Minecraft explorers who pick up the trail. They start with nothing
but the diary and have to explore the biomes, collect blocks, and craft their
way to the locked treasure chest one tool at a time.

## Core Mechanic
- **Core principle:** kids start with nothing but a diary. Every tool is crafted before it can be used.
- 3D-printed blocks with RFID tags hidden across the campsite in biome-appropriate spots
- One RFID crafting table as the tech centerpiece (ESP32 powered, battery) — **this is the kids' first craft**, not something handed to them
- Recipes are gated — each successful craft unlocks the next location, clue, or recipe card
- **Fog-of-war map (1–2 iPads/phones)** — *crafted mid-game* (Map recipe: 8 paper + 1 compass), not given at the start. Once crafted it "awakens," reveals terrain as kids walk, and the game master progressively shows locations/markers on it.
- **MCompass** — crafted early (Compass recipe, step 2). Points north for direction-card waypoint navigation.
- Game master controls what appears on the map at each stage
- Game master acts as an "NPC" to verify tool-gated locations and hand out props/journal pages

## The Game Flow (summary)

The adventure is a chain of **10 crafts**. Kids often gather ingredients for
several steps at once, so the exact order can wander, but this is the intended
spine. See `02-puzzle-design/flowchart.md` for the full step-by-step (loot at
each location, "aha" moments, admin map triggers, and journal pages).

1. **Crafting Table** (4 oak planks) — the tutorial. Find planks near camp → unlocks the tent and teaches the craft mechanic.
2. **Compass** (4 iron + 1 redstone) — grants the MCompass + first direction card.
3. **Cobblestone Pickaxe** (3 cobblestone + 2 stick) — unlocks the Old Mine.
4. **Map** (8 paper + 1 compass) — the iPad fog map awakens; world opens up. (Compass block is consumed.)
5. **Fishing Pole** (3 stick + 2 string) — lets them fish the stream.
6. **Diamond Pickaxe** (3 diamond + 2 stick) — unlocks the Ancient Quarry.
7. **Torch** (1 coal + 1 stick) — opens the Dark Cave.
8. **Iron Sword** (2 iron + 1 stick) — the weapon for the creeper.
9. **Spyglass** (1 amethyst + 2 copper) — spot the creeper's hiding spot.
10. **TNT** (5 gunpowder + 4 sand) — blows open the locked treasure chest. Finale.

## Finale
- Locked treasure chest sits in the tent, visible the whole game ("💥 TNT Required" sign)
- Kids craft TNT and bring it to the chest — game master plays the explosion sound and unlocks it
- Inside: 3D-printed Ender Dragon egg (painted, keepsake) + treats/prizes for everyone

## Adventure Arc
Craft → Navigate → Mine → Map → Fish → Explore → Trade → Fight → Blast → Treasure

## Tools the Kids Carry
- **Explorer's Journal** — handed out at the very start with the Crafting Table recipe card. Pure story flavor; pages are added as rewards along the way.
- **MCompass** — crafted at step 2. Points north for direction-card navigation.
- **Fog Map (1–2 devices)** — crafted at step 4 (Map recipe). Minecraft-style terrain with fog of war and real-time GPS tracking. Game master reveals locations/markers as the kids progress.

## Stretch Goals
- Magnetic/servo door on crafting table that pops open to dispense the crafted item prop when a recipe is correct
- NFC block scanning for setup mode (tap block to phone → auto-place marker on map)

## Extras
- Minecraft fox stuffed animal hidden somewhere, holding a hint to a hard-to-find block
- Villager (Ronny) trade: emerald → amethyst + Iron Sword recipe

## Open Questions
- Exact block hiding locations — need a site walkthrough
- Specific creeper placement along the trail
- Second locked chest / reset kit for the double run
