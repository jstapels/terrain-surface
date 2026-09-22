# Manual acceptance checks

Use a disposable test scene on Foundry 14.368 and a player view. The automated engine tests do not exercise WebGL rendering, sheet rendering, or a full multiplayer session.

1. Install and enable Terrain Surface. Confirm no browser console error. Add a region behavior and verify **Terrain Surface** appears with its help text and native Disabled control.
2. Use a visible background, Token Vision, and global illumination. Create a rectangular terrace with bottom/top `10`, Define Surface with Restrict Sight, and Terrain Surface. Give a player-owned token vision, with feet at `0` and depth small enough that its viewpoint is below `10`.
3. From outside the terrace, the background within and behind it should be outside current sight. Moving around the terrace should change the shadow; moving the token to elevation `10` should remove that barrier.
4. Move the token into the footprint while still below `10`: it should have no normal line of sight. Raise it to `10` and confirm sight returns.
5. Add a nested terrace at `20`. The token at `10` should still be blocked by the `20` terrace. At `20` it should see across both.
6. Add two player-owned vision tokens at different elevations and control both. Their visible areas should combine normally. Releasing one should remove only that source's contribution.
7. Add a hole, disconnected shapes, and overlapping regions. Check from a hole, from outside, and along the shared/crossing boundaries. Repeat with an ellipse and a rotated rectangle.
8. Cross a terrain boundary with an ordinary wall. Sight must not leak at the crossing. From above the terrain, the ordinary wall should still block. Repeat with an open/closed door, one-way wall, limited wall, and a proximity wall with attenuation.
9. Enable Define Surface's Reveal Elevated Surface. The cliff must continue hiding the terrain behind it. An unrelated elevated surface in an unobstructed area should still use native exposure.
10. Change the region shape/elevation, disable/re-enable either behavior, toggle Restrict Sight, hide/show the region, and delete/recreate the behavior. Sight should update for both the GM's controlled token and a connected player without a reload.
11. Switch scenes and back. Test an explicitly level-assigned region and an unassigned region. Only surfaces included in the observer's level should affect that observer.
12. Turn off global illumination and add local lights. Confirm darkness, darkvision distance, restricted vision angle, blindness, and normal detection rules still apply. Terrain Surface should not change light or movement collision settings.
13. With fog exploration enabled, compare dim explored terrain with current visible terrain. Existing fog is not cleared by enabling this module.
14. Disable the module and reload. Native Define Surface behavior should remain; no generated walls or orphaned scene documents should exist. Re-enable to restore the terrain barriers.

For performance, compare movement with simple versus highly detailed contours. Capture browser timings if large maps stutter. Test other vision modules individually before combining them in a campaign.

## Release acceptance

1. Push to a public repository's `main` branch with GitHub Actions enabled.
2. Confirm Checks and Release pass, and that the release contains `module.json`, `terrain-surface.zip`, and `SHA256SUMS`.
3. Install from `https://github.com/OWNER/REPOSITORY/releases/latest/download/module.json` on a test Foundry server.
4. Merge another change; confirm a new version is released and Foundry offers an update.
5. Rerun the same Release workflow: the existing published release should be left intact.

No automated test contacts or changes a live Foundry world. The release workflow itself can only be exercised after a GitHub repository is configured.
