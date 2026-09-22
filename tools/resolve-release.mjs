import { appendFile, readFile } from "node:fs/promises";
import { releasePlan } from "./version.mjs";

const { GITHUB_REPOSITORY: repo, GITHUB_SHA: sha, GH_TOKEN: token, GITHUB_OUTPUT: output } = process.env;
if (!repo || !/^[a-f0-9]{40}$/.test(sha ?? "") || !token || !output) {
  throw new Error("This script requires the GitHub Actions release environment.");
}

async function api(path) {
  const response = await fetch(`https://api.github.com/repos/${repo}/${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28"
    },
    signal: AbortSignal.timeout(30_000)
  });
  if (!response.ok) throw new Error(`GitHub ${path} returned HTTP ${response.status}.`);
  return response.json();
}

// Paginate so a rerun of an older commit cannot accidentally produce a new release.
const releases = [];
for (let page = 1; ; page++) {
  const batch = await api(`releases?per_page=100&page=${page}`);
  releases.push(...batch);
  if (batch.length < 100) break;
}
const prs = await api(`commits/${sha}/pulls?per_page=100`);
const merged = prs.filter(pr => pr.merged_at && pr.base.ref === "main");
const labels = merged.flatMap(pr => pr.labels.map(label => label.name));
const manifest = JSON.parse(await readFile(new URL("../module.json", import.meta.url), "utf8"));
const plan = releasePlan(manifest.version, releases, sha, labels);
await appendFile(output, Object.entries(plan).map(([key, value]) => `${key}=${value}\n`).join(""));
console.log(`${plan.tag}: ${plan.published ? "already published; nothing to do" : "ready to package"}`);
