// ============================================================
// Map Markers — user-placed points of interest
// ============================================================

import type { GeoPosition } from './types';

export interface MapMarker {
  id: string;
  position: GeoPosition;
  tag: MarkerTag;
  count: number;
  label?: string;
}

export type MarkerTag =
  | 'wood'
  | 'diamond'
  | 'chest'
  | 'iron'
  | 'gold'
  | 'emerald'
  | 'redstone'
  | 'tnt'
  | 'crafting'
  | 'spawn'
  | 'danger'
  | 'star';

const BASE = import.meta.env.BASE_URL;

export const MARKER_TAGS: { tag: MarkerTag; label: string; color: string; texture: string }[] = [
  { tag: 'wood',      label: 'Wood',           color: '#8B6914', texture: `${BASE}markers/wood.png` },
  { tag: 'diamond',   label: 'Diamond',        color: '#5CDBD5', texture: `${BASE}markers/diamond.png` },
  { tag: 'chest',     label: 'Chest',          color: '#C8A24E', texture: `${BASE}markers/chest.png` },
  { tag: 'iron',      label: 'Iron',           color: '#D8D8D8', texture: `${BASE}markers/iron.png` },
  { tag: 'gold',      label: 'Gold',           color: '#FAEE57', texture: `${BASE}markers/gold.png` },
  { tag: 'emerald',   label: 'Emerald',        color: '#17DD62', texture: `${BASE}markers/emerald.png` },
  { tag: 'redstone',  label: 'Redstone',       color: '#FF0000', texture: `${BASE}markers/redstone.png` },
  { tag: 'tnt',       label: 'TNT',            color: '#FF3333', texture: `${BASE}markers/tnt.png` },
  { tag: 'crafting',  label: 'Crafting Table',  color: '#B5804A', texture: `${BASE}markers/crafting.png` },
  { tag: 'spawn',     label: 'Spawn Point',    color: '#FFFFFF', texture: `${BASE}markers/spawn.png` },
  { tag: 'danger',    label: 'Danger',         color: '#FF5555', texture: `${BASE}markers/danger.png` },
  { tag: 'star',      label: 'Star',           color: '#FFFF55', texture: `${BASE}markers/star.png` },
];

/** Preloaded marker textures: tag → HTMLImageElement */
const markerImages: Map<MarkerTag, HTMLImageElement> = new Map();
let imagesLoaded = false;

/** Preload all marker textures. Call once at startup. */
export function preloadMarkerImages(): Promise<void> {
  if (imagesLoaded) return Promise.resolve();

  const promises = MARKER_TAGS.map((t) => {
    return new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => {
        markerImages.set(t.tag, img);
        resolve();
      };
      img.onerror = () => {
        // Fallback: skip this texture, will use color square
        resolve();
      };
      img.src = t.texture;
    });
  });

  return Promise.all(promises).then(() => { imagesLoaded = true; });
}

/** Get the preloaded image for a marker tag, or null if not loaded. */
export function getMarkerImage(tag: MarkerTag): HTMLImageElement | null {
  return markerImages.get(tag) ?? null;
}

import {
  isDbActive,
  dbPutMarker,
  dbRemoveMarker,
  dbCollectMarker,
  dbUpdatePosition,
  dbUpdateCount,
  dbPollMarkers,
  type DbMarker,
} from './marker-db';

const STORAGE_KEY = 'fogmap:markers';

export class MarkerStore {
  private markers: MapMarker[] = [];
  /** Called whenever markers change (local or remote) */
  onChange: ((markers: MapMarker[]) => void) | null = null;

  constructor() {
    this.load();
  }

  /** Start listening for remote changes via polling */
  async startSync(): Promise<void> {
    if (!isDbActive()) return;

    dbPollMarkers((dbMarkers) => {
      this.markers = dbMarkers
        .filter((m) => !m.collected)
        .map((m) => ({
          id: m.id,
          position: m.position,
          tag: m.tag as MarkerTag,
          count: m.count,
          label: m.label,
        }));
      this.saveLocal();
      this.onChange?.(this.getAll());
    });
  }

  getAll(): MapMarker[] {
    return [...this.markers];
  }

  add(position: GeoPosition, tag: MarkerTag, label?: string): { marker: MapMarker; incremented: boolean } {
    const nearby = this.markers.find((m) => {
      if (m.tag !== tag) return false;
      const dLat = Math.abs(m.position.latitude - position.latitude) * 111320;
      const dLng = Math.abs(m.position.longitude - position.longitude) * 111320 *
        Math.cos(position.latitude * Math.PI / 180);
      return Math.sqrt(dLat * dLat + dLng * dLng) < 5;
    });

    if (nearby) {
      nearby.count += 1;
      this.saveLocal();
      dbUpdateCount(nearby.id, nearby.count);
      return { marker: nearby, incremented: true };
    }

    const marker: MapMarker = {
      id: crypto.randomUUID(),
      position,
      tag,
      count: 1,
      label,
    };
    this.markers.push(marker);
    this.saveLocal();
    dbPutMarker({
      ...marker,
      collected: false,
      createdAt: Date.now(),
    });
    return { marker, incremented: false };
  }

  remove(id: string): void {
    this.markers = this.markers.filter((m) => m.id !== id);
    this.saveLocal();
    dbRemoveMarker(id);
  }

  removeAll(): void {
    const ids = this.markers.map((m) => m.id);
    this.markers = [];
    this.saveLocal();
    for (const id of ids) dbRemoveMarker(id);
    this.onChange?.(this.getAll());
  }

  /** Mark a marker as collected (block scanned on crafting table) */
  collect(id: string): void {
    this.markers = this.markers.filter((m) => m.id !== id);
    this.saveLocal();
    dbCollectMarker(id);
    this.onChange?.(this.getAll());
  }

  updatePosition(id: string, position: GeoPosition): void {
    const marker = this.markers.find((m) => m.id === id);
    if (marker) {
      marker.position = position;
      this.saveLocal();
      dbUpdatePosition(id, position);
    }
  }

  private saveLocal(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.markers));
    } catch {
      // ignore
    }
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.markers = JSON.parse(raw);
        for (const m of this.markers) {
          if (!m.count) m.count = 1;
        }
      }
    } catch {
      this.markers = [];
    }
  }
}
