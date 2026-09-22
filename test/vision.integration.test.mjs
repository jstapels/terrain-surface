import assert from "node:assert/strict";
import test from "node:test";
import { BEHAVIOR_TYPE } from "../scripts/constants.js";
import { createTerrainPolygonClass } from "../scripts/vision.js";
import { loadFoundryGeometry } from "./helpers/foundry-runtime.mjs";

const path = process.env.FOUNDRY_CLIENT_PATH;

test("Foundry VTT native geometry integration", { skip: !path && "Set FOUNDRY_CLIENT_PATH to your Foundry scripts/foundry.mjs" }, async t => {
  const runtime = await loadFoundryGeometry(path);
  const { PIXI, Edge, PolygonTree, ClipperLib, ClockwiseSweepPolygon, CONST } = runtime;
  class PointVisionSource {}
  globalThis.CONST = runtime.CONST;
  globalThis.foundry = {
    canvas: { sources: { PointVisionSource }, geometry: { ...runtime, edges: runtime } }
  };
  const TerrainPolygon = createTerrainPolygonClass(ClockwiseSweepPolygon);
  const box = (x, y, w, h) => [x, y, x + w, y, x + w, y + h, x, y + h];

  function region(id, points, elevation, { holes = [], enabled = true, levels = [], exposure = false } = {}) {
    const clipper = new ClipperLib.Clipper();
    for (const contour of [points, ...holes]) {
      clipper.AddPath(new PIXI.Polygon(contour).toClipperPoints({ scalingFactor: 100 }), ClipperLib.PolyType.ptSubject, true);
    }
    const tree = new ClipperLib.PolyTree();
    clipper.Execute(ClipperLib.ClipType.ctUnion, tree, ClipperLib.PolyFillType.pftEvenOdd, ClipperLib.PolyFillType.pftEvenOdd);
    const polygonTree = PolygonTree.fromClipperPolyTree(tree);
    return {
      id, polygonTree, polygons: polygonTree.polygons, elevation, levels, exposure,
      behaviors: [{ type: BEHAVIOR_TYPE, active: enabled }]
    };
  }

  function setup(regions, walls = []) {
    const rect = new PIXI.Rectangle(0, 0, 1000, 1000);
    const boundary = box(0, 0, 1000, 1000);
    const edges = Array.from({ length: 4 }, (_, i) => new Edge(
      { x: boundary[2 * i], y: boundary[2 * i + 1] },
      { x: boundary[(2 * i + 2) % 8], y: boundary[(2 * i + 3) % 8] },
      { id: `bounds${i}`, type: "innerBounds", sight: CONST.EDGE_SENSE_TYPES.NORMAL }
    ));
    edges.push(...walls);
    Edge.identifyEdgeIntersections(edges, "ground");
    const scene = {
      isView: false,
      dimensions: { width: 1000, height: 1000, maxR: 2000, sceneRect: rect, rect },
      getSurfaces: ({ level, exposure } = {}) => regions
        .filter(r => !r.levels.length || r.levels.includes(level?.id ?? level))
        .filter(r => exposure === undefined || exposure === r.exposure)
        .map(r => ({ region: r, elevation: r.elevation, exposure: r.exposure }))
    };
    const level = {
      id: "ground", parent: scene, elevation: { base: 0 },
      edges: { getEdges: (_bounds, options) => new Set(edges.filter(e => options.collisionTest(e))) }
    };
    const source = new PointVisionSource();
    source.level = level;
    const config = overrides => ({ type: "sight", level, source, ...overrides });
    const polygon = (elevation = 0, origin = { x: 100, y: 500 }, overrides = {}) =>
      TerrainPolygon.create({ ...origin, elevation }, config(overrides));
    const collides = (a, b, overrides = {}) => TerrainPolygon.testCollision(a, b, config({ mode: "any", ...overrides }));
    return { polygon, collides, config, edges, regions, level };
  }

  await t.test("lower token's rendered polygon hides the hill and background behind it", () => {
    const { polygon } = setup([region("hill", box(400, 300, 200, 400), 10)]);
    const low = polygon(0);
    assert.ok(low.contains(300, 500));
    assert.equal(low.contains(500, 500), false);
    assert.equal(low.contains(800, 500), false);
    assert.ok(low.contains(300, 150));
    assert.ok(polygon(10).contains(800, 500));
    assert.ok(polygon(30).contains(800, 500));
  });

  await t.test("multiple sources and nested terraces have independent sight", () => {
    const { polygon } = setup([
      region("lower", box(300, 100, 600, 800), 10),
      region("upper", box(500, 250, 250, 500), 20)
    ]);
    const low = polygon(0);
    const middle = polygon(10);
    const high = polygon(20);
    assert.equal(low.contains(400, 500), false);
    assert.ok(middle.contains(400, 500));
    assert.equal(middle.contains(600, 500), false);
    assert.ok(high.contains(600, 500));
    assert.equal(low.contains(400, 500), false);
  });

  await t.test("holes remain open and their boundary blocks a viewer in the hole", () => {
    const { polygon } = setup([region("ring", box(200, 200, 600, 600), 10, { holes: [box(350, 350, 300, 300)] })]);
    const result = polygon(0, { x: 500, y: 500 });
    assert.ok(result.contains(550, 550));
    assert.equal(result.contains(700, 500), false);
  });

  await t.test("a viewer inside solid terrain gets no sight until raised onto its surface", () => {
    const { polygon, collides } = setup([region("hill", box(400, 300, 200, 400), 10)]);
    assert.equal(polygon(0, { x: 500, y: 500 }).points.length, 0);
    assert.ok(polygon(10, { x: 500, y: 500 }).contains(800, 500));
    assert.equal(collides({ x: 500, y: 500, elevation: 0 }, { x: 550, y: 500 }), true);
  });

  await t.test("intersections with walls are registered locally and existing walls still block from above", () => {
    const wall = new Edge({ x: 350, y: 400 }, { x: 650, y: 400 }, { id: "wall", sight: CONST.EDGE_SENSE_TYPES.NORMAL });
    const { polygon } = setup([region("hill", box(400, 300, 200, 400), 10)], [wall]);
    const intersections = JSON.stringify(wall.intersections);
    const low = polygon(0, { x: 300, y: 350 });
    assert.ok([...low.vertices.values()].some(v => v.x === 400 && v.y === 400));
    assert.equal(JSON.stringify(wall.intersections), intersections);
    assert.equal(wall.vertexA, undefined);
    assert.equal(polygon(20, { x: 500, y: 300 }).contains(500, 500), false);
  });

  await t.test("disabled markers, other levels, non-vision sources and wall-free senses are unaffected", () => {
    const hill = region("hill", box(400, 300, 200, 400), 10);
    const { polygon } = setup([hill]);
    assert.ok(polygon(0, undefined, { source: {} }).contains(800, 500));
    assert.ok(polygon(0, undefined, { edgeTypes: { wall: false } }).contains(800, 500));
    hill.behaviors[0].active = false;
    assert.ok(polygon(0).contains(800, 500));
    hill.behaviors[0].active = true;
    hill.levels = ["another-level"];
    assert.ok(polygon(0).contains(800, 500));
  });

  await t.test("sight collision tests use the same terrain and respect the requested ray interval", () => {
    const { collides } = setup([region("hill", box(400, 300, 200, 400), 10)]);
    const a = { x: 100, y: 500, elevation: 0 };
    const b = { x: 900, y: 500, elevation: 30 };
    assert.equal(collides(a, b), true);
    assert.equal(collides({ ...a, elevation: 10 }, b), false);
    assert.equal(collides(a, b, { tMax: 0.25 }), false);
    assert.equal(collides(a, b, { tMin: 0.75 }), false);
  });

  await t.test("native elevated surface exposure cannot reveal the solid plateau", () => {
    const { polygon, config } = setup([region("hill", box(400, 300, 200, 400), 10, { exposure: true })]);
    const native = ClockwiseSweepPolygon.create({ x: 100, y: 500, elevation: 0 }, config({ surfaceExposure: { threshold: 5 } }));
    assert.ok(native.surfaceExposure?.testPoint({ x: 410, y: 500 }));
    const result = polygon(0, undefined, { surfaceExposure: { threshold: 5 } });
    assert.equal(result.contains(500, 500), false);
    assert.equal(result.surfaceExposure?.testPoint({ x: 410, y: 500 }) ?? false, false);
  });

  await t.test("threshold attenuation cannot union vision back through the terrain", () => {
    const wall = new Edge({ x: 350, y: 100 }, { x: 350, y: 900 }, {
      id: "threshold-wall", sight: CONST.EDGE_SENSE_TYPES.PROXIMITY,
      threshold: { sight: 300, attenuation: true }
    });
    const { polygon } = setup([region("hill", box(400, 300, 200, 400), 10)], [wall]);
    const result = polygon(0, undefined, { useThreshold: true });
    assert.ok(result.terrainThresholdExpanded, "exercise Foundry's actual threshold augmentation");
    assert.ok(result.contains(300, 500));
    assert.equal(result.contains(500, 500), false);
  });

  await t.test("range, zero-radius vision, and sight cones retain native restrictions", () => {
    const { polygon } = setup([region("hill", box(400, 300, 200, 400), 10)]);
    assert.equal(polygon(20, undefined, { radius: 0 }).points.length, 0);
    const limited = polygon(0, undefined, { radius: 250 });
    assert.ok(limited.contains(300, 500));
    assert.equal(limited.contains(375, 500), false);
    const cone = polygon(0, undefined, { angle: 90, rotation: 270 });
    assert.ok(cone.contains(300, 500));
    assert.equal(cone.contains(50, 500), false);
    assert.equal(cone.contains(500, 500), false);
  });

  await t.test("overlapping terrain produces crossing vertices without changing either region", () => {
    const hill = region("a", box(400, 300, 200, 400), 10);
    const other = region("b", box(350, 450, 400, 100), 20);
    const { polygon } = setup([hill, other]);
    const result = polygon(0);
    assert.equal(result.contains(375, 500), false);
    assert.ok([...result.vertices.values()].some(v => v.x === 400 && v.y === 450));
    assert.ok(hill.polygonTree.testPoint({ x: 500, y: 400 }));
  });
});
