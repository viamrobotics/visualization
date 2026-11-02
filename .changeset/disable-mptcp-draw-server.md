---
'@viamrobotics/visualization': patch
---

Turn off Multipath TCP in the draw server, which Go enables by default on Linux listeners and which carries the published exploit for CVE-2026-98432.
