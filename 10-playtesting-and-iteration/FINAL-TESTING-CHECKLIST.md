# Final Testing Checklist — 2 Days Out

Event date: **Saturday, Aug 29, 2026** · Checklist as of **Thu, Aug 27**

> **Source of truth:** the authoritative game flow is `../02-puzzle-design/flowchart.md`.
> The game has **10 crafts** (Crafting Table, Compass, Cobblestone Pickaxe, Map,
> Fishing Pole, Diamond Pickaxe, Torch, Iron Sword, Spyglass, TNT). Ignore any
> older references to a 6-craft flow or a diamond shovel / buried egg.

**Priority order:** do the slow, scary tests first (table power endurance +
10-recipe pass today), the full walkthrough tomorrow, and leave field-only
tests (GPS, compass outdoors, fishing in water, chest on cue) for the game-day
dry run.

---

## Tier 1 — Crafting Table (do first, highest risk)

Test powered the way it runs on game day: **DeWalt battery → buck converter**, not USB.

- [x] Power sanity check on DeWalt battery — confirm it powers the full table and lasts one run (~90 min). No need for a 2-hour continuous test; you can power-cycle between runs. Pack a charged spare battery.
- [x] Every block reads on every grid slot (re-run after any transport/re-seat)
- [x] All 10 recipes recognized — craft each in flowchart order:
  - [ ] 1. Crafting Table (4 Oak Planks)
  - [ ] 2. Compass (4 Iron + 1 Redstone) → door 2
  - [ ] 3. Cobblestone Pickaxe (3 Cobblestone + 2 Sticks) → door 0
  - [ ] 4. Map (8 Paper + 1 Compass) → door 1 + iPad activates
  - [ ] 5. Fishing Pole (3 Sticks + 2 String) → door 2
  - [ ] 6. Diamond Pickaxe (3 Diamonds + 2 Sticks) → door 0
  - [ ] 7. Torch (1 Coal + 1 Stick) → door 1
  - [ ] 8. Iron Sword (2 Iron + 1 Stick) → door 2
  - [ ] 9. Spyglass (1 Amethyst + 2 Copper) → door 0
  - [ ] 10. TNT (5 Gunpowder + 4 Sand) → door 1
- [x] Each successful craft: green glow → rainbow sweep → sound → **correct door** opens
- [x] Wrong recipe rejected (red flash, no sound, no door)
- [x] Empty-grid detection: clearing the grid doesn't re-trigger the last craft
- [x] Servo doors — full cycle: craft → door pops past magnets → grab prop → push shut → magnet holds
- [x] Capacitive-touch override pops all 3 doors
- [x] "Reset all doors" command works (between-run reset)
- [x] "Reset Game" command clears persisted recipe state — **required between runs**. Recipe "done" state is saved to flash and survives a power cycle, so a reboot alone does NOT reset progress.
- [x] Vibration motor buzzes on successful craft; MOSFET stays cool

---

## Tier 2 — Fog-of-War Map (digital)

Validate everything except GPS now; GPS is game-day only.

- [x] Admin reveal sequence matches flowchart triggers, nothing leaks early:
  - [ ] Game start → crafting table location
  - [ ] Map crafted → mine, villager, sand, key POIs
  - [ ] Spyglass moment → creeper location
  - [ ] Creeper defeated → gunpowder locations
- [x] Firebase sync: two devices reveal simultaneously, both update in real time
- [x] Persistence: kill and reopen app, fog state restores from Firebase
- [ ] Admin reset clears fog for all connected devices - NOPE
- [x] Map viewport clamps (can't scroll past edges)
- [ ] **Field-only (game day):** GPS tracking at campsite
- [ ] **Field-only (game day):** spotty-connection / localStorage fallback

---

## Tier 3 — Physical Props & Finale

- [x] MCompass charged, calibrated (6 presses + figure-8)
- [ ] **Field-only (game day):** MCompass points north outdoors
- [ ] Fishing rig: magnet holds the waterproof container (3 diamonds + recipe card)
- [ ] **Field-only (game day):** fishing works in the actual stream (backup: hide diamonds on bank)
- [x] Creeper: stacks stably, falls apart when hit, re-stacks fast
- [x] Creeper head loaded: 5 gunpowder + TNT recipe card
- [x] Locked treasure chest opens cleanly on cue (the finale beat)

---

## Tier 4 — Completeness & Packing

- [ ] **Full walkthrough playtest** (wife) — one complete start-to-finish pass
- [ ] All 51 blocks/items bagged by step; counts match flowchart inventory
- [ ] Compass block re-stocked (it's consumed into the Map craft between runs)
- [ ] Direction cards done (3–4 cards — gates the Step 3 compass leg)
- [ ] Candy/treats for the finale
- [ ] 10 recipe cards printed and sorted
- [ ] Explorer's Journal + all 12 journal pages, sorted by station
- [ ] 6 lock-out signs printed

---

## Backups to Stage Before Leaving

- [ ] Spare blocks of each type - NOPE!
- [ ] Screwdriver + phone charger / power bank packed

---

## Game-Day Dry Run (on site, before players arrive)

- [ ] Walk the full route
- [ ] Set up + power on crafting table in tent; re-test all readers once more
- [ ] GPS tracking works at the campsite
- [ ] MCompass points north outdoors
- [ ] Fishing works in the real stream
- [ ] Creeper placement stable but falls when hit
- [ ] Locked chest opens cleanly on cue
- [ ] Hide all blocks by step; place signs; pre-place + hide map markers
