---
'@viamrobotics/visualization': patch
---

Fix floating panel headers going out of reach in a short scene. The scene root now uses `overflow: clip`, so selecting a World tree row can no longer scroll the overlays up under the host app's navbar. Panels without a set position now center on their height instead of their width, and never open above or left of the canvas.
