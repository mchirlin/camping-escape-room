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
import { geoToWorld, worldToGeo, geoToTile } from './coords';
import { MarkerStore, MARKER_TAGS, preloadMarkerImages, getMarkerImage, isLocationTag, groupedMarkerTags } from './markers';
import type { MarkerTag } from './markers';
import { CraftingTableLink, collectNearestMarker } from './crafting-link';

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

function hasExplicitRegion(): boolean {
  const params = new URLSearchParams(window.location.search);
  return !!params.get('region');
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

/** Get a one-shot GPS position with a timeout. */
function getCurrentPosition(timeoutMs = 8000): Promise<GeoPosition | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return; }
    const timer = setTimeout(() => resolve(null), timeoutMs);
    navigator.geolocation.getCurrentPosition(
      (p) => { clearTimeout(timer); resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude }); },
      () => { clearTimeout(timer); resolve(null); },
      { enableHighAccuracy: true, timeout: timeoutMs },
    );
  });
}

/** Find the region whose bounding box center is closest to the given position. */
async function findClosestRegion(regions: RegionInfo[], pos: GeoPosition): Promise<RegionInfo | null> {
  let best: RegionInfo | null = null;
  let bestDist = Infinity;
  for (const r of regions) {
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}${r.file}`);
      if (!res.ok) continue;
      const data = await res.json() as TerrainData;
      const bb = data.boundingBox;
      const cLat = (bb.north + bb.south) / 2;
      const cLng = (bb.east + bb.west) / 2;
      const d = (pos.latitude - cLat) ** 2 + (pos.longitude - cLng) ** 2;
      if (d < bestDist) { bestDist = d; best = r; }
    } catch { /* skip */ }
  }
  return best;
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
  // Use window inner dimensions to avoid layout race conditions on reload
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  if (ctx) ctx.scale(dpr, dpr);
}

// ---- Main bootstrap ----

async function main(): Promise<void> {
  // Swap favicons for admin mode so iPhone home screen icon differs
  if (shouldActivateSimulation()) {
    document.querySelectorAll<HTMLLinkElement>('link[rel="icon"]').forEach((el) => {
      el.href = el.href.replace(/favicon(-16)?\.png/, 'favicon-sim$1.png');
    });
    document.querySelectorAll<HTMLLinkElement>('link[rel="apple-touch-icon"]').forEach((el) => {
      el.href = el.href.replace('apple-touch-icon.png', 'apple-touch-icon-sim.png');
    });
    const titleMeta = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    if (titleMeta) titleMeta.setAttribute('content', 'Fog Map (Admin)');
  }

  showLoading('Loading map data...');

  // 1. Load assets
  let terrainData: TerrainData;
  let atlasManifest: TextureAtlasManifest;
  let atlasImage: HTMLImageElement;
  let regions: RegionInfo[] = [];

  try {
    regions = await loadRegions();
    let terrainFile: string;

    // If no explicit region and using real GPS, auto-select closest region
    if (!hasExplicitRegion() && !shouldActivateSimulation() && regions.length > 1) {
      showLoading('Finding nearest region...');
      const gpsPos = await getCurrentPosition();
      if (gpsPos) {
        const closest = await findClosestRegion(regions, gpsPos);
        if (closest) {
          try { localStorage.setItem('fogmap:region', closest.id); } catch { /* ignore */ }
          terrainFile = closest.file;
        } else {
          terrainFile = getSelectedRegionFile(regions);
        }
      } else {
        terrainFile = getSelectedRegionFile(regions);
      }
    } else {
      terrainFile = getSelectedRegionFile(regions);
    }

    showLoading('Loading map data...');
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
  // Delayed re-resize to catch iOS address bar/layout settling after reload
  setTimeout(() => resizeCanvas(canvas), 300);

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

  // Load saved avatar and apply
  const savedAvatar = (() => {
    try { return localStorage.getItem('fogmap:avatar') || 'alex'; } catch { return 'alex'; }
  })();
  tileRenderer.setPlayerSkin(savedAvatar);

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

  // Wire avatar picker — pass atlas to overlay for face thumbnails
  uiOverlay.setAvatarAtlas(atlasImage, atlasManifest.textures);
  uiOverlay.onAvatarChange = (skinName: string) => {
    tileRenderer.setPlayerSkin(skinName);
  };

  // Player name (shown under the local player's avatar; broadcast to others)
  let playerName = (() => {
    try { return localStorage.getItem('fogmap:playername') || ''; } catch { return ''; }
  })();
  uiOverlay.onNameChange = (name: string) => {
    playerName = name;
  };

  // Wire FogEngine storage warnings to toast notifications
  fogConfig.onStorageWarning = (msg: string) => uiOverlay.showToast(msg);

  // Track current player world position for rendering
  let playerWorldPos: WorldPosition | null = null;
  // Track current player geo position for crafting-link marker collection
  let lastGeoPos: GeoPosition | null = null;
  // Other players from Firebase (multiplayer)
  let otherPlayers: Array<{ id: string; position: GeoPosition; avatar: string; name: string; updatedAt: number }> = [];

  // Marker store for user-placed points of interest
  const isAdminMode = shouldActivateSimulation();
  const markerStore = new MarkerStore(isAdminMode, terrainData.regionId, terrainData.boundingBox);
  const leafletMarkerLayers: Record<string, any> = {}; // id → Leaflet marker

  // Initialize Firebase sync (falls back to localStorage if not configured)
  import('./marker-db').then(({ initMarkerDb }) => {
    initMarkerDb().then(() => {
      markerStore.startSync();

      // Initialize shared fog sync via Firebase
      import('./fog-sync').then(({ initFogSync }) => {
        if (initFogSync()) {
          fogEngine.loadFromFirebase();
        }
      });

      // Multiplayer: broadcast position and listen for other players (non-admin only)
      if (!isAdminMode) {
        import('./player-db').then(({ initPlayerDb, startBroadcasting, listenForPlayers, removePlayer, hasOnboarded, markOnboarded }) => {
          if (!initPlayerDb()) return;

          // Persistent player ID per device
          let playerId: string;
          try {
            playerId = localStorage.getItem('fogmap:playerId') || '';
            if (!playerId) {
              playerId = crypto.randomUUID();
              localStorage.setItem('fogmap:playerId', playerId);
            }
          } catch {
            playerId = crypto.randomUUID();
          }

          // Show onboarding on first visit (or after an admin reset).
          // Firestore is the source of truth so admins can clear it for everyone.
          hasOnboarded(playerId).then((onboarded) => {
            if (onboarded) return;
            import('./onboarding').then(({ showOnboarding }) => {
              const curAvatar = (() => {
                try { return localStorage.getItem('fogmap:avatar') || 'alex'; } catch { return 'alex'; }
              })();
              const curName = (() => {
                try { return localStorage.getItem('fogmap:playername') || ''; } catch { return ''; }
              })();
              showOnboarding({
                atlas: atlasImage,
                manifest: atlasManifest.textures,
                initialAvatar: curAvatar,
                initialName: curName,
                onComplete: (avatar, name) => {
                  try {
                    localStorage.setItem('fogmap:avatar', avatar);
                    localStorage.setItem('fogmap:playername', name);
                  } catch { /* ignore */ }
                  tileRenderer.setPlayerSkin(avatar);
                  uiOverlay.setAvatarSelection(avatar);
                  uiOverlay.setNameValue(name);
                  playerName = name;
                  markOnboarded(playerId, avatar, name);
                },
              });
            });
          });

          // Start broadcasting position every 3 seconds
          const getAvatar = () => {
            try { return localStorage.getItem('fogmap:avatar') || 'alex'; } catch { return 'alex'; }
          };
          const getName = () => {
            try { return localStorage.getItem('fogmap:playername') || ''; } catch { return ''; }
          };
          const stopBroadcast = startBroadcasting(playerId, () => lastGeoPos, getAvatar, 3000, getName);

          // Listen for other players
          listenForPlayers(playerId, (players) => {
            otherPlayers = players;
          });

          // Clean up on page unload (multiple events for mobile reliability)
          const cleanup = () => {
            stopBroadcast();
            removePlayer(playerId);
          };
          window.addEventListener('beforeunload', cleanup);
          window.addEventListener('pagehide', cleanup);
          document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
              removePlayer(playerId);
            }
          });
        });
      }
    });
  });

  // Preload marker textures
  preloadMarkerImages();

  function locationMarkerHtml(tagInfo: { color: string; texture: string }, badge: string): string {
    // Larger colored frame with dark inner panel and a pin point below
    return `<div style="position:relative;width:44px;height:53px;">` +
      `<div style="position:relative;width:44px;height:44px;background:${tagInfo.color};border:3px solid #fff;box-sizing:border-box;display:flex;align-items:center;justify-content:center;">` +
      `<div style="width:32px;height:32px;background:#2a2a2a;display:flex;align-items:center;justify-content:center;"><img src="${tagInfo.texture}" style="width:28px;height:28px;object-fit:contain;image-rendering:pixelated;"></div>${badge}</div>` +
      `<div style="position:absolute;left:50%;top:42px;transform:translateX(-50%);width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-top:10px solid ${tagInfo.color};"></div>` +
      `</div>`;
  }

  function itemMarkerHtml(tagInfo: { texture: string }, badge: string): string {
    return `<div style="position:relative;width:32px;height:32px;background:#8b8b8b;border:2px solid;border-color:#555 #fff #fff #555;display:flex;align-items:center;justify-content:center;"><img src="${tagInfo.texture}" style="width:24px;height:24px;object-fit:contain;image-rendering:pixelated;">${badge}</div>`;
  }

  function addLeafletMarker(id: string, lat: number, lng: number, tagInfo: { label: string; color: string; texture: string; isLocation?: boolean }, count = 1) {
    const L = (window as any).L;
    if (!L || !leafletMap) return;

    const badge = count > 1 ? `<span style="position:absolute;bottom:-2px;right:-2px;background:#000;color:#fff;font-size:9px;font-weight:bold;padding:0 3px;border-radius:2px;font-family:monospace;">${count}</span>` : '';
    const loc = !!tagInfo.isLocation;
    const icon = L.divIcon({
      className: 'marker-icon-pixelated',
      html: loc ? locationMarkerHtml(tagInfo, badge) : itemMarkerHtml(tagInfo, badge),
      iconSize: loc ? [44, 53] : [32, 32],
      iconAnchor: loc ? [22, 53] : [16, 16],
    });

    const lm = L.marker([lat, lng], { icon, draggable: true }).addTo(leafletMap);
    // Locations can't be collected — only items get a Collect button
    const collectBtn = tagInfo.isLocation
      ? ''
      : `<button onclick="document.dispatchEvent(new CustomEvent('collect-marker',{detail:'${id}'}))">✅ Collect</button> `;
    lm.bindPopup(
      `<b>${tagInfo.label}${count > 1 ? ' x' + count : ''}</b><br>` +
      collectBtn +
      `<button onclick="document.dispatchEvent(new CustomEvent('remove-marker',{detail:'${id}'}))">🗑 Remove</button>`
    );

    // Update marker position in store when dragged
    lm.on('dragend', () => {
      const pos = lm.getLatLng();
      markerStore.updatePosition(id, { latitude: pos.lat, longitude: pos.lng });
    });

    leafletMarkerLayers[id] = lm;
  }

  function updateLeafletMarker(id: string, tagInfo: { label: string; color: string; texture: string; isLocation?: boolean }, count: number) {
    const L = (window as any).L;
    if (!L || !leafletMap) return;

    const lm = leafletMarkerLayers[id];
    if (!lm) return;

    const badge = count > 1 ? `<span style="position:absolute;bottom:-2px;right:-2px;background:#000;color:#fff;font-size:9px;font-weight:bold;padding:0 3px;border-radius:2px;font-family:monospace;">${count}</span>` : '';
    const loc = !!tagInfo.isLocation;
    const icon = L.divIcon({
      className: 'marker-icon-pixelated',
      html: loc ? locationMarkerHtml(tagInfo, badge) : itemMarkerHtml(tagInfo, badge),
      iconSize: loc ? [44, 53] : [32, 32],
      iconAnchor: loc ? [22, 53] : [16, 16],
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

  // Listen for marker collection from popups (must be within 15m)
  document.addEventListener('collect-marker', ((e: CustomEvent) => {
    const id = e.detail;
    const marker = markerStore.getAll().find(m => m.id === id);
    const tagInfo = marker ? MARKER_TAGS.find(t => t.tag === marker.tag) : null;

    // Locations are not collectible
    if (marker && isLocationTag(marker.tag)) {
      return;
    }

    // Check proximity — need GPS position within 15m of marker
    getCurrentPosition().then((pos) => {
      if (!pos || !marker) {
        uiOverlay.showToast('📍 GPS not available — move closer and try again');
        return;
      }
      const dLat = Math.abs(marker.position.latitude - pos.latitude) * 111320;
      const dLng = Math.abs(marker.position.longitude - pos.longitude) * 111320 *
        Math.cos(pos.latitude * Math.PI / 180);
      const dist = Math.sqrt(dLat * dLat + dLng * dLng);

      if (dist > 15) {
        uiOverlay.showToast(`📍 Too far away (${Math.round(dist)}m) — get closer!`);
        return;
      }

      markerStore.remove(id);
      if (leafletMarkerLayers[id] && leafletMap) {
        leafletMap.removeLayer(leafletMarkerLayers[id]);
        delete leafletMarkerLayers[id];
      }
      if (tagInfo) {
        uiOverlay.showToast(`✅ Collected: ${tagInfo.label}`);
      }
    });
  }) as EventListener);

  // ---- Crafting Table WiFi Link ----
  // Connect to ESP32 crafting table if ?craft=<ip> is in the URL
  // Example: ?craft=192.168.4.1 or ?craft=crafting-table.local
  const craftHost = new URLSearchParams(window.location.search).get('craft');
  if (craftHost) {
    const craftLink = new CraftingTableLink({ host: craftHost, pollInterval: 2500 });
    uiOverlay.setCraftingStatus('connecting');

    craftLink.onConnectionChange = (connected) => {
      uiOverlay.setCraftingStatus(connected ? 'connected' : 'disconnected');
      uiOverlay.showToast(connected ? '⚡ Crafting table connected' : '❌ Crafting table disconnected');
    };

    craftLink.onCraft = (_recipe, displayName) => {
      uiOverlay.showToast(`✨ Crafted: ${displayName}`);
    };

    craftLink.onBlockPlaced = (_blockType, markerTag) => {
      if (markerTag) {
        const id = collectNearestMarker(markerStore, markerTag, lastGeoPos);
        if (id && leafletMarkerLayers[id] && leafletMap) {
          leafletMap.removeLayer(leafletMarkerLayers[id]);
          delete leafletMarkerLayers[id];
        }
      }
    };

    craftLink.start();
  }

  // ---- NFC Tag Scan Handler ----
  // When opened via NFC tag URL: ?scan=block_type
  // First scan at a location: places a marker at current GPS position
  // Second scan of same tag type at same location: marks it as collected (removes marker)
  const scanParam = new URLSearchParams(window.location.search).get('scan');
  if (scanParam) {
    const scanType = scanParam as MarkerTag;
    const scanUid = new URLSearchParams(window.location.search).get('uid') || undefined;
    const tagInfo = MARKER_TAGS.find((t) => t.tag === scanType);
    if (tagInfo) {
      // Get current GPS position
      getCurrentPosition().then((pos) => {
        if (!pos) {
          uiOverlay.showToast('📍 GPS not available — cannot place marker');
          return;
        }

        // Check if there's already a marker with this UID (exact match)
        const existingMarkers = markerStore.getAllIncludingHidden();
        let existing: typeof existingMarkers[0] | undefined;

        if (scanUid) {
          // Match by UID — finds the exact tag regardless of proximity
          existing = existingMarkers.find((m) => m.uid === scanUid);
        } else {
          // Fallback: match by type + proximity (for tags without UID)
          existing = existingMarkers.find((m) => {
            if (m.tag !== scanType) return false;
            const dLat = Math.abs(m.position.latitude - pos.latitude) * 111320;
            const dLng = Math.abs(m.position.longitude - pos.longitude) * 111320 *
              Math.cos(pos.latitude * Math.PI / 180);
            return Math.sqrt(dLat * dLat + dLng * dLng) < 15;
          });
        }

        if (existing) {
          // Second scan — collect it (remove from map)
          markerStore.remove(existing.id);
          if (leafletMarkerLayers[existing.id] && leafletMap) {
            leafletMap.removeLayer(leafletMarkerLayers[existing.id]);
            delete leafletMarkerLayers[existing.id];
          }
          uiOverlay.showToast(`✅ Collected: ${tagInfo.label}`);
        } else {
          // First scan — place marker at current position with UID
          const { marker } = markerStore.add(pos, scanType, undefined, scanUid);
          addLeafletMarker(marker.id, pos.latitude, pos.longitude, tagInfo, marker.count);
          uiOverlay.showToast(`📌 Placed: ${tagInfo.label}`);
        }

        // Clean the URL (remove scan params so refresh doesn't re-trigger)
        const cleanParams = new URLSearchParams(window.location.search);
        cleanParams.delete('scan');
        cleanParams.delete('uid');
        const cleanUrl = cleanParams.toString()
          ? `${window.location.pathname}?${cleanParams.toString()}`
          : window.location.pathname;
        window.history.replaceState({}, '', cleanUrl);
      });
    } else {
      uiOverlay.showToast(`❓ Unknown block type: ${scanParam}`);
    }
  }

  // Map level: display level 0=128m, 1=256m, 2=512m
  // Maps to internal terrain grid level and a visible area fraction
  const MAP_LEVEL_CONFIG = [
    { display: 0, internal: 4, sizeFraction: 0.25 },  // 128m = 1/4 of 512m
    { display: 1, internal: 3, sizeFraction: 0.5 },   // 256m = 1/2 of 512m
    { display: 2, internal: 2, sizeFraction: 1.0 },   // 512m = full map
  ];

  // Track which map quadrants the player has stepped into (per display level)
  const discoveredQuadrants = new Map<number, Set<string>>();
  // Initialize empty sets so quadrants are hidden until discovered (null = show all)
  for (const cfg of MAP_LEVEL_CONFIG) {
    discoveredQuadrants.set(cfg.display, new Set());
  }

  // Mark the quadrant containing a given world position as discovered, for every display level.
  const markQuadrantDiscovered = (worldX: number, worldY: number): void => {
    for (const cfg of MAP_LEVEL_CONFIG) {
      if (!discoveredQuadrants.has(cfg.display)) {
        discoveredQuadrants.set(cfg.display, new Set());
      }
      const levelData = terrainData.zoomLevels.find((zl) => zl.level === cfg.internal);
      if (levelData) {
        const quadWorldW = Math.round(levelData.cols * cfg.sizeFraction) * TILE_SCREEN_SIZE * Math.pow(2, 4 - cfg.internal);
        const quadWorldH = Math.round(levelData.rows * cfg.sizeFraction) * TILE_SCREEN_SIZE * Math.pow(2, 4 - cfg.internal);
        const qx = Math.floor(worldX / quadWorldW);
        const qy = Math.floor(worldY / quadWorldH);
        discoveredQuadrants.get(cfg.display)!.add(`${qx},${qy}`);
      }
    }
  };

  const onPosition = (pos: GeoPosition): void => {
    fogEngine.reveal(pos, 15);
    playerWorldPos = geoToWorld(pos, bbox, level4Grid, TILE_SCREEN_SIZE);
    lastGeoPos = pos;
    markQuadrantDiscovered(playerWorldPos.x, playerWorldPos.y);
  };

  // When fog is revealed remotely (another player via Firebase), mark those
  // quadrants as discovered so the shared fog actually renders on this device.
  fogEngine.onRemoteReveal = (newLevel4Keys: string[]) => {
    for (const key of newLevel4Keys) {
      // key format: "z4:col:row"
      const parts = key.split(':');
      const col = parseInt(parts[1], 10);
      const row = parseInt(parts[2], 10);
      if (Number.isNaN(col) || Number.isNaN(row)) continue;
      // Convert the level-4 tile to world coords (tile center)
      const worldX = (col + 0.5) * TILE_SCREEN_SIZE;
      const worldY = (row + 0.5) * TILE_SCREEN_SIZE;
      markQuadrantDiscovered(worldX, worldY);
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

    // Wire exit-admin button to reload without admin param
    uiOverlay.onExitSimulation = () => {
      const params = new URLSearchParams(window.location.search);
      params.delete('admin');
      params.delete('simulate');
      window.location.search = params.toString();
    };

    // Populate region selector
    if (regions.length > 1) {
      const currentRegionId = getSelectedRegionId(regions);
      uiOverlay.setRegions(regions, currentRegionId);
      uiOverlay.onRegionChange = (regionId: string) => {
        try { localStorage.setItem('fogmap:region', regionId); } catch { /* ignore */ }
        const params = new URLSearchParams(window.location.search);
        params.set('region', regionId);
        params.set('admin', 'true');
        window.location.search = params.toString();
      };
    }

    // Wire keyboard for simulation (zoom only)
    window.addEventListener('keydown', (e) => {
      switch (e.key) {
        case '=':
        case '+':
          mapInteraction.setZoomLevel(mapInteraction.getViewport().zoomLevel + 0.5);
          break;
        case '-':
        case '_':
          mapInteraction.setZoomLevel(mapInteraction.getViewport().zoomLevel - 0.5);
          break;
        case 'w':
        case 'W':
        case 'ArrowUp':
          simulation?.handleKeyboard('up', simHeading);
          break;
        case 's':
        case 'S':
        case 'ArrowDown':
          simulation?.handleKeyboard('down', simHeading);
          break;
        case 'a':
        case 'A':
        case 'ArrowLeft':
          simulation?.handleKeyboard('left', simHeading);
          break;
        case 'd':
        case 'D':
        case 'ArrowRight':
          simulation?.handleKeyboard('right', simHeading);
          break;
      }
    });

  } else {
    // Real GPS mode
    const gpsTracker = createGPSTracker();
    uiOverlay.setGPSStatus('active');
    uiOverlay.setSimulationVisible(false);

    let centeredOnFirstFix = false;

    gpsTracker.start(
      (pos) => {
        onPosition(pos);
        uiOverlay.setGPSStatus('active');
        // Always center on the player for the first GPS fix.
        if (!centeredOnFirstFix) {
          centeredOnFirstFix = true;
          mapInteraction.centerOn(pos, true);
        } else if (simHeading !== 0) {
          // After that, auto-follow only in orientation/heading mode.
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
          uiOverlay.showToast('Tip: Add ?admin=true to the URL to use admin mode.');
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

  // Admin: clear onboarding for all players so everyone sees the intro again
  uiOverlay.onResetOnboarding = () => {
    import('./player-db').then(({ initPlayerDb, resetAllOnboarding }) => {
      initPlayerDb();
      resetAllOnboarding().then((count) => {
        uiOverlay.showToast(`📖 Intro reset for ${count} player${count === 1 ? '' : 's'}`);
      });
    });
  };

  // --- Admin: marker visibility triggers ---
  function updateMarkerPanel() {
    if (!isAdminMode) return;
    const allMarkers = markerStore.getAllIncludingHidden();
    // Group by tag with counts and hidden state
    const tagMap = new Map<string, { count: number; hidden: boolean }>();
    for (const m of allMarkers) {
      const existing = tagMap.get(m.tag);
      if (existing) {
        existing.count += m.count;
        // If any marker of this tag is hidden, show as hidden
        if (m.hidden) existing.hidden = true;
      } else {
        tagMap.set(m.tag, { count: m.count, hidden: !!m.hidden });
      }
    }
    const tagInfos = [...tagMap.entries()].map(([tag, info]) => {
      const tagDef = MARKER_TAGS.find((t) => t.tag === tag);
      return {
        tag,
        label: tagDef?.label ?? tag,
        color: tagDef?.color ?? '#888',
        hidden: info.hidden,
        count: info.count,
      };
    });
    uiOverlay.updateMarkerVisibilityPanel(tagInfos);
  }

  uiOverlay.onRevealTag = (tag: string) => {
    markerStore.revealByTag(tag as any);
    updateMarkerPanel();
    uiOverlay.showToast(`👁 Revealed: ${MARKER_TAGS.find(t => t.tag === tag)?.label ?? tag}`);
  };

  uiOverlay.onHideTag = (tag: string) => {
    markerStore.hideByTag(tag as any);
    updateMarkerPanel();
    uiOverlay.showToast(`🙈 Hidden: ${MARKER_TAGS.find(t => t.tag === tag)?.label ?? tag}`);
  };

  uiOverlay.onRevealAllMarkers = () => {
    markerStore.revealAll();
    updateMarkerPanel();
    uiOverlay.showToast('👁 All markers revealed');
  };

  uiOverlay.onHideAllMarkers = () => {
    markerStore.hideAll();
    updateMarkerPanel();
    uiOverlay.showToast('🙈 All markers hidden');
  };

  // Update panel whenever markers change (from sync)
  const originalOnChange = markerStore.onChange;
  markerStore.onChange = (markers) => {
    originalOnChange?.(markers);
    updateMarkerPanel();
  };

  // Initial panel render
  if (isAdminMode) {
    // Delay to let Firebase sync populate markers first
    setTimeout(updateMarkerPanel, 2000);
  }

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

            // --- Marker buttons grouped into Locations / Items (alphabetical) ---
            for (const group of groupedMarkerTags()) {
              const heading = document.createElement('div');
              heading.style.cssText = 'font-family:var(--mc-font);font-size:6px;color:#888;margin:4px 0 2px;';
              heading.textContent = group.title;
              div.appendChild(heading);

              const grid = document.createElement('div');
              grid.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;';
              for (const t of group.tags) {
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
            }

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

  function showMarkerPopup(marker: { id: string; tag: string; count: number; hidden?: boolean; revealOnFog?: boolean }, screenX: number, screenY: number) {
    hideMarkerPopup();
    const tagInfo = MARKER_TAGS.find((t) => t.tag === marker.tag);
    const label = tagInfo?.label ?? marker.tag;
    const isHidden = !!marker.hidden;
    const isFogGated = !!marker.revealOnFog;
    const isLocation = isLocationTag(marker.tag as MarkerTag);

    const popup = document.createElement('div');
    popup.style.cssText = `
      position:absolute;left:${screenX}px;top:${screenY - 60}px;z-index:50;
      background:rgba(0,0,0,0.9);border:2px solid #555;padding:8px;
      font-family:var(--mc-font);font-size:8px;color:#fff;pointer-events:auto;
      display:flex;flex-direction:column;gap:6px;align-items:center;
    `;

    let buttonsHtml = '';
    if (isAdminMode && isHidden) {
      buttonsHtml += `<button data-action="reveal" style="font-family:var(--mc-font);font-size:7px;padding:4px 8px;background:#5b8731;color:#fff;border:1px solid #333;cursor:pointer;">👁 Reveal</button>`;
    } else if (isAdminMode && !isHidden) {
      buttonsHtml += `<button data-action="hide" style="font-family:var(--mc-font);font-size:7px;padding:4px 8px;background:#AA3333;color:#fff;border:1px solid #333;cursor:pointer;">🙈 Hide</button>`;
    }
    // Locations can't be collected — only items
    if (!isLocation) {
      buttonsHtml += `<button data-action="collect" style="font-family:var(--mc-font);font-size:7px;padding:4px 8px;background:#55FF55;color:#000;border:1px solid #333;cursor:pointer;">✅ Collect</button>`;
    }
    // Admins can delete any marker (the only way to remove a location)
    if (isAdminMode) {
      buttonsHtml += `<button data-action="delete" style="font-family:var(--mc-font);font-size:7px;padding:4px 8px;background:#AA3333;color:#fff;border:1px solid #333;cursor:pointer;">🗑 Delete</button>`;
    }
    buttonsHtml += `<button data-action="close" style="font-family:var(--mc-font);font-size:7px;padding:4px 8px;background:#555;color:#fff;border:1px solid #333;cursor:pointer;">✕</button>`;

    const statusText = isHidden ? ' 🙈 hidden' : (isFogGated ? ' 🌫️ reveal on uncover' : '');
    popup.innerHTML = `
      <div>${label}${marker.count > 1 ? ' x' + marker.count : ''}${statusText}</div>
      <div style="display:flex;gap:4px;flex-wrap:wrap;justify-content:center;">
        ${buttonsHtml}
      </div>
    `;

    popup.querySelector('[data-action="collect"]')?.addEventListener('click', () => {
      markerStore.collect(marker.id);
      hideMarkerPopup();
    });
    popup.querySelector('[data-action="delete"]')?.addEventListener('click', () => {
      markerStore.remove(marker.id);
      if (leafletMarkerLayers[marker.id] && leafletMap) {
        leafletMap.removeLayer(leafletMarkerLayers[marker.id]);
        delete leafletMarkerLayers[marker.id];
      }
      hideMarkerPopup();
      updateMarkerPanel();
      uiOverlay.showToast(`🗑 Deleted: ${label}`);
    });
    popup.querySelector('[data-action="close"]')?.addEventListener('click', () => {
      hideMarkerPopup();
    });
    popup.querySelector('[data-action="reveal"]')?.addEventListener('click', () => {
      import('./marker-db').then(({ dbUpdateHidden }) => {
        dbUpdateHidden(marker.id, false);
      });
      // Update local state
      const m = markerStore.getAllIncludingHidden().find(x => x.id === marker.id);
      if (m) m.hidden = false;
      hideMarkerPopup();
      updateMarkerPanel();
      uiOverlay.showToast(`👁 Revealed: ${label}`);
    });
    popup.querySelector('[data-action="hide"]')?.addEventListener('click', () => {
      import('./marker-db').then(({ dbUpdateHidden }) => {
        dbUpdateHidden(marker.id, true);
      });
      const m = markerStore.getAllIncludingHidden().find(x => x.id === marker.id);
      if (m) m.hidden = true;
      hideMarkerPopup();
      updateMarkerPanel();
      uiOverlay.showToast(`🙈 Hidden: ${label}`);
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

  // Is a marker's tile uncovered in the fog? Used to gate reveal-on-fog markers.
  function isMarkerFogRevealed(marker: { position: GeoPosition }): boolean {
    const tile = geoToTile(marker.position, 4, bbox, level4Grid);
    return fogEngine.isRevealed(4, tile.col, tile.row);
  }

  // Detect clicks/taps on markers on the Minecraft canvas
  function handleMarkerClick(screenX: number, screenY: number) {
    const viewport = mapInteraction.getViewport();
    const scale = Math.pow(2, viewport.zoomLevel);
    const viewLeft = viewport.centerX - (viewport.screenWidth / scale) / 2;
    const viewTop = viewport.centerY - (viewport.screenHeight / scale) / 2;

    for (const marker of markerStore.getAll()) {
      // Don't allow interacting with reveal-on-fog markers still under fog (non-admin)
      if (marker.revealOnFog && !isAdminMode && !isMarkerFogRevealed(marker)) {
        continue;
      }

      const worldPos = geoToWorld(marker.position, bbox, level4Grid, TILE_SCREEN_SIZE);

      const mx = (worldPos.x - viewLeft) * scale;
      const my = (worldPos.y - viewTop) * scale;
      const dx = screenX - mx;
      const dy = screenY - my;

      // Larger hit radius for location markers (they're bigger)
      const hitRadius = isLocationTag(marker.tag) ? 24 : 16;

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

  // Admin: long-press on canvas to add items
  if (isAdminMode) {
    let longPressTimer: ReturnType<typeof setTimeout> | null = null;
    let longPressPos = { x: 0, y: 0 };

    canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      longPressPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      longPressTimer = setTimeout(() => {
        showAddItemPopup(longPressPos.x, longPressPos.y);
      }, 600); // 600ms long press
    });

    canvas.addEventListener('touchmove', (e) => {
      if (longPressTimer && e.touches.length === 1) {
        const dx = e.touches[0].clientX - longPressPos.x;
        const dy = e.touches[0].clientY - longPressPos.y;
        if (Math.sqrt(dx * dx + dy * dy) > 10) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
        }
      }
    });

    canvas.addEventListener('touchend', () => {
      if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
    });

    canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showAddItemPopup(e.clientX, e.clientY);
    });
  }

  function showAddItemPopup(screenX: number, screenY: number) {
    hideMarkerPopup();

    // Convert screen position to geo
    const viewport = mapInteraction.getViewport();
    const scale = Math.pow(2, viewport.zoomLevel);
    const viewLeft = viewport.centerX - (viewport.screenWidth / scale) / 2;
    const viewTop = viewport.centerY - (viewport.screenHeight / scale) / 2;
    const worldX = viewLeft + screenX / scale;
    const worldY = viewTop + screenY / scale;
    const geo = worldToGeo({ x: worldX, y: worldY }, bbox, level4Grid, TILE_SCREEN_SIZE);

    const popup = document.createElement('div');
    popup.style.cssText = `
      position:absolute;left:${screenX}px;top:${Math.max(0, screenY - 120)}px;z-index:50;
      background:rgba(0,0,0,0.95);border:2px solid #555;padding:8px;
      font-family:var(--mc-font);font-size:7px;color:#fff;pointer-events:auto;
      display:flex;flex-direction:column;gap:6px;max-width:240px;
    `;

    let html = '';
    // Reveal-on-fog toggle — when checked, placed markers only appear to players
    // once they've uncovered that spot on the map.
    html += `<label style="display:flex;align-items:center;gap:5px;font-size:6px;color:#ddd;margin-bottom:4px;cursor:pointer;">
      <input type="checkbox" data-fog-toggle style="width:12px;height:12px;">
      Only show when uncovered
    </label>`;
    for (const group of groupedMarkerTags()) {
      html += `<div style="color:#888;font-size:6px;margin:2px 0;">${group.title}</div>`;
      html += '<div style="display:flex;flex-wrap:wrap;gap:3px;">';
      for (const t of group.tags) {
        html += `<button data-tag="${t.tag}" style="font-family:var(--mc-font);font-size:6px;padding:3px 5px;cursor:pointer;background:${t.color};color:#000;border:1px solid #333;border-radius:2px;">${t.label}</button>`;
      }
      html += '</div>';
    }
    html += '<button data-action="close" style="font-family:var(--mc-font);font-size:6px;padding:3px 6px;background:#555;color:#fff;border:1px solid #333;cursor:pointer;margin-top:4px;align-self:flex-end;">Cancel</button>';
    popup.innerHTML = html;

    const fogToggle = popup.querySelector('[data-fog-toggle]') as HTMLInputElement | null;

    // Wire tag buttons
    popup.querySelectorAll('[data-tag]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tag = (btn as HTMLElement).getAttribute('data-tag') as MarkerTag;
        const revealOnFog = !!fogToggle?.checked;
        // reveal-on-fog markers use the fog gate for visibility, so they are NOT
        // admin-hidden. Regular admin placements stay hidden until manually revealed.
        const hidden = !revealOnFog;
        const { marker, incremented } = markerStore.add(geo, tag, undefined, undefined, hidden, revealOnFog);
        if (!incremented) {
          const label = MARKER_TAGS.find(t => t.tag === tag)?.label ?? tag;
          const suffix = revealOnFog ? ' (reveal on uncover)' : ' (hidden)';
          uiOverlay.showToast(`📌 Placed: ${label}${suffix}`);
        }
        popup.remove();
        updateMarkerPanel();
      });
    });

    popup.querySelector('[data-action="close"]')?.addEventListener('click', () => {
      popup.remove();
    });

    document.getElementById('app')!.appendChild(popup);
  }

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

  // Draw a player name label in Minecraft font, centered at (cx, cy), with a
  // dark rounded background so it reads over any terrain.
  const drawNameLabel = (name: string, cx: number, cy: number): void => {
    if (!ctx) return;
    ctx.save();
    ctx.font = '8px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const textW = ctx.measureText(name).width;
    const padX = 4;
    const boxW = textW + padX * 2;
    const boxH = 14;
    // Semi-transparent background (like Minecraft nameplates)
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(cx - boxW / 2, cy - boxH / 2, boxW, boxH);
    // White text
    ctx.fillStyle = '#ffffff';
    ctx.fillText(name, cx, cy + 0.5);
    ctx.restore();
  };

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
        // reveal-on-fog markers: hidden until their tile is uncovered.
        // Admins always see them (dimmed) so they can manage placement.
        if (marker.revealOnFog && !isAdminMode && !isMarkerFogRevealed(marker)) {
          continue;
        }

        const worldPos = geoToWorld(marker.position, bbox, level4Grid, TILE_SCREEN_SIZE);

        const screenX = (worldPos.x - viewLeft) * scale;
        const screenY = (worldPos.y - viewTop) * scale;

        // Draw marker icon (texture or fallback color square)
        const tagInfo = MARKER_TAGS.find((t) => t.tag === marker.tag);
        const markerImg = getMarkerImage(marker.tag);
        const isLocation = isLocationTag(marker.tag);

        // Location markers are larger and use a colored frame with a pin point.
        const slotSize = isLocation ? 44 : 32;
        const iconSize = isLocation ? 32 : 24;
        const slotX = screenX - slotSize / 2;
        const slotY = screenY - slotSize / 2;

        // Admin-only dimming for markers players can't see yet:
        //  - adminHidden: manually hidden (needs admin reveal)
        //  - adminFogPending: reveal-on-fog, tile not uncovered yet
        const adminHidden = !!(marker.hidden && isAdminMode);
        const adminFogPending = !!(marker.revealOnFog && isAdminMode && !isMarkerFogRevealed(marker));
        const isDimmed = adminHidden || adminFogPending;
        if (isDimmed) ctx!.globalAlpha = 0.45;

        if (isLocation) {
          // --- Location marker: colored map-pin banner ---
          const locColor = tagInfo?.color ?? '#FFAA00';
          // Downward pin point below the frame
          ctx!.fillStyle = locColor;
          ctx!.beginPath();
          ctx!.moveTo(screenX - 7, slotY + slotSize - 2);
          ctx!.lineTo(screenX + 7, slotY + slotSize - 2);
          ctx!.lineTo(screenX, slotY + slotSize + 9);
          ctx!.closePath();
          ctx!.fill();
          // Colored rounded frame background
          ctx!.fillStyle = locColor;
          ctx!.fillRect(slotX, slotY, slotSize, slotSize);
          // Dark inner panel so the icon reads clearly
          ctx!.fillStyle = '#2a2a2a';
          ctx!.fillRect(slotX + 4, slotY + 4, slotSize - 8, slotSize - 8);
          // Bright outer border (thicker than item slots)
          ctx!.strokeStyle = '#ffffff';
          ctx!.lineWidth = 3;
          ctx!.strokeRect(slotX + 1.5, slotY + 1.5, slotSize - 3, slotSize - 3);
        } else {
          // --- Item marker: gray inventory slot (unchanged) ---
          ctx!.fillStyle = '#8b8b8b';
          ctx!.fillRect(slotX, slotY, slotSize, slotSize);
          // Beveled border: dark top/left, light bottom/right
          ctx!.strokeStyle = '#555555';
          ctx!.lineWidth = 2;
          ctx!.beginPath();
          ctx!.moveTo(slotX, slotY + slotSize);
          ctx!.lineTo(slotX, slotY);
          ctx!.lineTo(slotX + slotSize, slotY);
          ctx!.stroke();
          ctx!.strokeStyle = '#ffffff';
          ctx!.beginPath();
          ctx!.moveTo(slotX + slotSize, slotY);
          ctx!.lineTo(slotX + slotSize, slotY + slotSize);
          ctx!.lineTo(slotX, slotY + slotSize);
          ctx!.stroke();
        }

        // Draw icon centered, preserving aspect ratio (like object-fit:contain)
        ctx!.imageSmoothingEnabled = false;
        if (markerImg) {
          const imgW = markerImg.naturalWidth || iconSize;
          const imgH = markerImg.naturalHeight || iconSize;
          const scale = Math.min(iconSize / imgW, iconSize / imgH);
          const drawW = imgW * scale;
          const drawH = imgH * scale;
          ctx!.drawImage(markerImg, screenX - drawW / 2, screenY - drawH / 2, drawW, drawH);
        } else {
          // Fallback: colored square
          const color = tagInfo?.color ?? '#FFFFFF';
          ctx!.fillStyle = color;
          ctx!.fillRect(screenX - iconSize / 2, screenY - iconSize / 2, iconSize, iconSize);
        }

        // Admin status badge (top-left corner) — no more red X.
        //   🙈 = manually hidden, 🌫️ = reveal-on-fog (waiting to be uncovered)
        if (isDimmed) {
          ctx!.globalAlpha = 1.0;
          const badge = adminFogPending ? '🌫️' : '🙈';
          ctx!.font = '13px sans-serif';
          ctx!.textAlign = 'center';
          ctx!.textBaseline = 'middle';
          const bx = slotX + 2;
          const by = slotY + 2;
          // dark chip behind the emoji for contrast
          ctx!.fillStyle = 'rgba(0,0,0,0.6)';
          ctx!.fillRect(bx - 8, by - 8, 16, 16);
          ctx!.fillText(badge, bx, by + 1);
        } else if (isAdminMode) {
          ctx!.globalAlpha = 1.0;
        }

        // Draw count badge if > 1
        if (marker.count > 1) {
          const text = String(marker.count);
          ctx!.font = 'bold 10px monospace';
          ctx!.fillStyle = '#FFFFFF';
          ctx!.strokeStyle = '#000000';
          ctx!.lineWidth = 2;
          const tx = screenX + slotSize / 2 - 2;
          const ty = screenY + slotSize / 2;
          ctx!.strokeText(text, tx, ty);
          ctx!.fillText(text, tx, ty);
        }

        // Location markers: draw the name label in Minecraft font to the right
        if (isLocation && tagInfo) {
          ctx!.save();
          ctx!.globalAlpha = isDimmed ? 0.55 : 1.0;
          ctx!.font = '8px "Press Start 2P", monospace';
          ctx!.textBaseline = 'middle';
          ctx!.textAlign = 'left';
          const labelX = slotX + slotSize + 4;
          const labelY = screenY;
          ctx!.lineWidth = 3;
          ctx!.strokeStyle = '#000000';
          ctx!.strokeText(tagInfo.label, labelX, labelY);
          ctx!.fillStyle = '#ffffff';
          ctx!.fillText(tagInfo.label, labelX, labelY);
          ctx!.restore();
        }
      }

      ctx!.restore();

      // Render other players' avatars (on top of everything)
      const vpScale = Math.pow(2, viewport.zoomLevel);
      const vpLeft = viewport.centerX - (viewport.screenWidth / vpScale) / 2;
      const vpTop = viewport.centerY - (viewport.screenHeight / vpScale) / 2;
      for (const op of otherPlayers) {
        const opWorld = geoToWorld(op.position, bbox, level4Grid, TILE_SCREEN_SIZE);
        let opScreenX = (opWorld.x - vpLeft) * vpScale;
        let opScreenY = (opWorld.y - vpTop) * vpScale;

        // Apply same rotation as the map if heading is active
        if (simHeading !== 0 && playerWorldPos) {
          const pivotX = (playerWorldPos.x - vpLeft) * vpScale;
          const pivotY = (playerWorldPos.y - vpTop) * vpScale;
          const angle = (-simHeading * Math.PI) / 180;
          const dx = opScreenX - pivotX;
          const dy = opScreenY - pivotY;
          opScreenX = pivotX + dx * Math.cos(angle) - dy * Math.sin(angle);
          opScreenY = pivotY + dx * Math.sin(angle) + dy * Math.cos(angle);
        }

        const skinKey = `player_${op.avatar}`;
        const entry = atlasManifest.textures[skinKey] ?? atlasManifest.textures['player'];
        const markerSize = 28;
        if (entry && atlasImage) {
          ctx!.save();
          ctx!.imageSmoothingEnabled = false;
          ctx!.translate(opScreenX, opScreenY);
          ctx!.drawImage(
            atlasImage,
            entry.x, entry.y, entry.w, entry.h,
            -markerSize / 2, -markerSize / 2, markerSize, markerSize
          );
          ctx!.restore();
        } else {
          ctx!.fillStyle = '#55FF55';
          ctx!.beginPath();
          ctx!.arc(opScreenX, opScreenY, 8, 0, Math.PI * 2);
          ctx!.fill();
        }

        // Name label under the avatar (Minecraft font)
        if (op.name) {
          drawNameLabel(op.name, opScreenX, opScreenY + markerSize / 2 + 8);
        }
      }

      // Local player's name under their own avatar.
      // The avatar sits at the rotation pivot (its own screen position), which
      // stays fixed under heading rotation, so no rotation math is needed here.
      if (playerName && playerWorldPos) {
        const meX = (playerWorldPos.x - vpLeft) * vpScale;
        const meY = (playerWorldPos.y - vpTop) * vpScale;
        drawNameLabel(playerName, meX, meY + 32 / 2 + 8);
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
