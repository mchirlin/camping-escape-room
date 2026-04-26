// ============================================================
// Core Data Model Interfaces and Type Definitions
// Minecraft Fog Map
// ============================================================

// --- Geographic & Coordinate Types ---

/** Geographic bounding box defined by lat/lng corners */
export interface BoundingBox {
  north: number; // max latitude
  south: number; // min latitude
  east: number;  // max longitude
  west: number;  // min longitude
}

/** Geographic coordinates (real world, WGS84) */
export interface GeoPosition {
  latitude: number;  // degrees, WGS84
  longitude: number; // degrees, WGS84
}

/** Tile coordinates (grid position at a zoom level) */
export interface TileCoord {
  zoomLevel: number; // 0–4
  col: number;       // 0-based column index
  row: number;       // 0-based row index
}

/**
 * World coordinates (pixel space, zoom-level-independent).
 * Used for viewport positioning. Origin = top-left of map at level 4.
 */
export interface WorldPosition {
  x: number; // pixels from left edge
  y: number; // pixels from top edge
}

// --- Viewport ---

export interface ViewportState {
  centerX: number;      // world-space X of viewport center (in pixels)
  centerY: number;      // world-space Y of viewport center (in pixels)
  zoomLevel: number;    // current discrete zoom level 0–4
  screenWidth: number;  // canvas pixel width
  screenHeight: number; // canvas pixel height
}

// --- Terrain ---

export type TerrainType = 'grass' | 'forest' | 'water' | 'path' | 'road' | 'building' | 'sand';

export interface TerrainData {
  version: number;             // schema version for cache busting
  regionId: string;            // unique ID for this map region
  boundingBox: BoundingBox;
  zoomLevels: ZoomLevelData[]; // 5 entries, one per zoom level
}

export interface ZoomLevelData {
  level: number;          // 0–4
  cols: number;           // grid width in tiles
  rows: number;           // grid height in tiles
  metersPerTile: number;  // real-world meters per tile edge
  grid: TerrainType[][];  // [row][col], row-major order
  /** Minecraft-style shade multiplier per tile: 0.71 (darker), 0.86 (normal), 1.0 (brighter).
   *  Based on elevation difference with the tile directly north. */
  shading?: number[][];   // [row][col], row-major order
}

// --- Fog State ---

export interface FogState {
  revealedTiles: Set<string>; // keys like "z3:12:45"
}

// --- Texture Atlas ---

export interface TextureAtlasManifest {
  tileSize: number;                        // 16 (pixels per texture)
  textures: Record<string, AtlasEntry>;    // keyed by terrain type + special textures
}

export interface AtlasEntry {
  x: number; // x offset in atlas image (pixels)
  y: number; // y offset in atlas image (pixels)
  w: number; // width (always 16)
  h: number; // height (always 16)
}

// --- Zoom Level Constants ---

export interface ZoomLevelConfig {
  level: number;         // 0–4
  metersPerTile: number; // real-world size of each tile
}

/** Zoom level definitions: level 0 = 32m/tile (coarsest) down to level 4 = 2m/tile (finest) */
export const ZOOM_LEVELS: ZoomLevelConfig[] = [
  { level: 0, metersPerTile: 32 },
  { level: 1, metersPerTile: 16 },
  { level: 2, metersPerTile: 8 },
  { level: 3, metersPerTile: 4 },
  { level: 4, metersPerTile: 2 },
];

export const MIN_ZOOM_LEVEL = 0;
export const MAX_ZOOM_LEVEL = 4;
