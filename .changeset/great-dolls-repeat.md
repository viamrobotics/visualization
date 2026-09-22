---
'@viamrobotics/visualization': patch
---

Apply every `fragment_mods` entry sharing a fragment id, so a part that imports one fragment twice no longer loses the second import's overrides.
