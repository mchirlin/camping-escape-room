// ============================================================
// Marker Database — Firebase Firestore for real-time sync
// Syncs markers across multiple devices in real-time.
// Falls back to localStorage-only if Firebase is unavailable.
// ============================================================

import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  updateDoc,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import type { GeoPosition } from './types';

export interface DbMarker {
  id: string;
  position: GeoPosition;
  tag: string;
  count: number;
  label?: string;
  uid?: string;
  collected: boolean;
  createdAt: number;
}

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyD8fwFu0xed8R2wRTkeQP7hxauz7_I81Ko",
  authDomain: "camping-escape-room-a3b7b.firebaseapp.com",
  projectId: "camping-escape-room-a3b7b",
  storageBucket: "camping-escape-room-a3b7b.firebasestorage.app",
  messagingSenderId: "1058615151116",
  appId: "1:1058615151116:web:ab38910aec5f9b9583fc29"
};

let db: ReturnType<typeof getFirestore> | null = null;
let apiAvailable = false;
let unsubscribe: Unsubscribe | null = null;

const COLLECTION_NAME = 'markers';

/**
 * Initialize Firebase Firestore. Returns true if connected.
 */
export async function initMarkerDb(): Promise<boolean> {
  try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    apiAvailable = true;
    console.log('Firebase Firestore connected');
    return true;
  } catch (err) {
    console.warn('Firebase init failed — using localStorage only', err);
    return false;
  }
}

export function isDbActive(): boolean {
  return apiAvailable;
}

export async function dbGetMarkers(): Promise<DbMarker[]> {
  // Not used with real-time listeners, but kept for compatibility
  return [];
}

export async function dbPutMarker(marker: DbMarker): Promise<void> {
  if (!apiAvailable || !db) return;
  try {
    await setDoc(doc(db, COLLECTION_NAME, marker.id), {
      position: marker.position,
      tag: marker.tag,
      count: marker.count,
      label: marker.label || null,
      collected: marker.collected,
      createdAt: marker.createdAt,
    });
  } catch (err) {
    console.warn('Failed to write marker to Firestore', err);
  }
}

export async function dbRemoveMarker(id: string): Promise<void> {
  if (!apiAvailable || !db) return;
  try {
    await deleteDoc(doc(db, COLLECTION_NAME, id));
  } catch (err) {
    console.warn('Failed to remove marker from Firestore', err);
  }
}

export async function dbCollectMarker(id: string): Promise<void> {
  if (!apiAvailable || !db) return;
  try {
    await updateDoc(doc(db, COLLECTION_NAME, id), { collected: true });
  } catch (err) {
    console.warn('Failed to collect marker in Firestore', err);
  }
}

export async function dbUpdatePosition(id: string, position: GeoPosition): Promise<void> {
  if (!apiAvailable || !db) return;
  try {
    await updateDoc(doc(db, COLLECTION_NAME, id), { position });
  } catch (err) {
    console.warn('Failed to update marker position', err);
  }
}

export async function dbUpdateCount(id: string, count: number): Promise<void> {
  if (!apiAvailable || !db) return;
  try {
    await updateDoc(doc(db, COLLECTION_NAME, id), { count });
  } catch (err) {
    console.warn('Failed to update marker count', err);
  }
}

/**
 * Subscribe to real-time marker updates from Firestore.
 * Calls the callback whenever markers change on any device.
 * Returns a cleanup function to stop listening.
 */
export function dbPollMarkers(
  callback: (markers: DbMarker[]) => void,
  _intervalMs = 3000  // ignored — Firestore uses real-time listeners
): () => void {
  if (!apiAvailable || !db) return () => {};

  const colRef = collection(db, COLLECTION_NAME);

  unsubscribe = onSnapshot(colRef, (snapshot) => {
    const markers: DbMarker[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      markers.push({
        id: docSnap.id,
        position: data.position,
        tag: data.tag,
        count: data.count || 1,
        label: data.label || undefined,
        collected: data.collected || false,
        createdAt: data.createdAt || 0,
      });
    });
    callback(markers);
  }, (err) => {
    console.warn('Firestore listener error:', err);
  });

  return () => {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  };
}
