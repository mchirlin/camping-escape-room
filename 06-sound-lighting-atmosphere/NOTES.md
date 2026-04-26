# Sound, Lighting & Atmosphere — Notes

Project: 2026-camping-minecraft
Created: 2026-04-18

## Decisions

### Background Music
- Minecraft soundtrack playing from Bluetooth speaker during the game
- Speaker at/near the crafting table in the tent

### Sound Effects — Phone Soundboard
- Use a soundboard app (iOS/Android) on your phone
- Pre-loaded sounds:
  - **Creeper hiss** — play when kids approach the creeper
  - **Explosion** — play when they smash it
  - **Victory/level-up fanfare** — play when they dig up the egg
  - **Crafting sound** — backup if table speaker fails
- You control it from your phone — one tap per sound
- App options: "Soundboard" or "Custom Soundboard" (both free)

### Crafting Table Sounds
- Wired speaker on the ESP32 handles crafting success sound automatically
- Phone soundboard is for remote/ambient moments

### Decorations
- Minimal — one or two Minecraft biome signs (pixel font)
- Let the natural campsite do the work

### Walking Sounds
- Cool idea but not practical for outdoor game — shelved for now

## Open Questions
- Which soundboard app to use (test a few)
- Source Minecraft sound files for the soundboard
- Bluetooth speaker selection (already own one?)
