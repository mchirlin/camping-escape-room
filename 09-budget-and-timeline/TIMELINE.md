# Build Timeline — Target: Mid-July 2026

~10 weeks from early May. Assumes evenings/weekends, ~5-10 hrs/week.

## Phase 1: Order Everything (Week 1 — Apr 28)

Do this NOW so shipping doesn't block you later.

**Electronics:**
- [x] 3 servos (SG90)
- [x] 5V 10A buck converter (DeWalt 20V → 5V)
- [x] DeWalt 20V battery adapter with terminals
- [x] IRFZ44N MOSFET TO-220
- [x] JST-XH connectors (4-pin headers x9, 3-pin headers x4)
- [x] Screw terminals (2-pin 5.08mm x3)
- [x] Pin sockets (1x15 x2, 1x12 x4, 1x8 x2)
- [ ] Barrel jack (PJ-002A, 5.5x2.1mm horizontal THT)
- [ ] 1000µF 10V electrolytic cap (Rubycon 10ZLH1000MEFC10X12.5)
- [x] Resistor kit (10kΩ, 4.7kΩ x2, 300Ω, 1kΩ — axial through-hole)
- [x] 1N5819 Schottky diode DO-41
- [x] Pin header 1x9
- [x] JST-XH housings + crimp contacts (for making cables)
- [x] Power toggle switch (SPST, 5V/3A)
- [x] Vibration motor

**PCBs:**
- [ ] Generate Gerbers — motherboard
- [ ] Generate Gerbers — daughter board
- [ ] Order from JLCPCB (5 motherboards, 10 daughter boards)

**Remaining parts (Mouser cart — order after breadboard testing):**
- https://www.mouser.com/account/projects
- Barrel jack, 1000µF cap, resistors, 1N5819 diode, pin header 1x9, JST-XH housings + crimp contacts

**Crafting Table Lumber & Hardware:**
- [ ] 2×6 lumber × 4' (16 pieces)
- [ ] Plywood 2'×2' × 1/8" (4 pieces)
- [ ] Aluminum angle 1.5" × 4' × 1/8" thick (2 pieces)
- [ ] Aluminum flat bar 1.5" × 8' × 1/8" thick (1 piece)
- [ ] 1"×1" wood rods, 4' total
- [x] 3 piano hinges (for doors)
- [x] 3-6 ball catches (for doors)
- [ ] Wood/MDF for door blocks (3 pieces, 2"×5"×9")

**Crafting Table Finishing:**
- [x] 2.5' square of camel pleather
- [x] 3" strips of dark brown pleather
- [ ] 1'×1' frosted acrylic
- [ ] Danish oil (for wood planks — natural finish)
- [ ] Watered-down acrylic paints (for pixel color variation on planks)
- [ ] Wood stain — dark (espresso) for plywood backing panels

**3D Printing Supplies:**
- [ ] Black PLA filament (1-2 spools)
- [x] Matte clear coat spray

**Paint & Paper:**
- [ ] Spray paint — diamond blue/teal
- [ ] Spray paint — green (creeper)
- [ ] Parchment paper

**Props:**
- [ ] 1/4" plywood sheet (for wooden prop cutouts)
- [ ] Cardboard boxes for creeper (free — grocery store)
- [ ] Waterproof container for buried treasure
- [ ] Waterproof container for TNT chest
- [ ] Chain or tape for TNT chest lock
- [ ] Candy/treats for finale
- [ ] Foam board for signs

**Other:**
- [x] Get a working ESP32 dev board
- [ ] Get a map device (iPad mini 4+ or use phones)
- [x] Source foam gold sword (ask friends, Amazon backup)

## Phase 2: PCB Design + 3D Print Test (Weeks 2-3 — May 5-16)

**PCB Design (DONE):**
- [x] Design motherboard schematic in KiCad
- [x] Route motherboard traces
- [x] Design daughter board schematic in KiCad
- [x] Route daughter board traces
- [x] All through-hole design (no SMD)
- [x] NeoPixel ring pad placement (6x 1x1 pins, 30° apart on 32mm radius)

**Breadboard Testing (while waiting for PCBs):**
- [x] Test NeoPixel ring — working (red/green/blue/white cycle)
- [x] Test servo — working (sweep 0°-180° on GPIO 4)
- [x] Test DFPlayer + speaker — working (plays MP3 from SD card)
- [x] Test PCA9548A + PN532 — working (I2C scan + tag read via multiplexer)
- [x] Test capacitive touch — working (touchRead on GPIO 27/33)
- [x] Fixed SDA/SCL swap in KiCad schematic
- [ ] Test vibration motor circuit (IRFZ44N + 1N5819 + motor) — waiting for parts
- [ ] Wire DeWalt → buck converter → verify 5V output under load

**3D Print Pipeline:**
- [ ] Design block model (3"×3"×3" cube with NTAG215 cavity)
- [x] Design item model (3"×3"×1.5" slab with NTAG215 cavity)
- [ ] Test print 1 block with embedded NFC tag
- [x] Test print 1 item with embedded NFC tag
- [ ] Test NFC read range through the printed plastic
- [x] Design texture sheets for each block type
- [x] Test print textures on vinyl sticker paper
- [x] Apply stickers to test block
- [ ] Clear coat test — verify stickers hold up

## Phase 3: PCB Assembly + Crafting Table Build (Weeks 3-6 — May 12 - Jun 8)

This is the biggest single build. PCBs should arrive ~May 18.

**PCB Assembly (when boards arrive):**
- [ ] Solder all sockets, resistors, cap, connectors to motherboard
- [ ] Solder JST connectors and NeoPixel ring pads to 9 daughter boards
- [ ] Solder PN532 modules directly to daughter boards
- [ ] Plug in ESP32, PCA9548A breakouts, DFPlayer to motherboard
- [ ] Test motherboard — power, I2C bus, NeoPixel, DFPlayer, servos
- [ ] Test each daughter board individually
- [ ] Make 9x JST-XH 4-pin I2C cables
- [ ] Make 3x JST-XH 3-pin servo extension cables
- [ ] Make 1x JST-XH 3-pin NeoPixel data cable
- [ ] Run 18AWG power bus wires for NeoPixel rings (direct from buck converter)

**Frame & Surface:**
- [ ] Design table dimensions (kid height, nightstand-sized)
- [ ] Build frame from 2×6 lumber
- [ ] Build top surface with 3×3 recessed grid
- [ ] Cut frosted acrylic for grid surface

**Electronics Mounting:**
- [ ] Mount motherboard PCB inside table
- [ ] Mount 9× daughter boards under grid slots (PN532 + NeoPixel ring per slot)
- [ ] Install copper tape shielding between slots
- [ ] Connect I2C cables from motherboard to daughter boards
- [ ] Connect NeoPixel data cable from motherboard to first ring
- [ ] Run NeoPixel power bus (18AWG from buck converter to rings)
- [ ] Wire DFPlayer speaker output to speaker
- [ ] Wire servo extension cables to servos
- [ ] Wire DeWalt adapter → buck converter → motherboard barrel jack + NeoPixel bus
- [ ] Test NFC read range through acrylic

**Doors:**
- [ ] Cut door openings in table
- [ ] Install piano hinges at bottom of each door opening
- [ ] Build 3 door blocks
- [ ] Install ball catches on each door
- [ ] 3D print 3 servo mounting brackets
- [ ] Mount 3 servos inside table with brackets
- [ ] 3D print servo arm push extensions
- [ ] Wire 3 servos to ESP32 GPIO pins
- [ ] Test servo push opens door past ball catch
- [ ] Test door clicks shut when pushed closed

**Finishing:**
- [ ] Route all wiring inside table
- [ ] Wrap/finish table with pleather
- [ ] Test all 9 reader slots

## Phase 4: ESP32 Firmware (Weeks 4-6 — May 19 - Jun 8)

Can overlap with table build — write firmware while waiting for glue to dry.

- [ ] Sequential I2C scanning of 9 PN532 readers
- [ ] NFC tag reading + block type parsing
- [ ] Recipe matching (6 recipes)
- [ ] NeoPixel feedback — white glow when block detected
- [ ] NeoPixel feedback — green glow on valid recipe
- [ ] NeoPixel feedback — rainbow sweep on successful craft
- [ ] Sound playback via DFPlayer on successful craft
- [ ] Servo door control — push open on craft
- [ ] Servo door control — return to rest after push
- [ ] Empty-grid detection (prevent re-triggering)
- [ ] Tag registration/writing mode
- [ ] Download Minecraft sound effects
- [ ] Load sounds onto DFPlayer SD card

## Phase 5: Mass Print Blocks (Weeks 4-8 — May 19 - Jun 22)

Runs in background — start prints before bed, finish in morning.

**Blocks (3"×3"×3" cubes):**
- [ ] Wood Plank × 8
- [ ] Gold Ingot × 3
- [ ] Gunpowder × 5
- [ ] Sand × 5

**Items (3"×3"×1.5" slabs):**
- [ ] Stick × 10
- [ ] Iron Ingot × 6
- [ ] String × 3
- [ ] Redstone × 2
- [ ] Diamond × 2

**Other Prints:**
- [ ] Ender Dragon egg
- [ ] 3 servo mounting brackets
- [ ] 3 servo arm push extensions

**Finishing:**
- [ ] Write NFC tags for all blocks using registration program
- [ ] Print vinyl sticker textures for all blocks
- [ ] Cut stickers to size
- [ ] Apply stickers to all blocks
- [ ] Apply stickers to all items
- [ ] Clear coat all blocks
- [ ] Clear coat all items

## Phase 6: Props & Recipe Cards (Weeks 7-8 — Jun 8-22)

Quick builds, mostly crafting/painting.

**Recipe Cards:**
- [ ] Design recipe card template (3×3 grid format)
- [ ] Print recipe card #1 — Wooden Pickaxe
- [ ] Print recipe card #2 — Fishing Rod
- [ ] Print recipe card #3 — Gold Sword
- [ ] Print recipe card #4 — TNT
- [ ] Print recipe card #5 — Compass
- [ ] Print recipe card #6 — Diamond Shovel
- [ ] Tea-stain parchment paper
- [ ] Roll cards into scroll format

**Wooden Props (cut from plywood):**
- [ ] Print stencils for sword, pickaxe, shovel, fishing rod
- [ ] Cut gold sword from plywood
- [ ] Cut wooden pickaxe from plywood
- [ ] Cut diamond shovel from plywood
- [ ] Cut fishing rod from plywood
- [ ] Sand edges smooth on all props
- [ ] Print vinyl textures for each prop
- [ ] Apply vinyl to both faces of sword
- [ ] Apply vinyl to both faces of pickaxe
- [ ] Apply vinyl to both faces of shovel
- [ ] Apply vinyl to both faces of fishing rod
- [ ] Paint edges with matching colors
- [ ] Clear coat all wooden props

**Other Props:**
- [ ] Build fishing rod (stick + string + magnet)
- [ ] Paint diamond shovel (real garden shovel, blue/teal)
- [ ] Paint creeper boxes green
- [ ] Paint creeper face (black) on top box
- [ ] Pre-score creeper tape for easy collapse
- [ ] Write explorer's diary entry
- [ ] Prep TNT chest (container + chain + sign)
- [ ] Prep buried treasure container #1 (dragon egg + candy)
- [ ] Prep buried treasure container #2 (dragon egg + candy)
- [ ] Make "Abandoned Mine" sign
- [ ] Make "TNT Required" sign
- [ ] Make biome signs (optional)

## Phase 7: MCompass Setup (Week 8 — Jun 15-22)

- [ ] Flash GPS-WIFI firmware
- [ ] Configure WiFi
- [ ] Set spawn point to dig site coordinates
- [ ] Test compass pointing accuracy outdoors
- [ ] Calibrate (6 quick presses, figure-8 motion)

## Phase 8: Integration Testing (Weeks 8-9 — Jun 15-29)

Everything comes together.

- [ ] Test every block on every grid slot
- [ ] Test recipe #1 — Wooden Pickaxe
- [ ] Test recipe #2 — Fishing Rod
- [ ] Test recipe #3 — Gold Sword
- [ ] Test recipe #4 — TNT
- [ ] Test recipe #5 — Compass
- [ ] Test recipe #6 — Diamond Shovel
- [ ] Test wrong recipe rejection
- [ ] Test servo door #1 — craft → door opens → grab prop → push shut
- [ ] Test servo door #2
- [ ] Test servo door #3
- [ ] Test crafting sound effect
- [ ] Test creeper hiss sound
- [ ] Test explosion sound
- [ ] Test victory fanfare
- [ ] Load fog map on iPad
- [ ] Test GPS tracking on fog map
- [ ] Place test markers on fog map
- [ ] Test MCompass pointing to a known location
- [ ] Full dry run of game flow at home (wife playtest)

## Phase 9: Sound & Atmosphere (Week 9 — Jun 22-29)

- [ ] Load all sounds onto DFPlayer SD card
- [ ] Install soundboard app on phone
- [ ] Load creeper hiss on soundboard
- [ ] Load explosion on soundboard
- [ ] Load victory fanfare on soundboard
- [ ] Create Minecraft soundtrack playlist
- [ ] Test Bluetooth speaker

## Phase 10: Pre-Trip Prep (Week 10 — Jun 29 - Jul 6)

- [ ] Pack crafting table + DeWalt battery + buck converter
- [ ] Pack all 44 blocks/items (in labeled bags by biome/step)
- [ ] Pack 6 recipe cards
- [ ] Pack fishing rod + gold target
- [ ] Pack foam gold sword
- [ ] Pack diamond shovel
- [ ] Pack wooden props (sword, pickaxe, shovel, rod)
- [ ] Pack creeper boxes (flat-packed)
- [ ] Pack dragon egg + candy containers (×2)
- [ ] Pack explorer's diary
- [ ] Pack mine sign + biome signs
- [ ] Pack TNT chest + chain + sign
- [ ] Pack Minecraft fox stuffed animal
- [ ] Pack phone with soundboard app
- [ ] Pack Bluetooth speaker
- [ ] Pack MCompass (charged)
- [ ] Pack iPad(s) with fog map
- [ ] Pack phone charger / power bank for map devices
- [ ] Pack spare blocks
- [ ] Pack tape, markers, zip ties (field repairs)
- [ ] Prep two dig sites worth of supplies
- [ ] Charge all devices
- [ ] Final fog map check — correct region loaded, fog cleared
- [ ] Print backup recipe cards

## Phase 11: Game Day (Mid-July)

**Setup:**
- [ ] Walk route — check for hazards, poison ivy
- [ ] Check stream level
- [ ] Set up crafting table in tent + power on
- [ ] Test all readers one more time
- [ ] Hide wood planks near trees (4 for trade + 3 for pickaxe)
- [ ] Hide sticks near trees
- [ ] Hide iron ingot in mine/bathroom
- [ ] Hide string in mine/bathroom
- [ ] Hide sand blocks along trails
- [ ] Place gold target in stream (with Recipe Card #3)
- [ ] Set up creeper along trail (5 gunpowder + Recipe Card #4)
- [ ] Set up TNT chest (diamond, redstone, 4 iron, Recipe Cards #5 + #6)
- [ ] Bury treasure at dig site
- [ ] Place mine sign on bathroom door
- [ ] Set MCompass spawn point to dig site
- [ ] Start fog map on iPad(s)
- [ ] Place item markers on fog map
- [ ] Queue up Minecraft music on speaker
- [ ] Load soundboard on phone

**Run Game!**

**Reset Between Runs:**
- [ ] Collect all blocks from first group
- [ ] Re-hide blocks in same spots
- [ ] Re-stack creeper, reload loot
- [ ] Re-bury treasure at second dig site
- [ ] Reset fog map (Reset Fog button)
- [ ] Re-place item markers on fog map
- [ ] Reload recipe scrolls
- [ ] Verify crafting table still working

---

## Critical Path (things that block other things)

1. **PCB order** → blocks all electronics assembly (1-2 week lead time from JLCPCB)
2. **DigiKey parts order** → blocks PCB soldering (barrel jack, cap, resistors, diode)
3. **NFC test print** → blocks mass printing (need to verify read range first)
4. **Table frame** → blocks electronics mounting, door installation
5. **PCB assembly + testing** → blocks electronics installation in table
6. **Firmware** → blocks recipe testing, door testing
7. **All blocks printed + tagged** → blocks full integration test

## What Can Run in Parallel

- 3D printing (overnight) + table build (daytime)
- Firmware development + table build
- Props/painting + everything else
- Fog map markers + any time after site visit
