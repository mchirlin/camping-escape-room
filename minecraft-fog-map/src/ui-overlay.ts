// ============================================================
// UIOverlay — DOM-based UI elements rendered on top of the canvas
// Minecraft Fog Map
// ============================================================

import { ZOOM_LEVELS } from './types';

export type GPSStatus = 'active' | 'lost' | 'denied' | 'simulation';

export interface UIOverlay {
  init(container: HTMLElement): void;
  setGPSStatus(status: GPSStatus): void;
  setCraftingStatus(status: 'hidden' | 'connecting' | 'connected' | 'disconnected'): void;
  setCompassHeading(degrees: number): void;
  setSimulationVisible(visible: boolean): void;
  setMapLevel(level: number): void;
  showToast(message: string): void;
  updateMarkerVisibilityPanel(tags: Array<{ tag: string; label: string; color: string; hidden: boolean; count: number }>): void;
  onCenterOnMe: () => void;
  onMapLevelChange: (level: number) => void;
  onToggleRealMap: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetFog: () => void;
  onHeadingChange: (degrees: number) => void;
  onAvatarChange: (skinName: string) => void;
}

const GPS_STATUS_LABELS: Record<GPSStatus, string> = {
  active: 'GPS Active',
  lost: 'GPS Signal Lost',
  denied: 'GPS Denied',
  simulation: 'Admin',
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
  onExitSimulation: () => void = () => {};
  onAvatarChange: (skinName: string) => void = () => {};
  onRevealTag: (tag: string) => void = () => {};
  onHideTag: (tag: string) => void = () => {};
  onRevealAllMarkers: () => void = () => {};
  onHideAllMarkers: () => void = () => {};

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
  private craftingStatusEl: HTMLElement | null = null;
  private simBanner: HTMLElement | null = null;
  private resetFogBtn: HTMLElement | null = null;
  private revealAllBtn: HTMLElement | null = null;
  private removeAllItemsBtn: HTMLElement | null = null;
  private actionRow: HTMLElement | null = null;
  private fullscreenBtn: HTMLElement | null = null;
  private toastContainer: HTMLElement | null = null;
  private toggleMapBtn: HTMLElement | null = null;
  private regionSelect: HTMLElement | null = null;
  private markerPanel: HTMLElement | null = null;

  private topLeftGroup: HTMLElement | null = null;
  private topRightGroup: HTMLElement | null = null;
  private bottomLeftGroup: HTMLElement | null = null;
  private bottomRightGroup: HTMLElement | null = null;

  init(container: HTMLElement): void {
    this.container = container;
    container.classList.add('ui-overlay');

    // Create corner groups for flexbox layout
    this.topLeftGroup = document.createElement('div');
    this.topLeftGroup.classList.add('ui-group', 'ui-group-top-left');
    container.appendChild(this.topLeftGroup);

    this.topRightGroup = document.createElement('div');
    this.topRightGroup.classList.add('ui-group', 'ui-group-top-right');
    container.appendChild(this.topRightGroup);

    this.bottomLeftGroup = document.createElement('div');
    this.bottomLeftGroup.classList.add('ui-group', 'ui-group-bottom-left');
    container.appendChild(this.bottomLeftGroup);

    this.bottomRightGroup = document.createElement('div');
    this.bottomRightGroup.classList.add('ui-group', 'ui-group-bottom-right');
    container.appendChild(this.bottomRightGroup);

    // Top-left: GPS status, crafting status, simulation banner
    this.createGPSStatus();
    this.createCraftingStatus();
    this.createSimulationBanner();

    // Top-right: avatar picker, compass, map level, toggle map
    this.createAvatarPicker();
    this.createCompass();
    this.createMapLevel();
    this.createToggleMapButton();

    // Bottom-left: region selector, action buttons row, marker panel, fullscreen
    this.createRegionSelector();
    this.createActionButtonsRow();
    this.createMarkerVisibilityPanel();
    this.createFullscreenButton();

    // Bottom-right: center button, zoom controls
    this.createCenterButton();
    this.createZoomButtons();

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

  setCraftingStatus(status: 'hidden' | 'connecting' | 'connected' | 'disconnected'): void {
    if (!this.craftingStatusEl) return;
    if (status === 'hidden') {
      this.craftingStatusEl.style.display = 'none';
      return;
    }
    this.craftingStatusEl.style.display = 'flex';
    const icons: Record<string, string> = { connecting: '🔄', connected: '⚡', disconnected: '❌' };
    const labels: Record<string, string> = { connecting: 'Crafting Table...', connected: 'Crafting Table', disconnected: 'Table Lost' };
    this.craftingStatusEl.innerHTML = `<span>${icons[status]}</span><span class="ui-gps-text">${labels[status]}</span>`;
    this.craftingStatusEl.setAttribute('data-status', status === 'connected' ? 'active' : 'lost');
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
      this.simBanner.style.display = visible ? 'flex' : 'none';
    }
    if (this.toggleMapBtn) {
      this.toggleMapBtn.style.display = visible ? 'flex' : 'none';
    }
    if (this.actionRow) {
      this.actionRow.style.display = visible ? 'flex' : 'none';
    }
    if (this.markerPanel) {
      this.markerPanel.style.display = visible ? 'block' : 'none';
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

  private createAvatarPicker(): void {
    const SKINS = ['alex', 'steve', 'ari', 'efe', 'kai', 'makena', 'noor', 'sunny', 'zuri'];
    const SKIN_LABELS: Record<string, string> = {
      alex: 'Alex', steve: 'Steve', ari: 'Ari', efe: 'Efe',
      kai: 'Kai', makena: 'Makena', noor: 'Noor', sunny: 'Sunny', zuri: 'Zuri',
    };

    const saved = (() => {
      try { return localStorage.getItem('fogmap:avatar') || 'alex'; } catch { return 'alex'; }
    })();

    const wrapper = document.createElement('div');
    wrapper.classList.add('ui-avatar-picker');
    wrapper.style.cssText = 'position:relative;';

    // Current face button
    const btn = document.createElement('button');
    btn.classList.add('ui-btn', 'ui-avatar-btn');
    btn.setAttribute('aria-label', 'Change avatar');
    btn.style.cssText = 'width:36px;height:36px;padding:2px;image-rendering:pixelated;overflow:hidden;border-radius:4px;';
    btn.innerHTML = `<img src="" style="width:100%;height:100%;image-rendering:pixelated;" />`;

    const btnImg = btn.querySelector('img')!;

    // Dropdown panel
    const dropdown = document.createElement('div');
    dropdown.classList.add('ui-avatar-dropdown');
    dropdown.style.cssText = `
      display:none;position:absolute;top:40px;right:0;z-index:100;
      background:#2a2a2a;border:2px solid #555;border-radius:4px;padding:6px;
      display:none;grid-template-columns:repeat(3,1fr);gap:4px;width:132px;
    `;

    // Create face options
    for (const skin of SKINS) {
      const option = document.createElement('button');
      option.classList.add('ui-avatar-option');
      option.setAttribute('aria-label', SKIN_LABELS[skin]);
      option.setAttribute('title', SKIN_LABELS[skin]);
      option.style.cssText = `
        width:36px;height:36px;padding:2px;cursor:pointer;border:2px solid transparent;
        background:#1a1a1a;border-radius:3px;image-rendering:pixelated;
      `;
      option.innerHTML = `<img src="" data-skin="${skin}" style="width:100%;height:100%;image-rendering:pixelated;" />`;
      if (skin === saved) option.style.borderColor = '#5b8731';

      option.addEventListener('click', () => {
        try { localStorage.setItem('fogmap:avatar', skin); } catch { /* ignore */ }
        this.onAvatarChange(skin);
        // Update selection highlight
        dropdown.querySelectorAll('.ui-avatar-option').forEach((el) => {
          (el as HTMLElement).style.borderColor = 'transparent';
        });
        option.style.borderColor = '#5b8731';
        // Update button face
        this.updateAvatarImages(btnImg, dropdown, skin);
        dropdown.style.display = 'none';
      });

      dropdown.appendChild(option);
    }

    // Toggle dropdown on button click
    let open = false;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      open = !open;
      dropdown.style.display = open ? 'grid' : 'none';
    });

    // Close on outside click
    document.addEventListener('click', () => {
      open = false;
      dropdown.style.display = 'none';
    });
    dropdown.addEventListener('click', (e) => e.stopPropagation());

    wrapper.appendChild(btn);
    wrapper.appendChild(dropdown);
    this.topRightGroup!.appendChild(wrapper);

    // Store references for updating images once atlas loads
    (this as any)._avatarBtn = btnImg;
    (this as any)._avatarDropdown = dropdown;
    (this as any)._avatarSkin = saved;

    // Fire initial avatar change so renderer uses saved skin
    setTimeout(() => this.onAvatarChange(saved), 0);
  }

  /** Update avatar images from the atlas. Call after atlas is loaded. */
  setAvatarAtlas(atlas: HTMLImageElement, manifest: Record<string, { x: number; y: number; w: number; h: number }>): void {
    const SKINS = ['alex', 'steve', 'ari', 'efe', 'kai', 'makena', 'noor', 'sunny', 'zuri'];
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx2 = canvas.getContext('2d')!;

    // Generate data URLs for each skin face from the atlas
    const faceUrls: Record<string, string> = {};
    for (const skin of SKINS) {
      const entry = manifest[`player_${skin}`];
      if (!entry) continue;
      ctx2.clearRect(0, 0, 16, 16);
      ctx2.drawImage(atlas, entry.x, entry.y, entry.w, entry.h, 0, 0, 16, 16);
      faceUrls[skin] = canvas.toDataURL();
    }

    // Update button and dropdown images
    const btnImg = (this as any)._avatarBtn as HTMLImageElement | undefined;
    const dropdown = (this as any)._avatarDropdown as HTMLElement | undefined;
    const currentSkin = (this as any)._avatarSkin as string || 'alex';

    if (btnImg && faceUrls[currentSkin]) {
      btnImg.src = faceUrls[currentSkin];
    }
    if (dropdown) {
      dropdown.querySelectorAll<HTMLImageElement>('img[data-skin]').forEach((img) => {
        const skin = img.dataset.skin!;
        if (faceUrls[skin]) img.src = faceUrls[skin];
      });
    }

    // Store for future updates
    (this as any)._avatarFaceUrls = faceUrls;
  }

  private updateAvatarImages(btnImg: HTMLImageElement, _dropdown: HTMLElement, skin: string): void {
    const faceUrls = (this as any)._avatarFaceUrls as Record<string, string> | undefined;
    if (faceUrls && faceUrls[skin]) {
      btnImg.src = faceUrls[skin];
    }
    (this as any)._avatarSkin = skin;
  }

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

    this.topRightGroup!.appendChild(btn);
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
    this.topRightGroup!.appendChild(wrapper);

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

    this.topRightGroup!.appendChild(btn);
    this.toggleMapBtn = btn;
  }

  private createCenterButton(): void {
    const btn = document.createElement('button');
    btn.classList.add('ui-btn', 'ui-center-btn');
    btn.setAttribute('data-testid', 'center-on-me');
    btn.setAttribute('aria-label', 'Center on my position');
    btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 20 20" fill="white" shape-rendering="crispEdges"><rect x="9" y="1" width="2" height="5"/><rect x="9" y="14" width="2" height="5"/><rect x="1" y="9" width="5" height="2"/><rect x="14" y="9" width="5" height="2"/><rect x="8" y="8" width="4" height="4"/><rect x="9" y="9" width="2" height="2" fill="#8B8B8B"/></svg>';
    btn.addEventListener('click', () => this.onCenterOnMe());

    this.bottomRightGroup!.appendChild(btn);
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
    this.bottomRightGroup!.appendChild(wrapper);
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
    this.topLeftGroup!.appendChild(status);

    this.gpsStatusEl = status;
    this.gpsIconEl = icon;
    this.gpsTextEl = text;
  }

  private createCraftingStatus(): void {
    const el = document.createElement('div');
    el.classList.add('ui-gps-status');
    el.style.display = 'none';  // Hidden until setCraftingStatus is called
    this.topLeftGroup!.appendChild(el);
    this.craftingStatusEl = el;
  }

  private createSimulationBanner(): void {
    const banner = document.createElement('div');
    banner.classList.add('ui-sim-banner');
    banner.setAttribute('data-testid', 'sim-banner');
    banner.style.display = 'none';

    const text = document.createElement('span');
    text.textContent = 'ADMIN MODE';
    banner.appendChild(text);

    const btn = document.createElement('button');
    btn.classList.add('ui-sim-exit-btn');
    btn.setAttribute('data-testid', 'exit-simulation');
    btn.setAttribute('aria-label', 'Switch to player GPS mode');
    btn.textContent = '📡 Player View';
    btn.addEventListener('click', () => this.onExitSimulation());
    banner.appendChild(btn);

    this.topLeftGroup!.appendChild(banner);
    this.simBanner = banner;
  }

  private createSimulationHints(): void {
    // Removed — WASD hints no longer needed
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

    this.bottomLeftGroup!.appendChild(wrapper);
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

  private createActionButtonsRow(): void {
    const row = document.createElement('div');
    row.classList.add('ui-action-row');
    row.style.display = 'none';

    const resetBtn = document.createElement('button');
    resetBtn.classList.add('ui-btn', 'ui-action-btn');
    resetBtn.setAttribute('data-testid', 'reset-fog');
    resetBtn.setAttribute('aria-label', 'Reset fog of war');
    resetBtn.textContent = '🔄 Reset';
    resetBtn.addEventListener('click', () => {
      if (confirm('Reset all fog of war? This clears all explored areas.')) this.onResetFog();
    });
    row.appendChild(resetBtn);
    this.resetFogBtn = resetBtn;

    const revealBtn = document.createElement('button');
    revealBtn.classList.add('ui-btn', 'ui-action-btn');
    revealBtn.setAttribute('data-testid', 'reveal-all');
    revealBtn.setAttribute('aria-label', 'Reveal entire map');
    revealBtn.textContent = '👁 Reveal';
    revealBtn.addEventListener('click', () => {
      if (confirm('Reveal the entire map? This removes all fog of war.')) this.onRevealAll();
    });
    row.appendChild(revealBtn);
    this.revealAllBtn = revealBtn;

    const removeBtn = document.createElement('button');
    removeBtn.classList.add('ui-btn', 'ui-action-btn');
    removeBtn.setAttribute('data-testid', 'remove-all-items');
    removeBtn.setAttribute('aria-label', 'Remove all items');
    removeBtn.textContent = '🗑 Items';
    removeBtn.addEventListener('click', () => {
      if (confirm('Remove all placed items from the map?')) this.onRemoveAllItems();
    });
    row.appendChild(removeBtn);
    this.removeAllItemsBtn = removeBtn;

    this.bottomLeftGroup!.appendChild(row);
    this.actionRow = row;
  }

  private createMarkerVisibilityPanel(): void {
    const panel = document.createElement('div');
    panel.classList.add('ui-marker-panel');
    panel.style.display = 'none';
    panel.innerHTML = `
      <div style="font-family:var(--mc-font);font-size:7px;color:#aaa;margin-bottom:4px;">MARKER VISIBILITY</div>
      <div class="ui-marker-panel-buttons"></div>
      <div style="display:flex;gap:4px;margin-top:6px;">
        <button class="ui-btn ui-action-btn ui-reveal-all-markers" style="font-size:7px;padding:4px 6px;">👁 Reveal All</button>
        <button class="ui-btn ui-action-btn ui-hide-all-markers" style="font-size:7px;padding:4px 6px;">🙈 Hide All</button>
      </div>
    `;

    panel.querySelector('.ui-reveal-all-markers')!.addEventListener('click', () => {
      this.onRevealAllMarkers();
    });
    panel.querySelector('.ui-hide-all-markers')!.addEventListener('click', () => {
      this.onHideAllMarkers();
    });

    this.bottomLeftGroup!.appendChild(panel);
    this.markerPanel = panel;
  }

  /** Update the marker visibility panel buttons based on current marker states */
  updateMarkerVisibilityPanel(tags: Array<{ tag: string; label: string; color: string; hidden: boolean; count: number }>): void {
    if (!this.markerPanel) return;
    const container = this.markerPanel.querySelector('.ui-marker-panel-buttons');
    if (!container) return;

    container.innerHTML = '';

    if (tags.length === 0) {
      container.innerHTML = '<div style="font-family:var(--mc-font);font-size:7px;color:#666;padding:4px;">No markers placed</div>';
      return;
    }

    for (const t of tags) {
      const btn = document.createElement('button');
      btn.style.cssText = `
        font-family:var(--mc-font);font-size:7px;padding:4px 8px;cursor:pointer;
        border:2px solid ${t.hidden ? '#555' : t.color};
        background:${t.hidden ? '#2a2a2a' : t.color + '33'};
        color:${t.hidden ? '#888' : '#fff'};
        opacity:${t.hidden ? '0.6' : '1'};
        border-radius:3px;
        transition:all 0.2s;
      `;
      btn.textContent = `${t.hidden ? '🙈' : '👁'} ${t.label} (${t.count})`;
      btn.title = t.hidden ? `Click to reveal ${t.label}` : `Click to hide ${t.label}`;
      btn.addEventListener('click', () => {
        if (t.hidden) {
          this.onRevealTag(t.tag);
        } else {
          this.onHideTag(t.tag);
        }
      });
      container.appendChild(btn);
    }
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

    this.bottomLeftGroup!.appendChild(btn);
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
