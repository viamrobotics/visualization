---
'@viamrobotics/motion-tools': patch
---

Fix unreadable text in the Details panel under dark mode by swapping
`dark:text-black` for `dark:text-white` on the panel container so child
text contrasts against dark surroundings rather than disappearing.
