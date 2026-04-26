import { describe, it, expect } from 'vitest';
import { geoToTile, tileToGeo, geoToWorld, worldToGeo, screenToGeo } from './coords';
import type { BoundingBox, ViewportState } from './types';

// A small bounding box roughly representing a ~500m area
const bbox: BoundingBox = {
  north: 38.960,
  south: 38.955,
  east: -77.310,
  west: -77.316,
};

const gridSize = { cols: 16, rows: 16 };
const level4Grid = { cols: 256, rows: 256 };
const tileScreenSize = 16;

describe('geoToTile', () => {
  it('maps the northwest corner to tile (0, 0)', () => {
    const pos = { latitude: bbox.north, longitude: bbox.west };
    const tile = geoToTile(pos, 0, bbox, gridSize);
    expect(tile).toEqual({ zoomLevel: 0, col: 0, row: 0 });
  });

  it('maps the southeast corner to the last tile', () => {
    const pos = { latitude: bbox.south, longitude: bbox.east };
    const tile = geoToTile(pos, 0, bbox, gridSize);
    expect(tile.col).toBe(gridSize.cols - 1);
    expect(tile.row).toBe(gridSize.rows - 1);
  });

  it('maps the center of the bbox to the middle tiles', () => {
    const pos = {
      latitude: (bbox.north + bbox.south) / 2,
      longitude: (bbox.east + bbox.west) / 2,
    };
    const tile = geoToTile(pos, 2, bbox, gridSize);
    expect(tile.col).toBe(8); // floor(0.5 * 16) = 8
    expect(tile.row).toBe(8);
    expect(tile.zoomLevel).toBe(2);
  });

  it('clamps out-of-bounds positions to valid grid range', () => {
    const posNorth = { latitude: bbox.north + 1, longitude: bbox.west - 1 };
    const tile = geoToTile(posNorth, 0, bbox, gridSize);
    expect(tile.col).toBe(0);
    expect(tile.row).toBe(0);

    const posSouth = { latitude: bbox.south - 1, longitude: bbox.east + 1 };
    const tile2 = geoToTile(posSouth, 0, bbox, gridSize);
    expect(tile2.col).toBe(gridSize.cols - 1);
    expect(tile2.row).toBe(gridSize.rows - 1);
  });
});


describe('tileToGeo', () => {
  it('returns the center of tile (0, 0) near the northwest corner', () => {
    const geo = tileToGeo({ zoomLevel: 0, col: 0, row: 0 }, bbox, gridSize);
    // Center of first tile: 0.5/16 of the way from the edges
    expect(geo.longitude).toBeCloseTo(bbox.west + (0.5 / 16) * (bbox.east - bbox.west), 6);
    expect(geo.latitude).toBeCloseTo(bbox.north - (0.5 / 16) * (bbox.north - bbox.south), 6);
  });

  it('returns the center of the last tile near the southeast corner', () => {
    const geo = tileToGeo({ zoomLevel: 0, col: 15, row: 15 }, bbox, gridSize);
    expect(geo.longitude).toBeCloseTo(bbox.west + (15.5 / 16) * (bbox.east - bbox.west), 6);
    expect(geo.latitude).toBeCloseTo(bbox.north - (15.5 / 16) * (bbox.north - bbox.south), 6);
  });
});

describe('geoToWorld / worldToGeo round-trip', () => {
  it('converts a geo position to world and back', () => {
    const pos = { latitude: 38.9575, longitude: -77.313 };
    const world = geoToWorld(pos, bbox, level4Grid, tileScreenSize);
    const back = worldToGeo(world, bbox, level4Grid, tileScreenSize);
    expect(back.latitude).toBeCloseTo(pos.latitude, 8);
    expect(back.longitude).toBeCloseTo(pos.longitude, 8);
  });

  it('maps the northwest corner to world origin (0, 0)', () => {
    const pos = { latitude: bbox.north, longitude: bbox.west };
    const world = geoToWorld(pos, bbox, level4Grid, tileScreenSize);
    expect(world.x).toBeCloseTo(0);
    expect(world.y).toBeCloseTo(0);
  });

  it('maps the southeast corner to the max world extent', () => {
    const pos = { latitude: bbox.south, longitude: bbox.east };
    const world = geoToWorld(pos, bbox, level4Grid, tileScreenSize);
    expect(world.x).toBeCloseTo(level4Grid.cols * tileScreenSize);
    expect(world.y).toBeCloseTo(level4Grid.rows * tileScreenSize);
  });
});

describe('screenToGeo', () => {
  it('maps the center of the screen to the viewport center geo position', () => {
    // Viewport centered on the middle of the map
    const centerWorld = geoToWorld(
      { latitude: (bbox.north + bbox.south) / 2, longitude: (bbox.east + bbox.west) / 2 },
      bbox,
      level4Grid,
      tileScreenSize
    );
    const viewport: ViewportState = {
      centerX: centerWorld.x,
      centerY: centerWorld.y,
      zoomLevel: 2,
      screenWidth: 800,
      screenHeight: 600,
    };

    // Click at the center of the screen
    const geo = screenToGeo(400, 300, viewport, bbox, level4Grid, tileScreenSize);
    expect(geo.latitude).toBeCloseTo((bbox.north + bbox.south) / 2, 6);
    expect(geo.longitude).toBeCloseTo((bbox.east + bbox.west) / 2, 6);
  });

  it('maps a screen edge click to an offset geo position', () => {
    const centerWorld = geoToWorld(
      { latitude: (bbox.north + bbox.south) / 2, longitude: (bbox.east + bbox.west) / 2 },
      bbox,
      level4Grid,
      tileScreenSize
    );
    const viewport: ViewportState = {
      centerX: centerWorld.x,
      centerY: centerWorld.y,
      zoomLevel: 2,
      screenWidth: 800,
      screenHeight: 600,
    };

    // Click at top-left corner of screen — should be north-west of center
    const geo = screenToGeo(0, 0, viewport, bbox, level4Grid, tileScreenSize);
    expect(geo.latitude).toBeGreaterThan((bbox.north + bbox.south) / 2);
    expect(geo.longitude).toBeLessThan((bbox.east + bbox.west) / 2);
  });
});
