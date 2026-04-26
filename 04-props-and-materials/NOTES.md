# Props & Materials — Notes

Project: 2026-camping-minecraft
Created: 2026-04-18

## Decisions

### 3D-Printed Blocks
- 3-inch cubes, black PLA
- **Printable vinyl sticker paper** for textures — actual Minecraft block textures printed on matte waterproof vinyl sheets
- Print 6 faces per block, cut to 3" squares, apply to all sides
- Clear coat matte spray over stickers to prevent edge peeling
- Bottom face can be left bare (sits on reader, nobody sees it)
- NTAG215 coin tags embedded mid-print (cavity near bottom, pause at layer, drop in, resume)
- Block type written to tag data (Option B)
- Registration program on ESP32 to write block types to tags

#### Magnetic Snap-Together Option
- 3D print cubes with internal compartments at each of the 8 corners
- Drop a 5mm magnetic ball bearing into each corner compartment (8 magnets per block)
- Sphere magnets self-align polarity — blocks always attract regardless of orientation
- Dab glue on the cap to prevent strong neighbors from pulling balls out
- Avoids the fixed-polarity problem of flat/cube magnets
- Players can freely stack and arrange blocks without "wrong" orientations
- Magnet count estimate: 8 per block × number of blocks needed
- Source: [Instructables - Fay3dlab](https://www.instructables.com/Magnetic-Blocks-AKA-Minecraft-Blocks/)

### Crafting Table
- Small nightstand-sized, but shorter (kid height)
- Flat surface with lip creating recessed 3x3 grid on top
- Wood construction
- Splurge item — worth spending time and money on

### Physical Items Given After Crafts
1. Wooden Pickaxe — prop (3D printed or crafted from wood)
2. Fishing Rod — real stick + string + magnet
3. Gold Sword — foam (sourcing from friends, or Minecraft licensed foam sword from Amazon)
4. Map — hand-drawn on tea-stained parchment, directions on back
5. Diamond Shovel — real kid-sized garden shovel, painted diamond blue/teal (already owned)

### Creeper
- 4 cardboard boxes stacked to adult height, painted creeper green
- Iconic face on top box
- Pre-scored tape so it falls apart on hit
- Loot inside head box

### Ender Dragon Egg
- 3D printed, painted — keepsake quality
- Buried in waterproof container with candy

### Other Props Already Owned
- Chests
- Keys
- Diary (potential intro prop — explorer's journal)
- Minecraft fox stuffed animal (holds a hint)
- Locks

### Still Need to Source
- RFID tags (NFC stickers compatible with RC522/PN532)
- Spray paint (multiple colors for block types)
- Cardboard boxes for creeper
- Foam sword (check friends first, Amazon backup)
- Magnets for fishing rod
- Parchment paper for recipe scrolls and map
- Candy/treats
- Wood for crafting table build

## Open Questions
- Exact NFC sticker model that works embedded in PLA at 3cm read distance
- Foam sword — friends have one or need to buy?
- Block color scheme per type (match Minecraft textures)
