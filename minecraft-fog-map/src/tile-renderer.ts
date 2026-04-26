// ============================================================
// Tile Renderer — renders visible map tiles to canvas
// Minecraft Fog Map
// ============================================================

import type {
  AtlasEntry,
  TerrainData,
  TerrainType,
  TextureAtlasManifest,
  ViewportState,
  WorldPosition,
} from './types';

/** Single-character terrain code → TerrainType mapping */
const CHAR_TO_TERRAIN: Record<string, TerrainType> = {
  g: 'grass',
  f: 'forest',
  w: 'water',
  p: 'path',
  r: 'road',
  b: 'building',
  s: 'sand',
};

/**
 * Minecraft map flat colors per terrain type.
 */
const MAP_COLORS: Record<TerrainType, string> = {
  grass: '#7FB238',
  forest: '#007C00',
  water: '#4040FF',
  path: '#976D4D',     // dirt — footpaths/trails
  road: '#707070',     // stone/cobblestone — roads
  building: '#909090',
  sand: '#F7E9A3',
};

/** Base tile size in world-space pixels (level-4 grid, 1 tile = 32 world px) */
export const TILE_SCREEN_SIZE = 32;

/**
 * Visible tile range returned by viewport culling.
 * All values are inclusive grid indices clamped to [0, gridSize-1].
 */
export interface VisibleTileRange {
  minCol: number;
  maxCol: number;
  minRow: number;
  maxRow: number;
}

/**
 * Pure function: compute the visible level-4 tile range for a viewport.
 * Includes a 1-tile buffer around the visible area.
 *
 * The viewport uses continuous zoom where zoomLevel is a float.
 * scale = 2^zoomLevel maps world pixels to screen pixels.
 * At zoomLevel 0, 1 world px = 1 screen px (most zoomed out).
 * At zoomLevel 4, 1 world px = 16 screen px (most zoomed in).
 */
export function getVisibleTileRange(
  viewport: ViewportState,
  gridSize: { cols: number; rows: number },
  tileWorldSize: number
): VisibleTileRange {
  const scale = Math.pow(2, viewport.zoomLevel);

  // Viewport extent in world pixels
  const halfW = (viewport.screenWidth / scale) / 2;
  const halfH = (viewport.screenHeight / scale) / 2;

  const left = viewport.centerX - halfW;
  const top = viewport.centerY - halfH;
  const right = viewport.centerX + halfW;
  const bottom = viewport.centerY + halfH;

  const minCol = Math.max(0, Math.floor(left / tileWorldSize) - 1);
  const maxCol = Math.min(gridSize.cols - 1, Math.floor(right / tileWorldSize) + 1);
  const minRow = Math.max(0, Math.floor(top / tileWorldSize) - 1);
  const maxRow = Math.min(gridSize.rows - 1, Math.floor(bottom / tileWorldSize) + 1);

  return { minCol, maxCol, minRow, maxRow };
}

/**
 * TileRenderer implementation.
 * Always renders from the level-4 (finest) terrain grid.
 * Zoom is continuous — tiles are scaled by 2^zoomLevel.
 */
export class TileRenderer {
  private terrainData: TerrainData | null = null;
  private atlas: HTMLImageElement | null = null;
  private atlasManifest: TextureAtlasManifest | null = null;
  private terrainAtlas: Map<TerrainType, AtlasEntry> = new Map();
  private fogEntry: AtlasEntry | null = null;
  private playerEntry: AtlasEntry | null = null;
  private mapBgImage: HTMLImageElement | null = null;

  init(
    terrainData: TerrainData,
    textureAtlas: HTMLImageElement,
    atlasManifest: TextureAtlasManifest
  ): void {
    this.terrainData = terrainData;
    this.atlas = textureAtlas;
    this.atlasManifest = atlasManifest;

    const terrainTypes: TerrainType[] = ['grass', 'forest', 'water', 'path', 'building', 'sand'];
    for (const t of terrainTypes) {
      const entry = atlasManifest.textures[t];
      if (entry) this.terrainAtlas.set(t, entry);
    }

    this.fogEntry = atlasManifest.textures['fog'] ?? null;
    this.playerEntry = atlasManifest.textures['player'] ?? null;

    // Load map background texture (torn paper border)
    const bgImg = new Image();
    bgImg.onload = () => { this.mapBgImage = bgImg; };
    bgImg.src = `${import.meta.env.BASE_URL}map-background.png`;
  }

  /**
   * Render the current frame.
   * Renders terrain from the selected mapLevel's grid directly.
   * Each pixel on the map represents that level's meters-per-tile.
   * Fog is always at level-4 (finest) granularity.
   */
  render(
    ctx: CanvasRenderingContext2D,
    viewport: ViewportState,
    mapLevel: number,
    isLevel4Revealed: (col: number, row: number) => boolean,
    playerPos: WorldPosition | null,
    playerHeading = 0,
    mapSizeFraction = 1.0
  ): void {
    if (!this.terrainData || !this.atlas) return;

    const zoomData = this.terrainData.zoomLevels.find((zl) => zl.level === mapLevel);
    if (!zoomData) return;

    const level4Data = this.terrainData.zoomLevels.find((zl) => zl.level === 4);
    const level4Cols = level4Data ? level4Data.cols : 256;
    const level4Rows = level4Data ? level4Data.rows : 256;

    const fullGridCols = zoomData.cols;
    const fullGridRows = zoomData.rows;

    // Clip to center portion based on map size fraction
    const clipCols = Math.round(fullGridCols * mapSizeFraction);
    const clipRows = Math.round(fullGridRows * mapSizeFraction);
    const clipColStart = Math.floor((fullGridCols - clipCols) / 2);
    const clipRowStart = Math.floor((fullGridRows - clipRows) / 2);

    // Level-4 clip bounds
    const l4ClipCols = Math.round(level4Cols * mapSizeFraction);
    const l4ClipRows = Math.round(level4Rows * mapSizeFraction);
    const l4ClipColStart = Math.floor((level4Cols - l4ClipCols) / 2);
    const l4ClipRowStart = Math.floor((level4Rows - l4ClipRows) / 2);

    const tileWorldSize = TILE_SCREEN_SIZE * Math.pow(2, 4 - mapLevel);
    const scale = Math.pow(2, viewport.zoomLevel);
    const tileScreenPx = tileWorldSize * scale;
    const subTilesPerAxis = Math.round(Math.pow(2, 4 - mapLevel));
    const subTileScreenPx = TILE_SCREEN_SIZE * scale;

    // World offset for the clipped area
    const clipWorldOffsetX = clipColStart * tileWorldSize;
    const clipWorldOffsetY = clipRowStart * tileWorldSize;

    const viewLeft = viewport.centerX - (viewport.screenWidth / scale) / 2;
    const viewTop = viewport.centerY - (viewport.screenHeight / scale) / 2;

    // 1. Black background
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, viewport.screenWidth, viewport.screenHeight);

    // 2. Draw map background texture sized to the clipped area
    if (this.mapBgImage) {
      const borderFrac = 3 / 64;
      const clipWorldW = clipCols * tileWorldSize;
      const clipWorldH = clipRows * tileWorldSize;
      const mapScreenW = clipWorldW * scale;
      const mapScreenH = clipWorldH * scale;
      const mapScreenL = (clipWorldOffsetX - viewLeft) * scale;
      const mapScreenT = (clipWorldOffsetY - viewTop) * scale;
      const bw = mapScreenW * borderFrac / (1 - 2 * borderFrac);
      const bh = mapScreenH * borderFrac / (1 - 2 * borderFrac);

      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(
        this.mapBgImage,
        mapScreenL - bw, mapScreenT - bh,
        mapScreenW + 2 * bw, mapScreenH + 2 * bh
      );
    }

    ctx.save();
    ctx.imageSmoothingEnabled = false;

    // Rotate around the player position (or screen center if no player)
    if (playerHeading !== 0) {
      let pivotX = viewport.screenWidth / 2;
      let pivotY = viewport.screenHeight / 2;
      if (playerPos) {
        pivotX = (playerPos.x - viewLeft) * scale;
        pivotY = (playerPos.y - viewTop) * scale;
      }
      ctx.translate(pivotX, pivotY);
      ctx.rotate((-playerHeading * Math.PI) / 180);
      ctx.translate(-pivotX, -pivotY);
    }

    // Expand tile range to cover rotated view (render extra tiles around edges)
    const extraTiles = playerHeading !== 0 ? Math.ceil(Math.max(viewport.screenWidth, viewport.screenHeight) / tileScreenPx / 2) : 0;
    const range = getVisibleTileRange(viewport, { cols: fullGridCols, rows: fullGridRows }, tileWorldSize);
    // Clamp to clipped area
    range.minCol = Math.max(clipColStart, range.minCol - extraTiles);
    range.maxCol = Math.min(clipColStart + clipCols - 1, range.maxCol + extraTiles);
    range.minRow = Math.max(clipRowStart, range.minRow - extraTiles);
    range.maxRow = Math.min(clipRowStart + clipRows - 1, range.maxRow + extraTiles);
    range.minCol = Math.max(0, range.minCol - extraTiles);
    range.maxCol = Math.min(gridCols - 1, range.maxCol + extraTiles);
    range.minRow = Math.max(0, range.minRow - extraTiles);
    range.maxRow = Math.min(gridRows - 1, range.maxRow + extraTiles);

    for (let row = range.minRow; row <= range.maxRow; row++) {
      for (let col = range.minCol; col <= range.maxCol; col++) {
        const screenX = (col * tileWorldSize - viewLeft) * scale;
        const screenY = (row * tileWorldSize - viewTop) * scale;

        const gridRow = zoomData.grid[row];
        if (!gridRow) continue;
        const charCode = gridRow[col] as string;
        const terrainType = CHAR_TO_TERRAIN[charCode] ?? 'grass';

        // Only draw terrain for revealed tiles — unrevealed stays as paper background
        const l4ColStart = col * subTilesPerAxis;
        const l4RowStart = row * subTilesPerAxis;

        // Check if ANY level-4 sub-tile in this coarse tile is revealed
        let anyRevealed = false;
        for (let sr = 0; sr < subTilesPerAxis && !anyRevealed; sr++) {
          for (let sc = 0; sc < subTilesPerAxis && !anyRevealed; sc++) {
            const l4Col = l4ColStart + sc;
            const l4Row = l4RowStart + sr;
            if (l4Col < level4Cols && l4Row < level4Rows && isLevel4Revealed(l4Col, l4Row)) {
              anyRevealed = true;
            }
          }
        }

        if (!anyRevealed) continue; // Skip entirely — paper shows through

        ctx.fillStyle = MAP_COLORS[terrainType] ?? MAP_COLORS.grass;
        ctx.fillRect(screenX, screenY, tileScreenPx, tileScreenPx);

        // Elevation shading
        if (zoomData.shading) {
          const shadingRow = zoomData.shading[row];
          if (shadingRow) {
            const shade = shadingRow[col] ?? 0.86;
            if (shade < 1.0) {
              ctx.fillStyle = '#000000';
              ctx.globalAlpha = 1.0 - shade;
              ctx.fillRect(screenX, screenY, tileScreenPx, tileScreenPx);
              ctx.globalAlpha = 1.0;
            }
          }
        }

        // Cover unrevealed sub-tiles with paper color for partial reveals
        for (let sr = 0; sr < subTilesPerAxis; sr++) {
          for (let sc = 0; sc < subTilesPerAxis; sc++) {
            const l4Col = l4ColStart + sc;
            const l4Row = l4RowStart + sr;
            if (l4Col >= level4Cols || l4Row >= level4Rows) continue;

            if (!isLevel4Revealed(l4Col, l4Row)) {
              const subX = screenX + sc * subTileScreenPx;
              const subY = screenY + sr * subTileScreenPx;
              ctx.fillStyle = '#D6BE96';
              ctx.fillRect(subX, subY, subTileScreenPx, subTileScreenPx);
            }
          }
        }
      }
    }

    // Player marker (rotated to face heading direction)
    if (playerPos && this.playerEntry && this.atlas) {
      const markerSize = 32;
      const px = (playerPos.x - viewLeft) * scale;
      const py = (playerPos.y - viewTop) * scale;

      ctx.save();
      ctx.translate(px, py);
      // Counter-rotate so the face stays upright relative to the heading
      ctx.rotate((playerHeading * Math.PI) / 180);
      ctx.drawImage(
        this.atlas,
        this.playerEntry.x, this.playerEntry.y, this.playerEntry.w, this.playerEntry.h,
        -markerSize / 2, -markerSize / 2, markerSize, markerSize
      );
      ctx.restore();
    }

    ctx.restore();
  }
}
