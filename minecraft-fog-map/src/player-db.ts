// ============================================================
// Player Database — Firebase Firestore for real-time multiplayer
// Broadcasts player position + avatar, listens for other players.
// Stale players (no update in 30 min) are filtered out client-side.
// ============================================================

import { getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import type { GeoPosition } from './types';

export interface PlayerData {
  id: string;
  position: GeoPosition;
  avatar: string;
  updatedAt: number;
}

const COLLECTION_NAME = 'players';
const STALE_TIMEOUT_MS = 10 * 1000; // 10 seconds — avatar disappears almost immediately when device stops broadcasting

let db: ReturnType<typeof getFirestore> | null = null;
let unsubscribe: Unsubscribe | null = null;
let broadcastInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Initialize player DB using the already-initialized Firebase app.
 * Call after initMarkerDb() has run.
 */
export function initPlayerDb(): boolean {
  try {
    const app = getApp();
    db = getFirestore(app);
    return true;
  } catch (err) {
    console.warn('Player DB init failed (Firebase not initialized?)', err);
    return false;
  }
}

/**
 * Write this player's position and avatar to Firestore.
 */
export async function writePlayerPosition(
  playerId: string,
  position: GeoPosition,
  avatar: string
): Promise<void> {
  if (!db) return;
  try {
    await setDoc(doc(db, COLLECTION_NAME, playerId), {
      position,
      avatar,
      updatedAt: Date.now(),
    });
  } catch (err) {
    console.warn('Failed to write player position', err);
  }
}

/**
 * Remove this player from the collection (on page unload).
 */
export async function removePlayer(playerId: string): Promise<void> {
  if (!db) return;
  try {
    await deleteDoc(doc(db, COLLECTION_NAME, playerId));
  } catch (err) {
    console.warn('Failed to remove player', err);
  }
}

/**
 * Subscribe to real-time player updates from Firestore.
 * Calls the callback with all non-stale players (excluding self).
 * Returns a cleanup function.
 */
export function listenForPlayers(
  myPlayerId: string,
  callback: (players: PlayerData[]) => void
): () => void {
  if (!db) return () => {};

  const colRef = collection(db, COLLECTION_NAME);

  unsubscribe = onSnapshot(colRef, (snapshot) => {
    const now = Date.now();
    const players: PlayerData[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      // Skip self
      if (docSnap.id === myPlayerId) return;
      // Skip stale (no update in 30 min)
      if (now - (data.updatedAt || 0) > STALE_TIMEOUT_MS) return;

      players.push({
        id: docSnap.id,
        position: data.position,
        avatar: data.avatar || 'alex',
        updatedAt: data.updatedAt || 0,
      });
    });
    callback(players);
  }, (err) => {
    console.warn('Player listener error:', err);
  });

  return () => {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  };
}

/**
 * Start broadcasting this player's position every intervalMs.
 * Returns a stop function.
 */
export function startBroadcasting(
  playerId: string,
  getPosition: () => GeoPosition | null,
  getAvatar: () => string,
  intervalMs = 3000
): () => void {
  // Write immediately
  const pos = getPosition();
  if (pos) writePlayerPosition(playerId, pos, getAvatar());

  broadcastInterval = setInterval(() => {
    const p = getPosition();
    if (p) writePlayerPosition(playerId, p, getAvatar());
  }, intervalMs);

  return () => {
    if (broadcastInterval) {
      clearInterval(broadcastInterval);
      broadcastInterval = null;
    }
  };
}
