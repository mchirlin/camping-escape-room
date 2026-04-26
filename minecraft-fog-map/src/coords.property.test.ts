import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { geoToTile, tileToGeo } from './coords';
import { ZOOM_LEVELS } from './types';
import type { BoundingBox, GeoPosition } from './types';

/**
 * Feature: minecraft-fog-map, Property 6: Geo-to-tile-to-geo round-trip
 *
 * For any geographic position within the map region bounding box and for any
 * zoom level, converting the position to tile coordinates and then converting
 * the tile center back to geographic coordinates SHALL produce a position
 * within one tile's width/height of the original position.
 *
 * Validates: Requirements 4.2
 */

/**
 * Approximate meters-per-degree at mid-latitudes for generating
 * bounding boxes with reasonable real-world dimensions.
 */
const METERS_PER_DEG_LAT = 111_320;
const METERS_PER_DEG_LNG_AT_45 = 78_710; // rough average for mid-latitudes

/**
 * Arbitrary for generating bounding boxes that represent a valid bounding box
 * with lat in [-60, 60] and lng in [-170, 170], with dimensions between
 * ~200m and ~2km per side.
 */
const arbBoundingBox: fc.Arbitrary<BoundingBox> = fc
  .record({
    south: fc.double({ min: -60, max: 59, noNaN: true }),
    west: fc.double({ min: -170, max: 169, noNaN: true }),
    latSpanDeg: fc.double({
      min: 200 / METERS_PER_DEG_LAT,
      max: 2000 / METERS_PER_DEG_LAT,
      noNaN: true,
    }),
    lngSpanDeg: fc.double({
      min: 200 / METERS_PER_DEG_LNG_AT_45,
      max: 2000 / METERS_PER_DEG_LNG_AT_45,
      noNaN: true,
    }),
  })
  .map(({ south, west, latSpanDeg, lngSpanDeg }) => ({
    south,
    north: south + latSpanDeg,
    west,
    east: west + lngSpanDeg,
  }));

/** Arbitrary for a geo position strictly inside a given bounding box. */
function arbGeoInBbox(bbox: BoundingBox): fc.Arbitrary<GeoPosition> {
  // Use a small epsilon to keep the position strictly inside the bbox
  // so we avoid exact-boundary edge cases with floor clamping.
  const eps = 1e-9;
  return fc.record({
    latitude: fc.double({
      min: bbox.south + eps,
      max: bbox.north - eps,
      noNaN: true,
    }),
    longitude: fc.double({
      min: bbox.west + eps,
      max: bbox.east - eps,
      noNaN: true,
    }),
  });
}

/** Arbitrary for zoom level 0–4. */
const arbZoomLevel = fc.integer({ min: 0, max: 4 });

/**
 * Calculate the grid size (cols × rows) for a bounding box at a given zoom level.
 * Uses the same logic the terrain generator would: ceil(bbox dimension / metersPerTile).
 */
function gridSizeForZoom(
  bbox: BoundingBox,
  zoomLevel: number
): { cols: number; rows: number } {
  const config = ZOOM_LEVELS[zoomLevel];
  const latMid = (bbox.north + bbox.south) / 2;
  const metersPerDegLng = METERS_PER_DEG_LAT * Math.cos((latMid * Math.PI) / 180);

  const widthMeters = (bbox.east - bbox.west) * metersPerDegLng;
  const heightMeters = (bbox.north - bbox.south) * METERS_PER_DEG_LAT;

  const cols = Math.max(1, Math.ceil(widthMeters / config.metersPerTile));
  const rows = Math.max(1, Math.ceil(heightMeters / config.metersPerTile));
  return { cols, rows };
}

describe('Feature: minecraft-fog-map, Property 6: Geo-to-tile-to-geo round-trip', () => {
  it('geo → tile → geo (tile center) is within one tile width/height of original', () => {
    fc.assert(
      fc.property(
        arbBoundingBox.chain((bbox) =>
          fc.tuple(fc.constant(bbox), arbGeoInBbox(bbox), arbZoomLevel)
        ),
        ([bbox, pos, zoomLevel]) => {
          const gridSize = gridSizeForZoom(bbox, zoomLevel);

          // geo → tile
          const tile = geoToTile(pos, zoomLevel, bbox, gridSize);

          // tile → geo (center of that tile)
          const roundTripped = tileToGeo(tile, bbox, gridSize);

          // One tile's width/height in degrees
          const tileWidthDeg = (bbox.east - bbox.west) / gridSize.cols;
          const tileHeightDeg = (bbox.north - bbox.south) / gridSize.rows;

          const latDiff = Math.abs(roundTripped.latitude - pos.latitude);
          const lngDiff = Math.abs(roundTripped.longitude - pos.longitude);

          expect(latDiff).toBeLessThanOrEqual(tileHeightDeg + 1e-10);
          expect(lngDiff).toBeLessThanOrEqual(tileWidthDeg + 1e-10);
        }
      ),
      { numRuns: 100 }
    );
  });
});
