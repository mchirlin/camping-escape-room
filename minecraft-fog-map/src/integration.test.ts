import { describe, it, expect } from 'vitest';
import { FogEngine, configFromBBox } from './fog-engine';
import type { BoundingBox, GeoPosition } from './types';

// Lake Fairfax bounding box
const BBOX: BoundingBox = {
  north: 38.96,
  south: 38.955,
  east: -77.31,
  west: -77.316,
};

function makeEngine(): FogEngine {
  return new FogEngine(configFromBBox(BBOX));
}

const CENTER: GeoPosition = {
  latitude: (BBOX.north + BBOX.south) / 2,
  longitude: (BBOX.east + BBOX.west) / 2,
};

describe('Integration: FogEngine + coordinates + serialization', () => {
  /**
   * Validates: Requirements 3.1
   * Initial fog state should be all-hidden — no tiles revealed at any zoom level.
   */
  it('initial fog state is all-hidden', () => {
    const engine = makeEngine();
    const config = configFromBBox(BBOX);

    for (let level = 0; level <= 4; level++) {
      const { cols, rows } = config.gridSizes[level];
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          expect(engine.isRevealed(level, col, row)).toBe(false);
        }
      }
    }
  });

  /**
   * Validates: Requirements 3.1, 3.4
   * Reveal tiles at several positions, serialize, reload into a new engine,
   * and verify the revealed tile sets match exactly at all zoom levels.
   */
  it('full reveal → serialize → reload → verify fog state matches', () => {
    const engine1 = makeEngine();

    // Reveal at several distinct positions
    const positions: GeoPosition[] = [
      CENTER,
      { latitude: BBOX.south + 0.001, longitude: BBOX.west + 0.001 },
      { latitude: BBOX.north - 0.001, longitude: BBOX.east - 0.001 },
    ];
    for (const pos of positions) {
      engine1.reveal(pos, 15);
    }

    // Serialize
    const serialized = engine1.serialize();

    // Reload into a fresh engine
    const engine2 = makeEngine();
    engine2.init(serialized);

    // Compare revealed tile sets at every zoom level
    const state1 = engine1.getState().revealedTiles;
    const state2 = engine2.getState().revealedTiles;

    expect(state2.size).toBe(state1.size);
    for (const key of state1) {
      expect(state2.has(key)).toBe(true);
    }
    for (const key of state2) {
      expect(state1.has(key)).toBe(true);
    }
  });

  /**
   * Validates: Requirements 3.1
   * Calling reveal with a position and radius should reveal nearby tiles
   * and leave distant tiles hidden.
   */
  it('position update triggers fog reveal', () => {
    const engine = makeEngine();

    // Reveal a small area at the center
    engine.reveal(CENTER, 10);

    // Tiles near the center at level 4 should be revealed
    const state = engine.getState();
    const level4Revealed = Array.from(state.revealedTiles).filter((k) =>
      k.startsWith('z4:')
    );
    expect(level4Revealed.length).toBeGreaterThan(0);

    // A corner tile far from center should NOT be revealed
    const config = configFromBBox(BBOX);
    const farCol = config.gridSizes[4].cols - 1;
    const farRow = config.gridSizes[4].rows - 1;
    expect(engine.isRevealed(4, farCol, farRow)).toBe(false);

    // The opposite corner should also be hidden
    expect(engine.isRevealed(4, 0, 0)).toBe(false);
  });
});
