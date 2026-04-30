// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { UIOverlayImpl } from './ui-overlay';
import type { GPSStatus } from './ui-overlay';

let container: HTMLDivElement;
let overlay: UIOverlayImpl;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  overlay = new UIOverlayImpl();
  overlay.init(container);
});

describe('UIOverlay', () => {
  /**
   * Validates: Requirements 7.4
   * Compass indicator element exists and has north orientation.
   */
  it('creates compass indicator pointing north by default', () => {
    const compass = container.querySelector('[data-testid="compass"]');
    expect(compass).not.toBeNull();

    const arrow = container.querySelector('[data-testid="compass-arrow"]') as HTMLElement;
    expect(arrow).not.toBeNull();
    expect(arrow.style.transform).toBe('rotate(0deg)');
  });

  /**
   * Validates: Requirements 4.4, 4.5
   * GPS status indicator updates text for each status.
   */
  it.each<{ status: GPSStatus; expectedText: string; expectedIcon: string }>([
    { status: 'active', expectedText: 'GPS Active', expectedIcon: '📡' },
    { status: 'lost', expectedText: 'GPS Signal Lost', expectedIcon: '⚠️' },
    { status: 'denied', expectedText: 'GPS Denied', expectedIcon: '🚫' },
    { status: 'simulation', expectedText: 'Simulation', expectedIcon: '🎮' },
  ])('setGPSStatus("$status") shows "$expectedText"', ({ status, expectedText, expectedIcon }) => {
    overlay.setGPSStatus(status);

    const text = container.querySelector('[data-testid="gps-text"]') as HTMLElement;
    const icon = container.querySelector('[data-testid="gps-icon"]') as HTMLElement;

    expect(text.textContent).toBe(expectedText);
    expect(icon.textContent).toBe(expectedIcon);
  });

  /**
   * Validates: Requirements 5.4
   * Simulation controls are visible only when simulation is active.
   */
  it('hides simulation banner by default', () => {
    const banner = container.querySelector('[data-testid="sim-banner"]') as HTMLElement;

    expect(banner.style.display).toBe('none');
  });

  it('shows simulation banner when setSimulationVisible(true)', () => {
    overlay.setSimulationVisible(true);

    const banner = container.querySelector('[data-testid="sim-banner"]') as HTMLElement;

    expect(banner.style.display).toBe('flex');
  });

  it('hides simulation controls again when setSimulationVisible(false)', () => {
    overlay.setSimulationVisible(true);
    overlay.setSimulationVisible(false);

    const banner = container.querySelector('[data-testid="sim-banner"]') as HTMLElement;

    expect(banner.style.display).toBe('none');
  });

  /**
   * Validates: Requirements 3.5
   * showToast displays a warning toast in the toast container.
   */
  it('showToast adds a toast element to the toast container', () => {
    overlay.showToast("Progress won't be saved in private browsing mode.");

    const toastContainer = container.querySelector('[data-testid="toast-container"]') as HTMLElement;
    const toasts = toastContainer.querySelectorAll('[data-testid="ui-toast"]');

    expect(toasts.length).toBe(1);
    expect(toasts[0].textContent).toBe("Progress won't be saved in private browsing mode.");
  });
});
