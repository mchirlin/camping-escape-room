// ============================================================
// Marker Database — shared state across devices
// Uses a simple REST API (Vite dev server or ESP32).
// Polls for changes to sync across devices.
// ============================================================

import type { GeoPosition } from './types';

export interface DbMarker {
  id: string;
  position: GeoPosition;
  tag: string;
  count: number;
  label?: string;
  collected: boolean;
  createdAt: number;
}

// API base URL — in dev it's the Vite server, in production it could be ESP32
const API_BASE = `${import.meta.env.BASE_URL}api/markers`;

let apiAvailable = false;

/**
 * Initialize the marker database. Tests if the API is reachable.
 */
export async function initMarkerDb(): Promise<boolean> {
  try {
    const res = await fetch(API_BASE, { method: 'GET' });
    if (res.ok) {
      apiAvailable = true;
      console.log('Marker API connected');
      return true;
    }
  } catch { /* ignore */ }

  console.warn('Marker API not available — using localStorage only');
  return false;
}

export function isDbActive(): boolean {
  return apiAvailable;
}

export async function dbGetMarkers(): Promise<DbMarker[]> {
  if (!apiAvailable) return [];
  const res = await fetch(API_BASE);
  if (!res.ok) return [];
  return res.json();
}

export async function dbPutMarker(marker: DbMarker): Promise<void> {
  if (!apiAvailable) return;
  await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(marker),
  });
}

export async function dbRemoveMarker(id: string): Promise<void> {
  if (!apiAvailable) return;
  await fetch(`${API_BASE}/${id}`, { method: 'DELETE' });
}

export async function dbCollectMarker(id: string): Promise<void> {
  if (!apiAvailable) return;
  await fetch(`${API_BASE}/${id}/collect`, { method: 'POST' });
}

export async function dbUpdatePosition(id: string, position: GeoPosition): Promise<void> {
  if (!apiAvailable) return;
  await fetch(`${API_BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ position }),
  });
}

export async function dbUpdateCount(id: string, count: number): Promise<void> {
  if (!apiAvailable) return;
  await fetch(`${API_BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ count }),
  });
}

/**
 * Poll for marker changes. Returns a cleanup function.
 * Calls the callback with the full marker list every `intervalMs`.
 */
export function dbPollMarkers(
  callback: (markers: DbMarker[]) => void,
  intervalMs = 3000
): () => void {
  if (!apiAvailable) return () => {};

  let running = true;

  const poll = async () => {
    while (running) {
      try {
        const markers = await dbGetMarkers();
        callback(markers);
      } catch { /* ignore */ }
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  };

  poll();
  return () => { running = false; };
}
