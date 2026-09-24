---
paths:
  - '**/*.svelte'
  - '**/*.svelte.ts'
---

# Threlte in This Repo

All 3D components live inside a Threlte `<Canvas>` context. Custom Three.js extensions live in `src/lib/three/` (pure Three.js — see `three.md`) and are mounted with `<T is={obj} />` (see `three-threlte.md`).

**Rendering is on-demand, not continuous.** Call `invalidate()` (from `useThrelte()`) after mutating scene objects to trigger a re-render. Use `useTask` for continuous per-frame updates — never `$effect`, which does not participate in Threlte's task scheduler.

**`$effect.pre` vs `$effect`:** `.pre` runs before the DOM updates (and before child effects in the same flush); plain `$effect` runs after. Ask "does anything downstream in the same flush need to read this before render/DOM-commit?" If yes, `.pre`; if it is a pure side effect with nothing observing the result inside the same flush, plain `$effect` is correct.

**`dispose={false}`** — pass when you manage the Three.js object's lifecycle yourself (pooled or shared instances).

**BVH / raycasting** — opt out objects that don't need hit-testing: `bvh={{ enabled: false }}` or `raycast={() => null}` for display-only geometry.
