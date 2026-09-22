# Terrain Surface

**Solid terrain vision for Foundry VTT 14.368.** Keep a hill battlemap as one background image. Draw regions for its terraces, give them native **Define Surface** behaviors, and add **Terrain Surface**. Each lower token's sight stops at the terrain boundary; a viewpoint on or above the surface can see across it.

No wall documents are generated. No additional modules are required. Works with any game system using Foundry's standard token vision and clockwise sweep backend.

## Set up a hill

1. Enable **Terrain Surface** in your world's Manage Modules screen.
2. Use a scene with **Token Vision** enabled. Keep the battlemap as a normal background image on one level.
3. Draw a region around the full footprint of a terrace. Use Foundry's region shapes, including holes where needed.
4. In the region's elevation settings, set **Bottom** and **Top** to the terrace elevation, for example `10`. Using equal bounds is the simplest setup; a surface has no thickness by itself.
5. In **Behaviors**, add **Define Surface**. Enable **Restrict Sight**. Leave its placement at **Bottom**. Configure the other native restrictions as appropriate for your scene.
6. Add **Terrain Surface** to the **same region**. It uses the existing surface, so there is no second elevation to maintain.
7. Repeat for the `20`, `30`, etc. terraces. Nested regions are supported.
8. Set a token's elevation when it climbs onto a terrace, then view through that token.

| Viewpoint elevation | Terrain surfaces that block sight |
| --- | --- |
| 0 | 10, 20, 30 |
| 10 | 20, 30 |
| 20 | 30 |
| 30 | None |

The comparison uses **Foundry's vision-source elevation**, which is normally the token's vertical center, not necessarily its feet. Native token depth and system vision adjustments therefore matter for short ledges. Equality with the surface permits sight across it.

Terrain is solid down to negative infinity. A viewpoint inside its footprint and below its surface has no line of sight. Raise the token onto the terrain to restore vision. Holes remain empty space. If a region has multiple sight-restricting surfaces, each extends downward; the highest one determines its solid height.

Disable the Terrain Surface behavior to return that region to normal surface behavior. Hiding the region, disabling its Define Surface behavior, or turning off Restrict Sight also removes its terrain vision barrier. Geometry, elevations, and behaviors refresh on connected clients using native document/region events.

## Install

### From a GitHub release

After this project has been pushed to a **public GitHub repository**, the Release action on `main` publishes `module.json`, `terrain-surface.zip`, and `SHA256SUMS`. In Foundry's **Add-on Modules → Install Module → Manifest URL**, enter:

```text
https://github.com/OWNER/REPOSITORY/releases/latest/download/module.json
```

Replace `OWNER/REPOSITORY` with your repository. The action inserts the correct URLs into both copies of the release manifest. Foundry can subsequently check for updates using this same URL. Private GitHub release downloads require authentication that Foundry's installer does not provide.

### Manual installation

Extract `dist/terrain-surface.zip` into your server's Foundry user-data directory at `Data/modules/terrain-surface/`. The resulting path must be `Data/modules/terrain-surface/module.json`, with `scripts/` and `lang/` alongside it. Restart Foundry and enable the module in the world. A local build without `GITHUB_REPOSITORY` is intended for this manual installation and has no update URL.

## Release workflow

The workflow runs checks and creates a release after a push or merge to `main`; it also supports **Run workflow** on `main`.

- First release: the source manifest version (`0.1.0`).
- Subsequent releases: patch bump from the highest release version by default.
- Merged PR labels `minor` or `major` select that bump; `major` takes precedence.
- Raising both `module.json` and `package.json` above the latest release explicitly selects that version. Keep the package lock's root version synchronized when doing so.
- Rerunning a published commit skips publication. An interrupted draft release can be resumed.

Version and download URLs are written only into build output. The action does not push version commits back to `main`, so it works with protected branches and avoids release-commit loops. The release targets the exact checked-out commit; assets are uploaded while the release is a draft and published together. GitHub's built-in `GITHUB_TOKEN` is sufficient when repository/organization policy permits Actions to write releases.

Official checkout, Node, and artifact actions are pinned to commit SHAs; Dependabot proposes updates. CI uploads installable artifacts on pull requests as well. The proprietary Foundry runtime is intentionally absent from public CI; see the optional engine tests below.

## Development

Use Node.js 24 or newer and the `zip` command (included with macOS and GitHub's Ubuntu runners).

```sh
npm ci --ignore-scripts
npm run check
npm run build
```

Build output:

```text
dist/
  terrain-surface/       # Ready to copy into Data/modules/
  module.json           # Manifest release asset
  terrain-surface.zip   # Installer archive; module.json is at its root
  SHA256SUMS
```

To prepare a release-shaped build locally:

```sh
GITHUB_REPOSITORY=OWNER/REPOSITORY RELEASE_VERSION=0.1.0 npm run build
```

Native browser ES modules are distributed directly. No bundler or runtime dependencies are needed. Packaging includes only the manifest, runtime scripts, translation, README, changelog, and license. Development dependencies, tests, and Foundry's own source are excluded.

### Tests against Foundry's engine

Normal tests cover terrain selection, contour extraction, caching, refresh handling, release versioning, and archive contents. To additionally exercise the **actual Foundry sweep, edge intersections, polygon tree, and surface exposure implementation**, provide the path to your own 14.368 client file:

```sh
FOUNDRY_CLIENT_PATH=/path/to/foundry/resources/app/client/scripts/foundry.mjs npm run check
```

Adjust the path for your installation. The test harness extracts geometry declarations in memory and supplies a small scene/source fixture; it never starts Foundry, contacts a server, or reads world data. No proprietary runtime is redistributed. These tests cover hill shadows, equal elevations, multiple viewpoints, nested/overlapping regions, holes, walls, collision intervals, and elevated surface exposure. They do not replace testing the rendered canvas and behavior sheet in a real world.

See [the manual acceptance checks](docs/TESTING.md) before using the first release in a game.

## Scope and limitations

- This is a **terraced 2D sight model**, not target-by-target 3D ray tracing. A low observer cannot see a flying target behind a blocking terrace, even if a true 3D ray would clear the terrain.
- Terrain Surface changes token sight and associated sight collision tests. It does not add movement barriers, change light/sound propagation, or automatically adjust token elevation. Define Surface retains its own native behavior.
- Existing walls still block sight normally. Put walls where you need ordinary walls; terrain regions replace the need for cliff-height walls only.
- Foundry's normal fog exploration remains in effect. Previously explored artwork may remain dimly visible. Test with fresh/reset fog if you need to distinguish current sight from explored map memory. The module never resets fog.
- Region level assignments are honored. Empty assignments apply to all levels; otherwise include the observer's level. You can use a single level for the whole outdoor map.
- Native “Reveal Elevated Surface” exposure is clipped against terrain shadows. Ordinary surface exposure remains available where terrain does not block it.
- Sight-bypassing detection modes retain their normal behavior. Other modules that replace token vision sources, polygon backends, or visibility rules may need compatibility work. An incompatible replacement of the sight backend produces a GM notification; compatibility with WAVES/Levels/other vision modules has not been established.
- Polygon contours are cached, but each viewpoint still needs an intersection calculation. Extremely detailed regions cost more than simple traced contours.

## API and architecture

```js
const terrain = game.modules.get("terrain-surface").api;
terrain.refresh();
terrain.getBlockingRegions(canvas.tokens.controlled[0].vision);
// Add the behavior using RegionDocument.createEmbeddedDocuments:
// { type: terrain.behaviorType }  // "terrain-surface.terrain"
```

The module registers a native `RegionBehaviorType` and extends the configured `CONFIG.Canvas.polygonBackends.sight` class at setup. The subclass uses `Scene#getSurfaces`, the region's precomputed union/hole contours, and per-polygon `Edge` instances. It rebuilds intersections on the polygon's clones, leaving scene edges and wall documents untouched. Light and movement backends remain unchanged. A second terrain-only sweep is needed only when core exposure or threshold attenuation could reveal area beyond a terrain barrier.

References: [Foundry 14 API](https://foundryvtt.com/api/v14/), [ClockwiseSweepPolygon](https://foundryvtt.com/api/v14/classes/foundry.canvas.geometry.ClockwiseSweepPolygon.html), [Edge](https://foundryvtt.com/api/v14/classes/foundry.canvas.geometry.edges.Edge.html), [Define Surface](https://foundryvtt.com/api/v14/classes/foundry.data.regionBehaviors.DefineSurfaceRegionBehaviorType.html), and [GitHub release creation](https://cli.github.com/manual/gh_release_create).

## License

MIT. Foundry Virtual Tabletop is a separate proprietary product; its code and assets are not included.
