# Technology & Electronics — Notes

Project: 2026-camping-minecraft
Created: 2026-04-18

## Decisions

### Platform
- ESP32 (already owned, or ESP8266)
- ESP32 preferred — more GPIO pins, built-in Bluetooth

### RFID Readers
- **9x PN532 modules** (one per grid slot)
- ~5–7cm read range — comfortable margin through table surface + block
- **2x PCA9548A I2C multiplexers** to run 9 readers off one ESP32
  - U1 (addr 0x70): channels 0-7 → slots 0-7
  - U2 (addr 0x71): channel 0 → slot 8
- **Sequential scanning only** — one reader active at a time to prevent interference
- **Copper tape between grid slot walls** as RF shielding — belt-and-suspenders with sequential scanning
- Embed NFC tag near the bottom of each block (pause print early) to minimize read distance

### LED Feedback
- **9x NeoPixel rings (24-LED, WS2812B)** — one per grid slot
- ~52mm inner diameter — PN532 board (43mm) fits inside the ring
- Reader + ring = single unit per slot, both mounted under table surface
- Only light 12 of 24 LEDs (every other one) for even glow + lower power draw
- Daisy-chained: data-out → wire → data-in on next ring, spaced to match grid
- Single GPIO pin on ESP32 controls all 9 rings
- Run at 10–20% brightness, cap in code: `FastLED.setBrightness(25);`
- **Power draw: well under 1A total for all 9 rings**
- **Light behavior:**
  - White/colored glow = block detected in slot
  - Green glow on all occupied slots = valid recipe ready to craft
  - Red flash = wrong recipe on button press
  - Rainbow sweep = successful craft

### Grid Construction
- 3x3 recessed slots on table surface
- Small lip on top of flat surface (not routed into wood)
- Under each slot: PN532 reader (center) + NeoPixel ring (surrounding)
- Thin surface material (¼" plywood or similar) to maximize read range
- Copper tape lining the walls between slots

### Output
- NeoPixel rings for visual feedback (real-time as blocks are placed)
- Speaker for sound effects (crafting sound on success)
- Screen/tablet as stretch goal (show crafted item image)
- **No craft button** — continuous scanning, auto-triggers on valid pattern
- **No quest state tracking** — all recipes active at all times, physical block availability handles sequencing
- Recipe list is just a flat array of patterns to match against

### Power
- USB power bank (10,000mAh+)
- ESP32 + 9 PN532 readers + 9 NeoPixel rings + speaker
- Estimated draw: ~2–3A total at moderate LED brightness
- Table is inside the tent — no direct weather exposure

### Sound
- Small speaker module wired to ESP32 for crafting table sounds
- Separate phone soundboard app for remote sounds (creeper hiss, explosion, victory fanfare)

### Budget Estimate
| Part | Cost |
|---|---|
| 10x PN532 readers (Amazon pack) | ~$32 |
| ESP32 | ~$10 (or already owned) |
| PCA9548A multiplexer (x2) | ~$10 |
| 9x NeoPixel 24-LED rings (2x 5-packs) | ~$38 |
| Speaker module | ~$10 |
| NFC stickers (50-pack) | ~$15 |
| Copper tape | ~$5 |
| Misc (wiring, button, connectors) | ~$15 |
| **Total electronics** | **~$125** |

### Shopping Links
- PN532 (10-pack): https://www.amazon.com/Module-Communication-Arduino-Raspberry-Android/dp/B0DDKX2JCD/
- NeoPixel WS2812B rings: https://www.amazon.com/DIYmall-WS2812B-Integrated-Individually-Addressable/dp/B0B2D5QXG5/

### Build Timeline
- Spread over a few months (May–July)
- Test RFID reads at home before the trip

## Open Questions
- Confirm PN532 read range through ¼" plywood + PLA block with embedded NTAG215
- ESP32 pin assignment for I2C multiplexer + NeoPixel data + button + speaker
- Speaker module selection (DFPlayer Mini? I2S amp?)
- Screen/tablet integration — worth the complexity?
- Arduino code: recipe matching, LED control, sound triggers, button debounce
- Table surface material — translucent/frosted acrylic for better ring glow, or thin plywood?
