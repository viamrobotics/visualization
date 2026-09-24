---
'@viamrobotics/visualization': patch
---

Draw batched primitives through a shared BatchedMesh pair instead of per-shape InstancedMesh2 objects. Spheres move first. Every transparent primitive now depth-sorts against every other, where separate objects previously fell back to creation order, and culling is per instance rather than whole-object.
