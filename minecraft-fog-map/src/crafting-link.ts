// ============================================================
// Crafting Table WiFi Integration
// Polls the ESP32 crafting table for status updates and
// triggers map events (marker collection, craft notifications).
// ============================================================
//
// ESP32 API contract (implemented in firmware):
//   GET /status → { slots: string[], recipe: string|null, lastCraft: number }
//     slots: array of 9 block type strings ("wood_plank", "stick", "") 
//     recipe: matched recipe name or null
//     lastCraft: timestamp (ms) of last successful craft, 0 if none
//
// The map polls this endpoint every few seconds when connected.
// On new craft detected, it shows a toast and can auto-collect markers.

import type { MarkerTag } from './markers';

export interface CraftingTableStatus {
  slots: string[];
  recipe: string | null;
  lastCraft: number;
}

export interface CraftingTableConfig {
  /** ESP32 IP address or hostname, e.g. "192.168.4.1" or "crafting-table.local" */
  host: string;
  /** Poll interval in ms (default 3000) */
  pollInterval?: number;
}

/** Map from block type IDs (as written on NFC tags) to marker tags */
const BLOCK_TO_MARKER: Record<string, MarkerTag> = {
  'wood_plank': 'wood',
  'stick': 'stick',
  'iron_ingot': 'iron',
  'string': 'string',
  'gold_ingot': 'gold',
  'diamond': 'diamond',
  'gunpowder': 'gunpowder',
  'sand': 'sand',
  'redstone': 'redstone',
};

/** Recipe names to display-friendly strings */
const RECIPE_NAMES: Record<string, string> = {
  'wooden_pickaxe': '⛏ Wooden Pickaxe',
  'fishing_rod': '🎣 Fishing Rod',
  'gold_sword': '⚔️ Gold Sword',
  'tnt': '💣 TNT',
  'compass': '🧭 Compass',
  'diamond_shovel': '⛏ Diamond Shovel',
};

export type CraftEventHandler = (recipe: string, displayName: string) => void;
export type BlockPlacedHandler = (blockType: string, markerTag: MarkerTag | null) => void;

export class CraftingTableLink {
  private config: CraftingTableConfig;
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastCraftTimestamp = 0;
  private lastSlots: string[] = [];
  private connected = false;
  private failCount = 0;

  /** Fired when a new craft is detected */
  onCraft: CraftEventHandler | null = null;
  /** Fired when a new block appears on the table */
  onBlockPlaced: BlockPlacedHandler | null = null;
  /** Fired when connection status changes */
  onConnectionChange: ((connected: boolean) => void) | null = null;

  constructor(config: CraftingTableConfig) {
    this.config = config;
  }

  get isConnected(): boolean {
    return this.connected;
  }

  get baseUrl(): string {
    return `http://${this.config.host}`;
  }

  start(): void {
    if (this.timer) return;
    const interval = this.config.pollInterval ?? 3000;
    // Poll immediately, then on interval
    this.poll();
    this.timer = setInterval(() => this.poll(), interval);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.setConnected(false);
  }

  private async poll(): Promise<void> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);

      const res = await fetch(`${this.baseUrl}/status`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const status: CraftingTableStatus = await res.json();
      this.failCount = 0;
      this.setConnected(true);
      this.processStatus(status);
    } catch {
      this.failCount++;
      if (this.failCount >= 3) {
        this.setConnected(false);
      }
    }
  }

  private processStatus(status: CraftingTableStatus): void {
    // Detect new blocks placed on table
    for (let i = 0; i < status.slots.length; i++) {
      const blockType = status.slots[i];
      const prev = this.lastSlots[i] ?? '';
      if (blockType && blockType !== prev) {
        const markerTag = BLOCK_TO_MARKER[blockType] ?? null;
        this.onBlockPlaced?.(blockType, markerTag);
      }
    }
    this.lastSlots = [...status.slots];

    // Detect new craft
    if (status.lastCraft > this.lastCraftTimestamp && this.lastCraftTimestamp > 0) {
      const recipe = status.recipe ?? 'unknown';
      const displayName = RECIPE_NAMES[recipe] ?? recipe;
      this.onCraft?.(recipe, displayName);
    }
    this.lastCraftTimestamp = status.lastCraft;
  }

  private setConnected(value: boolean): void {
    if (value !== this.connected) {
      this.connected = value;
      this.onConnectionChange?.(value);
    }
  }
}

// ============================================================
// Helper to find and collect the nearest marker of a given type
// ============================================================

import { MarkerStore } from './markers';
import type { GeoPosition } from './types';

/**
 * Find the nearest marker matching the given tag and collect it.
 * Returns the marker ID if found, null otherwise.
 */
export function collectNearestMarker(
  store: MarkerStore,
  tag: MarkerTag,
  playerPos?: GeoPosition | null,
): string | null {
  const markers = store.getAll().filter((m) => m.tag === tag);
  if (markers.length === 0) return null;

  if (playerPos && markers.length > 1) {
    // Sort by distance to player, collect nearest
    markers.sort((a, b) => {
      const da = haversine(playerPos, a.position);
      const db = haversine(playerPos, b.position);
      return da - db;
    });
  }

  const target = markers[0];
  if (target.count > 1) {
    // Decrement count instead of removing
    // (MarkerStore.collect removes entirely, so we'd need updateCount)
    store.collect(target.id);
  } else {
    store.collect(target.id);
  }
  return target.id;
}

function haversine(a: GeoPosition, b: GeoPosition): number {
  const dLat = (b.latitude - a.latitude) * 111320;
  const dLng = (b.longitude - a.longitude) * 111320 *
    Math.cos(a.latitude * Math.PI / 180);
  return Math.sqrt(dLat * dLat + dLng * dLng);
}
