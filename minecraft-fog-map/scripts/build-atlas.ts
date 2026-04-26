/**
 * Texture Atlas Builder
 *
 * Packs 6 terrain textures + fog texture + player marker into a single
 * 128×16 horizontal strip PNG and generates an atlas.json manifest.
 *
 * Usage: npx tsx scripts/build-atlas.ts
 */

import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import type { TextureAtlasManifest, AtlasEntry } from '../src/types.js';

const TILE_SIZE = 16;
const TEXTURE_DIR = new URL('../../textures', import.meta.url).pathname;
const BLOCK_DIR = path.join(TEXTURE_DIR, 'block');
const OUTPUT_DIR = path.resolve('public');

const COLORMAP_DIR = path.join(TEXTURE_DIR, 'colormap');

/** Terrain texture mapping: atlas key → source filename in block/ */
const TERRAIN_TEXTURES: Record<string, string> = {
  grass: 'grass_block_top.png',
  forest: 'oak_leaves.png',
  water: 'water_still.png',
  path: 'dirt_path_top.png',
  building: 'cobblestone.png',
  sand: 'sand.png',
};

/**
 * Textures that need biome colormap tinting.
 * In Minecraft, grass_block_top and oak_leaves are grayscale and get
 * tinted at runtime using the biome colormap.
 *
 * Key = atlas key, value = { colormap file, x, y } where x,y is the
 * sample position on the 256×256 colormap. We use a temperate forest
 * biome (~temperature 0.8, humidity 0.4 → pixel ~128, 100).
 */
/**
 * Textures that need biome colormap tinting.
 * Grass/leaves use the colormap PNGs. Water uses a hardcoded Minecraft tint.
 *
 * colormap + x,y = sample from colormap PNG
 * hex = direct tint color (no colormap needed)
 */
const TINTED_TEXTURES: Record<string, { colormap?: string; x?: number; y?: number; hex?: string }> = {
  grass: { colormap: 'grass.png', x: 30, y: 60 },
  forest: { colormap: 'foliage.png', x: 30, y: 60 },
  water: { hex: '#3F76E4' },
};

/** Order of textures in the horizontal strip */
const TEXTURE_ORDER = ['grass', 'forest', 'water', 'path', 'building', 'sand', 'fog', 'player'];

/**
 * Generate a 16×16 fog texture: dark gray (#1a1a1a) with subtle noise.
 */
async function createFogTexture(): Promise<Buffer> {
  const pixels = Buffer.alloc(TILE_SIZE * TILE_SIZE * 4);
  const base = 0x1a;

  for (let i = 0; i < TILE_SIZE * TILE_SIZE; i++) {
    // Subtle noise: vary brightness by ±6
    const noise = Math.floor(Math.random() * 13) - 6;
    const val = Math.max(0, Math.min(255, base + noise));
    const offset = i * 4;
    pixels[offset] = val;     // R
    pixels[offset + 1] = val; // G
    pixels[offset + 2] = val; // B
    pixels[offset + 3] = 255; // A
  }

  return sharp(pixels, { raw: { width: TILE_SIZE, height: TILE_SIZE, channels: 4 } })
    .png()
    .toBuffer();
}

/**
 * Extract a 16×16 player marker from Alex's face on the 64×64 skin texture.
 * Alex's face is at (8,8) to (16,16) in the skin layout — 8×8 pixels.
 * We scale it up to 16×16 with nearest-neighbor for pixel-art crispness.
 */
async function createPlayerMarker(): Promise<Buffer> {
  const alexPath = path.join(TEXTURE_DIR, 'entity', 'player', 'wide', 'alex.png');

  try {
    return await sharp(alexPath)
      .extract({ left: 8, top: 8, width: 8, height: 8 })
      .resize(TILE_SIZE, TILE_SIZE, { kernel: sharp.kernel.nearest })
      .png()
      .toBuffer();
  } catch {
    // Fallback: create a simple pixel-art marker programmatically
    return createFallbackPlayerMarker();
  }
}

/**
 * Fallback: simple red/white pixel-art arrow marker pointing up.
 */
async function createFallbackPlayerMarker(): Promise<Buffer> {
  const pixels = Buffer.alloc(TILE_SIZE * TILE_SIZE * 4);

  // Simple diamond/arrow shape in red on transparent background
  const pattern = [
    '................',
    '.......##.......',
    '......####......',
    '.....##..##.....',
    '....##....##....',
    '...##..##..##...',
    '..##..####..##..',
    '.##..######..##.',
    '......####......',
    '......####......',
    '......####......',
    '......####......',
    '......####......',
    '.......##.......',
    '................',
    '................',
  ];

  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const offset = (y * TILE_SIZE + x) * 4;
      if (pattern[y][x] === '#') {
        pixels[offset] = 220;     // R
        pixels[offset + 1] = 50;  // G
        pixels[offset + 2] = 50;  // B
        pixels[offset + 3] = 255; // A
      } else {
        pixels[offset + 3] = 0; // Transparent
      }
    }
  }

  return sharp(pixels, { raw: { width: TILE_SIZE, height: TILE_SIZE, channels: 4 } })
    .png()
    .toBuffer();
}

/**
 * Sample a tint color from a 256×256 biome colormap at the given position.
 * Returns { r, g, b } in 0–255 range.
 */
async function sampleColormap(
  colormapFile: string,
  x: number,
  y: number
): Promise<{ r: number; g: number; b: number }> {
  const filePath = path.join(COLORMAP_DIR, colormapFile);
  const { data, info } = await sharp(filePath)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const idx = (y * info.width + x) * info.channels;
  return {
    r: data[idx],
    g: data[idx + 1],
    b: data[idx + 2],
  };
}

/**
 * Apply a biome tint color to a texture by multiplying each pixel's RGB
 * channels with the tint color (normalized to 0–1). This replicates how
 * Minecraft tints grayscale grass/foliage textures at runtime.
 */
async function applyTint(
  textureBuffer: Buffer,
  tint: { r: number; g: number; b: number }
): Promise<Buffer> {
  const { data, info } = await sharp(textureBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const tintR = tint.r / 255;
  const tintG = tint.g / 255;
  const tintB = tint.b / 255;

  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.round(data[i] * tintR);
    data[i + 1] = Math.round(data[i + 1] * tintG);
    data[i + 2] = Math.round(data[i + 2] * tintB);
    // alpha unchanged
  }

  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toBuffer();
}

/**
 * Load a terrain block texture, extracting just the first 16×16 frame
 * (handles animated textures like water_still.png which are 16×N).
 * If the texture needs biome tinting, applies the colormap tint.
 */
async function loadBlockTexture(key: string, filename: string): Promise<Buffer> {
  const filePath = path.join(BLOCK_DIR, filename);
  let buf = await sharp(filePath)
    .extract({ left: 0, top: 0, width: TILE_SIZE, height: TILE_SIZE })
    .png()
    .toBuffer();

  // Apply tint if needed (colormap sample or direct hex)
  const tintConfig = TINTED_TEXTURES[key];
  if (tintConfig) {
    let tint: { r: number; g: number; b: number };
    if (tintConfig.hex) {
      // Parse hex color like '#3F76E4'
      const hex = tintConfig.hex.replace('#', '');
      tint = {
        r: parseInt(hex.substring(0, 2), 16),
        g: parseInt(hex.substring(2, 4), 16),
        b: parseInt(hex.substring(4, 6), 16),
      };
      console.log(`    Tinting with hex ${tintConfig.hex} → rgb(${tint.r}, ${tint.g}, ${tint.b})`);
    } else {
      tint = await sampleColormap(tintConfig.colormap!, tintConfig.x!, tintConfig.y!);
      console.log(`    Tinting with colormap ${tintConfig.colormap} → rgb(${tint.r}, ${tint.g}, ${tint.b})`);
    }
    buf = await applyTint(buf, tint);
  }

  return buf;
}

async function main() {
  // Ensure output directory exists
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  console.log('Building texture atlas...');

  // Load all textures in order
  const textures: Buffer[] = [];

  for (const key of TEXTURE_ORDER) {
    if (key === 'fog') {
      console.log(`  Creating fog texture (programmatic)`);
      textures.push(await createFogTexture());
    } else if (key === 'player') {
      console.log(`  Creating player marker (from alex.png)`);
      textures.push(await createPlayerMarker());
    } else {
      const filename = TERRAIN_TEXTURES[key];
      console.log(`  Loading ${key} ← ${filename}`);
      textures.push(await loadBlockTexture(key, filename));
    }
  }

  // Compose into a horizontal strip: 8 textures × 16px = 128×16
  const atlasWidth = TEXTURE_ORDER.length * TILE_SIZE;
  const atlasHeight = TILE_SIZE;

  const compositeInputs = textures.map((buf, i) => ({
    input: buf,
    left: i * TILE_SIZE,
    top: 0,
  }));

  // Create a transparent base image and composite all textures onto it
  await sharp({
    create: {
      width: atlasWidth,
      height: atlasHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(compositeInputs)
    .png()
    .toFile(path.join(OUTPUT_DIR, 'atlas.png'));

  console.log(`  → public/atlas.png (${atlasWidth}×${atlasHeight})`);

  // Generate manifest
  const manifest: TextureAtlasManifest = {
    tileSize: TILE_SIZE,
    textures: {},
  };

  for (let i = 0; i < TEXTURE_ORDER.length; i++) {
    const key = TEXTURE_ORDER[i];
    const entry: AtlasEntry = {
      x: i * TILE_SIZE,
      y: 0,
      w: TILE_SIZE,
      h: TILE_SIZE,
    };
    manifest.textures[key] = entry;
  }

  await fs.writeFile(
    path.join(OUTPUT_DIR, 'atlas.json'),
    JSON.stringify(manifest, null, 2) + '\n',
  );

  console.log('  → public/atlas.json');
  console.log('Done!');
}

main().catch((err) => {
  console.error('Atlas build failed:', err);
  process.exit(1);
});
