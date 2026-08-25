# Minecraft Camping Escape Room — Master TODO

## 🛒 Ordering & Sourcing

- [x] **Electronics**
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
- [x] **Crafting Table — Finishing**
  - [x] 2.5' square of camel pleather
  - [x] 3" strips of dark brown pleather
  - [x] 1'×1' frosted acrylic
  - [x] Danish oil (for wood planks — natural finish)
  - [x] Watered-down acrylic paints (for pixel color variation on planks)
  - [x] Wood stain — dark (espresso) for plywood backing
- [x] **3D Printing supplies**
  - [x] Black PLA filament (1-2 spools)
  - [x] Printable vinyl sticker paper (matte, waterproof, 25-pack)
  - [x] Matte clear coat spray
- [ ] **Props & materials**
  - [x] Neodymium disc magnets (for fishing rod)
  - [ ] Parchment paper (recipe scrolls)
  - [ ] Spray paint — diamond blue/teal (shovel)
  - [ ] Green wrapping paper (creeper)
  - [x] Cardboard boxes for creeper
  - [x] Waterproof container for buried treasure
  - [x] Chain or tape for TNT chest lock
  - [ ] Candy/treats for finale
  - [x] Wood boards for signs
- [x] **Wooden prop materials**
  - [x] 1/4" plywood sheet (for sword, pickaxe, shovel, fishing rod cutouts)
- [x] **Foam gold sword** — check friends first, Amazon backup
- [x] **Printer** — Epson EcoTank ET-2850 (if not already owned)

## 🧊 3D Printing

- [x] **Blocks — 2.5" cubes** (11 total)
  - [x] Wood Plank × 4
  - [x] Sand × 4
  - [x] Cobblestone × 3
- [x] **Items — 3" × 3" × 1.5" flat slabs** (30 total)
  - [x] Stick × 10
  - [x] Iron Ingot × 6
  - [x] String × 3
  - [x] Redstone × 1
  - [x] Diamond × 2
  - [x] Gold Ingot × 3
  - [x] Gunpowder × 5
  - [x] Compass × 1
  - [x] Emerald × 1 (trade with villager)
  - [x] Tripwire Hook × 1 (crossbow)
- [x] Design block model with NTAG215 cavity (pause-at-layer method)
- [x] Design item model (half-height) with NTAG215 cavity
- [x] Test print one block + one item with embedded NFC tag — verify read range
- [ ] **Ender Dragon Egg** — print and paint (keepsake quality)

## 🎨 Block Finishing

- [x] Design texture sheets for each block type (Minecraft textures)
- [x] Print textures on vinyl sticker paper
- [x] Cut to 3" squares (6 faces per block, 5 visible)
- [x] Apply stickers to all printed blocks
- [ ] Acrylic over all stickers

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
- [x] Install power toggle switch (inline with 5V power to ESP32)
- [x] Write ESP32 firmware:
  - [x] Sequential I2C scanning of 9 readers
  - [x] NFC tag reading + block type parsing
  - [x] Recipe matching (6 recipes: pickaxe, fishing rod, gold sword, TNT, compass, diamond shovel)
  - [x] NeoPixel feedback (type-colored on detect, rainbow=success, red=fail)
  - [x] Sound playback on successful craft
  - [x] Empty-grid detection (prevent re-triggering)
  - [x] Tag registration/writing mode
  - [ ] Dynamic recipe creation from web UI (define patterns via phone) [optional]
- [x] Write all block tags using registration program
  - [x] Stick × 11
  - [x] Iron Ingot × 6
  - [x] Gold Ingot × 3
  - [x] Amethyst Shard × 1
  - [x] Diamond × 3
  - [x] Redstone × 1
  - [x] Gunpowder × 5
  - [x] String × 3
  - [x] Coal × 2
  - [x] Copper Ingot × 2
  - [x] Wood Plank × 4
  - [x] Sand × 4
  - [x] Cobblestone × 3
  - [x] TNT x 1
  - [x] Paper × 8
  - [x] Tripwire Hook × 1
- [x] Print and sticker new items:
  - [x] Print tripwire_hook item slab
  - [x] Print cobblestone cubes × 3
  - [x] Sticker cobblestone cubes (sticker-block-cobblestone.pdf)
  - [x] Sticker tripwire_hook item (sticker-tripwire_hook.pdf)
- [x] Copy updated mp3/ folder to DFPlayer SD card (now 20 tracks)
- [x] Test every block on every grid slot
- [ ] Test all 13 recipes
- [x] Test wrong recipe rejection

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
- [x] Finish/wrap table with pleather
- [x] Apply dark brown pleather edging
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
- [x] **Firmware**
  - [x] Map each recipe to a door (door 1 = pickaxe, door 2 = fishing rod, etc.)
  - [x] On successful craft: servo pushes door open past magnets
  - [x] Servo returns to rest position after push
  - [x] "Reset all doors" command for between-run resets
- [x] **Testing**
  - [x] Verify magnets hold door securely
  - [x] Verify servo pushes door open cleanly
  - [x] Verify door clicks shut when pushed closed
  - [x] Test full cycle: craft → door opens → grab prop → push door shut

## 🧭 MCompass Setup

- [x] Receive compass from Etsy (or build from PCB order)
- [ ] Test compass pointing north outdoors
- [ ] Calibrate (6 quick presses, figure-8 motion)

## 🗺️ Fog-of-War Map (Digital)

- [x] Finalize map bounding box for campsite
- [x] Generate terrain data for final location
- [x] Multi-region support (Lake Fairfax + Depaul Dr)
- [x] Region selector in admin UI
- [x] Map rotation with device compass heading
- [x] WASD movement relative to heading (admin mode)
- [x] Map quadrant discovery (parchments appear as you explore)
- [x] Forest/park/campsite terrain classification
- [x] Sports fields rendering
- [x] Reveal All / Reset Fog / Remove Items buttons
- [x] Player auto-follow in GPS mode
- [x] Markers rotate with map
- [x] Heading resets to north-up when leaving orientation mode
- [x] Favicon + iOS home screen icon
- [x] Deploy to GitHub Pages
- [x] Admin mode (separate admin.html for iOS home screen)
- [x] Marker hidden/reveal system (admin triggers visibility)
- [x] Multiplayer avatar sync via Firebase
- [x] NFC scan to place/collect markers
- [x] Place markers on real-world map for block hiding spots
- [ ] Place markers for key locations (mine, quarry, cave, creeper, villager)
- [ ] Test on iPad (Safari, performance)
- [ ] Test GPS tracking at campsite
- [ ] Test shared fog of war (Firebase sync):
  - [ ] Two devices reveal simultaneously — both see each other's fog cleared in real-time
  - [ ] Kill and reopen app — fog state persists from Firebase
  - [ ] Reset fog on admin — clears for all connected devices
  - [ ] Test with spotty connection — localStorage fallback works
- [x] Test map viewport clamping (can't scroll past map edge)
- [x] Test background color (uniform brown #d6be96, no black, no tiled border texture)
- [x] Test map case SCAD file:
  - [x] Print in TPU and verify phone fits (15 Pro and 16 Pro)
  - [x] Camera cutout aligns with correct side and clears both models
  - [x] Side button hollows don't obstruct volume/power/action buttons
  - [x] 3mm lip holds phone securely without obstructing screen
  - [x] Rectangular map shape with pixelated edges looks right

## 📜 Recipe Cards

- [x] Design recipe card template (Minecraft bitmap font, leather texture background)
- [x] Generate all 10 recipe cards (storyline order)
- [x] Generate PDFs (1-up for Selphy, 2-up, 4-up for letter paper)
- [x] Print recipe cards on Selphy (100×148mm postcard paper)

## 🎣 Props Assembly

- [x] **Fishing Rod** — attach string + magnet to a stick
- [x] **Fishing target** — waterproof container with magnet/washer in stream (holds 3 diamonds + recipe page)
- [x] **Creeper** — stack 4 boxes, paint green, paint face on top box, pre-score tape
- [x] **Creeper loot** — 5 gunpowder blocks + TNT recipe page inside head box
- [x] **Treasure chest** — locked/chained container in tent with "TNT Required" sign, holds dragon egg + candy
- [x] **Explorer's Journal** — notebook with intro pages + slots for found pages
- [x] **12 journal pages** — write recipe/lore content for each step
- [ ] **Direction cards** — 3-4 cards with compass directions for waypoint navigation
- [x] **Signs** — all 6 lock-out signs generated (print on foam board)

## 🔊 Sound & Atmosphere

- [x] Download Minecraft sound effects (crafting, creeper hiss, explosion, victory)
- [x] Load sounds onto DFPlayer micro SD card
- [o] Install soundboard app on phone
- [o] Load remote sounds (creeper hiss, explosion, fanfare)
- [o] Test Bluetooth speaker for background Minecraft music
- [o] Create Minecraft soundtrack playlist

## 🏕️ Pre-Trip Prep

- [ ] Wife playtest — full walkthrough at home
- [ ] Pack checklist:
  - [ ] Crafting table + DeWalt battery + buck converter
  - [ ] All 54 blocks/items (in labeled bags by step)
    - [ ] 4 Wood Plank (start area)
    - [ ] 11 Stick (scattered)
    - [ ] 6 Iron Ingot (4 tent + 2 quarry)
    - [ ] 1 Redstone (tent pillow)
    - [ ] 1 Coal (tent pillow)
    - [ ] 3 Cobblestone (waypoint chest)
    - [ ] 3 String (2 waypoint + 1 mine)
    - [ ] 8 Paper (mine)
    - [ ] 2 Copper Ingot (mine)
    - [ ] 1 Compass block (crafted, then used in Map recipe)
    - [ ] 3 Diamond (stream fishing)
    - [ ] 1 Emerald (quarry)
    - [ ] 1 Amethyst Shard (quarry)
    - [ ] 4 Sand (stream shore)
    - [ ] 5 Gunpowder (creeper)
  - [ ] 10 recipe cards (Selphy prints)
  - [ ] Explorer's Journal (notebook with starter pages)
  - [ ] 13 journal pages (to find throughout adventure)
  - [ ] Direction cards for compass navigation (3-4 cards)
  - [ ] Physical props:
    - [ ] Cobblestone Pickaxe
    - [ ] Diamond Pickaxe
    - [ ] Fishing Pole (stick + string + magnet)
    - [ ] Torch
    - [ ] Iron Sword
    - [ ] Spyglass
    - [ ] TNT prop
    - [ ] MCompass (charged)
  - [ ] Wrapped Creeper boxes
  - [ ] Dragon egg + candy
  - [ ] Treasure chest + lock
  - [ ] 6 lock-out signs (tent, mine, quarry, cave, creeper)
  - [ ] Gold fishing target (waterproof container + magnet/washer)
  - [ ] iphone map holder
  - [ ] Phone with admin fog map app
  - [ ] Phone charger / power bank
  - [ ] Spare blocks + tape + zip ties (field repairs)
- [ ] Prep two treasure chests (for running twice)

## 🎮 Game Day Setup

- [ ] Walk route — check for hazards, poison ivy
- [ ] Check stream level
- [ ] Set up crafting table in tent + power on
- [ ] Place treasure chest in tent (chained, "TNT Required" sign)
- [ ] Test all readers one more time
- [ ] Hide blocks by step:
  - [ ] Start area: 4 wood planks + 3 sticks (easy to find)
  - [ ] Tent: Small Chest #1 (4 iron + 2 sticks), under pillow (1 redstone + 1 coal), Small Chest #2 (compass recipe page)
  - [ ] Compass waypoints: direction cards leading to waypoint chest
  - [ ] Waypoint chest: 3 cobblestone + 2 sticks + 2 string + pickaxe recipe page
  - [ ] Mine (bathroom): 8 paper + 1 string + 2 copper + map recipe page
  - [ ] Stream shore: 4 sand blocks (visible on map after Step 6)
  - [ ] Stream fishing target: waterproof container with 3 diamonds + diamond pickaxe recipe page
  - [ ] Quarry: 1 emerald + 1 amethyst + 2 iron + journal page
  - [ ] Creeper: stack 4 boxes, 5 gunpowder + TNT recipe page inside head
- [ ] Place lock-out signs:
  - [ ] "Explorer Tent — 4 Oak Planks Required"
  - [ ] "Abandoned Mine — Cobblestone Pickaxe Required"
  - [ ] "Ancient Quarry — Diamond Pickaxe Required"
  - [ ] "Dark Cave — Torch Required"
  - [ ] "Creeper Lair — Iron Sword Required"
  - [ ] "Treasure Chest — TNT Required" (on chest in tent)
- [ ] Set up fog map:
  - [ ] Start fog map on iPad(s)
  - [ ] Open admin map on phone
  - [ ] Pre-place item markers (sand, gunpowder, key locations)
  - [ ] Hide all markers (reveal during gameplay)
- [ ] Queue up Minecraft music on crafting table (Steve figurine or Music ON)
- [ ] Load soundboard on phone (explosion, creeper hiss)

## 🔄 Reset Between Runs

- [ ] Collect all blocks from first group
- [ ] Re-hide blocks in same spots
- [ ] Re-stock tent chests + pillow items
- [ ] Replace compass block (consumed into Map recipe)
- [ ] Re-stack creeper, reload 5 gunpowder + recipe page
- [ ] Re-chain treasure chest
- [ ] Reset fog map (Reset Fog button)
- [ ] Hide all markers again on admin map
- [ ] Re-place fishing target in stream
- [ ] Reload journal pages at each station
- [ ] Reset crafting table (Reset Game button on web UI)
- [ ] Verify crafting table still working

## ⭐ Stretch Goals

### NFC Block Scanning (Setup Mode)
Tap a block's NFC tag to your phone while hiding it → map automatically places a marker at your current GPS location for that block type.
- [x] Use Web NFC API (Chrome on Android) to read NTAG215 block tags
- [x] Parse block type from tag data (e.g., `wood_plank`, `iron_ingot`)
- [x] Map block type to marker tag (wood_plank → wood, iron_ingot → iron, etc.)
- [x] Auto-place marker at current GPS position when tag is scanned
- [x] Add "Setup Mode" toggle in simulation UI to enable NFC scanning

### Block Placement Sound Effects via RFID
When a block is placed on any grid slot, the PN532 detects the new tag and the DFPlayer plays a Minecraft "block place" sound. Already have the hardware — just needs a firmware trigger on tag-detected events.
- [x] Add block-place sound file to DFPlayer SD card
- [x] Firmware: trigger DFPlayer on any new tag detection (not just recipe match)

### Capacitive Touch — Game Master Door Override
Copper tape hidden on the table acts as a capacitive touch sensor using ESP32's built-in touch pins. Tap it to pop all three servo doors open — a quick way for the game master to open doors for testing, resetting, or loading props without needing blocks on the table.
- [x] Install small copper tape pad in a hidden spot (underside of table edge, back panel, etc.)
- [x] Wire copper tape to ESP32 touch-capable GPIO (e.g., GPIO 27 / Touch7)
- [x] Firmware: on touch event → craft recipe
- [x] Calibrate touch threshold (avoid false triggers from bumps)

### Vibration Motor — Tactile Craft Feedback
Small coin vibration motor mounted under the table buzzes on successful craft. Kids feel the table rumble.
- [x] Buy coin vibration motor + N-channel MOSFET (or motor driver) — ~$2-3
- [x] Wire motor to 5V via MOSFET, gate on a free GPIO (e.g., GPIO 26)
- [x] Firmware: buzz pattern on successful recipe match (short pulse, not continuous)
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
