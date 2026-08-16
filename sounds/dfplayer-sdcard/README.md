# DFPlayer SD Card — Sound Mapping

Copy the `mp3/` folder to the root of a FAT32-formatted micro SD card.

## File Format

DFPlayer uses the `/mp3/` folder with 4-digit numbered filenames.
Files are played by number: `dfPlayer.play(N)` plays `mp3/0000N_name.mp3`.

## Track Mapping

| Track | File | Firmware Use |
|-------|------|-----|
| 1 | 0001_craft_success.mp3 | Play on valid recipe match |
| 2 | 0002_craft_fail.mp3 | Play on wrong recipe |
| 3 | 0003_block_place.mp3 | Play when block placed on slot |
| 4 | 0004_levelup.mp3 | Victory fanfare / game complete |
| 5 | 0005_explosion1.mp3 | TNT recipe success |
| 6 | 0006_creeper_hiss.mp3 | Creeper proximity (phone soundboard) |
| 7 | 0007_chest_open.mp3 | Door opening |
| 8 | 0008_chest_close.mp3 | Game reset / doors closing |
| 9 | 0009_xp_pickup.mp3 | Item collected / tag registered |
| 10 | 0010_anvil_use.mp3 | Alternative craft sound |
| 11 | 0011_explosion2.mp3 | Explosion variant |
| 12 | 0012_explosion3.mp3 | Explosion variant |
| 13 | 0013_explosion4.mp3 | Explosion variant |
| 14 | 0014_toast_in.mp3 | UI notification in |
| 15 | 0015_toast_out.mp3 | UI notification out |
| 16 | 0016_crossbow_shoot.mp3 | Crossbow recipe (TODO: add) |
| 17 | 0017_door_open.mp3 | Servo door opening (TODO: add) |
| 18 | 0018_door_close.mp3 | Doors closing on reset (TODO: add) |
| 19 | 0019_enchant.mp3 | Spyglass/special craft (TODO: add) |
| 20 | 0020_note_pling.mp3 | Touch countdown complete (TODO: add) |

## Firmware Usage

```cpp
dfPlayer.play(3);   // block placement click
dfPlayer.play(1);   // craft success
dfPlayer.play(2);   // craft fail / wrong recipe
dfPlayer.play(4);   // level up / game victory
dfPlayer.play(7);   // chest/door open
```

## Sounds Still Needed

Extract from Minecraft Java Edition assets jar (`assets/minecraft/sounds/`):
- `random/door_open.ogg` → convert to MP3 → track 17
- `random/door_close.ogg` → convert to MP3 → track 18
- `random/orb.ogg` or `entity/experience_orb/pickup.ogg` → enchant sound → track 19
- `block/note_block/pling.ogg` → convert to MP3 → track 20
- `item/crossbow/shoot1.ogg` → convert to MP3 → track 16

Convert with: `ffmpeg -i input.ogg -b:a 128k output.mp3`

## Notes
- SD card MUST be FAT32 formatted
- Max 3000 files in /mp3/ folder
- Files play in numerical order by filename number, not creation date
- Keep filenames short — DFPlayer can be picky with long names on some cards
