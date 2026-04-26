// ============================================================
// Terrain Utility Functions
// Minecraft Fog Map
// ============================================================

import type { BoundingBox } from './types';

/**
 * Approximate meters per degree of latitude (roughly constant).
 */
const METERS_PER_DEG_LAT = 111_320;

/**
 * Approximate meters per degree of longitude at a given latitude.
 * Shrinks toward the poles as cos(lat).
 */
export function metersPerDegLng(latDeg: number): number {
  return METERS_PER_DEG_LAT * Math.cos((latDeg * Math.PI) / 180);
}

/**
 * Calculate the width and height of a bounding box in meters.
 * Uses the center latitude for the longitude→meters conversion.
 */
export function bboxSizeMeters(bbox: BoundingBox): { widthM: number; heightM: number } {
  const centerLat = (bbox.north + bbox.south) / 2;
  const widthM = Math.abs(bbox.east - bbox.west) * metersPerDegLng(centerLat);
  const heightM = Math.abs(bbox.north - bbox.south) * METERS_PER_DEG_LAT;
  return { widthM, heightM };
}

/**
 * Calculate grid dimensions (cols × rows) for a bounding box at a given
 * meters-per-tile resolution.
 *
 * Exported as a pure function so it can be tested independently
 * (used by Property 1 tests).
 */
export function calculateGridSize(
  bbox: BoundingBox,
  metersPerTile: number
): { cols: number; rows: number } {
  const { widthM, heightM } = bboxSizeMeters(bbox);
  const cols = Math.ceil(widthM / metersPerTile);
  const rows = Math.ceil(heightM / metersPerTile);
  return { cols, rows };
}
