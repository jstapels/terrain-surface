import { MODULE_ID } from "./constants.js";
import { geometryCache, getBlockingRegions, segmentIntersectsBounds } from "./terrain.js";

/**
 * Extend the configured sight backend, preserving other modules' sweep subclasses.
 * All added edges and intersections belong to this polygon, never to scene walls.
 */
export function createTerrainPolygonClass(Base) {
  const { Edge, PolygonVertex } = foundry.canvas.geometry.edges;

  return class TerrainSurfacePolygon extends Base {
    terrainRegions = [];
    terrainMaskOnly = false;
    insideTerrain = false;
    terrainThresholdExpanded = false;

    initialize(origin, config) {
      this.terrainRegions = [];
      this.insideTerrain = false;
      this.terrainThresholdExpanded = false;
      super.initialize(origin, config);
      // Light, movement, sound, and sight tests without a token vision source stay native.
      if (config.type !== "sight" || !(config.source instanceof foundry.canvas.sources.PointVisionSource)
        || this._edgeTypes.wall.mode === 0) return;
      this.terrainRegions = getBlockingRegions(this.scene, this.level, this.origin.elevation);
      this.insideTerrain = this.terrainRegions.some(r => r.polygonTree.testPoint(this.origin));
    }

    _compute() {
      if (this.insideTerrain) {
        this.points = [];
        this.edges.clear();
        this.vertices.clear();
        this.rays = [];
        return;
      }
      super._compute();
    }

    _identifyEdges() {
      super._identifyEdges();
      // A second sweep, used only for exposure/threshold clipping, preserves the
      // terrain shadows without suppressing native exposure around ordinary walls.
      if (this.terrainMaskOnly) {
        for (const edge of this.edges) {
          if (edge.type !== "innerBounds" && edge.type !== "outerBounds") this.edges.delete(edge);
        }
      }
      let added = false;
      for (const region of this.terrainRegions) {
        const segments = geometryCache.get(region);
        for (const [index, segment] of segments.entries()) {
          if (!segmentIntersectsBounds(segment, this.config.boundingBox)) continue;
          const edge = new Edge(segment.a, segment.b, {
            id: `${MODULE_ID}:${region.id}:${index}`,
            type: "wall",
            sight: CONST.EDGE_SENSE_TYPES.NORMAL
          });
          if (!this._testEdgeInclusion(edge, this._edgeTypes)) continue;
          this.edges.add(edge);
          added = true;
        }
      }
      // Core supplies cloned edges. Rebuilding their intersection graph also catches
      // terrain/wall crossings and overlaps without mutating shared canvas geometry.
      if (added) Edge.identifyEdgeIntersections(this.edges, this.level.id);
    }

    _testCollision(ray, mode, destination, tMin, tMax) {
      if (this.insideTerrain && tMin < tMax) {
        if (mode === "any") return true;
        const contact = PolygonVertex.fromPoint({
          x: ray.A.x + ray.dx * tMin,
          y: ray.A.y + ray.dy * tMin
        }, { distance: tMin, round: false });
        return mode === "all" ? [contact] : contact;
      }
      return super._testCollision(ray, mode, destination, tMin, tMax);
    }

    static create(origin, config = {}) {
      const polygon = super.create(origin, config);
      if (!polygon.terrainRegions.length) return polygon;
      if (polygon.insideTerrain) {
        // Threshold attenuation can otherwise add area after _compute returns.
        polygon.points = [];
        polygon.bounds = polygon.getBounds();
        polygon.surfaceExposure = null;
        return polygon;
      }
      if (!polygon.surfaceExposure && !polygon.terrainThresholdExpanded) return polygon;
      const mask = new this();
      mask.terrainMaskOnly = true;
      mask.initialize(origin, { ...polygon.config, useThreshold: false });
      mask.compute();
      // Native proximity-wall attenuation must not union sight back across a cliff.
      if (polygon.terrainThresholdExpanded) {
        polygon.points = polygon.intersectPolygon(mask).points;
        polygon.bounds = polygon.getBounds();
      }
      if (polygon.surfaceExposure) {
        polygon.surfaceExposure = polygon.surfaceExposure.intersectPolygon(mask);
        if (polygon.surfaceExposure.isEmpty) polygon.surfaceExposure = null;
      }
      return polygon;
    }

    static applyThresholdAttenuation(polygon) {
      const points = polygon.points;
      const result = super.applyThresholdAttenuation(polygon);
      polygon.terrainThresholdExpanded = polygon.points !== points;
      return result;
    }
  };
}
