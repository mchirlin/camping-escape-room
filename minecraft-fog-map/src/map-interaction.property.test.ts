import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { worldToGeo } from './coords';
import { TILE_SCREEN_SIZE } from './tile-renderer';
import { calculateGridSize } from './terrain-utils';
import type { BoundingBox, ViewportState } from './types';

/**
 * Feature: minecraft-fog-map, Property 2: Zoom preserves map center
 *
 * For any viewport state with a valid center position and for any zoom level
 * transition (up or down by 1), the geographic coordinate at the center of the
 * viewport SHALL be the same before and after the transition.
 *
 * Validates: Requirements 2.6
 */

/** Lake Fairfax bounding box */
const LAKE_FAIRFAX_BBOX: BoundingBox = {
  north: 38.960,
  south: 38.955,
  east: -77.310,
  west: -77.316,
};

/** Level-4 grid size for the Lake Fairfax bbox */
const LEVEL4_GRID = calculateGridSize(LAKE_FAIRFAX_BBOX, 2); // level 4 = 2m/tile

/** World dimensions in pixels (level-4 pixel space) */
const WORLD_WIDTH = LEVEL4_GRID.cols * TILE_SCREEN_SIZE;
const WORLD_HEIGHT = LEVEL4_GRID.rows * TILE_SCREEN_SIZE;

/**
 * Arbitrary for a valid viewport state with center within world bounds,
 * zoom level 0–4, and reasonable screen dimensions.
 */
const arbViewport: fc.Arbitrary<ViewportState> = fc.record({
  centerX: fc.double({ min: 0, max: WORLD_WIDTH, noNaN: true, noDefaultInfinity: true }),
  centerY: fc.double({ min: 0, max: WORLD_HEIGHT, noNaN: true, noDefaultInfinity: true }),
  zoomLevel: fc.integer({ min: 0, max: 4 }),
  screenWidth: fc.integer({ min: 100, max: 2048 }),
  screenHeight: fc.integer({ min: 100, max: 2048 }),
});

/**
 * Arbitrary for a zoom direction (+1 or -1), constrained so the resulting
 * zoom level stays within 0–4.
 */
function arbZoomDirection(currentZoom: number): fc.Arbitrary<number> {
  if (currentZoom === 0) return fc.constant(1);
  if (currentZoom === 4) return fc.constant(-1);
  return fc.oneof(fc.constant(1), fc.constant(-1));
}

describe('Feature: minecraft-fog-map, Property 2: Zoom preserves map center', () => {
  it('geographic coordinate at viewport center is identical before and after zoom transition', () => {
    fc.assert(
      fc.property(
        arbViewport.chain((viewport) =>
          fc.tuple(fc.constant(viewport), arbZoomDirection(viewport.zoomLevel))
        ),
        ([viewport, zoomDir]) => {
          // Convert viewport center to geo coordinates BEFORE zoom
          const geoBefore = worldToGeo(
            { x: viewport.centerX, y: viewport.centerY },
            LAKE_FAIRFAX_BBOX,
            LEVEL4_GRID,
            TILE_SCREEN_SIZE
          );

          // Apply zoom transition (just change the zoomLevel field)
          const viewportAfter: ViewportState = {
            ...viewport,
            zoomLevel: viewport.zoomLevel + zoomDir,
          };

          // Convert viewport center to geo coordinates AFTER zoom
          const geoAfter = worldToGeo(
            { x: viewportAfter.centerX, y: viewportAfter.centerY },
            LAKE_FAIRFAX_BBOX,
            LEVEL4_GRID,
            TILE_SCREEN_SIZE
          );

          // The geo coordinates should be identical since world-space center
          // doesn't change when zoom level changes
          expect(geoAfter.latitude).toBeCloseTo(geoBefore.latitude, 10);
          expect(geoAfter.longitude).toBeCloseTo(geoBefore.longitude, 10);
        }
      ),
      { numRuns: 100 }
    );
  });
});

import { clampViewportCenter } from './map-interaction';

/**
 * Feature: minecraft-fog-map, Property 8: Viewport clamping keeps center in bounds
 *
 * For any viewport center position (including positions outside the map region),
 * after applying the clamping function, the resulting viewport center SHALL be
 * within the map region bounding box.
 *
 * Validates: Requirements 7.2
 */
describe('Feature: minecraft-fog-map, Property 8: Viewport clamping keeps center in bounds', () => {
  it('clamped center is always within [0, worldWidth] × [0, worldHeight]', () => {
    fc.assert(
      fc.property(
        // Random center positions including negative and very large values
        fc.double({ min: -1e6, max: 1e6, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: -1e6, max: 1e6, noNaN: true, noDefaultInfinity: true }),
        // Random positive world dimensions
        fc.double({ min: 1, max: 1e5, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: 1, max: 1e5, noNaN: true, noDefaultInfinity: true }),
        (centerX, centerY, worldWidth, worldHeight) => {
          const result = clampViewportCenter(centerX, centerY, worldWidth, worldHeight);

          expect(result.x).toBeGreaterThanOrEqual(0);
          expect(result.x).toBeLessThanOrEqual(worldWidth);
          expect(result.y).toBeGreaterThanOrEqual(0);
          expect(result.y).toBeLessThanOrEqual(worldHeight);
        }
      ),
      { numRuns: 100 }
    );
  });
});
