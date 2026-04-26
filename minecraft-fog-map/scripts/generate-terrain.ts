/**
 * Terrain Generator — Build-time script
 *
 * Queries the Overpass API for OSM features within a bounding box,
 * classifies each grid cell by terrain type, and outputs
 * public/terrain-data.json for all 5 zoom levels.
 *
 * Usage: npx tsx scripts/generate-terrain.ts
 */

import fs from 'fs/promises';
import path from 'path';
import type { BoundingBox, TerrainData, ZoomLevelData } from '../src/types.js';
import { ZOOM_LEVELS } from '../src/types.js';
import { calculateGridSize, bboxSizeMeters, metersPerDegLng } from '../src/terrain-utils.js';

// --- Configuration ---

const DEFAULT_BBOX: BoundingBox = {
  north: 38.883522,
  south: 38.879032,
  east: -77.240148,
  west: -77.245920,
};

// Allow overriding via environment variables
function getBBox(): BoundingBox {
  if (process.env.TERRAIN_NORTH) {
    return {
      north: parseFloat(process.env.TERRAIN_NORTH!),
      south: parseFloat(process.env.TERRAIN_SOUTH!),
      east: parseFloat(process.env.TERRAIN_EAST!),
      west: parseFloat(process.env.TERRAIN_WEST!),
    };
  }
  return DEFAULT_BBOX;
}

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const OUTPUT_DIR = path.resolve('public');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'terrain-data.json');

// Single-character terrain codes for compact JSON storage
type TerrainCode = 'g' | 'f' | 'w' | 'p' | 'r' | 'b' | 's';

const TERRAIN_CODE_MAP: Record<string, TerrainCode> = {
  grass: 'g',
  forest: 'f',
  water: 'w',
  path: 'p',
  road: 'r',
  building: 'b',
  sand: 's',
};

// --- Overpass API types ---

interface OverpassResponse {
  elements: OverpassElement[];
}

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  tags?: Record<string, string>;
  lat?: number;
  lon?: number;
  bounds?: { minlat: number; minlon: number; maxlat: number; maxlon: number };
  geometry?: Array<{ lat: number; lon: number }>;
}

// --- Overpass query ---

/**
 * Build an Overpass QL query that fetches all relevant features
 * (water, forest, paths, buildings, sand) within the bounding box.
 * Requests geometry so we can determine spatial coverage.
 */
function buildOverpassQuery(bbox: BoundingBox): string {
  const b = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
  return `
[out:json][timeout:60];
(
  way["natural"="water"](${b});
  way["waterway"](${b});
  relation["natural"="water"](${b});
  way["natural"="wood"](${b});
  way["landuse"="forest"](${b});
  way["highway"="path"](${b});
  way["highway"="footway"](${b});
  way["highway"="track"](${b});
  way["highway"="service"](${b});
  way["highway"="residential"](${b});
  way["highway"="unclassified"](${b});
  way["highway"="tertiary"](${b});
  way["highway"="secondary"](${b});
  way["highway"="primary"](${b});
  way["building"](${b});
  way["natural"="sand"](${b});
  way["natural"="beach"](${b});
  way["leisure"="parking"](${b});
);
out body geom;
`;
}

async function queryOverpass(bbox: BoundingBox): Promise<OverpassElement[]> {
  const query = buildOverpassQuery(bbox);
  console.log('Querying Overpass API...');

  const url = `${OVERPASS_URL}?data=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'MinecraftFogMap/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`Overpass API error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as OverpassResponse;
  console.log(`  Received ${data.elements.length} elements`);
  return data.elements;
}

// --- Terrain classification ---

/**
 * Classify an OSM element into a terrain type based on its tags.
 * Returns null if the element doesn't match any known terrain type.
 */
function classifyElement(tags: Record<string, string>): string | null {
  // Water: natural=water or waterway=*
  if (tags['natural'] === 'water' || tags['waterway']) {
    return 'water';
  }
  // Forest: natural=wood or landuse=forest
  if (tags['natural'] === 'wood' || tags['landuse'] === 'forest') {
    return 'forest';
  }
  // Path/road: any highway type
  if (tags['highway']) {
    const hw = tags['highway'];
    // Paved roads → 'road' (cobblestone color)
    if (['service', 'residential', 'unclassified', 'tertiary', 'secondary', 'primary'].includes(hw)) {
      return 'road';
    }
    // Trails/footpaths → 'path' (dirt color)
    return 'path';
  }
  // Parking lots
  if (tags['leisure'] === 'parking') {
    return 'building';
  }
  // Building: building=*
  if (tags['building']) {
    return 'building';
  }
  // Sand: natural=sand or natural=beach
  if (tags['natural'] === 'sand' || tags['natural'] === 'beach') {
    return 'sand';
  }
  return null;
}

// --- Geometry helpers ---

const METERS_PER_DEG_LAT = 111_320;

/**
 * Check if a point is inside a polygon using ray-casting algorithm.
 */
function pointInPolygon(
  lat: number,
  lng: number,
  polygon: Array<{ lat: number; lon: number }>
): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const yi = polygon[i].lat;
    const xi = polygon[i].lon;
    const yj = polygon[j].lat;
    const xj = polygon[j].lon;

    const intersect =
      yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Check if a point is within a given distance (in meters) of a polyline.
 */
function pointNearPolyline(
  lat: number,
  lng: number,
  polyline: Array<{ lat: number; lon: number }>,
  thresholdMeters: number
): boolean {
  const cosLat = Math.cos((lat * Math.PI) / 180);
  for (let i = 0; i < polyline.length - 1; i++) {
    const dist = pointToSegmentDistance(
      lat,
      lng,
      polyline[i].lat,
      polyline[i].lon,
      polyline[i + 1].lat,
      polyline[i + 1].lon,
      cosLat
    );
    if (dist <= thresholdMeters) return true;
  }
  return false;
}

/**
 * Approximate distance in meters from a point to a line segment.
 */
function pointToSegmentDistance(
  pLat: number,
  pLng: number,
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
  cosLat: number
): number {
  // Convert to approximate meters
  const px = (pLng - aLng) * METERS_PER_DEG_LAT * cosLat;
  const py = (pLat - aLat) * METERS_PER_DEG_LAT;
  const bx = (bLng - aLng) * METERS_PER_DEG_LAT * cosLat;
  const by = (bLat - aLat) * METERS_PER_DEG_LAT;

  const dot = px * bx + py * by;
  const lenSq = bx * bx + by * by;
  let t = lenSq === 0 ? 0 : dot / lenSq;
  t = Math.max(0, Math.min(1, t));

  const dx = px - t * bx;
  const dy = py - t * by;
  return Math.sqrt(dx * dx + dy * dy);
}

// --- Grid generation ---

/**
 * Priority order for terrain types when multiple features overlap a cell.
 * Higher priority wins. Water and buildings take precedence over paths/forest.
 */
const TERRAIN_PRIORITY: Record<string, number> = {
  water: 5,
  building: 4,
  road: 3,
  path: 3,
  sand: 2,
  forest: 1,
  grass: 0,
};

/**
 * Determine if an element (area or line) covers a given grid cell center.
 * Line features (paths, waterways) use fixed real-world widths.
 * Area features (forests, lakes, buildings) use point-in-polygon.
 */
function elementCoversCell(
  element: OverpassElement,
  cellLat: number,
  cellLng: number,
  metersPerTile: number
): boolean {
  const geom = element.geometry;
  if (!geom || geom.length === 0) return false;

  const tags = element.tags ?? {};
  const terrainType = classifyElement(tags);

  // Waterways are line features — use a fixed width of 3m
  // (small streams are ~1-3m wide in reality)
  if (tags['waterway']) {
    return pointNearPolyline(cellLat, cellLng, geom, 3);
  }

  // Paths/footways/tracks and roads are line features
  if (terrainType === 'path' || terrainType === 'road') {
    const hw = tags['highway'] ?? '';
    const isRoad = ['service', 'residential', 'unclassified', 'tertiary', 'secondary', 'primary'].includes(hw);
    const width = isRoad ? 4 : 2;
    return pointNearPolyline(cellLat, cellLng, geom, width);
  }

  // Area features: check point-in-polygon
  return pointInPolygon(cellLat, cellLng, geom);
}

/**
 * Generate the terrain grid for a single zoom level.
 * Area features (forest, building, water bodies) use supersampling at coarse levels.
 * Line features (streams, paths) only check the tile center — they naturally
 * become thinner at coarser levels since each tile represents more meters.
 */
function generateGrid(
  bbox: BoundingBox,
  cols: number,
  rows: number,
  metersPerTile: number,
  elements: OverpassElement[]
): TerrainCode[][] {
  const grid: TerrainCode[][] = [];

  const latRange = bbox.north - bbox.south;
  const lngRange = bbox.east - bbox.west;

  // Separate elements into line features and area features
  const lineElements: OverpassElement[] = [];
  const areaElements: OverpassElement[] = [];
  for (const el of elements) {
    const tags = el.tags ?? {};
    if (tags['waterway'] || tags['highway']) {
      lineElements.push(el);
    } else {
      areaElements.push(el);
    }
  }

  // Supersampling only for area features at coarse levels
  const samplesPerAxis = metersPerTile <= 2 ? 1 : metersPerTile <= 4 ? 2 : 4;

  for (let row = 0; row < rows; row++) {
    const gridRow: TerrainCode[] = [];
    for (let col = 0; col < cols; col++) {
      let bestTerrain = 'grass';
      let bestPriority = TERRAIN_PRIORITY['grass'];

      // 1. Check area features with supersampling
      for (let sy = 0; sy < samplesPerAxis && bestPriority < 5; sy++) {
        for (let sx = 0; sx < samplesPerAxis && bestPriority < 5; sx++) {
          const sampleLat = bbox.north - ((row + (sy + 0.5) / samplesPerAxis) / rows) * latRange;
          const sampleLng = bbox.west + ((col + (sx + 0.5) / samplesPerAxis) / cols) * lngRange;

          for (const element of areaElements) {
            const terrain = classifyElement(element.tags ?? {});
            if (!terrain) continue;
            const priority = TERRAIN_PRIORITY[terrain] ?? 0;
            if (priority <= bestPriority) continue;
            if (elementCoversCell(element, sampleLat, sampleLng, metersPerTile)) {
              bestTerrain = terrain;
              bestPriority = priority;
            }
          }
        }
      }

      // 2. Check line features with center point only
      const centerLat = bbox.north - ((row + 0.5) / rows) * latRange;
      const centerLng = bbox.west + ((col + 0.5) / cols) * lngRange;

      for (const element of lineElements) {
        const terrain = classifyElement(element.tags ?? {});
        if (!terrain) continue;
        const priority = TERRAIN_PRIORITY[terrain] ?? 0;
        if (priority <= bestPriority) continue;
        if (elementCoversCell(element, centerLat, centerLng, metersPerTile)) {
          bestTerrain = terrain;
          bestPriority = priority;
        }
      }

      gridRow.push(TERRAIN_CODE_MAP[bestTerrain]);
    }
    grid.push(gridRow);
  }

  return grid;
}

// --- Main ---

// --- Elevation & Shading ---

const ELEVATION_API_URL = 'https://api.opentopodata.org/v1/ned10m';

/**
 * Fetch elevation data from Open Topo Data (ned10m, 10m resolution).
 * Batches in groups of 100 with 1.1s delay between requests.
 */
async function fetchElevationGrid(
  bbox: BoundingBox,
  cols: number,
  rows: number
): Promise<number[][]> {
  const latRange = bbox.north - bbox.south;
  const lngRange = bbox.east - bbox.west;

  const coords: { lat: number; lng: number; row: number; col: number }[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      coords.push({
        lat: bbox.north - ((row + 0.5) / rows) * latRange,
        lng: bbox.west + ((col + 0.5) / cols) * lngRange,
        row,
        col,
      });
    }
  }

  const elevation: number[][] = Array.from({ length: rows }, () => new Array(cols).fill(0));

  const BATCH_SIZE = 100;
  const totalBatches = Math.ceil(coords.length / BATCH_SIZE);
  console.log(`  Fetching elevation: ${coords.length} points in ${totalBatches} batches (~${totalBatches}s)...`);

  for (let i = 0; i < coords.length; i += BATCH_SIZE) {
    const batch = coords.slice(i, i + BATCH_SIZE);
    const locations = batch.map((c) => `${c.lat.toFixed(6)},${c.lng.toFixed(6)}`).join('|');

    const url = `${ELEVATION_API_URL}?locations=${locations}`;
    let res: Response | null = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      res = await fetch(url);
      if (res.ok) break;
      if (res.status === 429) {
        const wait = 3000 * (attempt + 1);
        console.warn(`  Batch ${Math.floor(i / BATCH_SIZE) + 1} rate limited, retrying in ${wait / 1000}s...`);
        await new Promise((r) => setTimeout(r, wait));
      } else {
        break;
      }
    }

    if (!res || !res.ok) {
      console.warn(`  Elevation batch ${Math.floor(i / BATCH_SIZE) + 1}/${totalBatches} failed: ${res?.status ?? 'no response'}`);
      continue;
    }

    const data = (await res.json()) as { results: Array<{ elevation: number | null }> };
    for (let j = 0; j < batch.length; j++) {
      elevation[batch[j].row][batch[j].col] = data.results[j]?.elevation ?? 0;
    }

    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    if (batchNum % 10 === 0 || batchNum === totalBatches) {
      console.log(`  Batch ${batchNum}/${totalBatches} done`);
    }

    // Open Topo Data allows 1 request/second
    if (i + BATCH_SIZE < coords.length) {
      await new Promise((r) => setTimeout(r, 1100));
    }
  }

  return elevation;
}

/**
 * Bilinear interpolation of a coarse elevation grid to a finer grid.
 */
function interpolateElevation(
  coarse: number[][],
  coarseRows: number,
  coarseCols: number,
  fineRows: number,
  fineCols: number
): number[][] {
  const result: number[][] = Array.from({ length: fineRows }, () => new Array(fineCols).fill(0));

  for (let row = 0; row < fineRows; row++) {
    for (let col = 0; col < fineCols; col++) {
      // Map fine grid position to coarse grid position
      const cy = (row / fineRows) * coarseRows;
      const cx = (col / fineCols) * coarseCols;

      const y0 = Math.min(Math.floor(cy), coarseRows - 1);
      const y1 = Math.min(y0 + 1, coarseRows - 1);
      const x0 = Math.min(Math.floor(cx), coarseCols - 1);
      const x1 = Math.min(x0 + 1, coarseCols - 1);

      const fy = cy - y0;
      const fx = cx - x0;

      // Bilinear interpolation
      const v00 = coarse[y0][x0];
      const v10 = coarse[y0][x1];
      const v01 = coarse[y1][x0];
      const v11 = coarse[y1][x1];

      result[row][col] = v00 * (1 - fx) * (1 - fy)
        + v10 * fx * (1 - fy)
        + v01 * (1 - fx) * fy
        + v11 * fx * fy;
    }
  }

  return result;
}

/**
 * Compute Minecraft-style north-south shading from an elevation grid.
 * Compares each tile's elevation to the tile directly north (row - 1).
 *
 * Adds subtle randomness so flat areas aren't uniformly the same shade —
 * matching how real Minecraft maps have visual variation even in flat biomes.
 *
 * Returns a 2D array of shade multipliers:
 *   0.71 = tile is lower than north neighbor (darker)
 *   0.86 = same height (normal)
 *   1.00 = tile is higher than north neighbor (brighter)
 */
function computeShading(elevation: number[][], rows: number, cols: number): number[][] {
  const SHADE_DARK = 0.71;
  const SHADE_NORMAL = 0.86;
  const SHADE_BRIGHT = 1.0;
  const SHADES = [SHADE_DARK, SHADE_NORMAL, SHADE_BRIGHT];

  // Threshold in meters — differences smaller than this count as "same height"
  const THRESHOLD = 0.5;

  // Simple seeded PRNG for deterministic randomness
  let seed = 12345;
  function rand(): number {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  }

  const shading: number[][] = Array.from({ length: rows }, () => new Array(cols).fill(SHADE_NORMAL));

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (row === 0) {
        // First row: random shade since no north neighbor
        const r = rand();
        shading[row][col] = r < 0.2 ? SHADE_DARK : r < 0.8 ? SHADE_NORMAL : SHADE_BRIGHT;
        continue;
      }

      const current = elevation[row][col];
      const north = elevation[row - 1][col];
      const diff = current - north;

      if (diff > THRESHOLD) {
        shading[row][col] = SHADE_BRIGHT;
      } else if (diff < -THRESHOLD) {
        shading[row][col] = SHADE_DARK;
      } else {
        // Same height — add subtle randomness
        // 70% normal, 15% dark, 15% bright
        const r = rand();
        shading[row][col] = r < 0.15 ? SHADE_DARK : r < 0.85 ? SHADE_NORMAL : SHADE_BRIGHT;
      }
    }
  }

  return shading;
}

// --- Main ---

async function main() {
  const bbox = getBBox();

  console.log('Terrain Generator');
  console.log(`  Region: N${bbox.north} S${bbox.south} E${bbox.east} W${bbox.west}`);

  const { widthM, heightM } = bboxSizeMeters(bbox);
  console.log(`  Size: ${widthM.toFixed(0)}m × ${heightM.toFixed(0)}m`);

  // Ensure output directory exists
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  // Query OSM data
  const elements = await queryOverpass(bbox);

  // Fetch elevation at level-2 resolution (65×70 = 4550 points, ~46 API calls)
  // Good balance of detail vs API calls, then interpolate to other levels
  const level2Config = ZOOM_LEVELS.find((zl) => zl.level === 2)!;
  const level2Grid = calculateGridSize(bbox, level2Config.metersPerTile);
  console.log(`  Fetching elevation at level-2 resolution: ${level2Grid.cols}×${level2Grid.rows}`);
  const baseElevation = await fetchElevationGrid(bbox, level2Grid.cols, level2Grid.rows);

  const elevMin = Math.min(...baseElevation.flat());
  const elevMax = Math.max(...baseElevation.flat());
  console.log(`  Elevation range: ${elevMin.toFixed(1)}m – ${elevMax.toFixed(1)}m`);

  // Generate grids for all zoom levels
  const zoomLevels: Array<{
    level: number;
    cols: number;
    rows: number;
    metersPerTile: number;
    grid: TerrainCode[][];
    shading: number[][];
  }> = [];

  for (const zl of ZOOM_LEVELS) {
    const { cols, rows } = calculateGridSize(bbox, zl.metersPerTile);
    console.log(`  Level ${zl.level}: ${cols}×${rows} tiles (${zl.metersPerTile}m/tile)`);

    const grid = generateGrid(bbox, cols, rows, zl.metersPerTile, elements);

    // Interpolate elevation to this zoom level's grid and compute shading
    const elevation = interpolateElevation(
      baseElevation, level2Grid.rows, level2Grid.cols, rows, cols
    );
    const shading = computeShading(elevation, rows, cols);

    zoomLevels.push({
      level: zl.level,
      cols,
      rows,
      metersPerTile: zl.metersPerTile,
      grid,
      shading,
    });
  }

  // Build output matching TerrainData interface (with compact single-char codes)
  const terrainData = {
    version: 1,
    regionId: 'lake-fairfax-campsite',
    boundingBox: bbox,
    zoomLevels,
  };

  await fs.writeFile(OUTPUT_FILE, JSON.stringify(terrainData));
  const stats = await fs.stat(OUTPUT_FILE);
  console.log(`  → ${OUTPUT_FILE} (${(stats.size / 1024).toFixed(1)} KB)`);
  console.log('Done!');
}

main().catch((err) => {
  console.error('Terrain generation failed:', err);
  process.exit(1);
});
