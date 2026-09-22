import assert from "node:assert/strict";
import test from "node:test";
import { BEHAVIOR_TYPE } from "../scripts/constants.js";
import { getBlockingRegions, polygonSegments, segmentIntersectsBounds, TerrainGeometryCache } from "../scripts/terrain.js";

const rectangle = { points: [0, 0, 100, 0, 100, 100, 0, 100] };
const marker = () => ({ type: BEHAVIOR_TYPE, active: true });

test("terraces block only below their surfaces, with negative and fractional elevations", () => {
  const regions = [-10, 0, 10.5, 20].map(top => ({ id: String(top), behaviors: [marker()], top }));
  const scene = { getSurfaces: () => regions.map(region => ({ region, elevation: region.top })) };
  assert.deepEqual(getBlockingRegions(scene, "ground", 10.5), [regions[3]]);
  assert.deepEqual(getBlockingRegions(scene, "ground", -10), regions.slice(1));
  assert.deepEqual(getBlockingRegions(scene, "ground", 20), []);
});

test("honors native surface filters, excludes unmarked/hidden/disabled regions and unbounded surfaces", () => {
  const good = { behaviors: [marker()] };
  const disabled = { behaviors: [{ type: BEHAVIOR_TYPE, active: false }] };
  const hidden = { hidden: true, behaviors: [marker()] };
  const scene = { getSurfaces: filter => {
    assert.deepEqual(filter, { type: "sight", level: "level-a" });
    return [
      { region: good, elevation: 10 }, { region: good, elevation: 20 },
      { region: hidden, elevation: 20 }, { region: disabled, elevation: 20 },
      { region: { behaviors: [] }, elevation: 20 },
      { region: { behaviors: [marker()] }, elevation: Infinity }
    ];
  } };
  assert.deepEqual(getBlockingRegions(scene, "level-a", 0), [good]);
  assert.deepEqual(getBlockingRegions(scene, "level-a", NaN), []);
});

test("keeps holes, disconnected contours, and closes each contour without zero-length edges", () => {
  const hole = { points: [25, 25, 25, 75, 75, 75, 75, 25, 25, 25] };
  const segments = polygonSegments([rectangle, hole]);
  assert.equal(segments.length, 8);
  assert.deepEqual(segments[3], { a: { x: 0, y: 100 }, b: { x: 0, y: 0 } });
  assert.deepEqual(segments[7], { a: { x: 75, y: 25 }, b: { x: 25, y: 25 } });
  assert.equal(polygonSegments([{ points: [0, 0, Infinity, 5, 6, 9] }]).length, 0);
  assert.equal(polygonSegments([{ points: [0, 0, 1, 1, 2] }]).length, 0);
});

test("spatial filtering retains horizontal/vertical edges on the viewport boundary", () => {
  const bounds = { left: 0, right: 100, top: 0, bottom: 100 };
  assert.ok(polygonSegments([rectangle]).every(segment => segmentIntersectsBounds(segment, bounds)));
  assert.equal(segmentIntersectsBounds({ a: { x: 101, y: 0 }, b: { x: 101, y: 99 } }, bounds), false);
});

test("cache follows replacement geometry and never modifies Foundry's polygons", () => {
  const cache = new TerrainGeometryCache();
  const region = { polygons: Object.freeze([Object.freeze({ points: Object.freeze([...rectangle.points]) })]) };
  const old = cache.get(region);
  assert.equal(cache.get(region), old);
  region.polygons = [{ points: [0, 0, 25, 0, 0, 25] }];
  assert.equal(cache.get(region).length, 3);
  assert.notEqual(cache.get(region), old);
  const current = cache.get(region);
  cache.invalidate(region);
  assert.notEqual(cache.get(region), current);
});
