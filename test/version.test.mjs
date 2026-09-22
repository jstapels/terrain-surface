import assert from "node:assert/strict";
import test from "node:test";
import { nextVersion, parseVersion, releasePlan } from "../tools/version.mjs";

test("uses the initial or explicitly raised version; otherwise bumps the latest release", () => {
  assert.equal(nextVersion("0.1.0"), "0.1.0");
  assert.equal(nextVersion("2.0.0", "1.9.9"), "2.0.0");
  assert.equal(nextVersion("0.1.0", "1.9.9"), "1.9.10");
  assert.equal(nextVersion("0.1.0", "1.9.9", "minor"), "1.10.0");
  assert.equal(nextVersion("0.1.0", "1.9.9", "major"), "2.0.0");
  for (const version of ["1.2", "v1.2.3", "1.02.3", "1.2.3-alpha", "$(echo bad)"]) {
    assert.throws(() => parseVersion(version));
  }
});

test("PR labels are case insensitive and major wins", () => {
  const releases = [{ tag_name: "v0.9.0", target_commitish: "old" }];
  assert.equal(releasePlan("0.1.0", releases, "new", ["minor", "Major"]).version, "1.0.0");
});

test("reruns resume a draft or skip an existing published release without changing latest", () => {
  const releases = [
    { tag_name: "v0.2.0", target_commitish: "newer", draft: false },
    { tag_name: "v0.1.0", target_commitish: "old", draft: false }
  ];
  assert.deepEqual(releasePlan("0.1.0", releases, "old"), {
    version: "0.1.0", tag: "v0.1.0", existing: true, published: true, latest: false
  });
  releases[1].draft = true;
  assert.equal(releasePlan("0.1.0", releases, "old").published, false);
  assert.equal(releasePlan("0.1.0", releases, "new").version, "0.2.1");
});
