# Minecraft Camping Escape Room — Master TODO

## 🛒 Ordering & Sourcing

- [ ] **Electronics**
  - [x] PN532 NFC/RFID modules (10-pack) — $32
  - [x] NeoPixel WS2812B 24-LED rings (2x 5-pack) — $38
  - [x] NTAG215 NFC coin tags (50-pack, 25mm) — ~$10
  - [x] PCA9548A I2C multiplexer (2-pack) — ~$7
  - [x] ESP32 dev board (or confirm you have one)
  - [x] DFPlayer Mini MP3 module + speaker — ~$9
  - [x] Micro SD card for DFPlayer
  - [x] Copper tape (1" wide roll) — ~$5
  - [x] Jumper wires / hookup wire — ~$8
  - [x] SG90 or MG90S micro servos (3) — ~$8
  - [x] 5V 10A buck converter (DeWalt 20V → 5V) — ~$10
  - [x] DeWalt 20V battery adapter with terminals — ~$10-20
  - [x] Power toggle switch (SPST, 5V/3A) for main power — ~$2
  - [x] IRFZ44N MOSFET TO-220 (for vibration motor) — already have
  - [x] 1N5819 Schottky diode DO-41 (flyback protection) — ~$10 assorted diode kit
  - [x] Cylindrical vibration motor with offset weight (3.7V, game-controller style) — ~$5-8
  - [x] Resistor kit (10kΩ, 4.7kΩ x2, 300Ω, 1kΩ — all axial through-hole) — ~$5
  - [x] 1000µF 10V electrolytic capacitor (Rubycon 10ZLH1000MEFC10X12.5) — ~$2
  - [x] Copper/aluminum tape for capacitive touch pads — already have copper tape
  - [x] Barrel jack connector (5.5x2.1mm, PJ-002A, horizontal THT) — ~$2
  - [x] JST-XH connectors (4-pin headers x9, 3-pin headers x4) — ordered
  - [x] Screw terminals (2-pin 2.54mm, x3: speaker, touch, motor) — ordered
  - [x] Pin sockets (1x15 x2, 1x12 x4, 1x8 x2) — ordered
  - [x] Pin header 1x9 (GPIO breakout) — ~$2
  - [x] JST-XH housings + crimp contacts (for making cables) — ~$12 kit
- [x] **MCompass** — buy pre-assembled from Etsy
- [x] **Crafting Table — Lumber & Hardware**
  - [x] 2×8 lumber × 8' (8 pieces)
  - [x] Plywood 2'×2' × 1/8" (4 pieces)
  - [o] Aluminum angle 1.5" × 4' × 1/8" thick (2 pieces)
  - [o] Aluminum flat bar 1.5" × 8' × 1/8" thick (1 piece)
  - [x] 1"×1" wood rods, 4' total
  - [x] Small piano hinges for doors (3)
  - [x] Ball catches for doors (3-6)
  - [x] Wood/MDF for door blocks (3 pieces, 2"×5"×9")
- [ ] **Crafting Table — Finishing**
  - [x] 2.5' square of camel pleather
  - [x] 3" strips of dark brown pleather
  - [x] 1'×1' frosted acrylic
  - [x] Danish oil (for wood planks — natural finish)
  - [ ] Watered-down acrylic paints (for pixel color variation on planks)
  - [x] Wood stain — dark (espresso) for plywood backing
- [ ] **3D Printing supplies**
  - [x] Black PLA filament (1-2 spools)
  - [x] Printable vinyl sticker paper (matte, waterproof, 25-pack)
  - [x] Matte clear coat spray
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
- [ ] **Wooden prop materials**
  - [x] 1/4" plywood sheet (for sword, pickaxe, shovel, fishing rod cutouts)
- [x] **Foam gold sword** — check friends first, Amazon backup
- [x] **Printer** — Epson EcoTank ET-2850 (if not already owned)

## 🧊 3D Printing

- [ ] **Blocks — 3" × 3" × 3" cubes** (13 total)
  - [ ] Wood Plank × 8
  - [ ] Sand × 5
- [ ] **Items — 3" × 3" × 1.5" flat slabs** (31 total)
  - [x] Stick × 10
  - [x] Iron Ingot × 6
  - [x] String × 3
  - [ ] Redstone × 2
  - [x] Diamond × 2
  - [x] Gold Ingot × 3
  - [x] Gunpowder × 5
- [x] Design block model with NTAG215 cavity (pause-at-layer method)
- [x] Design item model (half-height) with NTAG215 cavity
- [x] Test print one block + one item with embedded NFC tag — verify read range
- [ ] **Ender Dragon Egg** — print and paint (keepsake quality)

## 🎨 Block Finishing

- [x] Design texture sheets for each block type (Minecraft textures)
- [x] Print textures on vinyl sticker paper
- [x] Cut to 3" squares (6 faces per block, 5 visible)
- [ ] Apply stickers to all printed blocks
- [ ] Clear coat spray over stickers

## 🔌 Crafting Table — PCB

- [x] **Breadboard testing (before PCB order)**
  - [x] POC: ESP32 + PCA9548A + PN532 + NeoPixel + servo — working
  - [x] Component test: NeoPixel ring — verified (red/green/blue/white cycle)
  - [x] Component test: Servo — verified (sweep 0°-180°)
  - [x] Component test: DFPlayer + speaker — verified (plays MP3)
  - [x] Component test: PCA9548A + PN532 — verified (I2C scan + tag read)
  - [x] Component test: Capacitive touch — verified (touchRead on GPIO 27/33)
  - [x] Fixed SDA/SCL swap in KiCad schematic (GPIO 21=SDA, GPIO 22=SCL)
  - [x] Replaced DOA PCA9548A #1 (0x70) board
  - [x] Test vibration motor circuit (IRFZ44N + diode + motor) — working, MOSFET stays cool
  - [x] Test DeWalt battery → buck converter → 5V output under load — working (separate servo power path needed)
  - [x] Test PN532 read range at 50mm — DOES NOT READ at this distance
- [x] **Motherboard PCB**
  - [x] Design KiCad schematic (see PCB-DESIGN-GUIDE.md)
  - [x] Route traces in PCB editor
  - [x] Design complete — ready for Gerber export
  - [x] Generate Gerbers and order from JLCPCB (5 boards)
  - [x] Order remaining parts: capacitor (1000µF 10V, 10mm dia, 5mm pitch)
  - [x] Solder all sockets, resistors, caps, connectors to motherboard
  - [x] Plug in ESP32, PCA9548A breakouts, DFPlayer
  - [x] Test all connections before installing in table
- [x] **Daughter Board PCB (x9)**
  - [x] Design KiCad schematic
  - [x] Route traces
  - [x] Design complete — ready for Gerber export
  - [x] Generate Gerbers and order from JLCPCB (10 boards — 9 + 1 spare)
  - [x] Solder JST connectors and NeoPixel ring pads to all 9 boards
  - [x] Solder PN532 modules directly to daughter boards
  - [x] Test each daughter board individually
- [x] **Power supply**
  - [x] Order DeWalt 20V battery adapter with screw terminals
  - [x] Order 5V 10A buck converter (12V-24V input)
  - [x] Wire: DeWalt battery → adapter → buck converter → barrel jack + NeoPixel bus (waiting on barrel jack)
  - [x] Test runtime on DeWalt 5Ah battery (target: 2+ hours)
- [x] **Cables**
  - [x] Make 9x JST-XH 4-pin I2C cables (motherboard → daughter boards)
  - [x] Make 3x JST-XH 3-pin servo extension cables
  - [x] Make 1x JST-XH 3-pin NeoPixel data cable (motherboard → first ring)
  - [x] Run 18AWG power bus wires for NeoPixel rings (direct from buck converter)

## ⚡ Crafting Table — Electronics

- [x] Wire 9x PN532 readers to PCA9548A multiplexer to ESP32
- [x] Wire 9x NeoPixel rings (daisy-chained, single GPIO)
- [x] Wire DFPlayer Mini + speaker
- [ ] Install power toggle switch (inline with 5V power to ESP32)
- [ ] Write ESP32 firmware:
  - [x] Sequential I2C scanning of 9 readers
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

- [x] **Materials**
  - [x] 2×6 lumber × 4' (16 pieces)
  - [x] Plywood 2'×2' × 1/8" (4 pieces)
  - [x] Aluminum angle 1.5" × 4' × 1/8" thick (2 pieces)
  - [x] Aluminum flat bar 1.5" × 8' × 1/8" thick (1 piece)
  - [x] 2.5' square of camel pleather
  - [x] 3" strips of dark brown pleather
  - [x] 1'×1' frosted acrylic
  - [x] 1"×1" wood rods, 4' total
- [x] Design table (nightstand-sized, kid height)
- [x] Build frame (wood)
- [x] Build top surface with 3x3 recessed grid + lip
- [x] Mount PN532 + NeoPixel ring units under each slot
- [x] Route wiring underneath
- [x] Test read range through frosted acrylic
- [ ] Finish/wrap table with pleather
- [ ] Apply dark brown pleather edging
- [x] Add black edging
- [ ] Paint pixel color variation on planks

## 🚪 Crafting Table — Servo Doors (3 doors)

Each door is a 2"×5"×9" block hinged at the bottom with a piano hinge, held closed by magnets. Servos are mounted inside the table. On a successful craft, the servo arm pushes the door open past the magnets. To close, just push the door shut — the magnets pull it back into place.

- [x] **Materials**
  - [x] Servos (3) — SG90 or MG90S (latch needs minimal torque)
  - [x] Jumper wires / servo extension cables
  - [x] Piano hinges for doors (3)
  - [x] Magnets for doors (replaced ball catches)
  - [x] Wood/MDF for door blocks (3 pieces, 2"×5"×9")
- [x] **3D Printing**
  - [x] Servo mounting brackets (3)
  - [x] Servo arm push extensions (3)
  - [x] Print 3 sets
- [x] **Table Modifications**
  - [x] Install piano hinges at bottom edge of each door opening
  - [x] Install magnets to hold doors closed
  - [x] Mount servos inside table with 3D-printed brackets
  - [x] Build prop shelf behind each door (holds pickaxe, fishing rod, etc.)
  - [x] Ensure door face sits flush with table outer panel — all hardware hidden inside
- [x] **Electronics**
  - [x] Wire 3 servos directly to ESP32 GPIO pins
  - [x] Route all wiring inside the table
- [ ] **Firmware**
  - [ ] Map each recipe to a door (door 1 = pickaxe, door 2 = fishing rod, etc.)
  - [ ] On successful craft: servo pushes door open past magnets
  - [ ] Servo returns to rest position after push
  - [ ] "Reset all doors" command for between-run resets
- [x] **Testing**
  - [x] Verify magnets hold door securely
  - [x] Verify servo pushes door open cleanly
  - [x] Verify door clicks shut when pushed closed
  - [ ] Test full cycle: craft → door opens → grab prop → push door shut

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
  - [ ] Crafting table + DeWalt battery + buck converter
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

### Block Placement Sound Effects via RFID
When a block is placed on any grid slot, the PN532 detects the new tag and the DFPlayer plays a Minecraft "block place" sound. Already have the hardware — just needs a firmware trigger on tag-detected events.
- [ ] Add block-place sound file to DFPlayer SD card
- [ ] Firmware: trigger DFPlayer on any new tag detection (not just recipe match)
- [ ] Optional: different sounds for blocks vs items

### Capacitive Touch — Game Master Door Override
Copper tape hidden on the table acts as a capacitive touch sensor using ESP32's built-in touch pins. Tap it to pop all three servo doors open — a quick way for the game master to open doors for testing, resetting, or loading props without needing blocks on the table.
- [ ] Install small copper tape pad in a hidden spot (underside of table edge, back panel, etc.)
- [ ] Wire copper tape to ESP32 touch-capable GPIO (e.g., GPIO 27 / Touch7)
- [ ] Firmware: on touch event → trigger all 3 servos (no recipe check needed)
- [ ] Calibrate touch threshold (avoid false triggers from bumps)

### Vibration Motor — Tactile Craft Feedback
Small coin vibration motor mounted under the table buzzes on successful craft. Kids feel the table rumble.
- [x] Buy coin vibration motor + N-channel MOSFET (or motor driver) — ~$2-3
- [x] Wire motor to 5V via MOSFET, gate on a free GPIO (e.g., GPIO 26)
- [ ] Firmware: buzz pattern on successful recipe match (short pulse, not continuous)
- [x] Mount motor to underside of table surface for maximum vibration transfer

### Cabinet Lights — Illuminate Props on Door Open
Small NeoPixels inside each of the 3 door compartments that light up when the servo opens the door. Extends the existing daisy-chained NeoPixel strip — no extra GPIO.
- [ ] Add 1-2 WS2812B LEDs per compartment (3-6 LEDs total) at the end of the existing NeoPixel chain
- [ ] Mount LEDs to the ceiling or back wall of each compartment, angled down at the prop shelf
- [ ] Run thin wire from the last NeoPixel ring's DOUT into the compartment area
- [ ] Firmware: light the compartment LEDs warm white when the corresponding servo fires
- [ ] Turn off when doors are reset

### Crafting Table ↔ Map Integration
When a block is placed on the crafting table, remove its marker from the map in real time.
- [ ] ESP32 firmware: expose HTTP endpoint reporting blocks currently on the table (e.g., `GET /blocks` → `["wood_plank", "stick", "stick"]`)
- [ ] Map app: poll ESP32 endpoint every 2-3 seconds when on same WiFi
- [ ] When a new block type appears on the table, find the nearest marker of that type and remove it
- [ ] Show a brief "Block collected!" animation on the map when a marker is removed
- [ ] Handle recipe completion: when ESP32 reports a successful craft, show a celebration on the map
- [ ] Both devices connect via phone hotspot or portable router at the campsite
