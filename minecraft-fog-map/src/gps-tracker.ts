import type { GeoPosition } from './types';

/**
 * GPS error types mapped from GeolocationPositionError codes
 * plus a custom 'signal_lost' for prolonged silence.
 */
export type GPSError = 'permission_denied' | 'position_unavailable' | 'timeout' | 'signal_lost';

/**
 * GPSTracker interface — wraps the browser Geolocation API.
 */
export interface GPSTracker {
  start(onPosition: (pos: GeoPosition) => void, onError: (err: GPSError) => void): void;
  stop(): void;
  getLastPosition(): GeoPosition | null;
}

/** How long (ms) without a position update before we fire 'signal_lost'. */
const SIGNAL_LOST_TIMEOUT_MS = 10_000;

/**
 * Creates a GPSTracker backed by navigator.geolocation.watchPosition.
 */
export function createGPSTracker(): GPSTracker {
  let watchId: number | null = null;
  let lastPosition: GeoPosition | null = null;
  let signalLostTimer: ReturnType<typeof setTimeout> | null = null;
  let signalLostFired = false;
  let onErrorCb: ((err: GPSError) => void) | null = null;

  function resetSignalLostTimer(): void {
    signalLostFired = false;
    if (signalLostTimer !== null) {
      clearTimeout(signalLostTimer);
    }
    signalLostTimer = setTimeout(() => {
      signalLostFired = true;
      onErrorCb?.('signal_lost');
    }, SIGNAL_LOST_TIMEOUT_MS);
  }

  function mapGeolocationError(error: GeolocationPositionError): GPSError {
    switch (error.code) {
      case error.PERMISSION_DENIED:
        return 'permission_denied';
      case error.POSITION_UNAVAILABLE:
        return 'position_unavailable';
      case error.TIMEOUT:
        return 'timeout';
      default:
        return 'position_unavailable';
    }
  }

  return {
    start(onPosition, onError) {
      onErrorCb = onError;

      // Start the signal-lost countdown immediately
      resetSignalLostTimer();

      watchId = navigator.geolocation.watchPosition(
        (geolocationPosition) => {
          const pos: GeoPosition = {
            latitude: geolocationPosition.coords.latitude,
            longitude: geolocationPosition.coords.longitude,
          };
          lastPosition = pos;
          resetSignalLostTimer();
          onPosition(pos);
        },
        (error) => {
          // A geolocation error doesn't reset the signal-lost timer —
          // we still haven't received a valid position.
          onError(mapGeolocationError(error));
        },
        {
          enableHighAccuracy: true,
          maximumAge: 3000,
        },
      );
    },

    stop() {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
      }
      if (signalLostTimer !== null) {
        clearTimeout(signalLostTimer);
        signalLostTimer = null;
      }
      onErrorCb = null;
    },

    getLastPosition() {
      return lastPosition;
    },
  };
}
