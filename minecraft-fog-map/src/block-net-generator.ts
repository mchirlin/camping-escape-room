// Block Net Generator — renders printable T-shaped cube nets from Minecraft textures
// Supports biome colormap tinting for greyscale textures (grass, leaves, etc.)

const TEXTURE_BASE = './projects/2026-camping-minecraft/textures';
const FACE_PX = 16; // native Minecraft texture size

// Biome definitions with grass and foliage colors sampled from Minecraft colormaps
// Colors sourced from the Minecraft Wiki biome color tables
export interface BiomeDef {
  name: string;
  grass: string;
  foliage: string;
}

export const BIOMES: BiomeDef[] = [
  { name: 'Plains',           grass: '#91BD59', foliage: '#77AB2F' },
  { name: 'Forest',           grass: '#79C05A', foliage: '#59AE30' },
  { name: 'Birch Forest',     grass: '#88BB67', foliage: '#6BA941' },
  { name: 'Dark Forest',      grass: '#507A32', foliage: '#507A32' },
  { name: 'Jungle',           grass: '#59C93C', foliage: '#30BB0B' },
  { name: 'Swamp',            grass: '#6A7039', foliage: '#6A7039' },
  { name: 'Taiga',            grass: '#86B783', foliage: '#68A55F' },
  { name: 'Snowy Taiga',      grass: '#80B497', foliage: '#60A17B' },
  { name: 'Savanna',          grass: '#BFB755', foliage: '#AEA42A' },
  { name: 'Badlands',         grass: '#90814D', foliage: '#9E814D' },
  { name: 'Meadow',           grass: '#83BB6D', foliage: '#63A948' },
  { name: 'Cherry Grove',     grass: '#B6DB61', foliage: '#B6DB61' },
  { name: 'Mushroom Fields',  grass: '#55C93F', foliage: '#2BBB0F' },
  { name: 'Desert',           grass: '#BFB755', foliage: '#AEA42A' },
  { name: 'Snowy Plains',     grass: '#80B497', foliage: '#60A17B' },
  { name: 'Lush Caves',       grass: '#59C93C', foliage: '#30BB0B' },
];

// Current biome — mutable, set from UI
let currentBiome: BiomeDef = BIOMES[0];

export function setCurrentBiome(biome: BiomeDef) {
  currentBiome = biome;
}

export function getCurrentBiome(): BiomeDef {
  return currentBiome;
}

function getBiomeTint(type: string): string {
  if (type === 'grass') return currentBiome.grass;
  if (type === 'foliage') return currentBiome.foliage;
  return currentBiome.grass;
}

// Which block textures need biome tinting and which colormap to use
const TINTED_TEXTURES: Record<string, string> = {
  'grass_block_top.png': 'grass',
  'grass_block_side_overlay.png': 'grass',
  'short_grass.png': 'grass',
  'tall_grass_top.png': 'grass',
  'tall_grass_bottom.png': 'grass',
  'fern.png': 'grass',
  'large_fern_top.png': 'grass',
  'large_fern_bottom.png': 'grass',
  'sugar_cane.png': 'grass',
  'oak_leaves.png': 'foliage',
  'birch_leaves.png': 'foliage',
  'spruce_leaves.png': 'foliage',
  'jungle_leaves.png': 'foliage',
  'acacia_leaves.png': 'foliage',
  'dark_oak_leaves.png': 'foliage',
  'mangrove_leaves.png': 'foliage',
  'vine.png': 'foliage',
};

// Block definitions: which textures go on each face
// Faces: top, front, right, back, left, bottom
export type FaceMap = { top: string; front: string; right: string; back: string; left: string; bottom: string };

export interface BlockVariant {
  label: string;
  faces: Partial<FaceMap>; // only the faces that change
}

export interface BlockDef {
  name: string;
  category: string;
  faces: FaceMap;
  variants?: { name: string; options: BlockVariant[] };
}

// Helper for blocks where all 6 faces use the same texture
function uniform(cat: string, name: string, tex: string): BlockDef {
  return { name, category: cat, faces: { top: tex, front: tex, right: tex, back: tex, left: tex, bottom: tex } };
}

// Helper for blocks with top/bottom + 4 sides
function topSideBottom(cat: string, name: string, top: string, side: string, bottom: string): BlockDef {
  return { name, category: cat, faces: { top, front: side, right: side, back: side, left: side, bottom } };
}

// Helper for blocks with top + 4 sides (bottom = top)
function topSide(cat: string, name: string, top: string, side: string): BlockDef {
  return topSideBottom(cat, name, top, side, top);
}

// All blocks relevant to the escape room, plus common ones for flexibility
export const BLOCK_LIBRARY: BlockDef[] = [
  // --- Natural ---
  uniform('Natural', 'Stone', 'stone.png'),
  uniform('Natural', 'Cobblestone', 'cobblestone.png'),
  uniform('Natural', 'Dirt', 'coarse_dirt.png'),
  uniform('Natural', 'Sand', 'sand.png'),
  uniform('Natural', 'Gravel', 'gravel.png'),
  uniform('Natural', 'Clay', 'clay.png'),
  uniform('Natural', 'Bedrock', 'bedrock.png'),
  uniform('Natural', 'Obsidian', 'obsidian.png'),
  uniform('Natural', 'Crying Obsidian', 'crying_obsidian.png'),
  uniform('Natural', 'Moss Block', 'moss_block.png'),
  uniform('Natural', 'Snow', 'snow.png'),
  {
    name: 'Grass Block', category: 'Natural',
    faces: {
      top: 'grass_block_top.png',
      front: 'composite:grass_block_side.png+grass_block_side_overlay.png',
      right: 'composite:grass_block_side.png+grass_block_side_overlay.png',
      back: 'composite:grass_block_side.png+grass_block_side_overlay.png',
      left: 'composite:grass_block_side.png+grass_block_side_overlay.png',
      bottom: 'dirt.png',
    },
  },
  topSideBottom('Natural', 'Mycelium', 'mycelium_top.png', 'mycelium_side.png', 'dirt.png'),

  // --- Wood & Logs ---
  uniform('Wood', 'Oak Planks', 'oak_planks.png'),
  uniform('Wood', 'Birch Planks', 'birch_planks.png'),
  uniform('Wood', 'Spruce Planks', 'spruce_planks.png'),
  uniform('Wood', 'Jungle Planks', 'jungle_planks.png'),
  uniform('Wood', 'Dark Oak Planks', 'dark_oak_planks.png'),
  topSide('Wood', 'Oak Log', 'oak_log_top.png', 'oak_log.png'),
  topSide('Wood', 'Birch Log', 'birch_log_top.png', 'birch_log.png'),
  topSide('Wood', 'Spruce Log', 'spruce_log_top.png', 'spruce_log.png'),
  topSide('Wood', 'Jungle Log', 'jungle_log_top.png', 'jungle_log.png'),
  topSide('Wood', 'Dark Oak Log', 'dark_oak_log_top.png', 'dark_oak_log.png'),

  // --- Leaves ---
  uniform('Leaves', 'Oak Leaves', 'oak_leaves.png'),
  uniform('Leaves', 'Birch Leaves', 'birch_leaves.png'),
  uniform('Leaves', 'Spruce Leaves', 'spruce_leaves.png'),
  uniform('Leaves', 'Jungle Leaves', 'jungle_leaves.png'),
  uniform('Leaves', 'Dark Oak Leaves', 'dark_oak_leaves.png'),

  // --- Ores ---
  uniform('Ores', 'Coal Ore', 'coal_ore.png'),
  uniform('Ores', 'Iron Ore', 'iron_ore.png'),
  uniform('Ores', 'Gold Ore', 'gold_ore.png'),
  uniform('Ores', 'Diamond Ore', 'diamond_ore.png'),
  uniform('Ores', 'Emerald Ore', 'emerald_ore.png'),
  uniform('Ores', 'Redstone Ore', 'redstone_ore.png'),
  uniform('Ores', 'Lapis Ore', 'lapis_ore.png'),
  uniform('Ores', 'Copper Ore', 'copper_ore.png'),

  // --- Mineral Blocks ---
  uniform('Mineral Blocks', 'Iron Block', 'iron_block.png'),
  uniform('Mineral Blocks', 'Gold Block', 'gold_block.png'),
  uniform('Mineral Blocks', 'Diamond Block', 'diamond_block.png'),
  uniform('Mineral Blocks', 'Emerald Block', 'emerald_block.png'),
  uniform('Mineral Blocks', 'Coal Block', 'coal_block.png'),
  uniform('Mineral Blocks', 'Redstone Block', 'redstone_block.png'),
  uniform('Mineral Blocks', 'Lapis Block', 'lapis_block.png'),
  uniform('Mineral Blocks', 'Copper Block', 'copper_block.png'),
  uniform('Mineral Blocks', 'Amethyst Block', 'amethyst_block.png'),
  uniform('Mineral Blocks', 'Raw Iron Block', 'raw_iron_block.png'),
  uniform('Mineral Blocks', 'Raw Gold Block', 'raw_gold_block.png'),
  uniform('Mineral Blocks', 'Raw Copper Block', 'raw_copper_block.png'),

  // --- Stone Variants ---
  uniform('Stone', 'Smooth Stone', 'smooth_stone.png'),
  uniform('Stone', 'Stone Bricks', 'stone_bricks.png'),
  uniform('Stone', 'Bricks', 'bricks.png'),
  uniform('Stone', 'Mud Bricks', 'mud_bricks.png'),
  uniform('Stone', 'Prismarine Bricks', 'prismarine_bricks.png'),
  uniform('Stone', 'Nether Bricks', 'nether_bricks.png'),
  uniform('Stone', 'Purpur Block', 'purpur_block.png'),
  uniform('Stone', 'Terracotta', 'terracotta.png'),
  topSide('Stone', 'Deepslate', 'deepslate_top.png', 'deepslate.png'),
  topSide('Stone', 'Basalt', 'basalt_top.png', 'basalt_side.png'),
  uniform('Stone', 'Blackstone', 'blackstone.png'),
  topSide('Stone', 'Sandstone', 'sandstone_top.png', 'sandstone.png'),
  topSideBottom('Stone', 'Quartz Block', 'quartz_block_top.png', 'quartz_block_side.png', 'quartz_block_bottom.png'),

  // --- Nether ---
  uniform('Nether', 'Netherrack', 'netherrack.png'),
  uniform('Nether', 'Soul Sand', 'soul_sand.png'),
  uniform('Nether', 'Soul Soil', 'soul_soil.png'),
  uniform('Nether', 'Nether Wart Block', 'nether_wart_block.png'),
  uniform('Nether', 'Warped Wart Block', 'warped_wart_block.png'),
  uniform('Nether', 'Magma', 'magma.png'),
  uniform('Nether', 'Glowstone', 'glowstone.png'),
  uniform('Nether', 'Lava', 'lava_still.png'),

  // --- Ice & Snow ---
  uniform('Ice', 'Packed Ice', 'packed_ice.png'),
  uniform('Ice', 'Blue Ice', 'blue_ice.png'),

  // --- Functional ---
  topSideBottom('Functional', 'Crafting Table', 'crafting_table_top.png', 'crafting_table_front.png', 'oak_planks.png'),
  {
    name: 'Furnace', category: 'Functional',
    faces: {
      top: 'furnace_top.png', front: 'furnace_front.png',
      right: 'furnace_side.png', back: 'furnace_side.png',
      left: 'furnace_side.png', bottom: 'furnace_top.png',
    },
  },
  topSideBottom('Functional', 'Enchanting Table', 'enchanting_table_top.png', 'enchanting_table_side.png', 'enchanting_table_bottom.png'),
  uniform('Functional', 'Bookshelf', 'bookshelf.png'),
  {
    name: 'Chiseled Bookshelf', category: 'Functional',
    faces: {
      top: 'chiseled_bookshelf_top.png', front: 'chiseled_bookshelf_empty.png',
      right: 'chiseled_bookshelf_side.png', back: 'chiseled_bookshelf_side.png',
      left: 'chiseled_bookshelf_side.png', bottom: 'chiseled_bookshelf_top.png',
    },
    variants: {
      name: 'Books',
      options: [
        { label: '0 (Empty)', faces: { front: 'chiseled_bookshelf_empty.png' } },
        { label: '1 Book', faces: { front: 'bookshelf_slots:1' } },
        { label: '2 Books', faces: { front: 'bookshelf_slots:2' } },
        { label: '3 Books', faces: { front: 'bookshelf_slots:3' } },
        { label: '4 Books', faces: { front: 'bookshelf_slots:4' } },
        { label: '5 Books', faces: { front: 'bookshelf_slots:5' } },
        { label: '6 (Full)', faces: { front: 'chiseled_bookshelf_occupied.png' } },
      ],
    },
  },
  uniform('Functional', 'Note Block', 'note_block.png'),
  uniform('Functional', 'Beacon', 'beacon.png'),
  topSide('Functional', 'Lodestone', 'lodestone_top.png', 'lodestone_side.png'),
  uniform('Functional', 'Spawner', 'spawner.png'),

  // --- Food & Farm ---
  topSide('Food & Farm', 'Melon', 'melon_top.png', 'melon_side.png'),
  topSideBottom('Food & Farm', 'Pumpkin', 'pumpkin_top.png', 'pumpkin_side.png', 'pumpkin_top.png'),
  {
    name: 'Carved Pumpkin', category: 'Food & Farm',
    faces: {
      top: 'pumpkin_top.png', front: 'carved_pumpkin.png',
      right: 'pumpkin_side.png', back: 'pumpkin_side.png',
      left: 'pumpkin_side.png', bottom: 'pumpkin_top.png',
    },
    variants: {
      name: 'Face',
      options: [
        { label: 'Carved', faces: { front: 'carved_pumpkin.png' } },
        { label: 'Jack o\'Lantern', faces: { front: 'jack_o_lantern.png' } },
      ],
    },
  },
  topSide('Food & Farm', 'Hay Block', 'hay_block_top.png', 'hay_block_side.png'),
  uniform('Food & Farm', 'Honeycomb Block', 'honeycomb_block.png'),

  // --- Explosive & Misc ---
  topSideBottom('Misc', 'TNT', 'tnt_top.png', 'tnt_side.png', 'tnt_bottom.png'),
  uniform('Misc', 'Slime Block', 'slime_block.png'),

  // --- Misc ---
  uniform('Misc', 'End Stone', 'end_stone.png'),
  uniform('Misc', 'Sponge', 'sponge.png'),
  topSide('Misc', 'Bone Block', 'bone_block_top.png', 'bone_block_side.png'),
  uniform('Misc', 'Dragon Egg', 'dragon_egg.png'),
  uniform('Misc', 'Red Mushroom Block', 'red_mushroom_block.png'),
  uniform('Misc', 'Brown Mushroom Block', 'brown_mushroom_block.png'),

  // --- Wool ---
  uniform('Wool', 'White Wool', 'white_wool.png'),
  uniform('Wool', 'Light Gray Wool', 'light_gray_wool.png'),
  uniform('Wool', 'Gray Wool', 'gray_wool.png'),
  uniform('Wool', 'Black Wool', 'black_wool.png'),
  uniform('Wool', 'Brown Wool', 'brown_wool.png'),
  uniform('Wool', 'Red Wool', 'red_wool.png'),
  uniform('Wool', 'Orange Wool', 'orange_wool.png'),
  uniform('Wool', 'Yellow Wool', 'yellow_wool.png'),
  uniform('Wool', 'Lime Wool', 'lime_wool.png'),
  uniform('Wool', 'Green Wool', 'green_wool.png'),
  uniform('Wool', 'Cyan Wool', 'cyan_wool.png'),
  uniform('Wool', 'Light Blue Wool', 'light_blue_wool.png'),
  uniform('Wool', 'Blue Wool', 'blue_wool.png'),
  uniform('Wool', 'Purple Wool', 'purple_wool.png'),
  uniform('Wool', 'Magenta Wool', 'magenta_wool.png'),
  uniform('Wool', 'Pink Wool', 'pink_wool.png'),

  // --- Concrete ---
  uniform('Concrete', 'White Concrete', 'white_concrete.png'),
  uniform('Concrete', 'Light Gray Concrete', 'light_gray_concrete.png'),
  uniform('Concrete', 'Gray Concrete', 'gray_concrete.png'),
  uniform('Concrete', 'Black Concrete', 'black_concrete.png'),
  uniform('Concrete', 'Brown Concrete', 'brown_concrete.png'),
  uniform('Concrete', 'Red Concrete', 'red_concrete.png'),
  uniform('Concrete', 'Orange Concrete', 'orange_concrete.png'),
  uniform('Concrete', 'Yellow Concrete', 'yellow_concrete.png'),
  uniform('Concrete', 'Lime Concrete', 'lime_concrete.png'),
  uniform('Concrete', 'Green Concrete', 'green_concrete.png'),
  uniform('Concrete', 'Cyan Concrete', 'cyan_concrete.png'),
  uniform('Concrete', 'Light Blue Concrete', 'light_blue_concrete.png'),
  uniform('Concrete', 'Blue Concrete', 'blue_concrete.png'),
  uniform('Concrete', 'Purple Concrete', 'purple_concrete.png'),
  uniform('Concrete', 'Pink Concrete', 'pink_concrete.png'),
];

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load: ${src}`));
    img.src = src;
  });
}

// Apply biome tint to a texture using multiply blend
function tintTexture(
  source: HTMLCanvasElement | HTMLImageElement,
  tintColor: string,
  size: number,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Draw original
  ctx.drawImage(source, 0, 0, size, size);

  // Multiply blend the tint color
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = tintColor;
  ctx.fillRect(0, 0, size, size);

  // Restore alpha from original
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(source, 0, 0, size, size);

  return canvas;
}

async function loadFaceTexture(filename: string, faceSize: number): Promise<HTMLCanvasElement> {
  // Bookshelf slots: "bookshelf_slots:N" — composite N book slots from occupied onto empty
  if (filename.startsWith('bookshelf_slots:')) {
    const count = parseInt(filename.split(':')[1]);
    const emptyImg = await loadImage(`${TEXTURE_BASE}/block/chiseled_bookshelf_empty.png`);
    const fullImg = await loadImage(`${TEXTURE_BASE}/block/chiseled_bookshelf_occupied.png`);

    const canvas = document.createElement('canvas');
    canvas.width = faceSize;
    canvas.height = faceSize;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;

    // Draw empty base
    const srcSize = emptyImg.naturalWidth;
    ctx.drawImage(emptyImg, 0, 0, srcSize, srcSize, 0, 0, faceSize, faceSize);

    // Each slot is ~5px wide in a 16px texture, 2 rows of 3
    // Books sit at bottom of each shelf row
    // Top row: y=2..7, Bottom row: y=9..14
    // Columns: x=1..5, x=6..10, x=11..15
    const slotW = 5, slotH = 6;
    // Randomized fill order for natural look
    const slots = [
      { x: 1, y: 2 },   // top-left
      { x: 6, y: 9 },   // bottom-middle
      { x: 11, y: 2 },  // top-right
      { x: 1, y: 9 },   // bottom-left
      { x: 6, y: 2 },   // top-middle
      { x: 11, y: 9 },  // bottom-right
    ];
    const scale = faceSize / srcSize;
    for (let i = 0; i < count && i < 6; i++) {
      const s = slots[i];
      ctx.drawImage(fullImg,
        s.x, s.y, slotW, slotH,
        Math.round(s.x * scale), Math.round(s.y * scale),
        Math.round(slotW * scale), Math.round(slotH * scale));
    }
    return canvas;
  }

  // Composite texture: "composite:base.png+overlay.png" — overlay gets biome tinted
  if (filename.startsWith('composite:')) {
    const [base, overlay] = filename.slice('composite:'.length).split('+');
    const baseImg = await loadImage(`${TEXTURE_BASE}/block/${base}`);
    const overlayImg = await loadImage(`${TEXTURE_BASE}/block/${overlay}`);

    const canvas = document.createElement('canvas');
    canvas.width = faceSize;
    canvas.height = faceSize;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(baseImg, 0, 0, faceSize, faceSize);

    // Tint the overlay and draw on top
    const tintType = TINTED_TEXTURES[overlay];
    const overlayCanvas = document.createElement('canvas');
    overlayCanvas.width = faceSize;
    overlayCanvas.height = faceSize;
    const oCtx = overlayCanvas.getContext('2d')!;
    oCtx.imageSmoothingEnabled = false;
    oCtx.drawImage(overlayImg, 0, 0, faceSize, faceSize);

    const tinted = tintType
      ? tintTexture(overlayCanvas, getBiomeTint(tintType), faceSize)
      : overlayCanvas;
    ctx.drawImage(tinted, 0, 0);
    return canvas;
  }

  const img = await loadImage(`${TEXTURE_BASE}/block/${filename}`);

  const canvas = document.createElement('canvas');
  canvas.width = faceSize;
  canvas.height = faceSize;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false; // keep pixel art crisp
  // Animated textures are taller than wide (multiple frames stacked); crop first frame
  const srcSize = img.naturalWidth;
  ctx.drawImage(img, 0, 0, srcSize, srcSize, 0, 0, faceSize, faceSize);

  // Apply biome tint if needed
  const tintType = TINTED_TEXTURES[filename];
  if (tintType) {
    return tintTexture(canvas, getBiomeTint(tintType), faceSize);
  }

  return canvas;
}

/**
 * T-shaped net layout (each cell = one face):
 *
 *        [  top  ]
 * [left] [front ] [right] [ back ]
 *        [bottom]
 *
 * Grid coordinates (col, row) where each face sits:
 *   top:    (1, 0)
 *   left:   (0, 1)
 *   front:  (1, 1)
 *   right:  (2, 1)
 *   back:   (3, 1)
 *   bottom: (1, 2)
 */
export async function renderBlockNet(
  block: BlockDef,
  faceSize: number,
): Promise<HTMLCanvasElement> {
  const netWidth = 4 * faceSize;
  const netHeight = 3 * faceSize;

  const canvas = document.createElement('canvas');
  canvas.width = netWidth;
  canvas.height = netHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  // White background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Face positions in grid
  const facePositions: { face: keyof BlockDef['faces']; col: number; row: number }[] = [
    { face: 'top', col: 1, row: 0 },
    { face: 'left', col: 0, row: 1 },
    { face: 'front', col: 1, row: 1 },
    { face: 'right', col: 2, row: 1 },
    { face: 'back', col: 3, row: 1 },
    { face: 'bottom', col: 1, row: 2 },
  ];

  // Load and draw each face
  for (const { face, col, row } of facePositions) {
    const tex = await loadFaceTexture(block.faces[face], faceSize);
    ctx.drawImage(tex, col * faceSize, row * faceSize);
  }

  const s = faceSize;

  // Outline the T-shape (cut lines)
  ctx.strokeStyle = '#999';
  ctx.lineWidth = 1;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(s, 0);
  ctx.lineTo(2 * s, 0);
  ctx.lineTo(2 * s, s);
  ctx.lineTo(4 * s, s);
  ctx.lineTo(4 * s, 2 * s);
  ctx.lineTo(2 * s, 2 * s);
  ctx.lineTo(2 * s, 3 * s);
  ctx.lineTo(s, 3 * s);
  ctx.lineTo(s, 2 * s);
  ctx.lineTo(0, 2 * s);
  ctx.lineTo(0, s);
  ctx.lineTo(s, s);
  ctx.closePath();
  ctx.stroke();

  // Fold lines (dashed)
  ctx.setLineDash([6, 4]);
  ctx.strokeStyle = '#ccc';
  const foldLines = [
    [s, s, 2 * s, s],
    [s, 2 * s, 2 * s, 2 * s],
    [s, s, s, 2 * s],
    [2 * s, s, 2 * s, 2 * s],
    [3 * s, s, 3 * s, 2 * s],
  ];
  for (const [x1, y1, x2, y2] of foldLines) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  return canvas;
}

// Get sorted list of all block names
export function getBlockNames(): string[] {
  return BLOCK_LIBRARY.map((b) => b.name).sort();
}

export function getBlockByName(name: string): BlockDef | undefined {
  return BLOCK_LIBRARY.find((b) => b.name === name);
}

export function applyVariant(block: BlockDef, variantIndex: number): BlockDef {
  if (!block.variants || variantIndex < 0) return block;
  const v = block.variants.options[variantIndex];
  if (!v) return block;
  return { ...block, faces: { ...block.faces, ...v.faces } };
}

export function blockUsesBiomeTint(block: BlockDef): boolean {
  return Object.values(block.faces).some(tex => {
    if (tex.startsWith('composite:')) {
      const overlay = tex.split('+')[1];
      return overlay in TINTED_TEXTURES;
    }
    return tex in TINTED_TEXTURES;
  });
}
