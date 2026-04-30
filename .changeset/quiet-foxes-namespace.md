---
'@viamrobotics/motion-tools': minor
---

Wire up the `ID` field on `DrawGeometriesInFrame`, `DrawFrames`, `DrawFrameSystem`, and `DrawWorldState`. The field was previously accepted but ignored; setting it now namespaces entity identity (`"ID:label:parent"`) so multi-robot or multi-batch scenes with overlapping geometry labels no longer collide on UUIDs.
