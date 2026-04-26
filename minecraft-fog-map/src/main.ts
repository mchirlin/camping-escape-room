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

async function loadTerrainData(): Promise<TerrainData> {
  const res = await fetch('/terrain-data.json');
  if (!res.ok) throw new Error('Failed to load terrain data');
  return res.json() as Promise<TerrainData>;
}

async function loadAtlasManifest(): Promise<TextureAtlasManifest> {
  const res = await fetch('/atlas.json');
  if (!res.ok) throw new Error('Failed to load atlas manifest');
  return res.json() as Promise<TextureAtlasManifest>;
}

function loadAtlasImage(): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load atlas image'));
    img.src = '/atlas.png';
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

  try {
    [terrainData, atlasManifest, atlasImage] = await Promise.all([
      loadTerrainData(),
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
    lm.bindPopup(`<b>${tagInfo.label}${count > 1 ? ' x' + count : ''}</b><br><button onclick="document.dispatchEvent(new CustomEvent('remove-marker',{detail:'${id}'}))">Remove</button>`);

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

  // Position update handler shared by GPS and simulation
  const onPosition = (pos: GeoPosition): void => {
    fogEngine.reveal(pos, 15);
    playerWorldPos = geoToWorld(pos, bbox, level4Grid, TILE_SCREEN_SIZE);
  };

  // 10. Detect simulation mode and set up position source
  const isSimulation = shouldActivateSimulation();
  let simulation: ReturnType<typeof createSimulationMode> | null = null;

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

    // Wire keyboard for simulation
    window.addEventListener('keydown', (e) => {
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          simulation!.handleKeyboard('up');
          if (playerWorldPos) mapInteraction.centerOn(worldToGeo(playerWorldPos, bbox, level4Grid, TILE_SCREEN_SIZE), false);
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          simulation!.handleKeyboard('down');
          if (playerWorldPos) mapInteraction.centerOn(worldToGeo(playerWorldPos, bbox, level4Grid, TILE_SCREEN_SIZE), false);
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          simulation!.handleKeyboard('left');
          if (playerWorldPos) mapInteraction.centerOn(worldToGeo(playerWorldPos, bbox, level4Grid, TILE_SCREEN_SIZE), false);
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          simulation!.handleKeyboard('right');
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
      }
    });

    // Wire map click/tap for simulation
    canvas.addEventListener('click', (e) => {
      simulation!.handleMapClick(e.clientX, e.clientY);
    });

    // Mobile tap support (touch events prevent click from firing)
    mapInteraction.onTap = (screenX: number, screenY: number) => {
      simulation!.handleMapClick(screenX, screenY);
    };
  } else {
    // Real GPS mode
    const gpsTracker = createGPSTracker();
    uiOverlay.setGPSStatus('active');
    uiOverlay.setSimulationVisible(false);

    gpsTracker.start(
      (pos) => {
        onPosition(pos);
        uiOverlay.setGPSStatus('active');
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

  // Map level dropdown — controls terrain grid resolution (0-4)
  let currentMapLevel = 4;
  uiOverlay.setMapLevel(currentMapLevel);

  uiOverlay.onMapLevelChange = (level: number) => {
    currentMapLevel = Math.max(0, Math.min(4, level));
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
            genBtn.addEventListener('click', () => {
              // Replace with confirmation
              div.innerHTML = '';
              const msg = document.createElement('div');
              msg.style.cssText = 'font-family:var(--mc-font);font-size:7px;color:#333;margin-bottom:6px;';
              msg.textContent = `Generate new map at ${lat.toFixed(4)}, ${lng.toFixed(4)}? This takes ~60s.`;
              div.appendChild(msg);

              const row = document.createElement('div');
              row.style.cssText = 'display:flex;gap:4px;';

              const yesBtn = document.createElement('button');
              yesBtn.textContent = 'Yes';
              yesBtn.style.cssText = `
                font-family:var(--mc-font);font-size:8px;padding:4px 10px;cursor:pointer;
                background:#55FF55;color:#000;border:1px solid #333;flex:1;
              `;
              yesBtn.addEventListener('click', async () => {
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

              const noBtn = document.createElement('button');
              noBtn.textContent = 'Cancel';
              noBtn.style.cssText = `
                font-family:var(--mc-font);font-size:8px;padding:4px 10px;cursor:pointer;
                background:#FF5555;color:#fff;border:1px solid #333;flex:1;
              `;
              noBtn.addEventListener('click', () => leafletMap.closePopup());

              row.appendChild(yesBtn);
              row.appendChild(noBtn);
              div.appendChild(row);
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
    tileRenderer.render(ctx!, viewport, effectiveLevel, (c, r) => fogEngine.isRevealed(4, c, r), effectivePlayerPos);

    // Render user-placed markers on revealed tiles
    if (!skipNonEssential) {
      const scale = Math.pow(2, viewport.zoomLevel);
      const viewLeft = viewport.centerX - (viewport.screenWidth / scale) / 2;
      const viewTop = viewport.centerY - (viewport.screenHeight / scale) / 2;

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
