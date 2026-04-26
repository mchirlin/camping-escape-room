import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { calculateGridSize, bboxSizeMeters } from './terrain-utils';
import { ZOOM_LEVELS } from './types';
import type { BoundingBox } from './types';

/**
 * Feature: minecraft-fog-map, Property 1: Grid coverage for valid bounding boxes
 *
 * For any bounding box whose dimensions fall between 200m×200m and 2km×2km,
 * and for any zoom level 0–4, the terrain generator SHALL produce a grid where
 * `cols * metersPerTile >= bboxWidthMeters` and `rows * metersPerTile >= bboxHeightMeters`,
 * ensuring the grid fully covers the specified area.
 *
 * Validates: Requirements 1.1, 1.2
 */

const METERS_PER_DEG_LAT = 111_320;
const METERS_PER_DEG_LNG_AT_45 = 78_710;

/**
 * Arbitrary for generating valid bounding boxes with dimensions between
 * 200m and 2km per side, at reasonable latitudes.
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

describe('Feature: minecraft-fog-map, Property 1: Grid coverage for valid bounding boxes', () => {
  it('cols * metersPerTile >= bboxWidth and rows * metersPerTile >= bboxHeight for all zoom levels', () => {
    fc.assert(
      fc.property(arbBoundingBox, (bbox) => {
        const { widthM, heightM } = bboxSizeMeters(bbox);

        for (const zoomConfig of ZOOM_LEVELS) {
          const { cols, rows } = calculateGridSize(bbox, zoomConfig.metersPerTile);

          expect(cols * zoomConfig.metersPerTile).toBeGreaterThanOrEqual(widthM);
          expect(rows * zoomConfig.metersPerTile).toBeGreaterThanOrEqual(heightM);
        }
      }),
      { numRuns: 100 }
    );
  });
});
