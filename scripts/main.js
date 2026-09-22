import { BEHAVIOR_TYPE, MODULE_ID } from "./constants.js";
import { refreshTerrain, registerTerrainBehavior } from "./behavior.js";
import { createTerrainPolygonClass } from "./vision.js";
import { getBlockingRegions } from "./terrain.js";

let terrainBackend;

Hooks.once("init", () => {
  registerTerrainBehavior();
  game.modules.get(MODULE_ID).api = Object.freeze({
    behaviorType: BEHAVIOR_TYPE,
    refresh: refreshTerrain,
    getBlockingRegions: (source) => getBlockingRegions(source.level.parent, source.level, source.elevation)
  });
});

Hooks.once("setup", () => {
  const Base = CONFIG.Canvas.polygonBackends.sight;
  const Sweep = foundry.canvas.geometry.ClockwiseSweepPolygon;
  if (Base !== Sweep && !(Base.prototype instanceof Sweep)) return;
  terrainBackend = createTerrainPolygonClass(Base);
  CONFIG.Canvas.polygonBackends.sight = terrainBackend;
});

Hooks.once("ready", () => {
  const active = CONFIG.Canvas.polygonBackends.sight;
  if (!terrainBackend || (active !== terrainBackend && !(active.prototype instanceof terrainBackend))) {
    console.error("Terrain Surface | Another module uses an incompatible sight polygon backend.");
    if (game.user.isGM) ui.notifications.error(game.i18n.localize("TERRAIN_SURFACE.Errors.Backend"), { permanent: true });
  }
});
