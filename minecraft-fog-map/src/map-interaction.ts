// ============================================================
// Map Interaction — pan and zoom handling for touch and mouse
// Minecraft Fog Map
// ============================================================

import type { BoundingBox, GeoPosition, ViewportState } from './types';
import { geoToWorld } from './coords';
import { TILE_SCREEN_SIZE } from './tile-renderer';

/** Configuration for MapInteraction */
export interface MapInteractionConfig {
  boundingBox: BoundingBox;
  /** Level-4 grid dimensions (finest zoom) */
  level4GridSize: { cols: number; rows: number };
  /** Initial viewport state */
  initialViewport: ViewportState;
}

/** Min continuous zoom level (no max — zoom out as far as you want) */
const MIN_ZOOM = -5;

/**
 * Pure function: clamp a viewport center to stay within world bounds.
 */
export function clampViewportCenter(
  centerX: number,
  centerY: number,
  worldWidth: number,
  worldHeight: number
): { x: number; y: number } {
  return {
    x: Math.max(0, Math.min(centerX, worldWidth)),
    y: Math.max(0, Math.min(centerY, worldHeight)),
  };
}

const MOMENTUM_FRICTION = 0.92;
const MOMENTUM_MIN_VELOCITY = 0.5;
const CENTER_ANIMATION_DURATION = 400;

export class MapInteraction {
  private viewport: ViewportState;
  private config: MapInteractionConfig;
  private canvas: HTMLCanvasElement | null = null;

  private worldWidth: number;
  private worldHeight: number;

  // Pan state
  private isPanning = false;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private velocityX = 0;
  private velocityY = 0;
  private lastMoveTime = 0;
  private momentumRafId: number | null = null;

  // Pinch zoom state
  private isPinching = false;
  private initialPinchDistance = 0;
  private pinchStartZoom = 0;

  // CenterOn animation
  private animationRafId: number | null = null;

  private boundHandlers: Record<string, EventListener> = {};

  constructor(config: MapInteractionConfig) {
    this.config = config;
    this.viewport = { ...config.initialViewport };
    this.worldWidth = config.level4GridSize.cols * TILE_SCREEN_SIZE;
    this.worldHeight = config.level4GridSize.rows * TILE_SCREEN_SIZE;
  }

  attach(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;

    this.boundHandlers['touchstart'] = this.onTouchStart.bind(this) as EventListener;
    this.boundHandlers['touchmove'] = this.onTouchMove.bind(this) as EventListener;
    this.boundHandlers['touchend'] = this.onTouchEnd.bind(this) as EventListener;
    this.boundHandlers['touchcancel'] = this.onTouchEnd.bind(this) as EventListener;
    this.boundHandlers['mousedown'] = this.onMouseDown.bind(this) as EventListener;
    this.boundHandlers['mousemove'] = this.onMouseMove.bind(this) as EventListener;
    this.boundHandlers['mouseup'] = this.onMouseUp.bind(this) as EventListener;
    this.boundHandlers['mouseleave'] = this.onMouseUp.bind(this) as EventListener;
    this.boundHandlers['wheel'] = this.onWheel.bind(this) as EventListener;

    canvas.addEventListener('touchstart', this.boundHandlers['touchstart'], { passive: false });
    canvas.addEventListener('touchmove', this.boundHandlers['touchmove'], { passive: false });
    canvas.addEventListener('touchend', this.boundHandlers['touchend']);
    canvas.addEventListener('touchcancel', this.boundHandlers['touchcancel']);
    canvas.addEventListener('mousedown', this.boundHandlers['mousedown']);
    canvas.addEventListener('mousemove', this.boundHandlers['mousemove']);
    canvas.addEventListener('mouseup', this.boundHandlers['mouseup']);
    canvas.addEventListener('mouseleave', this.boundHandlers['mouseleave']);
    canvas.addEventListener('wheel', this.boundHandlers['wheel'], { passive: false });
  }

  getViewport(): ViewportState {
    return { ...this.viewport };
  }

  setScreenSize(width: number, height: number): void {
    this.viewport.screenWidth = width;
    this.viewport.screenHeight = height;
  }

  centerOn(position: GeoPosition, animate = true): void {
    const target = geoToWorld(
      position,
      this.config.boundingBox,
      this.config.level4GridSize,
      TILE_SCREEN_SIZE
    );
    const clamped = clampViewportCenter(target.x, target.y, this.worldWidth, this.worldHeight);

    if (!animate) {
      this.viewport.centerX = clamped.x;
      this.viewport.centerY = clamped.y;
      return;
    }

    this.stopMomentum();
    this.stopAnimation();

    const startX = this.viewport.centerX;
    const startY = this.viewport.centerY;
    const startTime = performance.now();

    const step = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / CENTER_ANIMATION_DURATION, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      this.viewport.centerX = startX + (clamped.x - startX) * ease;
      this.viewport.centerY = startY + (clamped.y - startY) * ease;
      if (t < 1) {
        this.animationRafId = requestAnimationFrame(step);
      } else {
        this.animationRafId = null;
      }
    };
    this.animationRafId = requestAnimationFrame(step);
  }

  clampToBounds(): void {
    const clamped = clampViewportCenter(
      this.viewport.centerX, this.viewport.centerY,
      this.worldWidth, this.worldHeight
    );
    this.viewport.centerX = clamped.x;
    this.viewport.centerY = clamped.y;
  }

  /** Set zoom level programmatically (continuous float) */
  setZoomLevel(level: number): void {
    this.stopAnimation();
    this.viewport.zoomLevel = Math.max(MIN_ZOOM, level);
  }

  // Tap detection
  private touchStartX = 0;
  private touchStartY = 0;
  private touchStartTime = 0;
  /** Callback for tap events (touch equivalent of click) */
  onTap: ((screenX: number, screenY: number) => void) | null = null;

  // --- Touch ---

  private onTouchStart(e: TouchEvent): void {
    e.preventDefault();
    this.stopMomentum();
    this.stopAnimation();

    if (e.touches.length === 1) {
      this.isPanning = true;
      this.isPinching = false;
      this.lastPointerX = e.touches[0].clientX;
      this.lastPointerY = e.touches[0].clientY;
      this.touchStartX = e.touches[0].clientX;
      this.touchStartY = e.touches[0].clientY;
      this.touchStartTime = performance.now();
      this.velocityX = 0;
      this.velocityY = 0;
      this.lastMoveTime = performance.now();
    } else if (e.touches.length === 2) {
      this.isPanning = false;
      this.isPinching = true;
      this.initialPinchDistance = this.getPinchDistance(e.touches);
      this.pinchStartZoom = this.viewport.zoomLevel;
    }
  }

  private onTouchMove(e: TouchEvent): void {
    e.preventDefault();

    if (this.isPanning && e.touches.length === 1) {
      const touch = e.touches[0];
      const dx = touch.clientX - this.lastPointerX;
      const dy = touch.clientY - this.lastPointerY;
      const now = performance.now();
      const dt = now - this.lastMoveTime;

      // Convert screen-space drag to world-space movement
      const scale = Math.pow(2, this.viewport.zoomLevel);
      this.viewport.centerX -= dx / scale;
      this.viewport.centerY -= dy / scale;
      this.clampToBounds();

      if (dt > 0) {
        this.velocityX = -(dx / scale) / (dt / 16);
        this.velocityY = -(dy / scale) / (dt / 16);
      }

      this.lastPointerX = touch.clientX;
      this.lastPointerY = touch.clientY;
      this.lastMoveTime = now;
    } else if (this.isPinching && e.touches.length === 2) {
      const dist = this.getPinchDistance(e.touches);
      const ratio = dist / this.initialPinchDistance;
      // Continuous zoom: log2(ratio) gives smooth zoom delta
      this.viewport.zoomLevel = Math.max(
        MIN_ZOOM,
        this.pinchStartZoom + Math.log2(ratio)
      );
    }
  }

  private onTouchEnd(e: TouchEvent): void {
    if (this.isPinching) {
      this.isPinching = false;
    }
    if (this.isPanning && e.touches.length === 0) {
      this.isPanning = false;

      // Detect tap: short duration + minimal movement
      const dt = performance.now() - this.touchStartTime;
      const dx = Math.abs(this.lastPointerX - this.touchStartX);
      const dy = Math.abs(this.lastPointerY - this.touchStartY);

      if (dt < 300 && dx < 10 && dy < 10 && this.onTap) {
        this.onTap(this.touchStartX, this.touchStartY);
      } else {
        this.startMomentum();
      }
    }
  }

  // --- Mouse ---

  private onMouseDown(e: MouseEvent): void {
    this.stopMomentum();
    this.stopAnimation();
    this.isPanning = true;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;
    this.velocityX = 0;
    this.velocityY = 0;
    this.lastMoveTime = performance.now();
  }

  private onMouseMove(e: MouseEvent): void {
    if (!this.isPanning) return;

    const dx = e.clientX - this.lastPointerX;
    const dy = e.clientY - this.lastPointerY;
    const now = performance.now();
    const dt = now - this.lastMoveTime;

    const scale = Math.pow(2, this.viewport.zoomLevel);
    this.viewport.centerX -= dx / scale;
    this.viewport.centerY -= dy / scale;
    this.clampToBounds();

    if (dt > 0) {
      this.velocityX = -(dx / scale) / (dt / 16);
      this.velocityY = -(dy / scale) / (dt / 16);
    }

    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;
    this.lastMoveTime = now;
  }

  private onMouseUp(_e: MouseEvent): void {
    if (!this.isPanning) return;
    this.isPanning = false;
    this.startMomentum();
  }

  private onWheel(e: WheelEvent): void {
    e.preventDefault();
    this.stopMomentum();
    this.stopAnimation();

    const delta = e.deltaY > 0 ? -0.15 : 0.15;
    const oldZoom = this.viewport.zoomLevel;
    const newZoom = Math.max(MIN_ZOOM, oldZoom + delta);

    // Zoom toward the mouse cursor position (like Google Maps)
    // Convert mouse screen position to world position at old zoom
    const oldScale = Math.pow(2, oldZoom);
    const newScale = Math.pow(2, newZoom);

    const rect = this.canvas?.getBoundingClientRect();
    if (rect) {
      const mouseScreenX = e.clientX - rect.left;
      const mouseScreenY = e.clientY - rect.top;

      // Mouse position in world coords (at old zoom)
      const mouseWorldX = this.viewport.centerX + (mouseScreenX - this.viewport.screenWidth / 2) / oldScale;
      const mouseWorldY = this.viewport.centerY + (mouseScreenY - this.viewport.screenHeight / 2) / oldScale;

      // Adjust center so the world point under the cursor stays at the same screen position
      this.viewport.centerX = mouseWorldX - (mouseScreenX - this.viewport.screenWidth / 2) / newScale;
      this.viewport.centerY = mouseWorldY - (mouseScreenY - this.viewport.screenHeight / 2) / newScale;
      this.clampToBounds();
    }

    this.viewport.zoomLevel = newZoom;
  }

  // --- Momentum ---

  private startMomentum(): void {
    if (Math.abs(this.velocityX) < MOMENTUM_MIN_VELOCITY &&
        Math.abs(this.velocityY) < MOMENTUM_MIN_VELOCITY) return;

    const tick = () => {
      this.velocityX *= MOMENTUM_FRICTION;
      this.velocityY *= MOMENTUM_FRICTION;

      if (Math.abs(this.velocityX) < MOMENTUM_MIN_VELOCITY &&
          Math.abs(this.velocityY) < MOMENTUM_MIN_VELOCITY) {
        this.momentumRafId = null;
        return;
      }

      this.viewport.centerX += this.velocityX;
      this.viewport.centerY += this.velocityY;
      this.clampToBounds();
      this.momentumRafId = requestAnimationFrame(tick);
    };
    this.momentumRafId = requestAnimationFrame(tick);
  }

  private stopMomentum(): void {
    if (this.momentumRafId !== null) {
      cancelAnimationFrame(this.momentumRafId);
      this.momentumRafId = null;
    }
    this.velocityX = 0;
    this.velocityY = 0;
  }

  private stopAnimation(): void {
    if (this.animationRafId !== null) {
      cancelAnimationFrame(this.animationRafId);
      this.animationRafId = null;
    }
  }

  private getPinchDistance(touches: TouchList): number {
    const dx = touches[1].clientX - touches[0].clientX;
    const dy = touches[1].clientY - touches[0].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }
}
