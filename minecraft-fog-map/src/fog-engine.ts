// ============================================================
// Fog Engine — manages revealed tile state and reveal logic
// Minecraft Fog Map
// ============================================================

import type { BoundingBox, FogState, GeoPosition, ZoomLevelData } from './types';
import { ZOOM_LEVELS } from './types';
import { geoToTile, tileToGeo } from './coords';
import { calculateGridSize } from './terrain-utils';

/** Configuration needed by the FogEngine to do coordinate conversions */
export interface FogEngineConfig {
  boundingBox: BoundingBox;
  /** Grid sizes per zoom level, indexed by level (0–4) */
  gridSizes: { cols: number; rows: number }[];
  /** Unique region identifier used as localStorage key: `fogmap:{regionId}` */
  regionId?: string;
  /** Called when a storage warning occurs (e.g. quota exceeded, private browsing) */
  onStorageWarning?: (message: string) => void;
}

/**
 * Build a FogEngineConfig from terrain data zoom levels.
 */
export function configFromTerrainData(
  bbox: BoundingBox,
  zoomLevels: ZoomLevelData[]
): FogEngineConfig {
  const gridSizes = zoomLevels
    .slice()
    .sort((a, b) => a.level - b.level)
    .map((zl) => ({ cols: zl.cols, rows: zl.rows }));
  return { boundingBox: bbox, gridSizes };
}

/**
 * Build a FogEngineConfig from a bounding box alone (derives grid sizes
 * from ZOOM_LEVELS constants using calculateGridSize).
 */
export function configFromBBox(bbox: BoundingBox): FogEngineConfig {
  const gridSizes = ZOOM_LEVELS.map((zl) =>
    calculateGridSize(bbox, zl.metersPerTile)
  );
  return { boundingBox: bbox, gridSizes };
}

/** Format a tile key string */
export function tileKey(level: number, col: number, row: number): string {
  return `z${level}:${col}:${row}`;
}

// Approximate meters per degree of latitude
const METERS_PER_DEG_LAT = 111_320;

/**
 * Compute the approximate distance in meters between two geographic positions.
 * Uses equirectangular approximation (good enough for small areas).
 */
function distanceMeters(a: GeoPosition, b: GeoPosition): number {
  const dLat = (b.latitude - a.latitude) * METERS_PER_DEG_LAT;
  const avgLat = ((a.latitude + b.latitude) / 2) * (Math.PI / 180);
  const dLng = (b.longitude - a.longitude) * METERS_PER_DEG_LAT * Math.cos(avgLat);
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

export class FogEngine {
  private revealedTiles: Set<string> = new Set();
  private readonly config: FogEngineConfig;
  /** Whether localStorage is available and working */
  private storageAvailable = true;

  constructor(config: FogEngineConfig) {
    this.config = config;
  }

  /** Get the localStorage key for this region */
  private get storageKey(): string | null {
    return this.config.regionId ? `fogmap:${this.config.regionId}` : null;
  }

  /**
   * Load fog state from localStorage for the configured regionId.
   * Handles: unavailable storage, corrupted JSON, missing data.
   */
  loadFromStorage(): void {
    const key = this.storageKey;
    if (!key) return;

    let raw: string | null = null;
    try {
      raw = localStorage.getItem(key);
    } catch {
      // localStorage unavailable (e.g. private browsing in some browsers)
      this.storageAvailable = false;
      console.warn('localStorage is unavailable. Progress will not be saved.');
      this.config.onStorageWarning?.(
        "Progress won't be saved in private browsing mode."
      );
      return;
    }

    if (raw === null) {
      // No saved state — start fresh
      return;
    }

    // init() already handles corrupted JSON (catches parse errors and starts fresh)
    this.init(raw);
  }

  /**
   * Persist current fog state to localStorage.
   * Handles quota exceeded and unavailable storage gracefully.
   */
  private persistToStorage(): void {
    if (!this.storageAvailable) return;
    const key = this.storageKey;
    if (!key) return;

    try {
      localStorage.setItem(key, this.serialize());
    } catch (err: unknown) {
      this.storageAvailable = false;
      // DOMException with name 'QuotaExceededError' for quota issues
      const isQuota =
        err instanceof DOMException &&
        (err.name === 'QuotaExceededError' ||
          err.name === 'NS_ERROR_DOM_QUOTA_REACHED');

      if (isQuota) {
        console.warn('localStorage quota exceeded. Progress may not be saved.');
        this.config.onStorageWarning?.(
          'Storage full — progress may not be saved.'
        );
      } else {
        // Generic storage failure (e.g. private browsing, SecurityError)
        console.warn('localStorage is unavailable. Progress will not be saved.');
        this.config.onStorageWarning?.(
          "Progress won't be saved in private browsing mode."
        );
      }
    }
  }

  /**
   * Reveal all tiles within `revealRadiusMeters` of `position`.
   * Returns the list of newly revealed tile keys.
   */
  reveal(position: GeoPosition, revealRadiusMeters: number): string[] {
    const newlyRevealed: string[] = [];
    const { boundingBox, gridSizes } = this.config;
    const level4 = 4;
    const grid4 = gridSizes[level4];

    // Convert position to level-4 tile to get approximate center tile
    const centerTile = geoToTile(position, level4, boundingBox, grid4);

    // Estimate how many tiles the radius spans at level 4
    // Each level-4 tile is ~2m, so radius in tiles ≈ radius / 2
    const metersPerTile = ZOOM_LEVELS[level4].metersPerTile;
    const tileRadius = Math.ceil(revealRadiusMeters / metersPerTile) + 1;

    const minCol = Math.max(0, centerTile.col - tileRadius);
    const maxCol = Math.min(grid4.cols - 1, centerTile.col + tileRadius);
    const minRow = Math.max(0, centerTile.row - tileRadius);
    const maxRow = Math.min(grid4.rows - 1, centerTile.row + tileRadius);

    // Check each candidate level-4 tile
    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        const key = tileKey(level4, col, row);
        if (this.revealedTiles.has(key)) continue;

        // Get the center of this tile in geo coordinates
        const tileCenter = tileToGeo(
          { zoomLevel: level4, col, row },
          boundingBox,
          grid4
        );

        // Check if tile center is within reveal radius
        const dist = distanceMeters(position, tileCenter);
        if (dist <= revealRadiusMeters) {
          this.revealedTiles.add(key);
          newlyRevealed.push(key);
        }
      }
    }

    // Propagate to coarser levels (3 → 0)
    if (newlyRevealed.length > 0) {
      this.propagateToCoarserLevels(newlyRevealed);
      // Auto-persist to localStorage after each reveal
      this.persistToStorage();
    }

    return newlyRevealed;
  }

  /**
   * For each newly revealed level-4 tile, mark its ancestor tiles at
   * levels 3, 2, 1, 0 as revealed.
   */
  private propagateToCoarserLevels(newLevel4Keys: string[]): void {
    const { gridSizes } = this.config;

    for (const key of newLevel4Keys) {
      // Parse the level-4 tile coordinates
      const parts = key.split(':');
      let col = parseInt(parts[1], 10);
      let row = parseInt(parts[2], 10);

      // Walk from level 4 up to level 0
      for (let level = 3; level >= 0; level--) {
        const childGrid = gridSizes[level + 1];
        const parentGrid = gridSizes[level];

        const colScale = childGrid.cols / parentGrid.cols;
        const rowScale = childGrid.rows / parentGrid.rows;

        col = Math.floor(col / colScale);
        row = Math.floor(row / rowScale);

        // Clamp to valid range
        col = Math.min(col, parentGrid.cols - 1);
        row = Math.min(row, parentGrid.rows - 1);

        const parentKey = tileKey(level, col, row);
        this.revealedTiles.add(parentKey);
      }
    }
  }

  /** O(1) lookup: is a specific tile revealed? (any child revealed → true) */
  isRevealed(zoomLevel: number, col: number, row: number): boolean {
    return this.revealedTiles.has(tileKey(zoomLevel, col, row));
  }

  /**
   * Check if a tile at a given zoom level is FULLY revealed — meaning ALL
   * of its level-4 descendant tiles are revealed. At level 4 this is the
   * same as isRevealed. At coarser levels, every child must be revealed.
   *
   * This prevents zoomed-out views from showing large revealed blocks when
   * only a small portion of the area has actually been explored.
   */
  isFullyRevealed(zoomLevel: number, col: number, row: number): boolean {
    if (zoomLevel === 4) {
      return this.revealedTiles.has(tileKey(4, col, row));
    }

    // Quick reject: if the coarse tile isn't even partially revealed, skip
    if (!this.revealedTiles.has(tileKey(zoomLevel, col, row))) {
      return false;
    }

    const { gridSizes } = this.config;

    // Find the range of level-4 tiles that map to this coarse tile
    let minCol = col;
    let maxCol = col;
    let minRow = row;
    let maxRow = row;

    for (let level = zoomLevel; level < 4; level++) {
      const parentGrid = gridSizes[level];
      const childGrid = gridSizes[level + 1];
      const colScale = childGrid.cols / parentGrid.cols;
      const rowScale = childGrid.rows / parentGrid.rows;

      minCol = Math.floor(minCol * colScale);
      maxCol = Math.min(Math.floor((maxCol + 1) * colScale) - 1, childGrid.cols - 1);
      minRow = Math.floor(minRow * rowScale);
      maxRow = Math.min(Math.floor((maxRow + 1) * rowScale) - 1, childGrid.rows - 1);
    }

    // Check every level-4 tile in the range
    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        if (!this.revealedTiles.has(tileKey(4, c, r))) {
          return false;
        }
      }
    }
    return true;
  }

  /** Get the current fog state for rendering */
  getState(): FogState {
    return { revealedTiles: this.revealedTiles };
  }

  /** Serialize state: export only level-4 tile keys as JSON array */
  serialize(): string {
    const level4Keys = Array.from(this.revealedTiles).filter((k) =>
      k.startsWith('z4:')
    );
    return JSON.stringify(level4Keys);
  }

  /**
   * Initialize with optional saved state.
   * Deserializes level-4 keys and rebuilds coarser level sets.
   */
  init(savedState?: string): void {
    this.revealedTiles.clear();

    if (savedState) {
      try {
        const level4Keys: string[] = JSON.parse(savedState);
        if (Array.isArray(level4Keys)) {
          for (const key of level4Keys) {
            this.revealedTiles.add(key);
          }
          // Rebuild coarser levels from level-4 keys
          this.propagateToCoarserLevels(level4Keys);
        }
      } catch {
        // Corrupted state — start fresh
        this.revealedTiles.clear();
      }
    }
  }

  /** Reset all fog — clear revealed tiles and localStorage. */
  reset(): void {
    this.revealedTiles.clear();
    const key = this.storageKey;
    if (key) {
      try { localStorage.removeItem(key); } catch { /* ignore */ }
    }
  }
}
