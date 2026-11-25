---
'@viamrobotics/visualization': minor
---

Selecting several objects opens one details panel that shows shared values and a dash where they differ. `useDetailsSection` becomes the `<DetailsSection>` component, which takes a `label` and whose snippet, like the `details` snippet on `<Visualizer />`, receives `{ entities }` instead of `{ entity }`. The details panel shows without a mode plugin, and `useEnvironmentMode` takes `ownsDetails`.
