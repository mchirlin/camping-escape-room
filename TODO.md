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
- [x] **MCompass** — buy pre-assembled from Etsy
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
  - [ ] Candy/treats for finale
  - [ ] Foam board for signs
- [ ] **Foam gold sword** — check friends first, Amazon backup
- [x] **Printer** — Epson EcoTank ET-2850 (if not already owned)

## 🧊 3D Printing

- [ ] **Blocks** (34 total — ~2-3 per overnight print)
  - [ ] Wood Plank × 4
  - [ ] Stick × 9
  - [ ] Iron Ingot × 2
  - [ ] String × 3
  - [ ] Gold Ingot × 3
  - [ ] Paper × 9
  - [ ] Compass × 2
  - [ ] Diamond × 2
- [ ] Design block with NTAG215 cavity (pause-at-layer method)
- [ ] Test print one block with embedded NFC tag — verify read range
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
  - [ ] Recipe matching (5 main recipes)
  - [ ] NeoPixel feedback (white=detected, green=valid, rainbow=success)
  - [ ] Sound playback on successful craft
  - [ ] Empty-grid detection (prevent re-triggering)
  - [ ] Tag registration/writing mode
- [ ] Write all block tags using registration program
- [ ] Test every block on every grid slot
- [ ] Test all 5 main recipes
- [ ] Test wrong recipe rejection

## 🪑 Crafting Table — Physical Build

- [ ] Design table (nightstand-sized, kid height)
- [ ] Build frame (wood)
- [ ] Build top surface with 3x3 recessed grid + lip
- [ ] Choose surface material (thin plywood or frosted acrylic)
- [ ] Mount PN532 + NeoPixel ring units under each slot
- [ ] Route wiring underneath
- [ ] Test read range through surface material
- [ ] Finish/paint table

## 🧭 MCompass Setup

- [ ] Receive compass from Etsy (or build from PCB order)
- [ ] Flash GPS-WIFI firmware (if not pre-flashed)
- [ ] Configure WiFi + set spawn point to **tent/crafting table coordinates** (so it always points home)
- [ ] Test compass pointing accuracy outdoors
- [ ] Calibrate (6 quick presses, figure-8 motion)
- [ ] Decide when kids receive the compass:
  - Option A: Given at the very start (always have a way home)
  - Option B: Given after first craft (pickaxe) as a reward
  - Option C: Found inside the creeper loot alongside map ingredients

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
- [ ] Print/write 5 recipe scrolls:
  - [ ] #1 Wooden Pickaxe (3 wood plank + 2 stick)
  - [ ] #2 Fishing Rod (2 stick + 2 string + 1 iron)
  - [ ] #3 Gold Sword (2 gold + 1 stick)
  - [ ] #4 Map (8 paper + 1 compass)
  - [ ] #5 Diamond Shovel (1 diamond + 2 stick)
- [ ] Tea-stain parchment paper for aged look
- [ ] Roll into scroll format

## 🎣 Props Assembly

- [ ] **Fishing Rod** — attach string + magnet to a stick
- [ ] **Gold fishing target** — waterproof container with metal ring/washer in stream
- [ ] **Creeper** — stack 4 boxes, paint green, paint face on top box, pre-score tape
- [ ] **Creeper loot** — put paper blocks + compass block inside head box
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
  - [ ] All 34 blocks (in labeled bags by biome)
  - [ ] 5 recipe scrolls
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
  - [ ] MCompass (charged, spawn set to tent location)
  - [ ] iPad(s) with fog map loaded (1–2 devices)
  - [ ] Phone charger / power bank for map devices
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
  - [ ] Forest: wood planks, sticks (near trees)
  - [ ] Mine/bathroom: iron, string, diamonds (inside stall)
  - [ ] Stream: gold target in water
- [ ] Set up creeper along trail (hidden from initial view)
- [ ] Bury treasure at dig site
- [ ] Place mine sign on bathroom door
- [ ] Set MCompass spawn point to tent/crafting table location
- [ ] Start fog map on iPad(s) — load Lake Fairfax region
- [ ] Pre-place item markers on fog map for block hiding spots (via real map view, right-click)
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
