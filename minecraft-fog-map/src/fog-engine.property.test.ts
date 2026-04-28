import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { FogEngine, configFromBBox } from './fog-engine';
import { tileToGeo } from './coords';
import { ZOOM_LEVELS } from './types';
import { calculateGridSize } from './terrain-utils';
import type { BoundingBox, GeoPosition } from './types';

/**
 * Feature: minecraft-fog-map, Property 3: Reveal covers radius
 *
 * For any geographic position within the map region and for any reveal radius,
 * after calling `reveal(position, radius)`, every tile at the finest zoom level
 * (level 4) whose center is within `radius` meters of `position` SHALL be
 * marked as revealed.
 *
 * Validates: Requirements 3.2, 3.6
 */

// Lake Fairfax bounding box
const BBOX: BoundingBox = {
  north: 38.960,
  south: 38.955,
  east: -77.310,
  west: -77.316,
};

// Approximate meters per degree of latitude (same constant FogEngine uses)
const METERS_PER_DEG_LAT = 111_320;

/**
 * Equirectangular distance approximation — matches FogEngine's internal
 * distanceMeters function exactly.
 */
function distanceMeters(a: GeoPosition, b: GeoPosition): number {
  const dLat = (b.latitude - a.latitude) * METERS_PER_DEG_LAT;
  const avgLat = ((a.latitude + b.latitude) / 2) * (Math.PI / 180);
  const dLng = (b.longitude - a.longitude) * METERS_PER_DEG_LAT * Math.cos(avgLat);
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

/** Arbitrary: random geo position within the Lake Fairfax bounding box */
const arbGeoPosition: fc.Arbitrary<GeoPosition> = fc.record({
  latitude: fc.double({ min: BBOX.south, max: BBOX.north, noNaN: true }),
  longitude: fc.double({ min: BBOX.west, max: BBOX.east, noNaN: true }),
});

/** Arbitrary: random reveal radius between 5 and 50 meters */
const arbRadius: fc.Arbitrary<number> = fc.double({ min: 5, max: 50, noNaN: true });

describe('Feature: minecraft-fog-map, Property 3: Reveal covers radius', () => {
  it('every level-4 tile whose center is within the radius is revealed after reveal()', () => {
    const level4 = 4;
    const grid4 = calculateGridSize(BBOX, ZOOM_LEVELS[level4].metersPerTile);

    fc.assert(
      fc.property(arbGeoPosition, arbRadius, (position, radius) => {
        const config = configFromBBox(BBOX);
        const engine = new FogEngine(config);

        engine.reveal(position, radius);

        // Check every level-4 tile in the grid
        for (let row = 0; row < grid4.rows; row++) {
          for (let col = 0; col < grid4.cols; col++) {
            const tileCenter = tileToGeo(
              { zoomLevel: level4, col, row },
              BBOX,
              grid4,
            );

            const dist = distanceMeters(position, tileCenter);

            if (dist < radius - 0.1) {
              // Only check tiles whose center is within the bounding box
              if (tileCenter.latitude < BBOX.south || tileCenter.latitude > BBOX.north ||
                  tileCenter.longitude < BBOX.west || tileCenter.longitude > BBOX.east) continue;

              expect(
                engine.isRevealed(level4, col, row),
                `Tile (${col}, ${row}) center is ${dist.toFixed(2)}m from position ` +
                `(within radius ${radius.toFixed(2)}m) but is NOT revealed`,
              ).toBe(true);
            }
          }
        }
      }),
      { numRuns: 100 },
    );
  });
});

/**
 * Feature: minecraft-fog-map, Property 4: Cross-zoom-level reveal consistency
 *
 * For any set of revealed tiles, if a tile at zoom level 4 is revealed,
 * then the corresponding ancestor tile at every coarser zoom level (3, 2, 1, 0)
 * SHALL also be revealed.
 *
 * Validates: Requirements 3.3
 */

describe('Feature: minecraft-fog-map, Property 4: Cross-zoom-level reveal consistency', () => {
  it('every revealed level-4 tile has its ancestor tiles at levels 3, 2, 1, 0 also revealed', () => {
    const config = configFromBBox(BBOX);
    const gridSizes = config.gridSizes;

    /** Arbitrary: a single reveal call (position + radius) */
    const arbRevealCall = fc.record({
      position: arbGeoPosition,
      radius: arbRadius,
    });

    /** Arbitrary: a sequence of 1–5 reveal calls */
    const arbRevealSequence = fc.array(arbRevealCall, { minLength: 1, maxLength: 5 });

    fc.assert(
      fc.property(arbRevealSequence, (reveals) => {
        const engine = new FogEngine(config);

        // Execute all reveal calls
        for (const { position, radius } of reveals) {
          engine.reveal(position, radius);
        }

        // For every revealed level-4 tile, verify all ancestors are revealed
        const grid4 = gridSizes[4];
        for (let row = 0; row < grid4.rows; row++) {
          for (let col = 0; col < grid4.cols; col++) {
            if (!engine.isRevealed(4, col, row)) continue;

            // Walk up from level 4 to level 0, computing parent coords
            let parentCol = col;
            let parentRow = row;

            for (let level = 3; level >= 0; level--) {
              const childGrid = gridSizes[level + 1];
              const parentGrid = gridSizes[level];

              const colScale = childGrid.cols / parentGrid.cols;
              const rowScale = childGrid.rows / parentGrid.rows;

              parentCol = Math.min(
                Math.floor(parentCol / colScale),
                parentGrid.cols - 1,
              );
              parentRow = Math.min(
                Math.floor(parentRow / rowScale),
                parentGrid.rows - 1,
              );

              expect(
                engine.isRevealed(level, parentCol, parentRow),
                `Level-4 tile (${col}, ${row}) is revealed but ancestor at level ${level} ` +
                `(${parentCol}, ${parentRow}) is NOT revealed`,
              ).toBe(true);
            }
          }
        }
      }),
      { numRuns: 100 },
    );
  });
});


/**
 * Feature: minecraft-fog-map, Property 5: Fog state serialization round-trip
 *
 * For any valid fog state (a set of revealed tile keys), serializing the state
 * to a string and then deserializing it back SHALL produce an identical set of
 * revealed tile keys.
 *
 * Validates: Requirements 3.4
 */

describe('Feature: minecraft-fog-map, Property 5: Fog state serialization round-trip', () => {
  it('serializing and deserializing fog state produces identical level-4 revealed tiles', () => {
    const config = configFromBBox(BBOX);
    const grid4 = config.gridSizes[4]; // cols: 260, rows: 279

    /**
     * Arbitrary: a random set of valid level-4 tile keys.
     * Generates 0–50 unique (col, row) pairs within the level-4 grid bounds,
     * then formats them as "z4:col:row" keys.
     */
    const arbLevel4TileKeys: fc.Arbitrary<string[]> = fc
      .uniqueArray(
        fc.record({
          col: fc.integer({ min: 0, max: grid4.cols - 1 }),
          row: fc.integer({ min: 0, max: grid4.rows - 1 }),
        }),
        { minLength: 0, maxLength: 50, selector: (t) => `${t.col}:${t.row}` },
      )
      .map((tiles) => tiles.map((t) => `z4:${t.col}:${t.row}`));

    fc.assert(
      fc.property(arbLevel4TileKeys, (keys) => {
        // 1. Create engine and init with the generated keys as JSON
        const engine1 = new FogEngine(config);
        engine1.init(JSON.stringify(keys));

        // 2. Serialize the state
        const serialized = engine1.serialize();

        // 3. Create a new engine and init with the serialized string
        const engine2 = new FogEngine(config);
        engine2.init(serialized);

        // 4. Verify level-4 tiles match exactly
        const originalSet = new Set(keys);
        const state2 = engine2.getState();
        const restoredLevel4 = new Set(
          Array.from(state2.revealedTiles).filter((k) => k.startsWith('z4:')),
        );

        // Every original key must be in the restored set
        for (const key of originalSet) {
          expect(
            restoredLevel4.has(key),
            `Original key "${key}" missing after round-trip`,
          ).toBe(true);
        }

        // No extra level-4 keys should appear
        for (const key of restoredLevel4) {
          expect(
            originalSet.has(key),
            `Unexpected key "${key}" appeared after round-trip`,
          ).toBe(true);
        }

        // Sets must be the same size
        expect(restoredLevel4.size).toBe(originalSet.size);
      }),
      { numRuns: 100 },
    );
  });
});
