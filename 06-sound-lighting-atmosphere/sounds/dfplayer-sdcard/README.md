# DFPlayer SD Card — Folder-Based Sound Mapping

Copy the `01/`, `02/`, `03/`, and `04/` folders to the root of a FAT32-formatted micro SD card.

## SD Card Structure

```
SD Card Root/
  01/                         — Block interaction sounds
    001.mp3                   — block_place (click on tag detect)
  02/                         — Game event sounds & effects
    001.mp3                   — craft_success
    002.mp3                   — craft_fail
    003.mp3                   — toast_in (touch start chime)
    004.mp3                   — levelup (victory variant)
    005.mp3                   — xp_pickup
    006.mp3                   — tnt_fuse + explosion (combined: hiss then bang)
    007.mp3                   — chest_open (legacy from mp3/ folder)
    008.mp3                   — note_pling
    009.mp3                   — levelup
    010.mp3                   — anvil
    011.mp3                   — chest_close
    012.mp3                   — chest_open
    013.mp3                   — crossbow_shoot
    014.mp3                   — door_open
    015.mp3                   — door_close
    016.mp3                   — enchant
    017.mp3                   — creeper_death
    018.mp3                   — explosion
    019.mp3                   — explosion2
    020.mp3                   — bow_shoot
    021.mp3                   — item_pop
    022.mp3                   — burp
    023.mp3                   — drink
    024.mp3                   — eat
    025.mp3                   — zombie
    026.mp3                   — skeleton
    027.mp3                   — villager_yes
    028.mp3                   — villager_no
    032.mp3                   — block_break
    033.mp3                   — fire_ignite
  03/                         — Background music (long tracks)
    001.mp3                   — sweden (THE Minecraft theme)
    002.mp3                   — wet_hands
    003.mp3                   — mice_on_venus
    004.mp3                   — haggstrom
    005.mp3                   — living_mice
    006.mp3                   — subwoofer_lullaby
    007.mp3                   — danny
    008.mp3                   — dry_hands
    009.mp3                   — clark
    010.mp3                   — minecraft_calm
  04/                         — Celebration songs
    001.mp3                   — gold victory song A (gold_ingot cycles 001/003)
    002.mp3                   — dragon egg song (dragon_egg plays this)
    003.mp3                   — gold victory song B (gold_ingot cycles 001/003)
```

## Firmware Usage

```cpp
// Block placement
dfPlayer.playFolder(1, 1);   // block_place click

// Game events
dfPlayer.playFolder(2, 4);   // craft success (victory fanfare)
dfPlayer.playFolder(2, 2);   // craft fail
dfPlayer.playFolder(2, 3);   // toast_in (touch hold start)
dfPlayer.playFolder(2, 9);   // levelup
dfPlayer.playFolder(2, 12);  // chest open
dfPlayer.playFolder(2, 14);  // door open
dfPlayer.playFolder(2, 16);  // enchant
dfPlayer.playFolder(2, 18);  // explosion

// Background music (looping)
dfPlayer.enableLoop();
dfPlayer.playFolder(3, 1);   // sweden
dfPlayer.playFolder(3, 2);   // wet_hands
dfPlayer.playFolder(3, 4);   // haggstrom
// etc.

// Celebration songs (folder 04)
dfPlayer.playFolder(4, 1);   // gold victory song A  (gold_ingot cycles 1 <-> 3)
dfPlayer.playFolder(4, 3);   // gold victory song B  (gold_ingot cycles 1 <-> 3)
dfPlayer.playFolder(4, 2);   // dragon egg song      (dragon_egg, single track)
```

## Folder Layout Logic

- **Folder 01:** Block interaction sounds (played frequently, very short)
- **Folder 02:** Game event sounds & ambient effects (short-medium)
- **Folder 03:** Background music (long tracks, 1-5 minutes). Plays as a sequenced playlist: when one track ends the next starts, wrapping from 010 back to 001. After a stretch of silence the firmware resumes background music automatically.
- **Folder 04:** Celebration songs (played one-shot). `gold_ingot` alternates between tracks 001 and 003 on each placement; `dragon_egg` always plays track 002.

## Notes
- SD card MUST be FAT32 formatted
- Folder names must be exactly 2 digits: `01`, `02`, `03`, `04`
- File names must be exactly 3 digits: `001.mp3`, `002.mp3`, etc.
- `dfPlayer.playFolder(folder, track)` is the most reliable playback method
- All files encoded at 44.1kHz mono 128kbps for DFPlayer compatibility
- The old `/mp3/` folder can be deleted from the SD card (no longer used)
