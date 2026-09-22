import { BEHAVIOR_TYPE } from "./constants.js";
import { geometryCache } from "./terrain.js";

export function refreshTerrain(scene = canvas?.scene, region) {
  geometryCache.invalidate(region);
  if (canvas?.ready && canvas.scene === scene) {
    canvas.perception.update({ initializeVision: true, refreshVision: true });
  }
}

/** Native data model and native generated behavior sheet; no injected form markup. */
export function registerTerrainBehavior() {
  class TerrainSurfaceBehavior extends foundry.data.regionBehaviors.RegionBehaviorType {
    static defineSchema() {
      return {};
    }

    static events = Object.fromEntries([
      CONST.REGION_EVENTS.BEHAVIOR_ACTIVATED,
      CONST.REGION_EVENTS.BEHAVIOR_DEACTIVATED,
      CONST.REGION_EVENTS.BEHAVIOR_VIEWED,
      CONST.REGION_EVENTS.BEHAVIOR_UNVIEWED,
      CONST.REGION_EVENTS.REGION_BOUNDARY,
      CONST.REGION_EVENTS.REGION_ANIMATION
    ].map(event => [event, function () { refreshTerrain(this.scene, this.region); }]));
  }

  CONFIG.RegionBehavior.dataModels[BEHAVIOR_TYPE] = TerrainSurfaceBehavior;
  CONFIG.RegionBehavior.typeLabels[BEHAVIOR_TYPE] = "TERRAIN_SURFACE.Behavior.Name";
  CONFIG.RegionBehavior.typeHints[BEHAVIOR_TYPE] = "TERRAIN_SURFACE.Behavior.Hint";
  CONFIG.RegionBehavior.typeIcons[BEHAVIOR_TYPE] = "fa-solid fa-mountain";

  for (const event of ["createRegionBehavior", "updateRegionBehavior", "deleteRegionBehavior"]) {
    Hooks.on(event, behavior => {
      if (behavior.type === "defineSurface" || behavior.type === BEHAVIOR_TYPE) {
        refreshTerrain(behavior.parent.parent, behavior.parent);
      }
    });
  }
  Hooks.on("canvasTearDown", () => geometryCache.invalidate());
}
