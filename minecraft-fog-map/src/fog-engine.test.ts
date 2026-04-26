import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { FogEngine, configFromBBox, tileKey } from './fog-engine';
import type { FogEngineConfig } from './fog-engine';
import type { BoundingBox, GeoPosition } from './types';

// Lake Fairfax campsite bounding box (from terrain-data.json)
const BBOX: BoundingBox = {
  north: 38.96,
  south: 38.955,
  east: -77.31,
  west: -77.316,
};

function makeEngine(): FogEngine {
  const config = configFromBBox(BBOX);
  return new FogEngine(config);
}

describe('FogEngine', () => {
  let engine: FogEngine;

  beforeEach(() => {
    engine = makeEngine();
  });

  describe('initial state', () => {
    it('starts with no revealed tiles', () => {
      const state = engine.getState();
      expect(state.revealedTiles.size).toBe(0);
    });

    it('isRevealed returns false for any tile', () => {
      expect(engine.isRevealed(0, 0, 0)).toBe(false);
      expect(engine.isRevealed(4, 100, 100)).toBe(false);
    });
  });

  describe('reveal', () => {
    it('reveals tiles near the given position', () => {
      const center: GeoPosition = {
        latitude: (BBOX.north + BBOX.south) / 2,
        longitude: (BBOX.east + BBOX.west) / 2,
      };
      const newKeys = engine.reveal(center, 10);
      expect(newKeys.length).toBeGreaterThan(0);
      // All returned keys should be level-4
      for (const key of newKeys) {
        expect(key).toMatch(/^z4:\d+:\d+$/);
      }
    });

    it('marks revealed tiles as revealed via isRevealed', () => {
      const center: GeoPosition = {
        latitude: (BBOX.north + BBOX.south) / 2,
        longitude: (BBOX.east + BBOX.west) / 2,
      };
      engine.reveal(center, 10);
      // At least the center tile at level 4 should be revealed
      const state = engine.getState();
      const level4Keys = Array.from(state.revealedTiles).filter((k) =>
        k.startsWith('z4:')
      );
      expect(level4Keys.length).toBeGreaterThan(0);

      // Check isRevealed for one of them
      const parts = level4Keys[0].split(':');
      const col = parseInt(parts[1], 10);
      const row = parseInt(parts[2], 10);
      expect(engine.isRevealed(4, col, row)).toBe(true);
    });

    it('does not re-reveal already revealed tiles', () => {
      const center: GeoPosition = {
        latitude: (BBOX.north + BBOX.south) / 2,
        longitude: (BBOX.east + BBOX.west) / 2,
      };
      const first = engine.reveal(center, 10);
      const second = engine.reveal(center, 10);
      expect(second.length).toBe(0);
      // Total revealed should be same as first call
      const state = engine.getState();
      const level4Keys = Array.from(state.revealedTiles).filter((k) =>
        k.startsWith('z4:')
      );
      expect(level4Keys.length).toBe(first.length);
    });

    it('reveals more tiles with a larger radius', () => {
      const center: GeoPosition = {
        latitude: (BBOX.north + BBOX.south) / 2,
        longitude: (BBOX.east + BBOX.west) / 2,
      };
      const engine1 = makeEngine();
      const engine2 = makeEngine();
      engine1.reveal(center, 5);
      engine2.reveal(center, 20);
      const count1 = Array.from(engine1.getState().revealedTiles).filter((k) =>
        k.startsWith('z4:')
      ).length;
      const count2 = Array.from(engine2.getState().revealedTiles).filter((k) =>
        k.startsWith('z4:')
      ).length;
      expect(count2).toBeGreaterThan(count1);
    });
  });

  describe('cross-zoom propagation', () => {
    it('propagates reveals to all coarser zoom levels', () => {
      const center: GeoPosition = {
        latitude: (BBOX.north + BBOX.south) / 2,
        longitude: (BBOX.east + BBOX.west) / 2,
      };
      engine.reveal(center, 10);

      // Should have revealed tiles at every zoom level
      const state = engine.getState();
      for (let level = 0; level <= 4; level++) {
        const keysAtLevel = Array.from(state.revealedTiles).filter((k) =>
          k.startsWith(`z${level}:`)
        );
        expect(keysAtLevel.length).toBeGreaterThan(0);
      }
    });
  });

  describe('isRevealed', () => {
    it('returns false for unrevealed tiles', () => {
      expect(engine.isRevealed(4, 0, 0)).toBe(false);
    });

    it('returns true after reveal for tiles within radius', () => {
      const center: GeoPosition = {
        latitude: (BBOX.north + BBOX.south) / 2,
        longitude: (BBOX.east + BBOX.west) / 2,
      };
      engine.reveal(center, 10);
      // The center tile should be revealed
      const state = engine.getState();
      const anyLevel4 = Array.from(state.revealedTiles).find((k) =>
        k.startsWith('z4:')
      );
      expect(anyLevel4).toBeDefined();
    });
  });

  describe('getState', () => {
    it('returns a FogState with a Set of revealed tiles', () => {
      const state = engine.getState();
      expect(state.revealedTiles).toBeInstanceOf(Set);
    });

    it('reflects changes after reveal calls', () => {
      const before = engine.getState().revealedTiles.size;
      engine.reveal(
        { latitude: (BBOX.north + BBOX.south) / 2, longitude: (BBOX.east + BBOX.west) / 2 },
        10
      );
      const after = engine.getState().revealedTiles.size;
      expect(after).toBeGreaterThan(before);
    });
  });

  describe('tileKey', () => {
    it('formats keys correctly', () => {
      expect(tileKey(3, 12, 45)).toBe('z3:12:45');
      expect(tileKey(0, 0, 0)).toBe('z0:0:0');
      expect(tileKey(4, 259, 278)).toBe('z4:259:278');
    });
  });
});


// ============================================================
// Persistence (localStorage) tests — Task 3.2
// ============================================================

/** Create a minimal in-memory localStorage mock */
function createLocalStorageMock() {
  const store = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => store.set(key, value)),
    removeItem: vi.fn((key: string) => store.delete(key)),
    clear: vi.fn(() => store.clear()),
    get length() {
      return store.size;
    },
    key: vi.fn((_index: number) => null),
    _store: store,
  };
}

const REGION_ID = 'lake-fairfax';

function makeEngineWithRegion(
  overrides?: Partial<FogEngineConfig>
): FogEngine {
  const base = configFromBBox(BBOX);
  return new FogEngine({ ...base, regionId: REGION_ID, ...overrides });
}

describe('FogEngine persistence (localStorage)', () => {
  let storageMock: ReturnType<typeof createLocalStorageMock>;

  beforeEach(() => {
    storageMock = createLocalStorageMock();
    // Install mock on globalThis so the engine can use it
    Object.defineProperty(globalThis, 'localStorage', {
      value: storageMock,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    // Clean up
    vi.restoreAllMocks();
    // Remove the mock
    // @ts-expect-error cleaning up test mock
    delete globalThis.localStorage;
  });

  const CENTER: GeoPosition = {
    latitude: (BBOX.north + BBOX.south) / 2,
    longitude: (BBOX.east + BBOX.west) / 2,
  };

  describe('auto-persist on reveal', () => {
    it('saves to localStorage after each reveal with new tiles', () => {
      const engine = makeEngineWithRegion();
      engine.reveal(CENTER, 10);

      expect(storageMock.setItem).toHaveBeenCalledWith(
        `fogmap:${REGION_ID}`,
        expect.any(String)
      );

      // Verify the stored value is a valid JSON array of z4 keys
      const stored = storageMock.setItem.mock.calls[0][1];
      const parsed = JSON.parse(stored);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBeGreaterThan(0);
      for (const key of parsed) {
        expect(key).toMatch(/^z4:\d+:\d+$/);
      }
    });

    it('does not write to localStorage when no new tiles are revealed', () => {
      const engine = makeEngineWithRegion();
      engine.reveal(CENTER, 10);
      storageMock.setItem.mockClear();

      // Second reveal at same position — no new tiles
      engine.reveal(CENTER, 10);
      expect(storageMock.setItem).not.toHaveBeenCalled();
    });
  });

  describe('loadFromStorage', () => {
    it('restores fog state from localStorage', () => {
      // First engine: reveal and persist
      const engine1 = makeEngineWithRegion();
      engine1.reveal(CENTER, 10);
      const serialized = engine1.serialize();

      // Manually set in storage
      storageMock._store.set(`fogmap:${REGION_ID}`, serialized);

      // Second engine: load from storage
      const engine2 = makeEngineWithRegion();
      engine2.loadFromStorage();

      // Should have the same level-4 tiles
      const state1 = Array.from(engine1.getState().revealedTiles)
        .filter((k) => k.startsWith('z4:'))
        .sort();
      const state2 = Array.from(engine2.getState().revealedTiles)
        .filter((k) => k.startsWith('z4:'))
        .sort();
      expect(state2).toEqual(state1);
    });

    it('starts fresh when no saved state exists', () => {
      const engine = makeEngineWithRegion();
      engine.loadFromStorage();
      expect(engine.getState().revealedTiles.size).toBe(0);
    });

    it('rebuilds coarser levels from stored level-4 keys', () => {
      const engine1 = makeEngineWithRegion();
      engine1.reveal(CENTER, 10);
      const serialized = engine1.serialize();

      storageMock._store.set(`fogmap:${REGION_ID}`, serialized);

      const engine2 = makeEngineWithRegion();
      engine2.loadFromStorage();

      // Should have tiles at all zoom levels
      for (let level = 0; level <= 4; level++) {
        const keysAtLevel = Array.from(engine2.getState().revealedTiles).filter(
          (k) => k.startsWith(`z${level}:`)
        );
        expect(keysAtLevel.length).toBeGreaterThan(0);
      }
    });
  });

  describe('localStorage unavailable (private browsing)', () => {
    it('logs warning and fires onStorageWarning callback', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const onWarning = vi.fn();

      // Make getItem throw to simulate unavailable storage
      storageMock.getItem.mockImplementation(() => {
        throw new DOMException('blocked', 'SecurityError');
      });

      const engine = makeEngineWithRegion({ onStorageWarning: onWarning });
      engine.loadFromStorage();

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('unavailable')
      );
      expect(onWarning).toHaveBeenCalledWith(
        expect.stringContaining('private browsing')
      );
      warnSpy.mockRestore();
    });

    it('continues in-memory after storage failure on reveal', () => {
      const onWarning = vi.fn();
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Make setItem throw to simulate unavailable storage
      storageMock.setItem.mockImplementation(() => {
        throw new DOMException('blocked', 'SecurityError');
      });

      const engine = makeEngineWithRegion({ onStorageWarning: onWarning });
      const newKeys = engine.reveal(CENTER, 10);

      // Reveal should still work in-memory
      expect(newKeys.length).toBeGreaterThan(0);
      expect(onWarning).toHaveBeenCalled();

      // Subsequent reveals should not attempt storage again
      onWarning.mockClear();
      engine.reveal(
        { latitude: CENTER.latitude + 0.0001, longitude: CENTER.longitude },
        10
      );
      expect(onWarning).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  describe('quota exceeded', () => {
    it('shows quota warning and continues in-memory', () => {
      const onWarning = vi.fn();
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      storageMock.setItem.mockImplementation(() => {
        throw new DOMException('quota exceeded', 'QuotaExceededError');
      });

      const engine = makeEngineWithRegion({ onStorageWarning: onWarning });
      const newKeys = engine.reveal(CENTER, 10);

      expect(newKeys.length).toBeGreaterThan(0);
      expect(onWarning).toHaveBeenCalledWith(
        expect.stringContaining('Storage full')
      );
      warnSpy.mockRestore();
    });
  });

  describe('corrupted state', () => {
    it('starts fresh when localStorage contains invalid JSON', () => {
      storageMock._store.set(`fogmap:${REGION_ID}`, '{not valid json!!!');

      const engine = makeEngineWithRegion();
      engine.loadFromStorage();

      // Should have no revealed tiles (started fresh)
      expect(engine.getState().revealedTiles.size).toBe(0);
    });

    it('starts fresh when localStorage contains non-array JSON', () => {
      storageMock._store.set(`fogmap:${REGION_ID}`, '"just a string"');

      const engine = makeEngineWithRegion();
      engine.loadFromStorage();

      expect(engine.getState().revealedTiles.size).toBe(0);
    });
  });

  describe('no regionId configured', () => {
    it('does not interact with localStorage when regionId is not set', () => {
      const engine = new FogEngine(configFromBBox(BBOX));
      engine.loadFromStorage();
      engine.reveal(CENTER, 10);

      expect(storageMock.getItem).not.toHaveBeenCalled();
      expect(storageMock.setItem).not.toHaveBeenCalled();
    });
  });
});
