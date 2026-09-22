import { cp, mkdir, readFile, readdir, rm, stat, utimes, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { resolve, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parseVersion } from "./version.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const dist = resolve(root, "dist");
const packageDir = resolve(dist, "terrain-surface");
const manifest = JSON.parse(await readFile(resolve(root, "module.json"), "utf8"));
const pkg = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
parseVersion(manifest.version);
if (manifest.id !== "terrain-surface" || manifest.version !== pkg.version) {
  throw new Error("module.json and package.json must use the same source version and module ID.");
}
if (process.env.RELEASE_VERSION) manifest.version = process.env.RELEASE_VERSION;
parseVersion(manifest.version);
const repository = process.env.GITHUB_REPOSITORY;
if (repository) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) throw new Error("Invalid GITHUB_REPOSITORY.");
  const url = `https://github.com/${repository}`;
  Object.assign(manifest, {
    url,
    manifest: `${url}/releases/latest/download/module.json`,
    download: `${url}/releases/download/v${manifest.version}/terrain-surface.zip`,
    readme: `${url}/blob/v${manifest.version}/README.md`,
    changelog: `${url}/blob/v${manifest.version}/CHANGELOG.md`,
    bugs: `${url}/issues`
  });
}

await rm(dist, { recursive: true, force: true });
await mkdir(packageDir, { recursive: true });
for (const path of ["scripts", "lang", "docs", "README.md", "CHANGELOG.md", "LICENSE"]) {
  await cp(resolve(root, path), resolve(packageDir, path), { recursive: true });
}
const json = `${JSON.stringify(manifest, null, 2)}\n`;
await writeFile(resolve(packageDir, "module.json"), json);
await writeFile(resolve(dist, "module.json"), json);

for (const path of [...manifest.esmodules, ...manifest.languages.map(lang => lang.path)]) {
  const target = resolve(packageDir, path);
  if (!target.startsWith(`${packageDir}${sep}`) || !(await stat(target)).isFile()) {
    throw new Error(`Missing or unsafe manifest entry: ${path}`);
  }
}

async function filesIn(directory) {
  const paths = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) paths.push(...await filesIn(path));
    else if (entry.isFile()) paths.push(path);
    else throw new Error(`Unsupported release entry: ${path}`);
  }
  return paths.sort();
}

const files = await filesIn(packageDir);
const epoch = new Date("2000-01-01T00:00:00Z");
for (const path of files) await utimes(path, epoch, epoch);
execFileSync("zip", ["-X", "-q", resolve(dist, "terrain-surface.zip"), ...files.map(p => relative(packageDir, p))], {
  cwd: packageDir, env: { ...process.env, TZ: "UTC" }, stdio: "inherit"
});
const checksums = [];
for (const name of ["module.json", "terrain-surface.zip"]) {
  const hash = createHash("sha256").update(await readFile(resolve(dist, name))).digest("hex");
  checksums.push(`${hash}  ${name}`);
}
await writeFile(resolve(dist, "SHA256SUMS"), `${checksums.join("\n")}\n`);
console.log(`Built Terrain Surface ${manifest.version}: dist/module.json and dist/terrain-surface.zip`);
