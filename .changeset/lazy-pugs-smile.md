---
'@viamrobotics/visualization': patch
---

Hold indexed point clouds at full detail under the point budget. Draw range addresses the index when a geometry has one, and three-mesh-bvh reorders that index spatially for picking, so decimating it drew a contiguous chunk of the cloud instead of the uniform sample `shuffled` describes — whole regions of a scan vanished while the camera moved and returned when it settled. Only clouds that opt into selection picking are indexed, so this was invisible until a scene both exceeded the budget and enabled the selection tool.
