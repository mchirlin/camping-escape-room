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
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import type { GeoPosition } from './types';

export interface PlayerData {
  id: string;
  position: GeoPosition;
  avatar: string;
  name: string;
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
  avatar: string,
  name = ''
): Promise<void> {
  if (!db) return;
  try {
    // merge:true so we don't clobber persistent fields like onboardedAt
    await setDoc(doc(db, COLLECTION_NAME, playerId), {
      position,
      avatar,
      name,
      updatedAt: Date.now(),
    }, { merge: true });
  } catch (err) {
    console.warn('Failed to write player position', err);
  }
}

/**
 * Mark this player offline on page unload.
 * We keep the doc (so persistent state like onboardedAt survives) and just
 * push updatedAt into the past so the staleness filter hides the avatar.
 */
export async function removePlayer(playerId: string): Promise<void> {
  if (!db) return;
  try {
    await setDoc(doc(db, COLLECTION_NAME, playerId), {
      updatedAt: 0,
    }, { merge: true });
  } catch (err) {
    console.warn('Failed to mark player offline', err);
  }
}

/**
 * Has this device's player already completed onboarding?
 * Reads the persistent onboardedAt field from the player doc.
 */
export async function hasOnboarded(playerId: string): Promise<boolean> {
  if (!db) return false;
  try {
    const snap = await getDoc(doc(db, COLLECTION_NAME, playerId));
    return snap.exists() && typeof snap.data().onboardedAt === 'number';
  } catch (err) {
    console.warn('Failed to read onboarding status', err);
    return false;
  }
}

/**
 * Record that this device's player finished onboarding.
 * Also stores the chosen avatar/name so the doc has meaningful data
 * before the first position broadcast.
 */
export async function markOnboarded(
  playerId: string,
  avatar: string,
  name: string
): Promise<void> {
  if (!db) return;
  try {
    await setDoc(doc(db, COLLECTION_NAME, playerId), {
      avatar,
      name,
      onboardedAt: Date.now(),
    }, { merge: true });
  } catch (err) {
    console.warn('Failed to mark onboarded', err);
  }
}

/**
 * Admin: clear the onboardedAt flag on every player doc so all devices
 * re-onboard on their next load. Does not delete players.
 */
export async function resetAllOnboarding(): Promise<number> {
  if (!db) return 0;
  try {
    const snap = await getDocs(collection(db, COLLECTION_NAME));
    let count = 0;
    const ops: Promise<void>[] = [];
    snap.forEach((docSnap) => {
      ops.push(updateDoc(docSnap.ref, { onboardedAt: deleteField() }));
      count++;
    });
    await Promise.all(ops);
    return count;
  } catch (err) {
    console.warn('Failed to reset onboarding', err);
    return 0;
  }
}

/**
 * Admin: delete every player doc from Firestore. Unlike removePlayer (which
 * just marks a player offline) this permanently removes all player records,
 * including persistent fields like onboardedAt. Every connected device will
 * re-create its own doc on its next broadcast / onboarding.
 * Returns the number of player docs deleted.
 */
export async function deleteAllPlayers(): Promise<number> {
  if (!db) return 0;
  try {
    const snap = await getDocs(collection(db, COLLECTION_NAME));
    let count = 0;
    const ops: Promise<void>[] = [];
    snap.forEach((docSnap) => {
      ops.push(deleteDoc(docSnap.ref));
      count++;
    });
    await Promise.all(ops);
    return count;
  } catch (err) {
    console.warn('Failed to delete all players', err);
    return 0;
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
        name: data.name || '',
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
  intervalMs = 3000,
  getName: () => string = () => ''
): () => void {
  // Write immediately
  const pos = getPosition();
  if (pos) writePlayerPosition(playerId, pos, getAvatar(), getName());

  broadcastInterval = setInterval(() => {
    const p = getPosition();
    if (p) writePlayerPosition(playerId, p, getAvatar(), getName());
  }, intervalMs);

  return () => {
    if (broadcastInterval) {
      clearInterval(broadcastInterval);
      broadcastInterval = null;
    }
  };
}
