import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { parse } from "acorn";
import * as PIXI from "pixi.js";
import ClipperLib from "clipper-lib";

/**
 * Opt-in integration tests use the user's own Foundry client source. Only geometry
 * declarations run; no application startup, network calls, or world data is loaded.
 * Proprietary Foundry source is never committed or included in a module release.
 */
export async function loadFoundryGeometry(path) {
  const source = await readFile(path, "utf8");
  const ast = parse(source, { ecmaVersion: "latest", sourceType: "module" });
  const classes = [
    "Edge", "CollisionResult", "PolygonVertex", "Ray", "LimitedAnglePolygon",
    "PolygonTreeNode", "PolygonTree", "ElevatedSurfaceExposureGenerator",
    "PointSourcePolygon", "ClockwiseSweepPolygon", "WeilerAthertonClipper"
  ];
  const constants = ["CLIPPER_SCALING_FACTOR", "EDGE_SENSE_TYPES", "EDGE_DIRECTIONS", "EDGE_DIRECTION_MODES", "SQRT3", "SQRT1_3", "nextAfterView"];
  const nodes = new Map(ast.body.filter(n => n.id).map(n => [n.id.name, n]));
  const declaration = name => {
    const node = nodes.get(name);
    if (!node) throw new Error(`Foundry geometry declaration not found: ${name}`);
    return source.slice(node.start, node.end);
  };
  const functions = ast.body.filter(n => n.type === "FunctionDeclaration");
  const extensions = ast.body.filter(n => n.type === "ExpressionStatement" && n.start < 50_000
    && /^(Object\.defineProperties\((Number|Math|Set|Array)|Number\.between\s*=)/.test(source.slice(n.start, n.end)));
  const constantSource = constants.map(name => {
    const node = ast.body.find(n => n.type === "VariableDeclaration" && n.declarations.some(d => d.id.name === name));
    if (!node) throw new Error(`Missing Foundry constant: ${name}`);
    return source.slice(node.start, node.end);
  });
  const context = vm.createContext({
    PIXI, ClipperLib, console, performance,
    PlaceableObject: class {}, Document: class {},
    CONFIG: { debug: { polygons: false }, Wall: { thresholdAttenuationMultiplier: 1 } },
    foundry: { utils: {} }, canvas: {}
  });
  vm.runInContext([
    ...functions.map(n => source.slice(n.start, n.end)),
    ...constantSource,
    ...classes.map(declaration),
    ...extensions.map(n => source.slice(n.start, n.end)),
    "foundry.utils = {orient2dFast, lineSegmentIntersects, lineLineIntersection, lineSegmentIntersection, closestPointToSegment, lineCircleIntersection, deepClone};",
    "globalThis.CONST = {EDGE_SENSE_TYPES, EDGE_DIRECTIONS, EDGE_DIRECTION_MODES, CLIPPER_SCALING_FACTOR};",
    "extendPIXICircle(); extendPIXIPolygon(); extendPIXIRectangle();",
    `globalThis.geometry = {${classes.join(",")}};`
  ].join("\n"), context, { filename: "foundry-geometry-from-local-client.mjs" });
  return { ...context.geometry, PIXI, CONST: context.CONST, CONFIG: context.CONFIG, ClipperLib, context };
}
