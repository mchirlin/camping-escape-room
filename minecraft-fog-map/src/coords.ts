// ============================================================
// Coordinate Conversion Utilities
// Minecraft Fog Map
// ============================================================

import type {
  BoundingBox,
  GeoPosition,
  TileCoord,
  WorldPosition,
  ViewportState,
} from './types';

/**
 * Convert a geographic position to tile coordinates at a given zoom level.
 * Uses linear interpolation within the bounding box.
 * Tile coordinates are clamped to valid grid bounds [0, cols-1] / [0, rows-1].
 */
export function geoToTile(
  pos: GeoPosition,
  level: number,
  bbox: BoundingBox,
  gridSize: { cols: number; rows: number }
): TileCoord {
  const lngRange = bbox.east - bbox.west;
  const latRange = bbox.north - bbox.south;

  // Fraction across the bounding box (0..1)
  const xFrac = lngRange === 0 ? 0 : (pos.longitude - bbox.west) / lngRange;
  const yFrac = latRange === 0 ? 0 : (bbox.north - pos.latitude) / latRange; // north is top (row 0)

  // Map to grid indices and clamp
  const col = Math.min(Math.max(Math.floor(xFrac * gridSize.cols), 0), gridSize.cols - 1);
  const row = Math.min(Math.max(Math.floor(yFrac * gridSize.rows), 0), gridSize.rows - 1);

  return { zoomLevel: level, col, row };
}

/**
 * Convert tile coordinates back to the geographic position at the tile's center.
 * Inverse of geoToTile.
 */
export function tileToGeo(
  tile: TileCoord,
  bbox: BoundingBox,
  gridSize: { cols: number; rows: number }
): GeoPosition {
  const lngRange = bbox.east - bbox.west;
  const latRange = bbox.north - bbox.south;

  // Center of the tile in fractional grid space
  const xFrac = (tile.col + 0.5) / gridSize.cols;
  const yFrac = (tile.row + 0.5) / gridSize.rows;

  const longitude = bbox.west + xFrac * lngRange;
  const latitude = bbox.north - yFrac * latRange; // north is top (row 0)

  return { latitude, longitude };
}


/**
 * Convert a geographic position to world-space pixel coordinates for rendering.
 * World space is defined relative to the level-4 grid (finest resolution).
 * Origin is the top-left corner of the map.
 */
export function geoToWorld(
  pos: GeoPosition,
  bbox: BoundingBox,
  level4GridSize: { cols: number; rows: number },
  tileScreenSize: number
): WorldPosition {
  const lngRange = bbox.east - bbox.west;
  const latRange = bbox.north - bbox.south;

  const xFrac = lngRange === 0 ? 0 : (pos.longitude - bbox.west) / lngRange;
  const yFrac = latRange === 0 ? 0 : (bbox.north - pos.latitude) / latRange;

  return {
    x: xFrac * level4GridSize.cols * tileScreenSize,
    y: yFrac * level4GridSize.rows * tileScreenSize,
  };
}

/**
 * Convert world-space pixel coordinates back to a geographic position.
 * Inverse of geoToWorld.
 */
export function worldToGeo(
  world: WorldPosition,
  bbox: BoundingBox,
  level4GridSize: { cols: number; rows: number },
  tileScreenSize: number
): GeoPosition {
  const totalWidth = level4GridSize.cols * tileScreenSize;
  const totalHeight = level4GridSize.rows * tileScreenSize;

  const xFrac = totalWidth === 0 ? 0 : world.x / totalWidth;
  const yFrac = totalHeight === 0 ? 0 : world.y / totalHeight;

  const lngRange = bbox.east - bbox.west;
  const latRange = bbox.north - bbox.south;

  return {
    latitude: bbox.north - yFrac * latRange,
    longitude: bbox.west + xFrac * lngRange,
  };
}

/**
 * Convert screen pixel coordinates to a geographic position.
 * Used for simulation click-to-position: maps a canvas click to a real-world location.
 */
export function screenToGeo(
  screenX: number,
  screenY: number,
  viewport: ViewportState,
  bbox: BoundingBox,
  level4GridSize: { cols: number; rows: number },
  tileScreenSize: number
): GeoPosition {
  // Screen pixel → world pixel (account for zoom scale)
  const scale = Math.pow(2, viewport.zoomLevel);
  const worldX = viewport.centerX + (screenX - viewport.screenWidth / 2) / scale;
  const worldY = viewport.centerY + (screenY - viewport.screenHeight / 2) / scale;

  return worldToGeo(
    { x: worldX, y: worldY },
    bbox,
    level4GridSize,
    tileScreenSize
  );
}
