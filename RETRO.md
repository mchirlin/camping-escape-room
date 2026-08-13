# Project Retrospective — Crafting Table Electronics

## Parts Sourcing

- **Amazon is expensive for individual components.** Every part is $10+ because you're buying packs of 10-50 when you only need 1-2. Good for common modules (ESP32, PN532, NeoPixel rings) but wasteful for passives and connectors.
- **DigiKey/Mouser shipping costs hurt on small orders.** A $5 order with $8 shipping doesn't make sense. Need to batch orders — do all breadboard testing first, finalize the BOM, then make one big order.
- **Need a low-cost way to prototype before committing to a full order.** This might mean keeping a basic stock of common resistors, caps, and connectors on hand so testing doesn't require a separate order. As the parts bin grows over projects, this becomes less of an issue.
- **Lesson:** Plan the full BOM upfront, test with what you have (or cheap Amazon kits), then place a single consolidated order from Mouser/DigiKey for the exact parts needed.

## PCB Design

- **Breadboard testing before ordering PCBs is essential.** This project caught 4 errors that would have meant dead boards:
  1. SDA/SCL swapped (GPIO 21 and 22 reversed in schematic)
  2. MOSFET symbol pin mapping wrong (didn't match TO-220 physical pinout)
  3. Screw terminal footprint wrong pitch (had 5.08mm, actual parts are 2.54mm)
  4. Power traces too thin (0.2mm for everything, needed 1-2mm for power)
- **Always verify footprints against your actual physical parts.** Measure with calipers. Check pin spacing on a breadboard. Don't trust that the datasheet matches your specific clone/variant.
- **Power trace width matters.** 0.2mm traces can only handle ~0.3A. The +5V rail carrying several amps needs 1-2mm minimum. Set up net classes in KiCad to enforce this automatically.
- **Pour a ground plane on B.Cu.** It handles all GND connections automatically through through-hole pads, saves you from routing dozens of ground traces manually, and provides a solid return current path.
- **Separate power paths for high-current loads.** The servo brownout issue (ESP32 rebooting when servo moved) was caused by sharing thin wires between the servo and ESP32. On the PCB, the 1000µF bulk cap handles this. On breadboard, use separate wire pairs from the power supply.
- **Run DRC before exporting Gerbers.** Every time. It catches clearance violations, unconnected nets, and other issues that are invisible by eye.

## Hardware Testing

- **Test each component individually before combining.** The component-test sketch (send 1-7 for each subsystem) made it easy to isolate problems.
- **I2C pull-up resistors are not optional.** The PCA9548A won't communicate without 4.7kΩ pull-ups on SDA/SCL to 3.3V. The PN532 has its own pull-ups on downstream channels, but the main bus needs external ones.
- **NFC read range is limited (~25-30mm).** This constrains block design — tags must be near the bottom face, not centered in a 3" block. Test range early before committing to a block design.
- **USB power is insufficient for full system testing.** NeoPixels + servos + PN532 readers exceed what a USB port can supply. Use external power (DeWalt + buck converter) for realistic testing.
- **Dead ESP32 boards happen.** Power brownouts can fry the USB-serial chip. Keep a spare. The chip itself may still work for the final build (powered via VIN, no USB needed).

## General

- **Measure your actual parts.** Module widths, pin spacings, connector pitches — don't rely on "standard" dimensions. Cheap clones vary.
- **DFPlayer quirks:** macOS hidden files (.DS_Store, ._files) confuse track numbering. Clean the SD card with `dot_clean` and delete hidden files. The startup pop/crackle is normal and unavoidable.
- **Document everything as you go.** The PCB Design Guide, wiring docs, and test results saved significant time when revisiting decisions or debugging issues.
