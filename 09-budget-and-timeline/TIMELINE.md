# Build Timeline — Target: Mid-July 2026

~11 weeks from late April. Assumes evenings/weekends, ~5-10 hrs/week.

## Phase 1: Order Everything (Week 1 — Apr 28)

Do this NOW so shipping doesn't block you later.

- [x] Order remaining electronics (PCA9685, 3 servos, 3 reed switch modules, 5V servo power supply)
- [ ] Order crafting table lumber & hardware (2×6s, plywood, aluminum angle/flat bar, hinges, wood rods)
- [ ] Order crafting table finishing (pleather, frosted acrylic)
- [ ] Order PLA filament (1-2 spools black)
- [x] Order matte clear coat spray
- [ ] Order spray paint (diamond blue/teal, green)
- [ ] Order parchment paper
- [ ] Order 1/4" plywood sheet for wooden props (sword, pickaxe, shovel, fishing rod)
- [o] Source foam gold sword (ask friends, Amazon backup)
- [ ] Source cardboard boxes for creeper (grocery store)
- [x] Get a working ESP32 dev board
- [ ] Get a map device — iPad mini 4+ or use phones

## Phase 2: 3D Print Test + Block Design (Weeks 2-3 — May 5-16)

Get the printing pipeline working before committing to 44 blocks.

- [ ] Design block model (3"×3"×3" cube with NTAG215 cavity)
- [ ] Design item model (3"×3"×1.5" slab with NTAG215 cavity)
- [ ] Test print 1 block + 1 item with embedded NFC tag
- [ ] Test NFC read range through the printed plastic
- [ ] Design texture sheets for each block type
- [ ] Test print textures on vinyl sticker paper, apply to test block
- [ ] Clear coat test — verify stickers hold up

## Phase 3: Crafting Table Build (Weeks 3-6 — May 12 - Jun 8)

This is the biggest single build. Start as soon as lumber arrives.

- [ ] Design table dimensions (kid height, nightstand-sized)
- [ ] Build frame from 2×6 lumber
- [ ] Build top surface with 3×3 recessed grid
- [ ] Cut frosted acrylic for grid surface
- [ ] Mount 9× PN532 + NeoPixel ring units under grid slots
- [ ] Install copper tape shielding between slots
- [ ] Wire everything to ESP32 (I2C multiplexer, NeoPixel chain, DFPlayer)
- [ ] Test NFC read range through acrylic
- [ ] Cut door openings, install hinges, build door blocks
- [ ] Mount 3 servos with 3D-printed brackets + latch tabs
- [ ] Wire servo driver (PCA9685) + reed switches
- [ ] Route all wiring inside table
- [ ] Wrap/finish table with pleather
- [ ] Test all 9 reader slots

## Phase 4: ESP32 Firmware (Weeks 4-6 — May 19 - Jun 8)

Can overlap with table build — write firmware while waiting for glue to dry.

- [ ] Sequential I2C scanning of 9 PN532 readers
- [ ] NFC tag reading + block type parsing
- [ ] Recipe matching (6 recipes)
- [ ] NeoPixel feedback (white=detected, green=valid, rainbow=success)
- [ ] Sound playback via DFPlayer on successful craft
- [ ] Servo door control (open on craft, reed switch auto-close)
- [ ] Empty-grid detection (prevent re-triggering)
- [ ] Tag registration/writing mode
- [ ] Download Minecraft sound effects, load onto SD card

## Phase 5: Mass Print Blocks (Weeks 4-8 — May 19 - Jun 22)

Runs in background — start prints before bed, finish in morning.

- [ ] Print 21 blocks (cubes) — ~3 per overnight print = 7 nights
- [ ] Print 23 items (slabs) — ~4-5 per overnight print = 5 nights
- [ ] Print Ender Dragon egg
- [ ] Print servo brackets + latch tabs (3 sets)
- [ ] Print wooden pickaxe prop (if doing it)
- [ ] Write NFC tags for all blocks using registration program
- [ ] Apply vinyl sticker textures to all blocks
- [ ] Clear coat all blocks

## Phase 6: Props & Recipe Cards (Weeks 7-8 — Jun 8-22)

Quick builds, mostly crafting/painting.

- [ ] Design + print 6 recipe cards (3×3 grid format)
- [ ] Tea-stain parchment, roll into scrolls
- [ ] Build fishing rod (stick + string + magnet)
- [ ] Paint diamond shovel
- [ ] Paint creeper boxes (green + black face)
- [ ] Pre-score creeper tape for easy collapse
- [ ] Cut wooden props from plywood using stencils (sword, pickaxe, shovel, rod)
- [ ] Sand edges smooth on all wooden props
- [ ] Apply vinyl sticker textures to both faces of each prop
- [ ] Paint edges with matching colors (gold for sword, brown for pickaxe handle, etc.)
- [ ] Clear coat wooden props
- [ ] Write explorer's diary entry
- [ ] Prep TNT chest (container + chain + sign)
- [ ] Prep buried treasure containers (2×, dragon egg + candy)
- [ ] Make mine sign + biome signs

## Phase 7: MCompass Setup (Week 8 — Jun 15-22)

- [ ] Flash GPS-WIFI firmware
- [ ] Configure WiFi + set spawn point to dig site coordinates
- [ ] Test compass pointing accuracy outdoors
- [ ] Calibrate (6 quick presses, figure-8 motion)

## Phase 8: Integration Testing (Weeks 8-9 — Jun 15-29)

Everything comes together.

- [ ] Test every block on every grid slot
- [ ] Test all 6 recipes end-to-end
- [ ] Test wrong recipe rejection
- [ ] Test servo doors: craft → door opens → grab prop → push shut → re-latches
- [ ] Test all sounds (crafting, creeper, explosion, victory)
- [ ] Load fog map on iPad, test GPS tracking
- [ ] Place test markers on fog map
- [ ] Test MCompass pointing to a known location
- [ ] Full dry run of game flow at home (wife playtest)

## Phase 9: Sound & Atmosphere (Week 9 — Jun 22-29)

- [ ] Load sounds onto DFPlayer SD card
- [ ] Install soundboard app on phone
- [ ] Create Minecraft soundtrack playlist
- [ ] Test Bluetooth speaker

## Phase 10: Pre-Trip Prep (Week 10 — Jun 29 - Jul 6)

- [ ] Pack everything per checklist
- [ ] Prep two dig sites worth of supplies
- [ ] Charge all devices (power banks, iPad, MCompass)
- [ ] Final fog map check — correct region loaded, fog cleared
- [ ] Print backup recipe cards

## Phase 11: Game Day (Mid-July)

- [ ] Walk route, check hazards
- [ ] Set up crafting table in tent
- [ ] Hide all blocks by biome
- [ ] Set up creeper, TNT chest
- [ ] Bury treasure
- [ ] Place markers on fog map
- [ ] Start music, load soundboard
- [ ] Run game!
- [ ] Reset between runs

---

## Critical Path (things that block other things)

1. **Working ESP32** → blocks all firmware + electronics work
2. **NFC test print** → blocks mass printing (need to verify read range first)
3. **Table frame** → blocks electronics mounting, door installation
4. **Firmware** → blocks recipe testing, door testing
5. **All blocks printed + tagged** → blocks full integration test

## What Can Run in Parallel

- 3D printing (overnight) + table build (daytime)
- Firmware development + table build
- Props/painting + everything else
- Fog map markers + any time after site visit
