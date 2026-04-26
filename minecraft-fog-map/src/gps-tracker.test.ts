import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createGPSTracker } from './gps-tracker';
import type { GPSError } from './gps-tracker';
import type { GeoPosition } from './types';

// --- Mock navigator.geolocation ---

let watchCallback: ((pos: GeolocationPosition) => void) | null = null;
let errorCallback: ((err: GeolocationPositionError) => void) | null = null;
let clearWatchSpy: ReturnType<typeof vi.fn>;

function makeGeolocationPosition(lat: number, lng: number): GeolocationPosition {
  return {
    coords: {
      latitude: lat,
      longitude: lng,
      accuracy: 10,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
    },
    timestamp: Date.now(),
  };
}

function makeGeolocationError(code: number): GeolocationPositionError {
  return {
    code,
    message: 'mock error',
    PERMISSION_DENIED: 1,
    POSITION_UNAVAILABLE: 2,
    TIMEOUT: 3,
  };
}

beforeEach(() => {
  vi.useFakeTimers();

  clearWatchSpy = vi.fn();

  const mockGeolocation: Partial<Geolocation> = {
    watchPosition: vi.fn((success, error, _options) => {
      watchCallback = success;
      errorCallback = error ?? null;
      return 42; // watchId
    }),
    clearWatch: clearWatchSpy,
  };

  vi.stubGlobal('navigator', {
    geolocation: mockGeolocation,
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  watchCallback = null;
  errorCallback = null;
});

describe('GPSTracker', () => {
  /**
   * Validates: Requirements 4.4
   * GPS permission denied produces correct error type.
   */
  it('maps PERMISSION_DENIED to "permission_denied" error', () => {
    const tracker = createGPSTracker();
    const onPosition = vi.fn();
    const onError = vi.fn<(err: GPSError) => void>();

    tracker.start(onPosition, onError);

    // Simulate permission denied
    errorCallback!(makeGeolocationError(1));

    expect(onError).toHaveBeenCalledWith('permission_denied');
    expect(onPosition).not.toHaveBeenCalled();

    tracker.stop();
  });

  it('maps POSITION_UNAVAILABLE to "position_unavailable" error', () => {
    const tracker = createGPSTracker();
    const onPosition = vi.fn();
    const onError = vi.fn<(err: GPSError) => void>();

    tracker.start(onPosition, onError);
    errorCallback!(makeGeolocationError(2));

    expect(onError).toHaveBeenCalledWith('position_unavailable');
    tracker.stop();
  });

  it('maps TIMEOUT to "timeout" error', () => {
    const tracker = createGPSTracker();
    const onPosition = vi.fn();
    const onError = vi.fn<(err: GPSError) => void>();

    tracker.start(onPosition, onError);
    errorCallback!(makeGeolocationError(3));

    expect(onError).toHaveBeenCalledWith('timeout');
    tracker.stop();
  });

  /**
   * Validates: Requirements 4.5
   * GPS signal lost fires after 10-second timeout.
   */
  it('fires "signal_lost" after 10 seconds with no position update', () => {
    const tracker = createGPSTracker();
    const onPosition = vi.fn();
    const onError = vi.fn<(err: GPSError) => void>();

    tracker.start(onPosition, onError);

    // Advance 9.9 seconds — should NOT have fired yet
    vi.advanceTimersByTime(9_900);
    expect(onError).not.toHaveBeenCalled();

    // Advance past 10 seconds
    vi.advanceTimersByTime(200);
    expect(onError).toHaveBeenCalledWith('signal_lost');

    tracker.stop();
  });

  it('resets signal-lost timer when a position arrives', () => {
    const tracker = createGPSTracker();
    const onPosition = vi.fn();
    const onError = vi.fn<(err: GPSError) => void>();

    tracker.start(onPosition, onError);

    // Advance 8 seconds, then deliver a position
    vi.advanceTimersByTime(8_000);
    watchCallback!(makeGeolocationPosition(38.957, -77.313));

    // Advance another 8 seconds — timer was reset, so no signal_lost yet
    vi.advanceTimersByTime(8_000);
    expect(onError).not.toHaveBeenCalled();

    // Advance 2 more seconds (10 total since last position) — now it fires
    vi.advanceTimersByTime(2_100);
    expect(onError).toHaveBeenCalledWith('signal_lost');

    tracker.stop();
  });

  it('delivers position updates and tracks last position', () => {
    const tracker = createGPSTracker();
    const onPosition = vi.fn();
    const onError = vi.fn();

    expect(tracker.getLastPosition()).toBeNull();

    tracker.start(onPosition, onError);
    watchCallback!(makeGeolocationPosition(38.957, -77.313));

    expect(onPosition).toHaveBeenCalledWith({ latitude: 38.957, longitude: -77.313 });
    expect(tracker.getLastPosition()).toEqual({ latitude: 38.957, longitude: -77.313 });

    tracker.stop();
  });

  it('clears watch and timers on stop', () => {
    const tracker = createGPSTracker();
    const onPosition = vi.fn();
    const onError = vi.fn();

    tracker.start(onPosition, onError);
    tracker.stop();

    expect(clearWatchSpy).toHaveBeenCalledWith(42);

    // Advancing time after stop should NOT fire signal_lost
    vi.advanceTimersByTime(15_000);
    expect(onError).not.toHaveBeenCalled();
  });
});
