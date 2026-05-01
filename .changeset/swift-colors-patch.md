---
'@viamrobotics/motion-tools': patch
---

Fix `NewColorChooser` pre-allocating zero-valued entries before appending named colors, which produced a doubled-length slice with transparent-black entries at the front.
