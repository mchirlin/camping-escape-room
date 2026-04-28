// ============================================================
// Unit tests for MapInteraction
// Minecraft Fog Map
// ============================================================

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  MapInteraction,
  MapInteractionConfig,
  clampViewportCenter,
} from './map-interaction';
import type { ViewportState } from './types';

/** Helper: create a minimal config for testing */
function makeConfig(overrides?: Partial<MapInteractionConfig>): MapInteractionConfig {
  return {
    boundingBox: { north: 39.0, south: 38.995, east: -77.31, west: -77.316 },
    level4GridSize: { cols: 256, rows: 256 },
    initialViewport: {
      centerX: 4096,
      centerY: 4096,
      zoomLevel: 2,
      screenWidth: 800,
      screenHeight: 600,
    },
    ...overrides,
  };
}

/** Helper: create a minimal HTMLCanvasElement stub for attach() */
function makeCanvas(): HTMLCanvasElement {
  const listeners: Record<string, EventListener[]> = {};
  return {
    addEventListener: vi.fn((type: string, handler: EventListener) => {
      if (!listeners[type]) listeners[type] = [];
      listeners[type].push(handler);
    }),
    removeEventListener: vi.fn(),
    // Expose listeners for dispatching in tests
    __listeners: listeners,
  } as unknown as HTMLCanvasElement;
}

describe('clampViewportCenter (pure function)', () => {
  it('returns the same position when already inside bounds', () => {
    const result = clampViewportCenter(100, 200, 500, 500);
    expect(result).toEqual({ x: 100, y: 200 });
  });

  it('clamps negative coordinates to 0', () => {
    const result = clampViewportCenter(-50, -100, 500, 500);
    expect(result).toEqual({ x: 0, y: 0 });
  });

  it('clamps coordinates exceeding world dimensions', () => {
    const result = clampViewportCenter(600, 700, 500, 500);
    expect(result).toEqual({ x: 500, y: 500 });
  });

  it('clamps both axes independently', () => {
    const result = clampViewportCenter(-10, 600, 500, 500);
    expect(result).toEqual({ x: 0, y: 500 });
  });

  it('handles zero-size world', () => {
    const result = clampViewportCenter(50, 50, 0, 0);
    expect(result).toEqual({ x: 0, y: 0 });
  });

  it('allows exact boundary values', () => {
    const result = clampViewportCenter(0, 500, 500, 500);
    expect(result).toEqual({ x: 0, y: 500 });
  });
});

describe('MapInteraction', () => {
  let interaction: MapInteraction;
  let config: MapInteractionConfig;

  beforeEach(() => {
    config = makeConfig();
    interaction = new MapInteraction(config);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor and getViewport', () => {
    it('returns the initial viewport state', () => {
      const vp = interaction.getViewport();
      expect(vp.centerX).toBe(4096);
      expect(vp.centerY).toBe(4096);
      expect(vp.zoomLevel).toBe(2);
      expect(vp.screenWidth).toBe(800);
      expect(vp.screenHeight).toBe(600);
    });

    it('returns a copy, not a reference', () => {
      const vp1 = interaction.getViewport();
      vp1.centerX = 9999;
      const vp2 = interaction.getViewport();
      expect(vp2.centerX).toBe(4096);
    });
  });

  describe('attach', () => {
    it('registers touch and mouse event listeners on the canvas', () => {
      const canvas = makeCanvas();
      interaction.attach(canvas);

      const calls = (canvas.addEventListener as ReturnType<typeof vi.fn>).mock.calls;
      const eventTypes = calls.map((c: unknown[]) => c[0]);

      expect(eventTypes).toContain('touchstart');
      expect(eventTypes).toContain('touchmove');
      expect(eventTypes).toContain('touchend');
      expect(eventTypes).toContain('touchcancel');
      expect(eventTypes).toContain('mousedown');
      expect(eventTypes).toContain('mousemove');
      expect(eventTypes).toContain('mouseup');
      expect(eventTypes).toContain('mouseleave');
      expect(eventTypes).toContain('wheel');
    });
  });

  describe('clampToBounds', () => {
    it('clamps viewport center that is out of bounds', () => {
      // worldWidth = 256 * 32 = 8192, worldHeight = 256 * 32 = 8192
      const cfg = makeConfig({
        initialViewport: {
          centerX: 10000,
          centerY: -500,
          zoomLevel: 2,
          screenWidth: 800,
          screenHeight: 600,
        },
      });
      const mi = new MapInteraction(cfg);
      mi.clampToBounds();
      const vp = mi.getViewport();
      expect(vp.centerX).toBe(8192);
      expect(vp.centerY).toBe(0);
    });

    it('does not change viewport already within bounds', () => {
      interaction.clampToBounds();
      const vp = interaction.getViewport();
      expect(vp.centerX).toBe(4096);
      expect(vp.centerY).toBe(4096);
    });
  });

  describe('centerOn', () => {
    it('immediately sets center when animate=false', () => {
      // Center of the bounding box
      const centerLat = (config.boundingBox.north + config.boundingBox.south) / 2;
      const centerLng = (config.boundingBox.east + config.boundingBox.west) / 2;

      interaction.centerOn({ latitude: centerLat, longitude: centerLng }, false);
      const vp = interaction.getViewport();

      // Should be approximately at the center of the world
      // worldWidth = 256 * 32 = 8192, so center ≈ 4096
      expect(vp.centerX).toBeCloseTo(4096, 0);
      expect(vp.centerY).toBeCloseTo(4096, 0);
    });

    it('clamps centerOn target to world bounds', () => {
      // Position far outside the bounding box (north-east corner way out)
      interaction.centerOn({ latitude: 40.0, longitude: -76.0 }, false);
      const vp = interaction.getViewport();

      // Should be clamped to world bounds
      expect(vp.centerX).toBeLessThanOrEqual(8192);
      expect(vp.centerY).toBeGreaterThanOrEqual(0);
    });
  });

  describe('setZoomLevel', () => {
    it('sets zoom level within valid range', () => {
      interaction.setZoomLevel(4);
      expect(interaction.getViewport().zoomLevel).toBe(4);
    });

    it('clamps zoom level to MIN_ZOOM_LEVEL', () => {
      interaction.setZoomLevel(-10);
      expect(interaction.getViewport().zoomLevel).toBe(-3);
    });

    it('clamps zoom level to MAX_ZOOM_LEVEL', () => {
      interaction.setZoomLevel(10);
      expect(interaction.getViewport().zoomLevel).toBe(6);
    });

    it('accepts fractional zoom levels (continuous zoom)', () => {
      interaction.setZoomLevel(2.7);
      expect(interaction.getViewport().zoomLevel).toBeCloseTo(2.7);
    });
  });

  describe('setScreenSize', () => {
    it('updates screen dimensions in viewport', () => {
      interaction.setScreenSize(1024, 768);
      const vp = interaction.getViewport();
      expect(vp.screenWidth).toBe(1024);
      expect(vp.screenHeight).toBe(768);
    });
  });
});
