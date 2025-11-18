/**
 * Viewport helper functions
 * Handles zoom, pan, and viewport calculations
 */

import type { CanvasViewport } from '../../../types/canvas';

/**
 * Zoom limits (from spec.md FR-002)
 */
export const MIN_ZOOM = 0.25; // 25%
export const MAX_ZOOM = 4.0; // 400%

/**
 * Clamp zoom level to valid range
 */
export function clampZoom(zoom: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
}

/**
 * Validate viewport data
 */
export function isValidViewport(viewport: Partial<CanvasViewport>): boolean {
  if (viewport.zoom !== undefined) {
    if (viewport.zoom < MIN_ZOOM || viewport.zoom > MAX_ZOOM) {
      return false;
    }
  }

  if (viewport.width !== undefined && viewport.width <= 0) {
    return false;
  }

  if (viewport.height !== undefined && viewport.height <= 0) {
    return false;
  }

  return true;
}

/**
 * Create default viewport
 */
export function createDefaultViewport(
  width: number = 1920,
  height: number = 1080
): CanvasViewport {
  return {
    zoom: 1.0,
    x: 0,
    y: 0,
    width,
    height,
  };
}

/**
 * Save viewport to localStorage
 */
export function saveViewportToLocalStorage(
  graphId: string,
  viewport: CanvasViewport
): void {
  try {
    const key = `mindflow-viewport-${graphId}`;
    localStorage.setItem(key, JSON.stringify(viewport));
  } catch (error) {
    console.error('Failed to save viewport to localStorage:', error);
  }
}

/**
 * Load viewport from localStorage
 */
export function loadViewportFromLocalStorage(
  graphId: string
): CanvasViewport | null {
  try {
    const key = `mindflow-viewport-${graphId}`;
    const stored = localStorage.getItem(key);

    if (stored) {
      const viewport = JSON.parse(stored) as CanvasViewport;
      if (isValidViewport(viewport)) {
        return viewport;
      }
    }
  } catch (error) {
    console.error('Failed to load viewport from localStorage:', error);
  }

  return null;
}

/**
 * Clear viewport from localStorage
 */
export function clearViewportFromLocalStorage(graphId: string): void {
  try {
    const key = `mindflow-viewport-${graphId}`;
    localStorage.removeItem(key);
  } catch (error) {
    console.error('Failed to clear viewport from localStorage:', error);
  }
}

/**
 * Calculate zoom increment (10% of current zoom)
 */
export function calculateZoomIncrement(currentZoom: number): number {
  return currentZoom * 0.1;
}

/**
 * Zoom in
 */
export function zoomIn(currentZoom: number): number {
  const increment = calculateZoomIncrement(currentZoom);
  return clampZoom(currentZoom + increment);
}

/**
 * Zoom out
 */
export function zoomOut(currentZoom: number): number {
  const increment = calculateZoomIncrement(currentZoom);
  return clampZoom(currentZoom - increment);
}

/**
 * Reset zoom to 100%
 */
export function resetZoom(): number {
  return 1.0;
}

/**
 * Check if point is within viewport bounds
 */
export function isPointInViewport(
  point: { x: number; y: number },
  viewport: CanvasViewport
): boolean {
  return (
    point.x >= viewport.x &&
    point.x <= viewport.x + viewport.width / viewport.zoom &&
    point.y >= viewport.y &&
    point.y <= viewport.y + viewport.height / viewport.zoom
  );
}

/**
 * Check if rectangle is within viewport bounds (for viewport culling)
 */
export function isRectInViewport(
  rect: { x: number; y: number; width: number; height: number },
  viewport: CanvasViewport
): boolean {
  const viewportRight = viewport.x + viewport.width / viewport.zoom;
  const viewportBottom = viewport.y + viewport.height / viewport.zoom;
  const rectRight = rect.x + rect.width;
  const rectBottom = rect.y + rect.height;

  return !(
    rectRight < viewport.x ||
    rect.x > viewportRight ||
    rectBottom < viewport.y ||
    rect.y > viewportBottom
  );
}

/**
 * Format zoom percentage for display
 */
export function formatZoomPercentage(zoom: number): string {
  return `${Math.round(zoom * 100)}%`;
}
