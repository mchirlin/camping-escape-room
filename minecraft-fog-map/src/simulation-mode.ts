// ============================================================
// Simulation Mode — virtual position source for desktop testing
// Minecraft Fog Map
// ============================================================

import type { BoundingBox, GeoPosition, ViewportState } from './types';
import { screenToGeo } from './coords';

/**
 * SimulationMode interface — provides a virtual position source
 * for testing without real GPS hardware.
 */
export interface SimulationMode {
  activate(initialPosition: GeoPosition): void;
  deactivate(): void;
  handleMapClick(screenX: number, screenY: number): void;
  handleKeyboard(direction: 'up' | 'down' | 'left' | 'right'): void;
  isActive(): boolean;
}

/** ~5 meters in degrees of latitude (5 / 111320) */
const LAT_STEP = 5 / 111320;

/**
 * Compute ~5 meters in degrees of longitude at a given latitude.
 * 5 / (111320 * cos(lat))
 */
function lngStep(latDegrees: number): number {
  const cosLat = Math.cos((latDegrees * Math.PI) / 180);
  // Guard against division by zero at the poles
  if (cosLat === 0) return 0;
  return 5 / (111320 * cosLat);
}

export interface SimulationModeConfig {
  /** Callback invoked with each simulated position — same signature as GPSTracker's onPosition */
  onPosition: (pos: GeoPosition) => void;
  /** Current viewport state accessor (needed for screenToGeo) */
  getViewport: () => ViewportState;
  /** Map region bounding box */
  bbox: BoundingBox;
  /** Level-4 grid size for coordinate conversion */
  level4GridSize: { cols: number; rows: number };
  /** Tile screen size in pixels */
  tileScreenSize: number;
}

/**
 * Creates a SimulationMode instance.
 *
 * Activated via `?simulate=true` query parameter or a UI toggle.
 * Arrow keys move the simulated position by ~5 meters per keypress.
 * Click on the map converts screen coordinates to geo coordinates.
 */
export function createSimulationMode(config: SimulationModeConfig): SimulationMode {
  let active = false;
  let currentPosition: GeoPosition | null = null;

  return {
    activate(initialPosition: GeoPosition): void {
      active = true;
      currentPosition = { ...initialPosition };
      config.onPosition(currentPosition);
    },

    deactivate(): void {
      active = false;
      currentPosition = null;
    },

    handleMapClick(screenX: number, screenY: number): void {
      if (!active) return;

      const viewport = config.getViewport();
      const geo = screenToGeo(
        screenX,
        screenY,
        viewport,
        config.bbox,
        config.level4GridSize,
        config.tileScreenSize,
      );

      currentPosition = geo;
      config.onPosition(currentPosition);
    },

    handleKeyboard(direction: 'up' | 'down' | 'left' | 'right'): void {
      if (!active || !currentPosition) return;

      const lng = lngStep(currentPosition.latitude);

      switch (direction) {
        case 'up':
          currentPosition = {
            latitude: currentPosition.latitude + LAT_STEP,
            longitude: currentPosition.longitude,
          };
          break;
        case 'down':
          currentPosition = {
            latitude: currentPosition.latitude - LAT_STEP,
            longitude: currentPosition.longitude,
          };
          break;
        case 'left':
          currentPosition = {
            latitude: currentPosition.latitude,
            longitude: currentPosition.longitude - lng,
          };
          break;
        case 'right':
          currentPosition = {
            latitude: currentPosition.latitude,
            longitude: currentPosition.longitude + lng,
          };
          break;
      }

      config.onPosition(currentPosition);
    },

    isActive(): boolean {
      return active;
    },
  };
}

/**
 * Check whether simulation mode should be activated based on the URL query string.
 */
export function shouldActivateSimulation(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.get('simulate') === 'true';
}
