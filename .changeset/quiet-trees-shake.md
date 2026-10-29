---
'@viamrobotics/visualization': patch
---

Declare `sideEffects` so bundlers drop the modules a consumer doesn't use. Importing `SnapshotProto` from `@viamrobotics/visualization/lib` no longer pulls three.js into the importing chunk.
