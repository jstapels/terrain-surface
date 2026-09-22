import assert from "node:assert/strict";
import test from "node:test";
import { BEHAVIOR_TYPE } from "../scripts/constants.js";
import { registerTerrainBehavior } from "../scripts/behavior.js";

test("native region and behavior changes refresh the viewed scene, including remote client updates", () => {
  const hooks = new Map();
  const calls = [];
  const scene = {};
  const region = { parent: scene };
  globalThis.foundry = { data: { regionBehaviors: { RegionBehaviorType: class {} } } };
  globalThis.CONFIG = { RegionBehavior: { dataModels: {}, typeLabels: {}, typeHints: {}, typeIcons: {} } };
  globalThis.CONST = { REGION_EVENTS: {
    BEHAVIOR_ACTIVATED: "behaviorActivated", BEHAVIOR_DEACTIVATED: "behaviorDeactivated",
    BEHAVIOR_VIEWED: "behaviorViewed", BEHAVIOR_UNVIEWED: "behaviorUnviewed",
    REGION_BOUNDARY: "regionBoundary", REGION_ANIMATION: "regionAnimation"
  } };
  globalThis.Hooks = { on: (name, callback) => hooks.set(name, callback) };
  globalThis.canvas = { ready: true, scene, perception: { update: data => calls.push(data) } };
  registerTerrainBehavior();
  const Model = globalThis.CONFIG.RegionBehavior.dataModels[BEHAVIOR_TYPE];
  for (const event of Object.values(globalThis.CONST.REGION_EVENTS)) {
    Model.events[event].call({ scene, region });
  }
  assert.equal(calls.length, 6);
  for (const hook of ["createRegionBehavior", "updateRegionBehavior", "deleteRegionBehavior"]) {
    hooks.get(hook)({ type: "defineSurface", parent: region });
    hooks.get(hook)({ type: BEHAVIOR_TYPE, parent: region });
    hooks.get(hook)({ type: "unrelated", parent: region });
  }
  assert.equal(calls.length, 12);
  assert.ok(calls.every(data => data.initializeVision && data.refreshVision));
  Model.events.regionBoundary.call({ scene: {}, region: {} });
  globalThis.canvas.ready = false;
  Model.events.behaviorViewed.call({ scene, region });
  assert.equal(calls.length, 12);
});
