---
'@viamrobotics/motion-tools': patch
---

Fix frames not rendering for offline parts when the embedder skips dialing. The merge fallback now triggers whenever the connection is not actively `CONNECTED`, instead of only when explicitly `DISCONNECTED`, so config-derived frames render even when `connectionStatus` is `undefined` or `CONNECTING`.
