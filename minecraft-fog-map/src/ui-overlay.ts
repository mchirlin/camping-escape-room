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
  onHeadingChange: (degrees: number) => void;
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
  onRevealAll: () => void = () => {};
  onRemoveAllItems: () => void = () => {};
  onHeadingChange: (degrees: number) => void = () => {};
  onRegionChange: (regionId: string) => void = () => {};

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
  private revealAllBtn: HTMLElement | null = null;
  private fullscreenBtn: HTMLElement | null = null;
  private toastContainer: HTMLElement | null = null;
  private toggleMapBtn: HTMLElement | null = null;
  private regionSelect: HTMLElement | null = null;

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
    this.createRegionSelector();
    this.createResetFogButton();
    this.createRevealAllButton();
    this.createRemoveAllItemsButton();
    this.createFullscreenButton();
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
      // Arrow points to north: rotate by the heading so it indicates
      // where north is relative to the screen
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
    if (this.toggleMapBtn) {
      this.toggleMapBtn.style.display = visible ? 'flex' : 'none';
    }
    if (this.resetFogBtn) {
      this.resetFogBtn.style.display = visible ? 'flex' : 'none';
    }
    if (this.revealAllBtn) {
      this.revealAllBtn.style.display = visible ? 'flex' : 'none';
    }
    if (this.removeAllItemsBtn) {
      this.removeAllItemsBtn.style.display = visible ? 'flex' : 'none';
    }
    if (this.regionSelect) {
      this.regionSelect.style.display = visible ? 'flex' : 'none';
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
    const btn = document.createElement('button');
    btn.classList.add('ui-btn', 'ui-compass');
    btn.setAttribute('data-testid', 'compass');
    btn.setAttribute('aria-label', 'Toggle compass heading');
    btn.innerHTML = '<svg class="ui-compass-arrow" data-testid="compass-arrow" width="18" height="18" viewBox="0 0 18 18" shape-rendering="crispEdges" style="transition:transform 0.15s ease"><polygon points="9,2 14,14 9,11 4,14" fill="#FF5555"/><polygon points="9,11 14,14 9,16 4,14" fill="#FFFFFF"/></svg>';

    let headingActive = false;

    btn.addEventListener('click', () => {
      headingActive = !headingActive;

      if (headingActive) {
        // Request permission on iOS
        if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
          (DeviceOrientationEvent as any).requestPermission().then((state: string) => {
            if (state === 'granted') {
              this.startHeadingWatch();
            } else {
              headingActive = false;
            }
          });
        } else {
          this.startHeadingWatch();
        }
        btn.style.outlineColor = '#55FF55';
      } else {
        this.stopHeadingWatch();
        this.onHeadingChange(0);
        this.setCompassHeading(0);
        btn.style.outlineColor = '#000';
      }
    });

    this.container!.appendChild(btn);
    this.compassEl = btn;
    this.compassArrow = btn.querySelector('.ui-compass-arrow') as HTMLElement;
    if (this.compassArrow) this.compassArrow.style.transform = 'rotate(0deg)';
  }

  private headingHandler: ((e: DeviceOrientationEvent) => void) | null = null;

  private startHeadingWatch(): void {
    this.headingHandler = (e: DeviceOrientationEvent) => {
      const heading = (e as any).webkitCompassHeading ?? (e.alpha ? 360 - e.alpha : 0);
      this.setCompassHeading(heading);
      this.onHeadingChange(heading);
    };
    window.addEventListener('deviceorientation', this.headingHandler, true);
  }

  private stopHeadingWatch(): void {
    if (this.headingHandler) {
      window.removeEventListener('deviceorientation', this.headingHandler, true);
      this.headingHandler = null;
    }
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

    // Minecraft map levels: 0=128m, 1=256m, 2=512m
    const mapLevels = [
      { display: 0, internal: 4, size: 128 },
      { display: 1, internal: 3, size: 256 },
      { display: 2, internal: 2, size: 512 },
    ];

    for (const ml of mapLevels) {
      const opt = document.createElement('option');
      opt.value = String(ml.display);
      opt.textContent = `${ml.display}/4 (${ml.size}m)`;
      select.appendChild(opt);
    }

    select.value = '2'; // default to level 2 (512m, full map)
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

  private createRegionSelector(): void {
    const wrapper = document.createElement('div');
    wrapper.classList.add('ui-region-select');
    wrapper.style.display = 'none';

    const label = document.createElement('span');
    label.classList.add('ui-region-label');
    label.textContent = '🗺️';
    wrapper.appendChild(label);

    const select = document.createElement('select');
    select.setAttribute('data-testid', 'region-select');
    select.setAttribute('aria-label', 'Select map region');
    select.addEventListener('change', () => {
      this.onRegionChange(select.value);
    });
    wrapper.appendChild(select);

    this.container!.appendChild(wrapper);
    this.regionSelect = wrapper;
  }

  setRegions(regions: Array<{ id: string; name: string }>, currentId: string): void {
    const select = this.regionSelect?.querySelector('select');
    if (!select) return;
    select.innerHTML = '';
    for (const r of regions) {
      const opt = document.createElement('option');
      opt.value = r.id;
      opt.textContent = r.name;
      if (r.id === currentId) opt.selected = true;
      select.appendChild(opt);
    }
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

  private createRevealAllButton(): void {
    const btn = document.createElement('button');
    btn.classList.add('ui-btn', 'ui-reveal-all');
    btn.setAttribute('data-testid', 'reveal-all');
    btn.setAttribute('aria-label', 'Reveal entire map');
    btn.textContent = '👁 Reveal All';
    btn.style.display = 'none';
    btn.addEventListener('click', () => {
      if (confirm('Reveal the entire map? This removes all fog of war.')) {
        this.onRevealAll();
      }
    });

    this.container!.appendChild(btn);
    this.revealAllBtn = btn;
  }

  private removeAllItemsBtn: HTMLElement | null = null;

  private createRemoveAllItemsButton(): void {
    const btn = document.createElement('button');
    btn.classList.add('ui-btn', 'ui-remove-all-items');
    btn.setAttribute('data-testid', 'remove-all-items');
    btn.setAttribute('aria-label', 'Remove all items');
    btn.textContent = '🗑 Remove Items';
    btn.style.display = 'none';
    btn.addEventListener('click', () => {
      if (confirm('Remove all placed items from the map?')) {
        this.onRemoveAllItems();
      }
    });

    this.container!.appendChild(btn);
    this.removeAllItemsBtn = btn;
  }

  private createFullscreenButton(): void {
    const btn = document.createElement('button');
    btn.classList.add('ui-btn', 'ui-fullscreen');
    btn.setAttribute('data-testid', 'fullscreen');
    btn.setAttribute('aria-label', 'Toggle fullscreen');
    btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="white" shape-rendering="crispEdges"><rect x="0" y="0" width="3" height="2"/><rect x="0" y="0" width="2" height="3"/><rect x="13" y="0" width="3" height="2"/><rect x="14" y="0" width="2" height="3"/><rect x="0" y="14" width="3" height="2"/><rect x="0" y="13" width="2" height="3"/><rect x="13" y="14" width="3" height="2"/><rect x="14" y="13" width="2" height="3"/></svg>';

    btn.addEventListener('click', () => {
      const doc = document as any;
      const el = document.documentElement as any;
      const isFullscreen = doc.fullscreenElement || doc.webkitFullscreenElement || doc.msFullscreenElement;

      if (!isFullscreen) {
        if (el.requestFullscreen) {
          el.requestFullscreen().catch(() => {});
        } else if (el.webkitRequestFullscreen) {
          el.webkitRequestFullscreen();
        } else if (el.msRequestFullscreen) {
          el.msRequestFullscreen();
        }
      } else {
        if (doc.exitFullscreen) {
          doc.exitFullscreen().catch(() => {});
        } else if (doc.webkitExitFullscreen) {
          doc.webkitExitFullscreen();
        } else if (doc.msExitFullscreen) {
          doc.msExitFullscreen();
        }
      }
    });

    this.container!.appendChild(btn);
    this.fullscreenBtn = btn;
  }

  private createToastContainer(): void {
    const toasts = document.createElement('div');
    toasts.classList.add('ui-toast-container');
    toasts.setAttribute('data-testid', 'toast-container');

    this.container!.appendChild(toasts);
    this.toastContainer = toasts;
  }
}
