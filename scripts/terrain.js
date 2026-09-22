import { BEHAVIOR_TYPE } from "./constants.js";

/** Select each marked region once, using Foundry's resolved, level-filtered surfaces. */
export function getBlockingRegions(scene, level, elevation) {
  if (!Number.isFinite(elevation)) return [];
  const regions = new Set();
  for (const surface of scene.getSurfaces({ type: "sight", level })) {
    if (!Number.isFinite(surface.elevation) || elevation >= surface.elevation) continue;
    const region = surface.region;
    if (region.hidden || !region.behaviors.some(b => b.type === BEHAVIOR_TYPE && b.active)) continue;
    regions.add(region);
  }
  return [...regions];
}

/** Convert Foundry's already-unioned polygons, including hole contours, to segments. */
export function polygonSegments(polygons) {
  const segments = [];
  for (const { points } of polygons) {
    if (points.length < 6 || points.length % 2 || !points.every(Number.isFinite)) continue;
    for (let i = 0; i < points.length; i += 2) {
      const j = (i + 2) % points.length;
      const a = { x: points[i], y: points[i + 1] };
      const b = { x: points[j], y: points[j + 1] };
      if (a.x === b.x && a.y === b.y) continue;
      segments.push({ a, b });
    }
  }
  return segments;
}

/** Inclusive overlap: horizontal and vertical segments have zero-area bounds. */
export function segmentIntersectsBounds({ a, b }, bounds) {
  return Math.max(a.x, b.x) >= bounds.left && Math.min(a.x, b.x) <= bounds.right
    && Math.max(a.y, b.y) >= bounds.top && Math.min(a.y, b.y) <= bounds.bottom;
}

/** The immutable polygon array changes whenever Foundry rebuilds region geometry. */
export class TerrainGeometryCache {
  #regions = new WeakMap();

  get(region) {
    const polygons = region.polygons;
    let cached = this.#regions.get(region);
    if (cached?.polygons !== polygons) {
      cached = { polygons, segments: polygonSegments(polygons) };
      this.#regions.set(region, cached);
    }
    return cached.segments;
  }

  invalidate(region) {
    if (region) this.#regions.delete(region);
    else this.#regions = new WeakMap();
  }
}

export const geometryCache = new TerrainGeometryCache();
