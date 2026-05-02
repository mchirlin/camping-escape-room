# DFPlayer SD Card — Sound Mapping

Copy the `mp3/` folder to the root of a FAT32-formatted micro SD card.

## Track Numbers (for firmware)

| Track | File | Use |
|-------|------|-----|
| 1 | craft_success | Play on valid recipe match |
| 2 | craft_fail | Play on wrong recipe (stretch) |
| 3 | block_place | Play when block placed on slot |
| 4 | levelup | Victory fanfare / celebration |
| 5 | explosion1 | TNT / creeper explosion |
| 6 | creeper_hiss | Creeper proximity warning |
| 7 | chest_open | Chest opening |
| 8 | chest_close | Chest closing |
| 9 | xp_pickup | Item collected |
| 10 | anvil_use | Alternative craft sound |
| 11-13 | explosion2-4 | Explosion variants |
| 14 | toast_in | UI notification in |
| 15 | toast_out | UI notification out |

## Firmware Usage

```cpp
// DFPlayer Mini — play by track number
dfPlayer.play(1);  // craft success
dfPlayer.play(3);  // block place
dfPlayer.play(5);  // explosion
```
