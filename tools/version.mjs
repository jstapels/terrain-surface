export function parseVersion(version) {
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) {
    throw new Error(`Expected a stable major.minor.patch version, received: ${version}`);
  }
  const parts = version.split(".").map(Number);
  if (!parts.every(Number.isSafeInteger)) throw new Error("Version exceeds safe integer range.");
  return parts;
}

export function compareVersions(a, b) {
  const left = parseVersion(a);
  const right = parseVersion(b);
  for (let i = 0; i < 3; i++) {
    if (left[i] !== right[i]) return left[i] > right[i] ? 1 : -1;
  }
  return 0;
}

export function nextVersion(manifestVersion, previousVersion, bump = "patch") {
  parseVersion(manifestVersion);
  if (!previousVersion || compareVersions(manifestVersion, previousVersion) > 0) return manifestVersion;
  const parts = parseVersion(previousVersion);
  const index = { major: 0, minor: 1, patch: 2 }[bump];
  if (index === undefined) throw new Error(`Unknown version bump: ${bump}`);
  parts[index]++;
  for (let i = index + 1; i < 3; i++) parts[i] = 0;
  const version = parts.join(".");
  parseVersion(version);
  return version;
}

export function releasePlan(manifestVersion, releases, sha, labels = []) {
  const versions = releases.filter(r => !r.prerelease && /^v\d+\.\d+\.\d+$/.test(r.tag_name));
  versions.sort((a, b) => compareVersions(b.tag_name.slice(1), a.tag_name.slice(1)));
  const existing = versions.find(r => r.target_commitish === sha);
  const names = labels.map(label => label.toLowerCase());
  const bump = names.includes("major") ? "major" : names.includes("minor") ? "minor" : "patch";
  const latest = versions[0]?.tag_name.slice(1);
  const version = existing?.tag_name.slice(1) ?? nextVersion(manifestVersion, latest, bump);
  return {
    version,
    tag: `v${version}`,
    existing: Boolean(existing),
    published: Boolean(existing && !existing.draft),
    latest: !latest || compareVersions(version, latest) >= 0
  };
}
