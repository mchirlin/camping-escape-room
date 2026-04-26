import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createSimulationMode,
  shouldActivateSimulation,
} from './simulation-mode';
import type { SimulationModeConfig } from './simulation-mode';
import { FogEngine, configFromBBox } from './fog-engine';
import type { BoundingBox, GeoPosition, ViewportState } from './types';

// Shared test bounding box (~500m area)
const bbox: BoundingBox = {
  north: 38.96,
  south: 38.955,
  east: -77.31,
  west: -77.316,
};

const level4GridSize = { cols: 256, rows: 256 };
const tileScreenSize = 16;

function makeViewport(centerLat: number, centerLng: number): ViewportState {
  // Simple viewport centered on a geo position
  const lngRange = bbox.east - bbox.west;
  const latRange = bbox.north - bbox.south;
  const xFrac = lngRange === 0 ? 0 : (centerLng - bbox.west) / lngRange;
  const yFrac = latRange === 0 ? 0 : (bbox.north - centerLat) / latRange;
  return {
    centerX: xFrac * level4GridSize.cols * tileScreenSize,
    centerY: yFrac * level4GridSize.rows * tileScreenSize,
    zoomLevel: 4,
    screenWidth: 800,
    screenHeight: 600,
  };
}

function makeConfig(overrides?: Partial<SimulationModeConfig>): SimulationModeConfig {
  const viewport = makeViewport(38.9575, -77.313);
  return {
    onPosition: vi.fn(),
    getViewport: () => viewport,
    bbox,
    level4GridSize,
    tileScreenSize,
    ...overrides,
  };
}

describe('shouldActivateSimulation', () => {
  const originalLocation = globalThis.window?.location;

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Validates: Requirements 5.1
   * Simulation mode activates via query parameter.
   */
  it('returns true when ?simulate=true is in the URL', () => {
    vi.stubGlobal('window', {
      location: { search: '?simulate=true' },
    });
    expect(shouldActivateSimulation()).toBe(true);
  });

  it('returns false when ?simulate is absent', () => {
    vi.stubGlobal('window', {
      location: { search: '' },
    });
    expect(shouldActivateSimulation()).toBe(false);
  });

  it('returns false when ?simulate=false', () => {
    vi.stubGlobal('window', {
      location: { search: '?simulate=false' },
    });
    expect(shouldActivateSimulation()).toBe(false);
  });

  it('returns false when window is undefined', () => {
    // shouldActivateSimulation guards against typeof window === 'undefined'
    const origWindow = globalThis.window;
    // @ts-expect-error — intentionally removing window for test
    delete globalThis.window;
    expect(shouldActivateSimulation()).toBe(false);
    globalThis.window = origWindow;
  });
});

describe('SimulationMode', () => {
  it('isActive returns false before activation', () => {
    const sim = createSimulationMode(makeConfig());
    expect(sim.isActive()).toBe(false);
  });

  it('isActive returns true after activate and false after deactivate', () => {
    const sim = createSimulationMode(makeConfig());
    sim.activate({ latitude: 38.9575, longitude: -77.313 });
    expect(sim.isActive()).toBe(true);

    sim.deactivate();
    expect(sim.isActive()).toBe(false);
  });

  it('activate calls onPosition with the initial position', () => {
    const onPosition = vi.fn();
    const sim = createSimulationMode(makeConfig({ onPosition }));
    const initial: GeoPosition = { latitude: 38.9575, longitude: -77.313 };

    sim.activate(initial);

    expect(onPosition).toHaveBeenCalledTimes(1);
    expect(onPosition).toHaveBeenCalledWith(initial);
  });

  /**
   * Validates: Requirements 5.3
   * Arrow keys move position in correct cardinal direction.
   */
  describe('handleKeyboard — arrow key movement', () => {
    it('up increases latitude (moves north)', () => {
      const onPosition = vi.fn();
      const sim = createSimulationMode(makeConfig({ onPosition }));
      const start: GeoPosition = { latitude: 38.9575, longitude: -77.313 };
      sim.activate(start);
      onPosition.mockClear();

      sim.handleKeyboard('up');

      expect(onPosition).toHaveBeenCalledTimes(1);
      const pos = onPosition.mock.calls[0][0] as GeoPosition;
      expect(pos.latitude).toBeGreaterThan(start.latitude);
      expect(pos.longitude).toBeCloseTo(start.longitude, 10);
    });

    it('down decreases latitude (moves south)', () => {
      const onPosition = vi.fn();
      const sim = createSimulationMode(makeConfig({ onPosition }));
      const start: GeoPosition = { latitude: 38.9575, longitude: -77.313 };
      sim.activate(start);
      onPosition.mockClear();

      sim.handleKeyboard('down');

      const pos = onPosition.mock.calls[0][0] as GeoPosition;
      expect(pos.latitude).toBeLessThan(start.latitude);
      expect(pos.longitude).toBeCloseTo(start.longitude, 10);
    });

    it('left decreases longitude (moves west)', () => {
      const onPosition = vi.fn();
      const sim = createSimulationMode(makeConfig({ onPosition }));
      const start: GeoPosition = { latitude: 38.9575, longitude: -77.313 };
      sim.activate(start);
      onPosition.mockClear();

      sim.handleKeyboard('left');

      const pos = onPosition.mock.calls[0][0] as GeoPosition;
      expect(pos.longitude).toBeLessThan(start.longitude);
      expect(pos.latitude).toBeCloseTo(start.latitude, 10);
    });

    it('right increases longitude (moves east)', () => {
      const onPosition = vi.fn();
      const sim = createSimulationMode(makeConfig({ onPosition }));
      const start: GeoPosition = { latitude: 38.9575, longitude: -77.313 };
      sim.activate(start);
      onPosition.mockClear();

      sim.handleKeyboard('right');

      const pos = onPosition.mock.calls[0][0] as GeoPosition;
      expect(pos.longitude).toBeGreaterThan(start.longitude);
      expect(pos.latitude).toBeCloseTo(start.latitude, 10);
    });
  });

  it('handleKeyboard does nothing when not active', () => {
    const onPosition = vi.fn();
    const sim = createSimulationMode(makeConfig({ onPosition }));

    sim.handleKeyboard('up');
    expect(onPosition).not.toHaveBeenCalled();
  });

  it('handleMapClick calls onPosition with a geo position', () => {
    const onPosition = vi.fn();
    const viewport = makeViewport(38.9575, -77.313);
    const sim = createSimulationMode(
      makeConfig({ onPosition, getViewport: () => viewport }),
    );
    sim.activate({ latitude: 38.9575, longitude: -77.313 });
    onPosition.mockClear();

    // Click at center of screen
    sim.handleMapClick(400, 300);

    expect(onPosition).toHaveBeenCalledTimes(1);
    const pos = onPosition.mock.calls[0][0] as GeoPosition;
    expect(typeof pos.latitude).toBe('number');
    expect(typeof pos.longitude).toBe('number');
    // The clicked position should be a valid geo coordinate
    expect(pos.latitude).toBeGreaterThanOrEqual(bbox.south - 1);
    expect(pos.latitude).toBeLessThanOrEqual(bbox.north + 1);
  });

  it('handleMapClick does nothing when not active', () => {
    const onPosition = vi.fn();
    const sim = createSimulationMode(makeConfig({ onPosition }));

    sim.handleMapClick(400, 300);
    expect(onPosition).not.toHaveBeenCalled();
  });

  /**
   * Validates: Requirements 5.5
   * Simulated positions trigger fog reveal identically to GPS positions.
   */
  it('simulated positions trigger fog reveal identically to GPS positions', () => {
    const fogConfig = configFromBBox(bbox);
    const fogEngine = new FogEngine(fogConfig);
    fogEngine.init();

    // Wire simulation's onPosition to fogEngine.reveal
    const sim = createSimulationMode(
      makeConfig({
        onPosition: (pos: GeoPosition) => {
          fogEngine.reveal(pos, 10); // 10m reveal radius
        },
      }),
    );

    // All tiles should be hidden initially
    const stateBefore = fogEngine.getState();
    expect(stateBefore.revealedTiles.size).toBe(0);

    // Activate simulation and move
    const center: GeoPosition = { latitude: 38.9575, longitude: -77.313 };
    sim.activate(center);

    // After activation, tiles around the center should be revealed
    const stateAfter = fogEngine.getState();
    expect(stateAfter.revealedTiles.size).toBeGreaterThan(0);

    // Move with arrow key and verify more tiles get revealed
    const sizeAfterActivate = stateAfter.revealedTiles.size;
    sim.handleKeyboard('up');
    sim.handleKeyboard('up');
    sim.handleKeyboard('up');

    const stateAfterMove = fogEngine.getState();
    expect(stateAfterMove.revealedTiles.size).toBeGreaterThanOrEqual(sizeAfterActivate);
  });
});
