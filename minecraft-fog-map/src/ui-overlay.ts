// ============================================================
// UIOverlay — DOM-based UI elements rendered on top of the canvas
// Minecraft Fog Map
// ============================================================

import { ZOOM_LEVELS } from './types';

export type GPSStatus = 'active' | 'lost' | 'denied' | 'simulation';

export interface UIOverlay {
  init(container: HTMLElement): void;
  setGPSStatus(status: GPSStatus): void;
  setCompassHeading(degrees: number): void;
  setSimulationVisible(visible: boolean): void;
  setMapLevel(level: number): void;
  showToast(message: string): void;
  onCenterOnMe: () => void;
  onMapLevelChange: (level: number) => void;
  onToggleRealMap: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetFog: () => void;
}

const GPS_STATUS_LABELS: Record<GPSStatus, string> = {
  active: 'GPS Active',
  lost: 'GPS Signal Lost',
  denied: 'GPS Denied',
  simulation: 'Simulation',
};

const GPS_STATUS_ICONS: Record<GPSStatus, string> = {
  active: '📡',
  lost: '⚠️',
  denied: '🚫',
  simulation: '🎮',
};

export class UIOverlayImpl implements UIOverlay {
  // Callbacks — consumers wire these up after construction
  onCenterOnMe: () => void = () => {};
  onMapLevelChange: (level: number) => void = () => {};
  onToggleRealMap: () => void = () => {};
  onZoomIn: () => void = () => {};
  onZoomOut: () => void = () => {};
  onResetFog: () => void = () => {};

  // DOM element references
  private container: HTMLElement | null = null;
  private compassEl: HTMLElement | null = null;
  private compassArrow: HTMLElement | null = null;
  private mapLevelEl: HTMLElement | null = null;
  private mapLevelSelect: HTMLSelectElement | null = null;
  private centerBtn: HTMLElement | null = null;
  private gpsStatusEl: HTMLElement | null = null;
  private gpsIconEl: HTMLElement | null = null;
  private gpsTextEl: HTMLElement | null = null;
  private simBanner: HTMLElement | null = null;
  private simHints: HTMLElement | null = null;
  private resetFogBtn: HTMLElement | null = null;
  private toastContainer: HTMLElement | null = null;
  private toggleMapBtn: HTMLElement | null = null;

  init(container: HTMLElement): void {
    this.container = container;
    container.classList.add('ui-overlay');

    this.createCompass();
    this.createMapLevel();
    this.createToggleMapButton();
    this.createCenterButton();
    this.createZoomButtons();
    this.createGPSStatus();
    this.createSimulationBanner();
    this.createSimulationHints();
    this.createResetFogButton();
    this.createToastContainer();
  }

  setGPSStatus(status: GPSStatus): void {
    if (this.gpsIconEl) {
      this.gpsIconEl.textContent = GPS_STATUS_ICONS[status];
    }
    if (this.gpsTextEl) {
      this.gpsTextEl.textContent = GPS_STATUS_LABELS[status];
    }
    if (this.gpsStatusEl) {
      this.gpsStatusEl.setAttribute('data-status', status);
    }
  }

  setCompassHeading(degrees: number): void {
    if (this.compassArrow) {
      this.compassArrow.style.transform = `rotate(${degrees}deg)`;
    }
  }

  setMapLevel(level: number): void {
    if (this.mapLevelSelect) {
      this.mapLevelSelect.value = String(Math.round(level));
    }
  }

  setSimulationVisible(visible: boolean): void {
    if (this.simBanner) {
      this.simBanner.style.display = visible ? 'block' : 'none';
    }
    if (this.simHints) {
      this.simHints.style.display = visible ? 'block' : 'none';
    }
    if (this.toggleMapBtn) {
      this.toggleMapBtn.style.display = visible ? 'flex' : 'none';
    }
    if (this.resetFogBtn) {
      this.resetFogBtn.style.display = visible ? 'flex' : 'none';
    }
    if (this.mapLevelEl) {
      this.mapLevelEl.style.display = visible ? 'flex' : 'none';
    }
    if (this.gpsStatusEl) {
      this.gpsStatusEl.style.display = visible ? 'flex' : 'none';
    }
  }

  showToast(message: string): void {
    if (!this.toastContainer) return;

    const toast = document.createElement('div');
    toast.classList.add('ui-toast');
    toast.setAttribute('data-testid', 'ui-toast');
    toast.textContent = message;
    this.toastContainer.appendChild(toast);

    // Auto-remove after 4 seconds
    setTimeout(() => {
      toast.remove();
    }, 4000);
  }

  // --- Private creation methods ---

  private createCompass(): void {
    const compass = document.createElement('div');
    compass.classList.add('ui-compass');
    compass.setAttribute('data-testid', 'compass');

    const arrow = document.createElement('div');
    arrow.classList.add('ui-compass-arrow');
    arrow.setAttribute('data-testid', 'compass-arrow');
    arrow.textContent = '▲';
    // Default: pointing north (0 degrees)
    arrow.style.transform = 'rotate(0deg)';

    const label = document.createElement('span');
    label.classList.add('ui-compass-label');
    label.textContent = 'N';

    compass.appendChild(arrow);
    compass.appendChild(label);
    this.container!.appendChild(compass);

    this.compassEl = compass;
    this.compassArrow = arrow;
  }

  private createMapLevel(): void {
    const wrapper = document.createElement('div');
    wrapper.classList.add('ui-map-level');
    wrapper.setAttribute('data-testid', 'map-level');

    const icon = document.createElement('span');
    icon.classList.add('ui-map-level-icon');
    icon.textContent = '🗺️';

    const select = document.createElement('select');
    select.classList.add('ui-map-level-select');
    select.setAttribute('data-testid', 'map-level-select');
    select.setAttribute('aria-label', 'Map zoom level');

    for (let i = 0; i <= 4; i++) {
      // Minecraft convention: 0/4 = finest, 4/4 = coarsest
      // Internal level: 4 - i (so display 0 → internal 4, display 4 → internal 0)
      const internalLevel = 4 - i;
      const mpt = ZOOM_LEVELS[internalLevel].metersPerTile;
      const opt = document.createElement('option');
      opt.value = String(internalLevel);
      opt.textContent = `${i}/4 (${mpt}m/px)`;
      select.appendChild(opt);
    }

    select.value = '4'; // default to finest (display 0/4, internal 4)
    select.addEventListener('change', () => {
      this.onMapLevelChange(parseInt(select.value, 10));
    });

    wrapper.appendChild(icon);
    wrapper.appendChild(select);
    this.container!.appendChild(wrapper);

    this.mapLevelEl = wrapper;
    this.mapLevelSelect = select;
  }

  private createToggleMapButton(): void {
    const btn = document.createElement('button');
    btn.classList.add('ui-btn', 'ui-toggle-map');
    btn.setAttribute('data-testid', 'toggle-real-map');
    btn.setAttribute('aria-label', 'Toggle real map');
    btn.textContent = '🌍';
    btn.style.display = 'none';
    btn.addEventListener('click', () => this.onToggleRealMap());

    this.container!.appendChild(btn);
    this.toggleMapBtn = btn;
  }

  private createCenterButton(): void {
    const btn = document.createElement('button');
    btn.classList.add('ui-btn', 'ui-center-btn');
    btn.setAttribute('data-testid', 'center-on-me');
    btn.setAttribute('aria-label', 'Center on my position');
    btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 20 20" fill="white" shape-rendering="crispEdges"><rect x="9" y="1" width="2" height="5"/><rect x="9" y="14" width="2" height="5"/><rect x="1" y="9" width="5" height="2"/><rect x="14" y="9" width="5" height="2"/><rect x="8" y="8" width="4" height="4"/><rect x="9" y="9" width="2" height="2" fill="#8B8B8B"/></svg>';
    btn.addEventListener('click', () => this.onCenterOnMe());

    this.container!.appendChild(btn);
    this.centerBtn = btn;
  }

  private createZoomButtons(): void {
    const wrapper = document.createElement('div');
    wrapper.classList.add('ui-zoom-controls');
    wrapper.setAttribute('data-testid', 'zoom-controls');

    const zoomIn = document.createElement('button');
    zoomIn.classList.add('ui-btn', 'ui-zoom-in');
    zoomIn.setAttribute('data-testid', 'zoom-in');
    zoomIn.setAttribute('aria-label', 'Zoom in');
    zoomIn.innerHTML = '<svg width="18" height="18" viewBox="0 0 18 18" fill="white" shape-rendering="crispEdges"><rect x="7" y="3" width="4" height="12"/><rect x="3" y="7" width="12" height="4"/></svg>';
    zoomIn.addEventListener('click', () => this.onZoomIn());

    const zoomOut = document.createElement('button');
    zoomOut.classList.add('ui-btn', 'ui-zoom-out');
    zoomOut.setAttribute('data-testid', 'zoom-out');
    zoomOut.setAttribute('aria-label', 'Zoom out');
    zoomOut.innerHTML = '<svg width="18" height="18" viewBox="0 0 18 18" fill="white" shape-rendering="crispEdges"><rect x="3" y="7" width="12" height="4"/></svg>';
    zoomOut.addEventListener('click', () => this.onZoomOut());

    wrapper.appendChild(zoomIn);
    wrapper.appendChild(zoomOut);
    this.container!.appendChild(wrapper);
  }

  private createGPSStatus(): void {
    const status = document.createElement('div');
    status.classList.add('ui-gps-status');
    status.setAttribute('data-testid', 'gps-status');
    status.setAttribute('data-status', 'active');

    const icon = document.createElement('span');
    icon.classList.add('ui-gps-icon');
    icon.setAttribute('data-testid', 'gps-icon');
    icon.textContent = GPS_STATUS_ICONS.active;

    const text = document.createElement('span');
    text.classList.add('ui-gps-text');
    text.setAttribute('data-testid', 'gps-text');
    text.textContent = GPS_STATUS_LABELS.active;

    status.appendChild(icon);
    status.appendChild(text);
    this.container!.appendChild(status);

    this.gpsStatusEl = status;
    this.gpsIconEl = icon;
    this.gpsTextEl = text;
  }

  private createSimulationBanner(): void {
    const banner = document.createElement('div');
    banner.classList.add('ui-sim-banner');
    banner.setAttribute('data-testid', 'sim-banner');
    banner.textContent = 'SIMULATION MODE';
    banner.style.display = 'none';

    this.container!.appendChild(banner);
    this.simBanner = banner;
  }

  private createSimulationHints(): void {
    const hints = document.createElement('div');
    hints.classList.add('ui-sim-hints');
    hints.setAttribute('data-testid', 'sim-hints');
    hints.style.display = 'none';

    hints.innerHTML = [
      '<span class="ui-sim-hint-key">W</span>',
      '<span class="ui-sim-hint-key">S</span>',
      '<span class="ui-sim-hint-key">A</span>',
      '<span class="ui-sim-hint-key">D</span>',
      '<span class="ui-sim-hint-label">Move</span>',
    ].join('');

    this.container!.appendChild(hints);
    this.simHints = hints;
  }

  private createResetFogButton(): void {
    const btn = document.createElement('button');
    btn.classList.add('ui-btn', 'ui-reset-fog');
    btn.setAttribute('data-testid', 'reset-fog');
    btn.setAttribute('aria-label', 'Reset fog of war');
    btn.textContent = '🔄 Reset Fog';
    btn.style.display = 'none';
    btn.addEventListener('click', () => {
      if (confirm('Reset all fog of war? This clears all explored areas.')) {
        this.onResetFog();
      }
    });

    this.container!.appendChild(btn);
    this.resetFogBtn = btn;
  }

  private createToastContainer(): void {
    const toasts = document.createElement('div');
    toasts.classList.add('ui-toast-container');
    toasts.setAttribute('data-testid', 'toast-container');

    this.container!.appendChild(toasts);
    this.toastContainer = toasts;
  }
}
