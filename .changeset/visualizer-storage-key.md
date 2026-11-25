---
'@viamrobotics/visualization': major
---

Each `<Visualizer>` keeps its own state, in memory unless given a `storageKey` to persist under, and `useControlWidgets()` must now be called while a component initializes.
