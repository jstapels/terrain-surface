import assert from "node:assert/strict";
import test from "node:test";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";

test("release archive installs at its root, matches its manifest, excludes dev files and builds reproducibly", async () => {
  const fixture = await mkdtemp(join(tmpdir(), "terrain-surface-build-"));
  try {
    for (const path of ["module.json", "package.json", "tools", "scripts", "lang", "docs", "README.md", "CHANGELOG.md", "LICENSE"]) {
      await cp(new URL(`../${path}`, import.meta.url), join(fixture, path), { recursive: true });
    }
    const env = { ...process.env, GITHUB_REPOSITORY: "example/terrain-surface", RELEASE_VERSION: "1.2.3" };
    const build = () => execFileSync(process.execPath, [join(fixture, "tools/build.mjs")], { env });
    build();
    const archive = join(fixture, "dist/terrain-surface.zip");
    const external = await readFile(join(fixture, "dist/module.json"), "utf8");
    const embedded = execFileSync("unzip", ["-p", archive, "module.json"], { encoding: "utf8" });
    assert.equal(external, embedded);
    const manifest = JSON.parse(external);
    assert.equal(manifest.version, "1.2.3");
    assert.equal(manifest.manifest, "https://github.com/example/terrain-surface/releases/latest/download/module.json");
    assert.equal(manifest.download, "https://github.com/example/terrain-surface/releases/download/v1.2.3/terrain-surface.zip");
    const entries = execFileSync("unzip", ["-Z1", archive], { encoding: "utf8" }).trim().split("\n");
    assert.ok(entries.includes("scripts/main.js"));
    assert.ok(entries.includes("docs/TESTING.md"));
    assert.ok(!entries.some(path => /^(tools|test|node_modules|\.github)\//.test(path)));
    const checksum = await readFile(join(fixture, "dist/SHA256SUMS"), "utf8");
    const bytes = await readFile(archive);
    assert.ok(checksum.includes(createHash("sha256").update(bytes).digest("hex")));
    build();
    assert.deepEqual(await readFile(archive), bytes);
    assert.equal(JSON.parse(await readFile(join(fixture, "module.json"), "utf8")).version, "0.1.0");
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});
