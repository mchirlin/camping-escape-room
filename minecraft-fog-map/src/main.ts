// ============================================================
// Minecraft Fog Map — Main Application Bootstrap
// ============================================================

import './styles.css';

import type { GeoPosition, TerrainData, TextureAtlasManifest, WorldPosition } from './types';
import { FogEngine, configFromTerrainData } from './fog-engine';
import { TileRenderer, TILE_SCREEN_SIZE } from './tile-renderer';
import { MapInteraction } from './map-interaction';
import { UIOverlayImpl } from './ui-overlay';
import { createGPSTracker } from './gps-tracker';
import { createSimulationMode, shouldActivateSimulation } from './simulation-mode';
import { geoToWorld, worldToGeo } from './coords';
import { MarkerStore, MARKER_TAGS, preloadMarkerImages, getMarkerImage } from './markers';
import type { MarkerTag } from './markers';

// ---- Loading screen helpers ----

function showLoading(message: string): void {
  let el = document.getElementById('loading-screen');
  if (!el) {
    el = document.createElement('div');
    el.id = 'loading-screen';
    el.style.cssText =
      'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;' +
      'background:#1a1a1a;color:#fff;font-family:"Press Start 2P",monospace;font-size:12px;z-index:100;';
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.style.display = 'flex';
}

function hideLoading(): void {
  const el = document.getElementById('loading-screen');
  if (el) el.style.display = 'none';
}

function showError(message: string): void {
  let el = document.getElementById('error-screen');
  if (!el) {
    el = document.createElement('div');
    el.id = 'error-screen';
    el.style.cssText =
      'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;' +
      'background:#1a1a1a;color:#FF5555;font-family:"Press Start 2P",monospace;font-size:10px;' +
      'z-index:100;padding:24px;text-align:center;line-height:1.8;';
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.style.display = 'flex';
}

// ---- Asset loading ----

interface RegionInfo {
  id: string;
  name: string;
  file: string;
}

async function loadRegions(): Promise<RegionInfo[]> {
  const res = await fetch(`${import.meta.env.BASE_URL}regions.json`);
  if (!res.ok) return [];
  return res.json() as Promise<RegionInfo[]>;
}

function getSelectedRegionFile(regions: RegionInfo[]): string {
  const params = new URLSearchParams(window.location.search);
  const regionId = params.get('region');
  if (regionId) {
    const match = regions.find((r) => r.id === regionId);
    if (match) {
      try { localStorage.setItem('fogmap:region', regionId); } catch { /* ignore */ }
      return match.file;
    }
  }
  // Check localStorage for a previously selected region
  try {
    const saved = localStorage.getItem('fogmap:region');
    if (saved) {
      const match = regions.find((r) => r.id === saved);
      if (match) return match.file;
    }
  } catch { /* ignore */ }
  // Default to first region
  return regions.length > 0 ? regions[0].file : 'terrain-lakefairfax.json';
}

function getSelectedRegionId(regions: RegionInfo[]): string {
  const params = new URLSearchParams(window.location.search);
  const regionId = params.get('region');
  if (regionId && regions.find((r) => r.id === regionId)) return regionId;
  try {
    const saved = localStorage.getItem('fogmap:region');
    if (saved && regions.find((r) => r.id === saved)) return saved;
  } catch { /* ignore */ }
  return regions.length > 0 ? regions[0].id : '';
}

async function loadTerrainData(filename: string): Promise<TerrainData> {
  const res = await fetch(`${import.meta.env.BASE_URL}${filename}`);
  if (!res.ok) throw new Error('Failed to load terrain data');
  return res.json() as Promise<TerrainData>;
}

async function loadAtlasManifest(): Promise<TextureAtlasManifest> {
  const res = await fetch(`${import.meta.env.BASE_URL}atlas.json`);
  if (!res.ok) throw new Error('Failed to load atlas manifest');
  return res.json() as Promise<TextureAtlasManifest>;
}

function loadAtlasImage(): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load atlas image'));
    img.src = `${import.meta.env.BASE_URL}atlas.png`;
  });
}

// ---- Canvas resize helper ----

function resizeCanvas(canvas: HTMLCanvasElement): void {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  const ctx = canvas.getContext('2d');
  if (ctx) ctx.scale(dpr, dpr);
}

// ---- Main bootstrap ----

async function main(): Promise<void> {
  showLoading('Loading map data...');

  // 1. Load assets
  let terrainData: TerrainData;
  let atlasManifest: TextureAtlasManifest;
  let atlasImage: HTMLImageElement;
  let regions: RegionInfo[] = [];

  try {
    regions = await loadRegions();
    const terrainFile = getSelectedRegionFile(regions);
    [terrainData, atlasManifest, atlasImage] = await Promise.all([
      loadTerrainData(terrainFile),
      loadAtlasManifest(),
      loadAtlasImage(),
    ]);
  } catch (err) {
    hideLoading();
    const msg =
      err instanceof Error && err.message.includes('atlas')
        ? "Couldn't load textures. Check your connection and refresh."
        : "Couldn't load map data. Check your connection and refresh.";
    showError(msg);
    return;
  }

  // 2. Grab DOM elements
  const canvasEl = document.getElementById('map-canvas') as HTMLCanvasElement | null;
  const uiContainer = document.getElementById('ui-overlay') as HTMLElement | null;

  if (!canvasEl || !uiContainer) {
    showError('Missing required DOM elements.');
    hideLoading();
    return;
  }

  const canvas: HTMLCanvasElement = canvasEl;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    hideLoading();
    showError("Your browser doesn't support this map. Try Safari or Chrome.");
    return;
  }

  // 3. Set up canvas sizing
  resizeCanvas(canvas);

  // 3b. Handle font load failure — fall back to system monospace silently
  if (document.fonts) {
    document.fonts.ready.then(() => {
      const loaded = document.fonts.check('12px "Press Start 2P"');
      if (!loaded) {
        console.warn('Pixel font failed to load, falling back to system monospace.');
        document.documentElement.style.setProperty('--mc-font', 'monospace');
      }
    });
  }

  // 4. Create FogEngine
  const fogConfig = configFromTerrainData(terrainData.boundingBox, terrainData.zoomLevels);
  fogConfig.regionId = terrainData.regionId;
  const fogEngine = new FogEngine(fogConfig);
  fogEngine.loadFromStorage();

  // 5. Create TileRenderer
  const tileRenderer = new TileRenderer();
  tileRenderer.init(terrainData, atlasImage, atlasManifest);

  // 6. Determine level-4 grid size
  const level4Data = terrainData.zoomLevels.find((zl) => zl.level === 4);
  const level4Grid = level4Data
    ? { cols: level4Data.cols, rows: level4Data.rows }
    : { cols: 256, rows: 256 };

  // 7. Compute map center in geo and world coords
  const bbox = terrainData.boundingBox;
  const mapCenterGeo: GeoPosition = {
    latitude: (bbox.north + bbox.south) / 2,
    longitude: (bbox.east + bbox.west) / 2,
  };
  const mapCenterWorld = geoToWorld(mapCenterGeo, bbox, level4Grid, TILE_SCREEN_SIZE);

  // 8. Create MapInteraction
  const rect = canvas.getBoundingClientRect();
  const mapInteraction = new MapInteraction({
    boundingBox: bbox,
    level4GridSize: level4Grid,
    initialViewport: {
      centerX: mapCenterWorld.x,
      centerY: mapCenterWorld.y,
      zoomLevel: 1.5,
      screenWidth: rect.width,
      screenHeight: rect.height,
    },
  });
  mapInteraction.attach(canvas);

  // 9. Create UIOverlay
  const uiOverlay = new UIOverlayImpl();
  uiOverlay.init(uiContainer);

  // Wire FogEngine storage warnings to toast notifications
  fogConfig.onStorageWarning = (msg: string) => uiOverlay.showToast(msg);

  // Track current player world position for rendering
  let playerWorldPos: WorldPosition | null = null;

  // Marker store for user-placed points of interest
  const markerStore = new MarkerStore();
  const leafletMarkerLayers: Record<string, any> = {}; // id → Leaflet marker

  // Initialize Firebase sync (falls back to localStorage if not configured)
  import('./marker-db').then(({ initMarkerDb }) => {
    initMarkerDb().then(() => markerStore.startSync());
  });

  // Preload marker textures
  preloadMarkerImages();

  function addLeafletMarker(id: string, lat: number, lng: number, tagInfo: { label: string; color: string; texture: string }, count = 1) {
    const L = (window as any).L;
    if (!L || !leafletMap) return;

    const badge = count > 1 ? `<span style="position:absolute;bottom:-2px;right:-2px;background:#000;color:#fff;font-size:9px;font-weight:bold;padding:0 3px;border-radius:2px;font-family:monospace;">${count}</span>` : '';
    const icon = L.divIcon({
      className: 'marker-icon-pixelated',
      html: `<div style="position:relative;width:24px;height:24px;"><img src="${tagInfo.texture}" style="width:24px;height:24px;image-rendering:pixelated;">${badge}</div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });

    const lm = L.marker([lat, lng], { icon, draggable: true }).addTo(leafletMap);
    lm.bindPopup(
      `<b>${tagInfo.label}${count > 1 ? ' x' + count : ''}</b><br>` +
      `<button onclick="document.dispatchEvent(new CustomEvent('collect-marker',{detail:'${id}'}))">✅ Collect</button> ` +
      `<button onclick="document.dispatchEvent(new CustomEvent('remove-marker',{detail:'${id}'}))">🗑 Remove</button>`
    );

    // Update marker position in store when dragged
    lm.on('dragend', () => {
      const pos = lm.getLatLng();
      markerStore.updatePosition(id, { latitude: pos.lat, longitude: pos.lng });
    });

    leafletMarkerLayers[id] = lm;
  }

  function updateLeafletMarker(id: string, tagInfo: { label: string; color: string; texture: string }, count: number) {
    const L = (window as any).L;
    if (!L || !leafletMap) return;

    const lm = leafletMarkerLayers[id];
    if (!lm) return;

    const badge = count > 1 ? `<span style="position:absolute;bottom:-2px;right:-2px;background:#000;color:#fff;font-size:9px;font-weight:bold;padding:0 3px;border-radius:2px;font-family:monospace;">${count}</span>` : '';
    const icon = L.divIcon({
      className: 'marker-icon-pixelated',
      html: `<div style="position:relative;width:24px;height:24px;"><img src="${tagInfo.texture}" style="width:24px;height:24px;image-rendering:pixelated;">${badge}</div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
    lm.setIcon(icon);
    lm.setPopupContent(`<b>${tagInfo.label} x${count}</b><br><button onclick="document.dispatchEvent(new CustomEvent('remove-marker',{detail:'${id}'}))">Remove</button>`);
  }

  // Listen for marker removal from popups
  document.addEventListener('remove-marker', ((e: CustomEvent) => {
    const id = e.detail;
    markerStore.remove(id);
    if (leafletMarkerLayers[id] && leafletMap) {
      leafletMap.removeLayer(leafletMarkerLayers[id]);
      delete leafletMarkerLayers[id];
    }
  }) as EventListener);

  // Track which map quadrants the player has stepped into (per display level)
  const discoveredQuadrants = new Map<number, Set<string>>();
  // Initialize empty sets so quadrants are hidden until discovered (null = show all)
  for (const cfg of MAP_LEVEL_CONFIG) {
    discoveredQuadrants.set(cfg.display, new Set());
  }

  // Map level: display level 0=128m, 1=256m, 2=512m
  // Maps to internal terrain grid level and a visible area fraction
  const MAP_LEVEL_CONFIG = [
    { display: 0, internal: 4, sizeFraction: 0.25 },  // 128m = 1/4 of 512m
    { display: 1, internal: 3, sizeFraction: 0.5 },   // 256m = 1/2 of 512m
    { display: 2, internal: 2, sizeFraction: 1.0 },   // 512m = full map
  ];

  // Position update handler shared by GPS and simulation
  const onPosition = (pos: GeoPosition): void => {
    fogEngine.reveal(pos, 15);
    playerWorldPos = geoToWorld(pos, bbox, level4Grid, TILE_SCREEN_SIZE);

    // Mark the player's current quadrant as discovered for each display level
    for (const cfg of MAP_LEVEL_CONFIG) {
      if (!discoveredQuadrants.has(cfg.display)) {
        discoveredQuadrants.set(cfg.display, new Set());
      }
      const levelData = terrainData.zoomLevels.find((zl) => zl.level === cfg.internal);
      if (levelData) {
        // getQuadrantKey uses level-4 world coords, but quadrant size is based on
        // the selected level's grid scaled to world space
        const quadWorldW = Math.round(levelData.cols * cfg.sizeFraction) * TILE_SCREEN_SIZE * Math.pow(2, 4 - cfg.internal);
        const quadWorldH = Math.round(levelData.rows * cfg.sizeFraction) * TILE_SCREEN_SIZE * Math.pow(2, 4 - cfg.internal);
        const qx = Math.floor(playerWorldPos.x / quadWorldW);
        const qy = Math.floor(playerWorldPos.y / quadWorldH);
        discoveredQuadrants.get(cfg.display)!.add(`${qx},${qy}`);
      }
    }
  };

  // 10. Detect simulation mode and set up position source
  const isSimulation = shouldActivateSimulation();
  let simulation: ReturnType<typeof createSimulationMode> | null = null;
  let simHeading = 0; // simulated compass heading in degrees

  if (isSimulation) {
    simulation = createSimulationMode({
      onPosition,
      getViewport: () => mapInteraction.getViewport(),
      bbox,
      level4GridSize: level4Grid,
      tileScreenSize: TILE_SCREEN_SIZE,
    });
    simulation.activate(mapCenterGeo);
    uiOverlay.setGPSStatus('simulation');
    uiOverlay.setSimulationVisible(true);

    // Populate region selector
    if (regions.length > 1) {
      const currentRegionId = getSelectedRegionId(regions);
      uiOverlay.setRegions(regions, currentRegionId);
      uiOverlay.onRegionChange = (regionId: string) => {
        try { localStorage.setItem('fogmap:region', regionId); } catch { /* ignore */ }
        const params = new URLSearchParams(window.location.search);
        params.set('region', regionId);
        params.set('simulate', 'true');
        window.location.search = params.toString();
      };
    }

    // Wire keyboard for simulation
    window.addEventListener('keydown', (e) => {
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          simulation!.handleKeyboard('up', simHeading);
          if (playerWorldPos) mapInteraction.centerOn(worldToGeo(playerWorldPos, bbox, level4Grid, TILE_SCREEN_SIZE), false);
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          simulation!.handleKeyboard('down', simHeading);
          if (playerWorldPos) mapInteraction.centerOn(worldToGeo(playerWorldPos, bbox, level4Grid, TILE_SCREEN_SIZE), false);
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          simulation!.handleKeyboard('left', simHeading);
          if (playerWorldPos) mapInteraction.centerOn(worldToGeo(playerWorldPos, bbox, level4Grid, TILE_SCREEN_SIZE), false);
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          simulation!.handleKeyboard('right', simHeading);
          if (playerWorldPos) mapInteraction.centerOn(worldToGeo(playerWorldPos, bbox, level4Grid, TILE_SCREEN_SIZE), false);
          break;
        case '=':
        case '+':
          mapInteraction.setZoomLevel(mapInteraction.getViewport().zoomLevel + 0.5);
          break;
        case '-':
        case '_':
          mapInteraction.setZoomLevel(mapInteraction.getViewport().zoomLevel - 0.5);
          break;
        case 'q':
        case 'Q':
          simHeading = (simHeading - 15 + 360) % 360;
          uiOverlay.setCompassHeading(simHeading);
          break;
        case 'e':
        case 'E':
          simHeading = (simHeading + 15) % 360;
          uiOverlay.setCompassHeading(simHeading);
          break;
      }
    });

  } else {
    // Real GPS mode
    const gpsTracker = createGPSTracker();
    uiOverlay.setGPSStatus('active');
    uiOverlay.setSimulationVisible(false);

    gpsTracker.start(
      (pos) => {
        onPosition(pos);
        uiOverlay.setGPSStatus('active');
        // Auto-follow only when orientation/heading mode is active
        if (simHeading !== 0) {
          mapInteraction.centerOn(pos, false);
        }
      },
      (err) => {
        if (err === 'permission_denied') {
          uiOverlay.setGPSStatus('denied');
          uiOverlay.showToast(
            'Location access is needed to explore the map. Please enable location in your browser settings.'
          );
          // Offer simulation fallback
          uiOverlay.showToast('Tip: Add ?simulate=true to the URL to use simulation mode.');
        } else if (err === 'signal_lost') {
          uiOverlay.setGPSStatus('lost');
        }
      }
    );
  }

  // 11. Wire UIOverlay button callbacks
  uiOverlay.onCenterOnMe = () => {
    if (playerWorldPos) {
      // Reverse world→geo for centerOn
      const lastGeo: GeoPosition = {
        latitude:
          bbox.north -
          (playerWorldPos.y / (level4Grid.rows * TILE_SCREEN_SIZE)) *
            (bbox.north - bbox.south),
        longitude:
          bbox.west +
          (playerWorldPos.x / (level4Grid.cols * TILE_SCREEN_SIZE)) *
            (bbox.east - bbox.west),
      };
      mapInteraction.centerOn(lastGeo);
    }
  };

  let currentDisplayLevel = 0;
  let currentMapLevel = 4; // internal terrain grid level
  let mapSizeFraction = 0.25; // fraction of the full map to show
  uiOverlay.setMapLevel(currentDisplayLevel);

  uiOverlay.onMapLevelChange = (displayLevel: number) => {
    const config = MAP_LEVEL_CONFIG.find((c) => c.display === displayLevel);
    if (!config) return;
    currentDisplayLevel = displayLevel;
    currentMapLevel = config.internal;
    mapSizeFraction = config.sizeFraction;
  };

  uiOverlay.onZoomIn = () => {
    const vp = mapInteraction.getViewport();
    mapInteraction.setZoomLevel(vp.zoomLevel + 0.5);
  };

  uiOverlay.onZoomOut = () => {
    const vp = mapInteraction.getViewport();
    mapInteraction.setZoomLevel(vp.zoomLevel - 0.5);
  };

  uiOverlay.onResetFog = () => {
    fogEngine.reset();
    // Reset discovered quadrants to empty sets (not null — null means show all)
    for (const cfg of MAP_LEVEL_CONFIG) {
      discoveredQuadrants.set(cfg.display, new Set());
    }
  };

  uiOverlay.onRevealAll = () => {
    fogEngine.revealAll();
    // Discover all quadrants for every display level
    for (const cfg of MAP_LEVEL_CONFIG) {
      if (!discoveredQuadrants.has(cfg.display)) {
        discoveredQuadrants.set(cfg.display, new Set());
      }
      const levelData = terrainData.zoomLevels.find((zl) => zl.level === cfg.internal);
      if (levelData) {
        const quadCols = Math.round(levelData.cols * cfg.sizeFraction);
        const quadRows = Math.round(levelData.rows * cfg.sizeFraction);
        const numQX = Math.ceil(levelData.cols / quadCols);
        const numQY = Math.ceil(levelData.rows / quadRows);
        const set = discoveredQuadrants.get(cfg.display)!;
        for (let qy = 0; qy < numQY; qy++) {
          for (let qx = 0; qx < numQX; qx++) {
            set.add(`${qx},${qy}`);
          }
        }
      }
    }
  };

  uiOverlay.onHeadingChange = (degrees: number) => {
    simHeading = degrees;
  };

  uiOverlay.onRemoveAllItems = () => {
    markerStore.removeAll();
    // Clean up leaflet markers if any
    for (const id of Object.keys(leafletMarkerLayers)) {
      if (leafletMap) leafletMap.removeLayer(leafletMarkerLayers[id]);
      delete leafletMarkerLayers[id];
    }
  };

  // Toggle between Minecraft map and real OpenStreetMap view
  let showingRealMap = false;
  const realMapDiv = document.getElementById('real-map') as HTMLElement | null;
  let leafletMap: any = null;
  let leafletMarker: any = null;

  uiOverlay.onToggleRealMap = () => {
    showingRealMap = !showingRealMap;

    if (showingRealMap) {
      canvas.style.display = 'none';
      if (realMapDiv) {
        realMapDiv.style.display = 'block';

        const L = (window as any).L;

        // Lazy-init Leaflet map on first toggle
        if (!leafletMap && L) {
          leafletMap = L.map('real-map', {
            zoomControl: true,
            attributionControl: true,
          });

          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap contributors',
          }).addTo(leafletMap);

          L.rectangle(
            [[bbox.south, bbox.west], [bbox.north, bbox.east]],
            { color: '#FF5555', weight: 2, fill: false, dashArray: '6,4' }
          ).addTo(leafletMap);

          // Right-click: combined context menu with Generate Map + Add Item
          leafletMap.on('contextmenu', (e: any) => {
            e.originalEvent.preventDefault();
            const lat = e.latlng.lat;
            const lng = e.latlng.lng;

            const L = (window as any).L;
            const div = document.createElement('div');
            div.style.cssText = 'max-width:220px;';

            // --- Generate Map section ---
            const genBtn = document.createElement('button');
            genBtn.textContent = '🗺️ Generate Map Here';
            genBtn.style.cssText = `
              font-family:var(--mc-font);font-size:8px;padding:6px 8px;cursor:pointer;
              background:#555;color:#fff;border:1px solid #333;width:100%;margin-bottom:6px;
            `;
            genBtn.addEventListener('click', async () => {
              leafletMap.closePopup();
              showLoading(`Generating map at ${lat.toFixed(4)}, ${lng.toFixed(4)}... (this takes ~60s)`);
              showingRealMap = false;
              canvas.style.display = 'block';
              if (realMapDiv) realMapDiv.style.display = 'none';

              try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 180000);
                const res = await fetch('/api/generate-terrain', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ lat, lng, size: 500 }),
                  signal: controller.signal,
                });
                clearTimeout(timeout);
                if (!res.ok) throw new Error('Generation failed');
                window.location.reload();
              } catch (err) {
                hideLoading();
                uiOverlay.showToast('Failed to generate terrain. Try again.');
                console.error(err);
              }
            });
            div.appendChild(genBtn);

            // --- Separator ---
            const sep = document.createElement('div');
            sep.style.cssText = 'border-top:1px solid #ccc;margin:4px 0;font-family:var(--mc-font);font-size:6px;color:#666;padding-top:4px;';
            sep.textContent = 'Add Item:';
            div.appendChild(sep);

            // --- Item marker buttons ---
            const grid = document.createElement('div');
            grid.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;';

            for (const t of MARKER_TAGS) {
              const btn = document.createElement('button');
              btn.textContent = t.label;
              btn.style.cssText = `
                font-family:var(--mc-font);font-size:7px;padding:4px 6px;cursor:pointer;
                background:${t.color};color:#000;border:1px solid #333;
              `;
              btn.addEventListener('click', () => {
                const { marker, incremented } = markerStore.add({ latitude: lat, longitude: lng }, t.tag);
                if (incremented) {
                  updateLeafletMarker(marker.id, t, marker.count);
                } else {
                  addLeafletMarker(marker.id, lat, lng, t);
                }
                leafletMap.closePopup();
              });
              grid.appendChild(btn);
            }
            div.appendChild(grid);

            L.popup()
              .setLatLng(e.latlng)
              .setContent(div)
              .openOn(leafletMap);
          });

          // Show existing markers on the Leaflet map
          for (const m of markerStore.getAll()) {
            const tagInfo = MARKER_TAGS.find((t) => t.tag === m.tag);
            if (tagInfo) {
              addLeafletMarker(m.id, m.position.latitude, m.position.longitude, tagInfo, m.count);
            }
          }
        }

        if (leafletMap) {
          leafletMap.invalidateSize();

          // Center on the current Minecraft viewport center
          const vp = mapInteraction.getViewport();
          const centerGeo = worldToGeo(
            { x: vp.centerX, y: vp.centerY },
            bbox,
            level4Grid,
            TILE_SCREEN_SIZE
          );

          // Calculate Leaflet zoom to match the Minecraft viewport extent.
          // Each level-4 tile = 2m real-world. TILE_SCREEN_SIZE world px = 2m.
          // So 1 world px = 2/TILE_SCREEN_SIZE meters.
          // Viewport width in meters = (screenWidth / scale) * (2 / TILE_SCREEN_SIZE)
          const scale = Math.pow(2, vp.zoomLevel);
          const viewWidthMeters = (vp.screenWidth / scale) * (2 / TILE_SCREEN_SIZE);
          // Leaflet: at zoom Z, the map is 256 * 2^Z pixels wide = 40075km at equator.
          // meters/pixel = 40075016 * cos(lat) / (256 * 2^Z)
          // We want: screenWidth * metersPerPixel = viewWidthMeters
          // metersPerPixel = viewWidthMeters / screenWidth
          // So: 40075016 * cos(lat) / (256 * 2^Z) = viewWidthMeters / screenWidth
          // 2^Z = 40075016 * cos(lat) * screenWidth / (256 * viewWidthMeters)
          const cosLat = Math.cos(centerGeo.latitude * Math.PI / 180);
          const leafletZoom = Math.log2(
            (40075016 * cosLat * vp.screenWidth) / (256 * viewWidthMeters)
          );
          const clampedZoom = Math.max(1, Math.min(19, Math.round(leafletZoom)));

          leafletMap.setView([centerGeo.latitude, centerGeo.longitude], clampedZoom);

          // Place/update player marker
          if (playerWorldPos) {
            const playerGeo = worldToGeo(playerWorldPos, bbox, level4Grid, TILE_SCREEN_SIZE);

            if (leafletMarker) {
              leafletMarker.setLatLng([playerGeo.latitude, playerGeo.longitude]);
            } else if (L) {
              leafletMarker = L.marker([playerGeo.latitude, playerGeo.longitude])
                .addTo(leafletMap)
                .bindPopup('You are here');
            }
          }
        }
      }
    } else {
      canvas.style.display = 'block';
      if (realMapDiv) {
        realMapDiv.style.display = 'none';
      }
    }
  };

  // Marker popup on the Minecraft canvas map
  let markerPopupEl: HTMLElement | null = null;

  function showMarkerPopup(marker: { id: string; tag: string; count: number }, screenX: number, screenY: number) {
    hideMarkerPopup();
    const tagInfo = MARKER_TAGS.find((t) => t.tag === marker.tag);
    const label = tagInfo?.label ?? marker.tag;

    const popup = document.createElement('div');
    popup.style.cssText = `
      position:absolute;left:${screenX}px;top:${screenY - 60}px;z-index:50;
      background:rgba(0,0,0,0.9);border:2px solid #555;padding:8px;
      font-family:var(--mc-font);font-size:8px;color:#fff;pointer-events:auto;
      display:flex;flex-direction:column;gap:6px;align-items:center;
    `;
    popup.innerHTML = `
      <div>${label}${marker.count > 1 ? ' x' + marker.count : ''}</div>
      <div style="display:flex;gap:4px;">
        <button data-action="collect" style="font-family:var(--mc-font);font-size:7px;padding:4px 8px;background:#55FF55;color:#000;border:1px solid #333;cursor:pointer;">✅ Collect</button>
        <button data-action="close" style="font-family:var(--mc-font);font-size:7px;padding:4px 8px;background:#555;color:#fff;border:1px solid #333;cursor:pointer;">✕</button>
      </div>
    `;

    popup.querySelector('[data-action="collect"]')!.addEventListener('click', () => {
      markerStore.collect(marker.id);
      hideMarkerPopup();
    });
    popup.querySelector('[data-action="close"]')!.addEventListener('click', () => {
      hideMarkerPopup();
    });

    document.getElementById('app')!.appendChild(popup);
    markerPopupEl = popup;
  }

  function hideMarkerPopup() {
    if (markerPopupEl) {
      markerPopupEl.remove();
      markerPopupEl = null;
    }
  }

  // Detect clicks/taps on markers on the Minecraft canvas
  function handleMarkerClick(screenX: number, screenY: number) {
    const viewport = mapInteraction.getViewport();
    const scale = Math.pow(2, viewport.zoomLevel);
    const viewLeft = viewport.centerX - (viewport.screenWidth / scale) / 2;
    const viewTop = viewport.centerY - (viewport.screenHeight / scale) / 2;
    const hitRadius = 16; // pixels

    for (const marker of markerStore.getAll()) {
      const worldPos = geoToWorld(marker.position, bbox, level4Grid, TILE_SCREEN_SIZE);
      const tileCol = Math.floor(worldPos.x / TILE_SCREEN_SIZE);
      const tileRow = Math.floor(worldPos.y / TILE_SCREEN_SIZE);
      if (!fogEngine.isRevealed(4, tileCol, tileRow)) continue;

      const mx = (worldPos.x - viewLeft) * scale;
      const my = (worldPos.y - viewTop) * scale;
      const dx = screenX - mx;
      const dy = screenY - my;

      if (Math.sqrt(dx * dx + dy * dy) < hitRadius) {
        showMarkerPopup(marker, screenX, screenY);
        return true;
      }
    }

    hideMarkerPopup();
    return false;
  }

  // Wire canvas click for marker interaction (non-simulation mode uses this too)
  canvas.addEventListener('click', (e) => {
    handleMarkerClick(e.clientX, e.clientY);
  });

  // Wire tap for mobile marker interaction
  const existingOnTap = mapInteraction.onTap;
  mapInteraction.onTap = (screenX: number, screenY: number) => {
    if (!handleMarkerClick(screenX, screenY)) {
      // If no marker was hit, pass through to simulation if active
      if (simulation) {
        simulation.handleMapClick(screenX, screenY);
      }
    }
  };

  // 12. Handle canvas resize
  window.addEventListener('resize', () => {
    resizeCanvas(canvas);
    const r = canvas.getBoundingClientRect();
    mapInteraction.setScreenSize(r.width, r.height);
  });

  // 13. Hide loading, start render loop
  hideLoading();

  // Frame time monitoring: track previous frame timestamp
  let lastFrameTime = performance.now();
  /** When true, skip non-essential rendering (player marker) to recover perf */
  let skipNonEssential = false;

  function renderLoop(): void {
    const now = performance.now();
    const frameTime = now - lastFrameTime;
    lastFrameTime = now;

    // If frame took >100ms, skip non-essential rendering and log warning
    if (frameTime > 100) {
      if (!skipNonEssential) {
        console.warn(`Frame time ${frameTime.toFixed(1)}ms exceeds 100ms threshold — skipping non-essential rendering.`);
      }
      skipNonEssential = true;
    } else {
      skipNonEssential = false;
    }

    const viewport = mapInteraction.getViewport();
    const r = canvas.getBoundingClientRect();
    viewport.screenWidth = r.width;
    viewport.screenHeight = r.height;

    // Auto-select the best map level for the current zoom.
    // The dropdown controls which terrain grid resolution to render.
    // Zoom is unlimited — no auto-switching between levels.
    const effectiveLevel = currentMapLevel;

    // When performance is degraded, skip player marker rendering
    const effectivePlayerPos = skipNonEssential ? null : playerWorldPos;
    tileRenderer.render(ctx!, viewport, effectiveLevel, (c, r) => fogEngine.isRevealed(4, c, r), effectivePlayerPos, simHeading, mapSizeFraction, discoveredQuadrants.get(currentDisplayLevel) ?? null);

    // Render user-placed markers on revealed tiles
    if (!skipNonEssential) {
      const scale = Math.pow(2, viewport.zoomLevel);
      const viewLeft = viewport.centerX - (viewport.screenWidth / scale) / 2;
      const viewTop = viewport.centerY - (viewport.screenHeight / scale) / 2;

      // Apply the same rotation transform as the tile renderer
      ctx!.save();
      if (simHeading !== 0) {
        let pivotX = viewport.screenWidth / 2;
        let pivotY = viewport.screenHeight / 2;
        if (playerWorldPos) {
          pivotX = (playerWorldPos.x - viewLeft) * scale;
          pivotY = (playerWorldPos.y - viewTop) * scale;
        }
        ctx!.translate(pivotX, pivotY);
        ctx!.rotate((-simHeading * Math.PI) / 180);
        ctx!.translate(-pivotX, -pivotY);
      }

      for (const marker of markerStore.getAll()) {
        const worldPos = geoToWorld(marker.position, bbox, level4Grid, TILE_SCREEN_SIZE);

        // Check if this marker's tile is revealed
        const tileCol = Math.floor(worldPos.x / TILE_SCREEN_SIZE);
        const tileRow = Math.floor(worldPos.y / TILE_SCREEN_SIZE);
        if (!fogEngine.isRevealed(4, tileCol, tileRow)) continue;

        const screenX = (worldPos.x - viewLeft) * scale;
        const screenY = (worldPos.y - viewTop) * scale;

        // Draw marker icon (texture or fallback color square)
        const tagInfo = MARKER_TAGS.find((t) => t.tag === marker.tag);
        const markerImg = getMarkerImage(marker.tag);
        const size = 24;

        ctx!.imageSmoothingEnabled = false;
        if (markerImg) {
          ctx!.drawImage(markerImg, screenX - size / 2, screenY - size / 2, size, size);
        } else {
          // Fallback: colored square
          const color = tagInfo?.color ?? '#FFFFFF';
          ctx!.fillStyle = color;
          ctx!.fillRect(screenX - size / 2, screenY - size / 2, size, size);
        }

        // Draw count badge if > 1
        if (marker.count > 1) {
          const text = String(marker.count);
          ctx!.font = 'bold 10px monospace';
          ctx!.fillStyle = '#FFFFFF';
          ctx!.strokeStyle = '#000000';
          ctx!.lineWidth = 2;
          const tx = screenX + size / 2 - 2;
          const ty = screenY + size / 2;
          ctx!.strokeText(text, tx, ty);
          ctx!.fillText(text, tx, ty);
        }
      }
      ctx!.restore();
    }
    requestAnimationFrame(renderLoop);
  }

  requestAnimationFrame(renderLoop);
}

// Kick off
main().catch((err) => {
  console.error('Minecraft Fog Map failed to start:', err);
  showError("Something went wrong. Please refresh the page.");
});
