// ============================================================
// Fog Sync — Firebase Firestore for shared multiplayer fog state
// ============================================================
// Stores revealed level-4 tile keys in a Firestore document.
// All players share the same fog — when one player reveals tiles,
// everyone else sees them revealed in real-time.
//
// Strategy:
// - One Firestore doc per region: `fog/{regionId}`
// - The doc stores a `tiles` field: an array of level-4 tile key strings
// - On reveal: push newly revealed keys to Firestore (merge with existing)
// - On snapshot: apply any remotely-revealed tiles locally
// - Falls back to localStorage-only if Firebase is unavailable
// ============================================================

import { getApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  arrayUnion,
  type Unsubscribe,
} from 'firebase/firestore';

const COLLECTION = 'fog';

let db: ReturnType<typeof getFirestore> | null = null;
let unsubscribe: Unsubscribe | null = null;
let syncActive = false;

/**
 * Initialize fog sync. Call after Firebase app is initialized (e.g. after initMarkerDb).
 */
export function initFogSync(): boolean {
  try {
    const app = getApp();
    db = getFirestore(app);
    syncActive = true;
    return true;
  } catch (err) {
    console.warn('Fog sync init failed — using localStorage only', err);
    syncActive = false;
    return false;
  }
}

export function isFogSyncActive(): boolean {
  return syncActive;
}

/**
 * Load the full fog state from Firestore for a region.
 * Returns the array of level-4 tile keys, or null if no data exists.
 */
export async function loadFogFromFirebase(regionId: string): Promise<string[] | null> {
  if (!db || !syncActive) return null;

  try {
    const ref = doc(db, COLLECTION, regionId);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data();
      if (Array.isArray(data.tiles)) {
        return data.tiles as string[];
      }
    }
    return null;
  } catch (err) {
    console.warn('Failed to load fog from Firebase:', err);
    return null;
  }
}

/**
 * Push newly revealed tile keys to Firestore (merges with existing).
 * Uses arrayUnion so concurrent writes from multiple players merge correctly.
 */
export async function pushRevealedTiles(regionId: string, newKeys: string[]): Promise<void> {
  if (!db || !syncActive || newKeys.length === 0) return;

  try {
    const ref = doc(db, COLLECTION, regionId);
    // arrayUnion ensures no duplicates and merges concurrent writes
    await updateDoc(ref, {
      tiles: arrayUnion(...newKeys),
    });
  } catch (err: any) {
    // If doc doesn't exist yet, create it
    if (err?.code === 'not-found') {
      try {
        const ref = doc(db!, COLLECTION, regionId);
        await setDoc(ref, { tiles: newKeys });
      } catch (createErr) {
        console.warn('Failed to create fog doc in Firebase:', createErr);
      }
    } else {
      console.warn('Failed to push fog tiles to Firebase:', err);
    }
  }
}

/**
 * Save the full fog state to Firestore (overwrites).
 * Used for reset or revealAll operations.
 */
export async function saveFogToFirebase(regionId: string, allLevel4Keys: string[]): Promise<void> {
  if (!db || !syncActive) return;

  try {
    const ref = doc(db, COLLECTION, regionId);
    await setDoc(ref, { tiles: allLevel4Keys });
  } catch (err) {
    console.warn('Failed to save fog to Firebase:', err);
  }
}

/**
 * Subscribe to real-time fog updates for a region.
 * The callback receives the full set of level-4 tile keys whenever the doc changes.
 */
export function subscribeFogUpdates(
  regionId: string,
  onUpdate: (tileKeys: string[]) => void
): void {
  if (!db || !syncActive) return;

  // Unsubscribe from previous listener
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }

  const ref = doc(db, COLLECTION, regionId);
  unsubscribe = onSnapshot(ref, (snap) => {
    if (snap.exists()) {
      const data = snap.data();
      if (Array.isArray(data.tiles)) {
        onUpdate(data.tiles as string[]);
      }
    }
  }, (err) => {
    console.warn('Fog sync listener error:', err);
  });
}

/**
 * Unsubscribe from real-time fog updates.
 */
export function unsubscribeFogUpdates(): void {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
}
