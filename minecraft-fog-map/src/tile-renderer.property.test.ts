import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { getVisibleTileRange, TILE_SCREEN_SIZE } from './tile-renderer';
import type { ViewportState } from './types';

/**
 * Feature: minecraft-fog-map, Property 7: Viewport culling produces correct tile range
 *
 * For any viewport state (center position, zoom level, screen dimensions),
 * the set of tiles selected for rendering SHALL include all tiles that
 * intersect the visible screen area plus a one-tile buffer, and SHALL NOT
 * include tiles more than one tile outside the visible area.
 *
 * Validates: Requirements 6.3
 */

/** Arbitrary for continuous zoom level 0–5. */
const arbZoomLevel = fc.double({ min: 0, max: 5, noNaN: true, noDefaultInfinity: true });

const arbScreenWidth = fc.integer({ min: 320, max: 1920 });
const arbScreenHeight = fc.integer({ min: 240, max: 1080 });

/** Level-4 grid size for Lake Fairfax (~256 tiles per axis) */
const GRID_SIZE = { cols: 256, rows: 256 };

/**
 * Generate a viewport with center within world bounds.
 * World is defined by level-4 grid: 256 * TILE_SCREEN_SIZE pixels.
 */
function arbViewport(zoomLevel: number): fc.Arbitrary<ViewportState> {
  const worldWidth = GRID_SIZE.cols * TILE_SCREEN_SIZE;
  const worldHeight = GRID_SIZE.rows * TILE_SCREEN_SIZE;

  return fc
    .record({
      centerX: fc.double({ min: 0, max: worldWidth, noNaN: true, noDefaultInfinity: true }),
      centerY: fc.double({ min: 0, max: worldHeight, noNaN: true, noDefaultInfinity: true }),
      screenWidth: arbScreenWidth,
      screenHeight: arbScreenHeight,
    })
    .map(({ centerX, centerY, screenWidth, screenHeight }) => ({
      centerX,
      centerY,
      zoomLevel,
      screenWidth,
      screenHeight,
    }));
}

describe('Feature: minecraft-fog-map, Property 7: Viewport culling produces correct tile range', () => {
  it('all tiles intersecting the visible area + 1-tile buffer are included', () => {
    fc.assert(
      fc.property(
        arbZoomLevel.chain((zoomLevel) =>
          fc.tuple(fc.constant(zoomLevel), arbViewport(zoomLevel))
        ),
        ([_zoomLevel, viewport]) => {
          const range = getVisibleTileRange(viewport, GRID_SIZE, TILE_SCREEN_SIZE);

          // New zoom model: scale = 2^zoomLevel
          const scale = Math.pow(2, viewport.zoomLevel);
          const halfW = (viewport.screenWidth / scale) / 2;
          const halfH = (viewport.screenHeight / scale) / 2;

          const left = viewport.centerX - halfW;
          const top = viewport.centerY - halfH;
          const right = viewport.centerX + halfW;
          const bottom = viewport.centerY + halfH;

          const rawMinCol = Math.floor(left / TILE_SCREEN_SIZE);
          const rawMaxCol = Math.floor(right / TILE_SCREEN_SIZE);
          const rawMinRow = Math.floor(top / TILE_SCREEN_SIZE);
          const rawMaxRow = Math.floor(bottom / TILE_SCREEN_SIZE);

          const expectedMinCol = Math.max(0, rawMinCol - 1);
          const expectedMaxCol = Math.min(GRID_SIZE.cols - 1, rawMaxCol + 1);
          const expectedMinRow = Math.max(0, rawMinRow - 1);
          const expectedMaxRow = Math.min(GRID_SIZE.rows - 1, rawMaxRow + 1);

          expect(range.minCol).toBe(expectedMinCol);
          expect(range.maxCol).toBe(expectedMaxCol);
          expect(range.minRow).toBe(expectedMinRow);
          expect(range.maxRow).toBe(expectedMaxRow);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('no tile more than 1 tile outside the visible area is included', () => {
    fc.assert(
      fc.property(
        arbZoomLevel.chain((zoomLevel) =>
          fc.tuple(fc.constant(zoomLevel), arbViewport(zoomLevel))
        ),
        ([_zoomLevel, viewport]) => {
          const range = getVisibleTileRange(viewport, GRID_SIZE, TILE_SCREEN_SIZE);

          const scale = Math.pow(2, viewport.zoomLevel);
          const halfW = (viewport.screenWidth / scale) / 2;
          const halfH = (viewport.screenHeight / scale) / 2;

          const left = viewport.centerX - halfW;
          const top = viewport.centerY - halfH;
          const right = viewport.centerX + halfW;
          const bottom = viewport.centerY + halfH;

          const rawMinCol = Math.floor(left / TILE_SCREEN_SIZE);
          const rawMaxCol = Math.floor(right / TILE_SCREEN_SIZE);
          const rawMinRow = Math.floor(top / TILE_SCREEN_SIZE);
          const rawMaxRow = Math.floor(bottom / TILE_SCREEN_SIZE);

          expect(range.minCol).toBeGreaterThanOrEqual(Math.max(0, rawMinCol - 1));
          expect(range.maxCol).toBeLessThanOrEqual(Math.min(GRID_SIZE.cols - 1, rawMaxCol + 1));
          expect(range.minRow).toBeGreaterThanOrEqual(Math.max(0, rawMinRow - 1));
          expect(range.maxRow).toBeLessThanOrEqual(Math.min(GRID_SIZE.rows - 1, rawMaxRow + 1));

          expect(range.minCol).toBeGreaterThanOrEqual(0);
          expect(range.maxCol).toBeLessThan(GRID_SIZE.cols);
          expect(range.minRow).toBeGreaterThanOrEqual(0);
          expect(range.maxRow).toBeLessThan(GRID_SIZE.rows);
        }
      ),
      { numRuns: 100 }
    );
  });
});
