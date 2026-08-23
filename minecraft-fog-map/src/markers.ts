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
  uid?: string;
  hidden?: boolean;
}

export type MarkerTag =
  // Blocks
  | 'wood_plank'
  | 'sand'
  | 'cobblestone'
  // Ingots
  | 'iron_ingot'
  | 'gold_ingot'
  | 'copper_ingot'
  // Gems
  | 'diamond'
  | 'redstone'
  | 'amethyst_shard'
  | 'emerald'
  | 'coal'
  // Materials
  | 'stick'
  | 'string'
  | 'paper'
  | 'gunpowder'
  // Locations
  | 'creeper'
  | 'crafting'
  | 'mine'
  | 'tnt_chest'
  | 'dig_site';

const BASE = import.meta.env.BASE_URL;

export const MARKER_TAGS: { tag: MarkerTag; label: string; color: string; texture: string }[] = [
  // Blocks
  { tag: 'wood_plank',    label: 'Wood Plank',      color: '#8B6914', texture: `${BASE}markers/wood.png` },
  { tag: 'sand',          label: 'Sand',            color: '#E8D8A0', texture: `${BASE}markers/sand.png` },
  { tag: 'cobblestone',   label: 'Cobblestone',     color: '#7A7A7A', texture: `${BASE}markers/cobblestone.png` },
  // Ingots
  { tag: 'iron_ingot',    label: 'Iron Ingot',      color: '#D8D8D8', texture: `${BASE}markers/iron.png` },
  { tag: 'gold_ingot',    label: 'Gold Ingot',      color: '#FAEE57', texture: `${BASE}markers/gold.png` },
  { tag: 'copper_ingot',  label: 'Copper Ingot',    color: '#C87533', texture: `${BASE}markers/copper_ingot.png` },
  // Gems
  { tag: 'diamond',       label: 'Diamond',         color: '#5CDBD5', texture: `${BASE}markers/diamond.png` },
  { tag: 'redstone',      label: 'Redstone',        color: '#FF0000', texture: `${BASE}markers/redstone.png` },
  { tag: 'amethyst_shard',label: 'Amethyst Shard',  color: '#9B59B6', texture: `${BASE}markers/amethyst_shard.png` },
  { tag: 'emerald',       label: 'Emerald',         color: '#17DD62', texture: `${BASE}markers/emerald.png` },
  { tag: 'coal',          label: 'Coal',            color: '#2A2A2A', texture: `${BASE}markers/coal.png` },
  // Materials
  { tag: 'stick',         label: 'Stick',           color: '#C4A24E', texture: `${BASE}markers/stick.png` },
  { tag: 'string',        label: 'String',          color: '#EEEEEE', texture: `${BASE}markers/string.png` },
  { tag: 'paper',         label: 'Paper',           color: '#F5F5DC', texture: `${BASE}markers/paper.png` },
  { tag: 'gunpowder',     label: 'Gunpowder',      color: '#444444', texture: `${BASE}markers/gunpowder.png` },
  // Locations
  { tag: 'creeper',       label: 'Creeper',         color: '#55AA33', texture: `${BASE}markers/creeper.png` },
  { tag: 'crafting',      label: 'Crafting Table',  color: '#B5804A', texture: `${BASE}markers/crafting.png` },
  { tag: 'mine',          label: 'Mine',            color: '#707070', texture: `${BASE}markers/mine.png` },
  { tag: 'tnt_chest',     label: 'TNT Chest',       color: '#FF3333', texture: `${BASE}markers/tnt_chest.png` },
  { tag: 'dig_site',      label: 'Dig Site',        color: '#AA5500', texture: `${BASE}markers/dig_site.png` },
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
  dbUpdateHidden,
  dbPollMarkers,
  type DbMarker,
} from './marker-db';

const STORAGE_KEY = 'fogmap:markers';

export class MarkerStore {
  private markers: MapMarker[] = [];
  private isAdmin = false;
  /** Called whenever markers change (local or remote) */
  onChange: ((markers: MapMarker[]) => void) | null = null;

  constructor(admin = false) {
    this.isAdmin = admin;
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
          hidden: m.hidden ?? false,
        }));
      this.saveLocal();
      this.onChange?.(this.getAll());
    });
  }

  /** Get visible markers (hidden markers excluded unless admin) */
  getAll(): MapMarker[] {
    if (this.isAdmin) {
      return [...this.markers];
    }
    return this.markers.filter((m) => !m.hidden);
  }

  /** Get all markers including hidden (for admin rendering) */
  getAllIncludingHidden(): MapMarker[] {
    return [...this.markers];
  }

  /** Get unique tags that have hidden markers */
  getHiddenTags(): MarkerTag[] {
    const tags = new Set<MarkerTag>();
    for (const m of this.markers) {
      if (m.hidden) tags.add(m.tag);
    }
    return [...tags];
  }

  /** Get unique tags that have visible markers */
  getVisibleTags(): MarkerTag[] {
    const tags = new Set<MarkerTag>();
    for (const m of this.markers) {
      if (!m.hidden) tags.add(m.tag);
    }
    return [...tags];
  }

  /** Reveal all markers of a given tag (set hidden=false) */
  revealByTag(tag: MarkerTag): void {
    for (const m of this.markers) {
      if (m.tag === tag && m.hidden) {
        m.hidden = false;
        dbUpdateHidden(m.id, false);
      }
    }
    this.saveLocal();
    this.onChange?.(this.getAll());
  }

  /** Hide all markers of a given tag (set hidden=true) */
  hideByTag(tag: MarkerTag): void {
    for (const m of this.markers) {
      if (m.tag === tag && !m.hidden) {
        m.hidden = true;
        dbUpdateHidden(m.id, true);
      }
    }
    this.saveLocal();
    this.onChange?.(this.getAll());
  }

  /** Reveal all hidden markers */
  revealAll(): void {
    for (const m of this.markers) {
      if (m.hidden) {
        m.hidden = false;
        dbUpdateHidden(m.id, false);
      }
    }
    this.saveLocal();
    this.onChange?.(this.getAll());
  }

  /** Hide all markers */
  hideAll(): void {
    for (const m of this.markers) {
      if (!m.hidden) {
        m.hidden = true;
        dbUpdateHidden(m.id, true);
      }
    }
    this.saveLocal();
    this.onChange?.(this.getAll());
  }

  add(position: GeoPosition, tag: MarkerTag, label?: string, uid?: string, hidden = false): { marker: MapMarker; incremented: boolean } {
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
      uid,
      hidden,
    };
    this.markers.push(marker);
    this.saveLocal();
    dbPutMarker({
      ...marker,
      collected: false,
      hidden,
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
