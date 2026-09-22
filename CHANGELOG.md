# Changelog

## 0.1.0

- Add the Terrain Surface region behavior for Foundry VTT 14.368.
- Extend existing sight-restricting Define Surface regions into solid terrain below their surfaces.
- Calculate terrain vision independently per token, with support for holes, overlapping terraces, and native walls.
- Refresh sight when relevant regions or behaviors change.
- Constrain elevated surface exposure and threshold-wall attenuation to terrain visibility.
- Add automated checks, reproducible module archives, checksums, and GitHub releases on `main`.
