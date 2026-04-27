# Minecraft Camping Escape Room — Master TODO

## 🛒 Ordering & Sourcing

- [ ] **Electronics**
  - [x] PN532 NFC/RFID modules (10-pack) — $32
  - [x] NeoPixel WS2812B 24-LED rings (2x 5-pack) — $38
  - [x] NTAG215 NFC coin tags (50-pack, 25mm) — ~$10
  - [x] TCA9548A I2C multiplexer (2-pack) — ~$7
  - [x] ESP32 dev board (or confirm you have one)
  - [x] DFPlayer Mini MP3 module + speaker — ~$9
  - [x] Micro SD card for DFPlayer
  - [x] Copper tape (1" wide roll) — ~$5
  - [x] Jumper wires / hookup wire — ~$8
  - [ ] PCA9685 16-channel PWM servo driver board — ~$6
  - [ ] SG90 or MG90S micro servos (3) — ~$8
  - [ ] Magnetic reed switches (3) + small neodymium magnets (3) — ~$5
  - [ ] 5V power supply for servos (separate from ESP32) — ~$8
- [x] **MCompass** — buy pre-assembled from Etsy
- [ ] **Crafting Table — Lumber & Hardware**
  - [ ] 2×6 lumber × 4' (16 pieces)
  - [ ] Plywood 2'×2' × 1/8" (4 pieces)
  - [ ] Aluminum angle 1.5" × 4' × 1/8" thick (2 pieces)
  - [ ] Aluminum flat bar 1.5" × 8' × 1/8" thick (1 piece)
  - [ ] 1"×1" wood rods, 4' total
  - [ ] Small hinges for servo doors (3 sets)
  - [ ] Wood/MDF for door blocks (3 pieces, 2"×5"×9")
- [ ] **Crafting Table — Finishing**
  - [ ] 2.5' square of camel pleather
  - [ ] 3" strips of dark brown pleather
  - [ ] 1'×1' frosted acrylic
- [ ] **3D Printing supplies**
  - [ ] Black PLA filament (1-2 spools)
  - [x] Printable vinyl sticker paper (matte, waterproof, 25-pack)
  - [ ] Matte clear coat spray
- [ ] **Props & materials**
  - [x] Neodymium disc magnets (for fishing rod)
  - [ ] Parchment paper (recipe scrolls)
  - [ ] Spray paint — diamond blue/teal (shovel)
  - [ ] Green spray paint (creeper)
  - [ ] Black acrylic paint (creeper face)
  - [ ] Cardboard boxes for creeper (free — grocery store)
  - [ ] Waterproof container for buried treasure
  - [ ] Waterproof container / chest for TNT chest prop
  - [ ] Chain or tape for TNT chest lock
  - [ ] Candy/treats for finale
  - [ ] Foam board for signs
- [ ] **Foam gold sword** — check friends first, Amazon backup
- [x] **Printer** — Epson EcoTank ET-2850 (if not already owned)

## 🧊 3D Printing

- [ ] **Blocks — 3" × 3" × 3" cubes** (21 total)
  - [ ] Wood Plank × 8
  - [ ] Gold Ingot × 3
  - [ ] Gunpowder × 5
  - [ ] Sand × 5
- [ ] **Items — 3" × 3" × 1.5" flat slabs** (23 total)
  - [ ] Stick × 10
  - [ ] Iron Ingot × 6
  - [ ] String × 3
  - [ ] Redstone × 2
  - [ ] Diamond × 2
- [ ] Design block model with NTAG215 cavity (pause-at-layer method)
- [ ] Design item model (half-height) with NTAG215 cavity
- [ ] Test print one block + one item with embedded NFC tag — verify read range
- [ ] **Ender Dragon Egg** — print and paint (keepsake quality)
- [ ] **Wooden Pickaxe prop** (if 3D printing it)

## 🎨 Block Finishing

- [ ] Design texture sheets for each block type (Minecraft textures)
- [ ] Print textures on vinyl sticker paper
- [ ] Cut to 3" squares (6 faces per block, 5 visible)
- [ ] Apply stickers to all printed blocks
- [ ] Clear coat spray over stickers
- [ ] Optional: install magnetic ball bearings (8 per block) for snap-together

## ⚡ Crafting Table — Electronics

- [ ] Wire 9x PN532 readers to TCA9548A multiplexer to ESP32
- [ ] Wire 9x NeoPixel rings (daisy-chained, single GPIO)
- [ ] Wire DFPlayer Mini + speaker
- [ ] Install copper tape shielding between grid slots
- [ ] Write ESP32 firmware:
  - [ ] Sequential I2C scanning of 9 readers
  - [ ] NFC tag reading + block type parsing
  - [ ] Recipe matching (6 recipes: pickaxe, fishing rod, gold sword, TNT, compass, diamond shovel)
  - [ ] NeoPixel feedback (white=detected, green=valid, rainbow=success)
  - [ ] Sound playback on successful craft
  - [ ] Empty-grid detection (prevent re-triggering)
  - [ ] Tag registration/writing mode
- [ ] Write all block tags using registration program
- [ ] Test every block on every grid slot
- [ ] Test all 6 recipes
- [ ] Test wrong recipe rejection

## 🪑 Crafting Table — Physical Build

- [ ] **Materials**
  - [ ] 2×6 lumber × 4' (16 pieces)
  - [ ] Plywood 2'×2' × 1/8" (4 pieces)
  - [ ] Aluminum angle 1.5" × 4' × 1/8" thick (2 pieces)
  - [ ] Aluminum flat bar 1.5" × 8' × 1/8" thick (1 piece)
  - [ ] 2.5' square of camel pleather
  - [ ] 3" strips of dark brown pleather
  - [ ] 1'×1' frosted acrylic
  - [ ] 1"×1" wood rods, 4' total
- [ ] Design table (nightstand-sized, kid height)
- [ ] Build frame (wood)
- [ ] Build top surface with 3x3 recessed grid + lip
- [ ] Mount PN532 + NeoPixel ring units under each slot
- [ ] Route wiring underneath
- [ ] Test read range through frosted acrylic
- [ ] Finish/wrap table with pleather

## 🚪 Crafting Table — Servo Doors (3 doors)

Each door is a 2"×5"×9" block hinged at the bottom, flush with the table's outer panel. Gravity swings it open when unlatched. Servos are mounted on the inside of the table wall — completely hidden from the outside. A narrow slot in the wall lets the servo's latch tab poke through to hold the door shut. On a successful craft, the servo rotates the tab out of the way and the door drops open, revealing the crafted item prop on a shelf inside. A magnetic reed switch detects when the door is pushed closed and the servo re-latches automatically.

- [ ] **Materials**
  - [ ] Servos (3) — SG90 or MG90S (latch needs minimal torque)
  - [ ] PCA9685 16-channel PWM servo driver board
  - [ ] Magnetic reed switches (3) + small neodymium magnets (3)
  - [ ] Jumper wires / servo extension cables
  - [ ] Power supply for servos (5–6V, separate from ESP32)
  - [ ] Small hinges for door blocks (3 sets — piano hinge or butt hinges)
  - [ ] Wood/MDF for door blocks (3 pieces, 2"×5"×9")
- [ ] **3D Printing**
  - [ ] Servo mounting brackets (mount servo to inside of table wall, horn axis perpendicular to wall)
  - [ ] Latch tab (flat arm that screws onto servo horn, extends through slot to catch door)
  - [ ] Print 3 sets of brackets + tabs
- [ ] **Table Modifications**
  - [ ] Cut narrow slot in table wall behind each door (just wide enough for latch tab)
  - [ ] Attach small catch ledge (screw head or wood strip) to inside face of each door for tab to engage
  - [ ] Install hinges at bottom edge of each door opening
  - [ ] Build prop shelf behind each door (holds pickaxe, fishing rod, etc.)
  - [ ] Ensure door face sits flush with table outer panel — all hardware hidden inside
- [ ] **Electronics**
  - [ ] Wire PCA9685 servo driver to ESP32 via I2C (shares bus with NFC multiplexer)
  - [ ] Wire 3 servos to PCA9685 channels
  - [ ] Wire 3 reed switches to ESP32 GPIO pins (digital input, pull-up)
  - [ ] Glue magnets to inside of each door block
  - [ ] Mount reed switches on inside of table wall, aligned with magnets when door is closed
  - [ ] Route all wiring inside the table
- [ ] **Firmware**
  - [ ] Map each recipe to a door (door 1 = pickaxe, door 2 = fishing rod, etc.)
  - [ ] On successful craft: rotate servo 90° to retract latch tab, door drops open by gravity
  - [ ] Reed switch detects door pushed closed → servo rotates back to latch position
  - [ ] Fallback: auto re-latch after 15 second timeout
  - [ ] "Reset all doors" command for between-run resets
- [ ] **Testing**
  - [ ] Verify latch holds door securely (no rattle)
  - [ ] Verify door drops open cleanly when unlatched
  - [ ] Verify reed switch triggers reliably when door is pushed shut
  - [ ] Test full cycle: craft → door opens → grab prop → push door shut → re-latches

## 🧭 MCompass Setup

- [ ] Receive compass from Etsy (or build from PCB order)
- [ ] Flash GPS-WIFI firmware (if not pre-flashed)
- [ ] Configure WiFi + set spawn point to **buried treasure dig site coordinates** (compass points to treasure)
- [ ] Test compass pointing accuracy outdoors
- [ ] Calibrate (6 quick presses, figure-8 motion)
- [ ] Compass is given to kids after they craft the Compass recipe (Step 5)

## 🗺️ Fog-of-War Map (Digital)

- [x] Finalize map bounding box for campsite
- [x] Generate terrain data for final location
- [x] Multi-region support (Lake Fairfax + Depaul Dr)
- [x] Region selector in simulation UI
- [x] Map rotation with device compass heading
- [x] WASD movement relative to heading (simulation mode)
- [x] Map quadrant discovery (parchments appear as you explore)
- [x] Forest/park/campsite terrain classification
- [x] Sports fields rendering
- [x] Reveal All / Reset Fog / Remove Items buttons
- [x] Player auto-follow in GPS mode
- [x] Markers rotate with map
- [x] Heading resets to north-up when leaving orientation mode
- [x] Favicon + iOS home screen icon
- [x] Deploy to GitHub Pages
- [ ] Place markers on real-world map for block hiding spots
- [ ] Place markers for key locations (mine, creeper, dig site)
- [ ] Test on iPad (Safari, performance)
- [ ] Test GPS tracking at campsite
- [ ] Clear fog state before each game run

## 📜 Recipe Cards & Map

- [ ] Design recipe scroll template (3×3 grid with block icons)
- [ ] Print/write 6 recipe cards:
  - [ ] #1 Wooden Pickaxe (3 wood plank + 2 stick) — given with crafting table
  - [ ] #2 Fishing Rod (3 stick + 2 string + 1 iron) — after pickaxe craft
  - [ ] #3 Gold Sword (2 gold + 1 stick) — found with gold in stream
  - [ ] #4 TNT (5 gunpowder + 4 sand) — found in creeper loot
  - [ ] #5 Compass (4 iron + 1 redstone) — found in TNT chest
  - [ ] #6 Diamond Shovel (1 diamond + 2 stick) — found in TNT chest
- [ ] Tea-stain parchment paper for aged look
- [ ] Roll into scroll format

## 🎣 Props Assembly

- [ ] **Fishing Rod** — attach string + magnet to a stick
- [ ] **Gold fishing target** — waterproof container with metal ring/washer in stream
- [ ] **Creeper** — stack 4 boxes, paint green, paint face on top box, pre-score tape
- [ ] **Creeper loot** — put 5 gunpowder blocks + Recipe Card #4 inside head box
- [ ] **TNT chest** — locked/chained container with "⚠ TNT Required" sign, containing diamond, redstone, 4 iron, Recipe Cards #5 + #6
- [ ] **Diamond Shovel** — paint kid garden shovel diamond blue/teal
- [ ] **Explorer's Diary** — write last journal entry about Ender Dragon egg sighting
- [ ] **Buried treasure** — waterproof container with dragon egg + candy
- [ ] **Mine sign** — "⛏ Abandoned Mine — Wooden Pickaxe Required"
- [ ] **Biome signs** (optional) — pixel font Minecraft-style

## 🔊 Sound & Atmosphere

- [ ] Download Minecraft sound effects (crafting, creeper hiss, explosion, victory)
- [ ] Load sounds onto DFPlayer micro SD card
- [ ] Install soundboard app on phone
- [ ] Load remote sounds (creeper hiss, explosion, fanfare)
- [ ] Test Bluetooth speaker for background Minecraft music
- [ ] Create Minecraft soundtrack playlist

## 🏕️ Pre-Trip Prep

- [ ] Wife playtest — full walkthrough at home
- [ ] Pack checklist:
  - [ ] Crafting table + power bank
  - [ ] All 44 blocks/items (in labeled bags by biome/step)
  - [ ] 6 recipe cards
  - [ ] Fishing rod + gold target
  - [ ] Foam gold sword
  - [ ] Diamond shovel
  - [ ] Creeper boxes (flat-packed) + paint touch-up
  - [ ] Dragon egg + candy in waterproof container
  - [ ] Explorer's diary
  - [ ] Mine sign + biome signs
  - [ ] Minecraft fox stuffed animal
  - [ ] Phone with soundboard app
  - [ ] Bluetooth speaker
  - [ ] MCompass (charged, spawn set to dig site)
  - [ ] iPad(s) with fog map loaded (1–2 devices)
  - [ ] Phone charger / power bank for map devices
  - [ ] TNT chest + chain/tape + sign
  - [ ] Spare blocks
  - [ ] Tape, markers, zip ties (field repairs)
- [ ] Prep two dig sites (for running twice)
- [ ] Prep two waterproof treasure containers

## 🎮 Game Day Setup

- [ ] Walk route — check for hazards, poison ivy
- [ ] Check stream level
- [ ] Set up crafting table in tent + power on
- [ ] Test all readers one more time
- [ ] Hide blocks by biome:
  - [ ] Forest: wood planks (4 for trade + 3 for pickaxe), sticks (near trees)
  - [ ] Mine/bathroom: iron ingot, string (inside stall)
  - [ ] Stream: gold target in water (with Recipe Card #3)
  - [ ] Scattered: sand blocks along trails
- [ ] Set up creeper along trail (hidden from initial view, loaded with 5 gunpowder + Recipe Card #4)
- [ ] Set up TNT chest (loaded with diamond, redstone, 4 iron, Recipe Cards #5 + #6)
- [ ] Bury treasure at dig site
- [ ] Place mine sign on bathroom door
- [ ] Set MCompass spawn point to buried treasure dig site
- [ ] Start fog map on iPad(s) — load Lake Fairfax region
- [ ] Pre-place item markers on fog map for block hiding spots (via real map view, right-click)
- [ ] Set up TNT chest along trail (locked/chained)
- [ ] Queue up Minecraft music on speaker
- [ ] Load soundboard on phone

## 🔄 Reset Between Runs

- [ ] Collect all blocks from first group
- [ ] Re-hide blocks in same spots
- [ ] Re-stack creeper, reload loot
- [ ] Re-bury treasure at second dig site
- [ ] Reset fog map (🔄 Reset Fog button — also resets discovered quadrants)
- [ ] Re-place item markers on fog map (or use 🗑 Remove Items + re-add)
- [ ] Reload recipe scrolls
- [ ] Verify crafting table still working

## ⭐ Stretch Goals

### NFC Block Scanning (Setup Mode)
Tap a block's NFC tag to your phone while hiding it → map automatically places a marker at your current GPS location for that block type.
- [ ] Use Web NFC API (Chrome on Android) to read NTAG215 block tags
- [ ] Parse block type from tag data (e.g., `wood_plank`, `iron_ingot`)
- [ ] Map block type to marker tag (wood_plank → wood, iron_ingot → iron, etc.)
- [ ] Auto-place marker at current GPS position when tag is scanned
- [ ] iOS fallback: encode block type as URL in NFC tag, Safari opens map with `?addBlock=wood_plank` parameter
- [ ] Add "Setup Mode" toggle in simulation UI to enable NFC scanning

### Crafting Table ↔ Map Integration
When a block is placed on the crafting table, remove its marker from the map in real time.
- [ ] ESP32 firmware: expose HTTP endpoint reporting blocks currently on the table (e.g., `GET /blocks` → `["wood_plank", "stick", "stick"]`)
- [ ] Map app: poll ESP32 endpoint every 2-3 seconds when on same WiFi
- [ ] When a new block type appears on the table, find the nearest marker of that type and remove it
- [ ] Show a brief "Block collected!" animation on the map when a marker is removed
- [ ] Handle recipe completion: when ESP32 reports a successful craft, show a celebration on the map
- [ ] Both devices connect via phone hotspot or portable router at the campsite
