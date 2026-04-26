/**
 * Render a flat chest icon from the 3D entity UV map texture.
 * Extracts the front face of the chest lid + body + latch from the UV map
 * and composites them into a 16×16 pixel icon.
 *
 * Minecraft chest UV layout (64×64 texture):
 *   Lid front:  x=14, y=14, w=14, h=5
 *   Body front: x=14, y=33, w=14, h=10
 *   Latch:      x=3,  y=0,  w=2,  h=4
 *
 * Usage: npx tsx scripts/render-chest-icon.ts
 */

import sharp from 'sharp';
import path from 'path';

const TEXTURE_DIR = path.resolve('projects/2026-camping-minecraft/textures');
const CHEST_TEXTURE = path.join(TEXTURE_DIR, 'entity', 'chest', 'normal.png');
const OUTPUT = path.resolve('public', 'chest-icon.png');

async function main() {
  // Extract the three regions from the UV map
  const lidFront = await sharp(CHEST_TEXTURE)
    .extract({ left: 14, top: 14, width: 14, height: 5 })
    .png()
    .toBuffer();

  const bodyFront = await sharp(CHEST_TEXTURE)
    .extract({ left: 14, top: 33, width: 14, height: 10 })
    .png()
    .toBuffer();

  const latch = await sharp(CHEST_TEXTURE)
    .extract({ left: 3, top: 0, width: 2, height: 4 })
    .png()
    .toBuffer();

  // Composite into a 14×19 image (lid 5px + body 10px + 4px latch overlap)
  // Then scale to 16×16
  const compositeHeight = 15; // 5 (lid) + 10 (body)
  const compositeWidth = 14;

  const composite = await sharp({
    create: {
      width: compositeWidth,
      height: compositeHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      { input: lidFront, left: 0, top: 0 },
      { input: bodyFront, left: 0, top: 5 },
      { input: latch, left: 6, top: 3 }, // latch centered on the seam
    ])
    .png()
    .toBuffer();

  // Scale to 16×16 with nearest-neighbor for pixel art
  await sharp(composite)
    .resize(16, 16, { kernel: sharp.kernel.nearest, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(OUTPUT);

  console.log(`Chest icon → ${OUTPUT}`);
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
