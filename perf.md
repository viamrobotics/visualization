# WebXR Performance Findings

Performance issues observed while viewing geometries from `GetGeometries`
and frames from `frameSystemConfig` in the WebXR viewer. Ranked by impact.

---

## 1. Every `getGeometries` poll rebuilds three.js geometries from scratch

**Files:** `src/lib/hooks/useGeometries.svelte.ts:143-146`,
`src/lib/ecs/traits.ts:204-239`, `src/lib/components/Entities/Mesh.svelte:84-106`

On every response, `useGeometries` updates existing entities unconditionally:

```ts
if (existing) {
    existing.set(traits.Center, center)
    updateGeometryTrait(existing, geometry)
    continue
}
```

`createPose`, `createBox`, `createCapsule`, `createSphere`, and
`parsePlyInput` (for meshes) all allocate fresh objects. `entity.set`
fires `world.onChange` on every poll even when dimensions haven't
changed. That propagates through `useTrait` → `box.current` /
`capsule.current` / `sphere.current` → `Mesh.svelte` re-renders.

Then in `Mesh.svelte`, the `args` tuple is a new array literal each
render:

```svelte
<T.BoxGeometry args={[x * 0.001, y * 0.001, z * 0.001]} {oncreate} />
```

Threlte's `determineRef` (`@threlte/core/.../utils.js:7-17`) calls
`new is(...args)` whenever `args` changes reference. So a fresh
`BoxGeometry` / `SphereGeometry` / `CapsuleGeometry` is allocated and
the old one disposed on every poll. At 60fps that's a lot of GPU buffer
churn. `parsePlyInput` on PLY meshes is especially painful — it
re-parses the whole PLY every poll.

**Fix options (not exclusive):**

- In `updateGeometryTrait` (`src/lib/ecs/traits.ts:204-239`), compare
  the new dims to `entity.get(Box/Capsule/Sphere)` and only `set` when
  they actually changed. Same for `Center` in `useGeometries` /
  `useFrames`.
- In `Mesh.svelte`, use unit geometries and drive dimensions through
  `mesh.scale` — no rebuild on resize.

---

## 2. `EdgesGeometry` is rebuilt every time `geo` changes

**File:** `src/lib/components/Entities/Mesh.svelte:121-129`

```svelte
{#if geo && geo.getAttribute('position').array.length > 0}
    <T.LineSegments raycast={() => null} bvh={{ enabled: false }}>
        <T.EdgesGeometry args={[geo, 0]} />
        ...
```

Largely goes away once fix #1 lands (the underlying geometry won't keep
changing). But also note:

- `raycast={() => null}` is a fresh function every render.
- `bvh={{ enabled: false }}` is a fresh object every render.

Both cause prop updates on `T.LineSegments`. Lift them to module scope:

```ts
const noRaycast = () => null
const bvhDisabled = { enabled: false }
```

---

## 3. `useFrames` re-runs on every `frameSystemConfig` response even when nothing changed

**Files:** `src/lib/hooks/useFrames.svelte.ts:102,164-249`,
`src/lib/hooks/usePose.svelte.ts:75-82`

```ts
const current = $derived(Object.values(frames))
```

Every query poll produces a new `frames` record → new `current` array →
the `current.length` tracking trick at line 171 fires → every frame
entity gets `setParentTrait`, `updateGeometryTrait`, `set(Color…)`,
`set(Center…)`, `set(EditedPose…)` called even when nothing changed.

That also cascades into `usePose`: the `observe.pre` at
`usePose.svelte.ts:75-82` watches `frames.current` and force-refetches
**every** `getPose` query whenever the frames reference changes —
amplifying the wasted work across N pose queries.

**Fix:** compare before `set` in the `$effect.pre`; diff pose / color /
center against the existing trait value. Same treatment for
`observe.pre`.

---

## 4. XR debug logging is on a per-event hot path

**File:** `src/lib/components/xr/OriginMarker.svelte:101-103`

```ts
xrDebug.add(`gaze=${headForward.x.toFixed(2)},...`)
```

Inside the right thumbstick `change` handler, which fires many times
per second while the stick is held. `xrDebug.add` does
`this.messages = this.messages.slice(-8)` — new array every push, and a
re-render of `DebugPanel` (a uikit panel, not cheap).

**Fix:** gate behind a debug flag or remove.

---

## 5. Minor wins

- **`Mesh.svelte:26`** — `const colorUtil = new Color()` is per-instance
  (fine), but `darkenColor(color, 10)` runs on every render. Memoize or
  hoist.
- **`use3DModels.svelte.ts:79-86`** — already flagged in `bugs.md`: the
  effect doesn't track `clients`, and `fetch3DModels` has an async race.
  Toggling settings while present can produce duplicate clones.

---

## Recommended order of fixes

1. Guard `updateGeometryTrait` and the `set(Center, …)` / `set(Pose, …)`
   calls in `useGeometries` and `useFrames` behind value-equality
   checks. This is the upstream fix that eliminates the cascade.
2. Stabilize `args` / prop references in `Mesh.svelte` (hoist
   `noRaycast`, `bvhDisabled`; consider unit-geometry + scale for
   parametric shapes).
3. Diff the `useFrames` `$effect.pre` against existing trait values
   (and fix the `observe.pre` in `usePose` to avoid the blanket
   refetch).
4. Remove or gate the high-frequency `xrDebug.add` calls.

---

# Quest 3 / XR-specific concerns

Quest 3 uses a Snapdragon XR2 Gen 2 — a mobile-class GPU rendering two
eye views at 90Hz (≈180 draw-pass equivalents per second). Below 90 FPS
the headset falls back to Asynchronous Spacewarp, which produces
artifacts with dynamic scenes. These findings are about keeping the app
at 90 FPS on-device, not desktop-parity.

Note: `@threlte/xr`'s `<XR>` component switches `renderMode` to
`'always'` on session start (`@threlte/xr/components/XR.svelte:152-155`),
so `<Canvas renderMode="on-demand">` in `App.svelte` is effectively
`'always'` in XR. Every scheduler tick and `invalidate()` call runs, and
calling `invalidate()` in `$effect.pre` is a no-op — you can drop those.

---

## 6. XR pointer raycasts aren't accelerated by BVH

**Files:** `src/lib/components/SceneProviders.svelte:44-45`,
`src/lib/components/Scene.svelte:49`,
`@threlte/xr/plugins/pointerControls/index.js:15`

`Scene.svelte` installs `bvh(raycaster, () => ({ helper: false }))`, but
that only wires up the **desktop** `interactivity()` raycaster. The XR
pointer controls create their own plain `Raycaster`s:

```js
// @threlte/xr/plugins/pointerControls/index.js
setControlsContext({
    interactiveObjects: [],
    raycaster: new Raycaster(),   // no BVH
    ...
})
```

Those raycasters fire `intersectObjects(interactiveObjects, true)` at
40 Hz per hand (the plugin's default `fixedStep: 1/40`). Every entity
created via `useEntityEvents` is registered — frames, geometries,
points, lines, GLTF arms. With ~50+ entities that's thousands of
ray-triangle tests per second without acceleration.

**Fix:** pass a BVH-enabled raycaster via `pointerControls(handedness, {
raycaster })`, or install the BVH plugin on the XR raycaster the same
way `Scene.svelte` does for the desktop one. Also consider filtering
`interactiveObjects` down to what actually needs XR interaction (the
transform-gizmo target, maybe the pendant UI — not every collider in
the scene).

---

## 7. Every mesh pays for a second draw call via `EdgesGeometry`

**File:** `src/lib/components/Entities/Mesh.svelte:121-129`

Each geometry entity renders two draw calls: the `MeshToonMaterial`
pass + the edge wireframe. On Quest that doubles per-eye, so every
added collider is 4 draw passes. Wireframes of PLY meshes also build an
`EdgesGeometry` with one line per non-coplanar triangle edge — easily
tens of thousands of line segments for arm meshes.

**Fix:** in XR, either skip the wireframe entirely or only draw it on
the selected/hovered entity. If you keep it on-device, precompute the
edges once per geometry (not per render) and cache them.

---

## 8. `AxesHelper` per frame entity = fat-line draw calls

**Files:** `src/lib/components/AxesHelper.svelte`,
`src/lib/hooks/useFrames.svelte.ts:216-217` (spawns with
`traits.ShowAxesHelper`)

`AxesHelper` uses `Line2` / `LineMaterial` / `LineGeometry` — fat
instanced lines, which have a more expensive vertex shader than basic
`LineSegments`. Every frame entity spawned by `useFrames` gets one
automatically. With 20 frames, that's 20 extra fat-line draw calls per
eye, each resolving screen-space width per pixel.

**Fix:** in XR, swap to a cheaper `<T.AxesHelper>` (three's built-in,
basic-line) — mobile-friendly. Or don't render them at all in headset
mode by default; gate on `$isPresenting`.

---

## 9. Two infinite grids in XR

**Files:** `src/lib/components/Scene.svelte:81-98`,
`src/lib/components/xr/OriginMarker.svelte:304-311`

`Scene.svelte` already gates its grid behind `!$isPresenting`, so that
part is fine. But `OriginMarker` renders its own infinite grid
unconditionally while presenting. Infinite-grid shaders do a distance
fade in the fragment shader — per-pixel work. On Quest, a full-screen
infinite grid through both eyes is a measurable tax.

**Fix:** cap the grid with `fadeDistance` small (already 5m) *and* use
`size` to make it a finite mesh. Or turn it off outside of calibration
mode.

---

## 10. HDR environment is loaded for all materials

**File:** `src/lib/components/Scene.svelte:60`

```svelte
<Environment url={hdrImage} />
```

Loads `ferndale_studio_11_1k.hdr` and sets it as
`EquirectangularReflectionMapping` on `scene.environment`. Every
`MeshStandardMaterial` (the arm GLTFs set `roughness: 0.3,
metalness: 0.1` in `use3DModels.svelte.ts:63-67`) samples the env
PMREM per fragment per eye. On a tile-based mobile GPU that's real
bandwidth.

The scene's majority uses `MeshToonMaterial`, which doesn't use the env
map — it's only paying for the arm meshes. But the texture allocation
and PMREM generation still happen.

**Fix:** either (a) don't use `MeshStandardMaterial` for arm models in
XR — switch to `MeshLambertMaterial` or `MeshToonMaterial` to avoid
IBL, (b) use a much smaller HDR (256×128 or a tiny procedural gradient)
specifically when `$isPresenting`, or (c) skip `<Environment>` in XR
entirely.

---

## 11. `useMouseRaycaster` runs against `scene.children` while in XR

**File:** `src/lib/hooks/useMouseRaycaster.svelte.ts:64,78`

```ts
const currentIntersections = raycaster.intersectObjects(scene.children, true)
```

On every `pointermove` / `pointerup` it raycasts the **entire scene**
recursively — not just interactive objects. The DOM pointer listeners
are attached for the lifetime of the component, so even though the
mouse isn't really "moving" in headset, if anything triggers a
pointerevent on the canvas (the browser composer, a stray tap on the
Quest screen before donning), the full-scene raycast still fires. Also
runs in desktop for every single mouse move.

**Fix:** scope to `context.interactiveObjects` (the same list
`pointerControls` maintains), or a user-provided list. Gate the listener
registration on `!$isPresenting` for the XR path.

---

## 12. `VideoTexture.needsUpdate = true` every frame

**File:** `src/lib/components/xr/CameraFeed.svelte:215-219`

```ts
useTask(() => {
    if (!enableProfiling && texture && ready) {
        texture.needsUpdate = true
    }
})
```

Runs every frame (90 Hz in XR). `VideoTexture` already has an internal
update mechanism tied to `requestVideoFrameCallback` — setting
`needsUpdate = true` unconditionally forces the GL texture path even
when the video hasn't produced a new frame. Camera streams in XR are
typically 30 fps, so this triples the work.

**Fix:** use the profiling path's `requestVideoFrameCallback` unconditionally and drop the `useTask` fallback, or only flag `needsUpdate` when the `video.currentTime` has advanced.

---

## 13. `Mesh.svelte` / `Frame.svelte` call `invalidate()` in XR

**Files:** `src/lib/components/Entities/Mesh.svelte:61-66`,
`src/lib/components/Entities/Frame.svelte:73-78`

```ts
$effect.pre(() => {
    if (center) {
        poseToObject3d(center, mesh)
        invalidate()
    }
})
```

In XR, `renderMode === 'always'`, so `invalidate()` is a no-op on the
scheduler but still a function call on every trait update. For N
entities updating every pose tick, that's just noise. Not a hot fix —
cleanup.

**Fix:** read `renderMode` from context and skip; or accept that it's
cheap. Low priority.

---

## 14. Headset-locked uikit panels rebuild layout on state change

**Files:** `src/lib/components/xr/DebugPanel.svelte`,
`src/lib/components/xr/PendingEditsPanel.svelte`,
`src/lib/components/xr/frame-configure/Controllers.svelte:281-328`

`threlte-uikit` `Panel` + `Text` run a flex layout and SDF text
rendering. Every push to `xrDebug.messages` re-flows the panel
(finding #4 above makes this worse). On Quest, font texture atlas
updates are non-trivial.

**Fix:** besides gating the debug log, consider a single "heads-up
display" panel that shows only what's active in the current XR mode,
instead of three always-on `<Headset>` children.

---

## 15. Hover event firehose at 40 Hz in XR

**File:** `src/lib/components/Entities/hooks/useEntityEvents.svelte.ts:44-84`

`onpointermove` fires at the pointer-controls tick rate (40 Hz) for
every ray that hits a registered entity. Inside it allocates new `Pose`
objects, `Matrix4` instances (via `poseToMatrix`), calls
`matrixToPose` (which allocates), then `entity.set(traits.InstancedPose,
…)` — triggering the same reactivity cascade as findings #1 and #3.

In XR with two hands pointing, that's up to 80 hover updates/sec per
entity under the ray. With multiple entities bubbled through, it adds
up fast.

**Fix:** throttle the `onpointermove` work inside the handler; reuse a
single pre-allocated `Matrix4`/`Pose` pair; only update
`traits.InstancedPose` when the index changes.

---

## 16. Line rendering in general uses `Line2` (fat lines)

**Files:** `src/lib/components/Entities/Line.svelte`,
`src/lib/components/AxesHelper.svelte`

`Line2` / `LineMaterial` is a screen-space thick-line shader — each
line vertex has to compute a perpendicular in screen space and do
per-pixel edge anti-aliasing. On desktop it looks great; on Quest
at 90Hz × 2 eyes it's heavy for what's visually a stroke. Basic
`THREE.Line` / `LineSegments` ships a trivial fragment shader and runs
near-free on mobile.

**Fix:** gate line style on `$isPresenting` — thick lines on desktop,
basic lines in XR (accept 1-pixel thickness in headset).

---

## 17. `MeshToonMaterial` with no gradient map

**File:** `src/lib/components/Entities/Mesh.svelte:108-115`

Without a `gradientMap`, `MeshToonMaterial` falls back to a procedural
step in the fragment shader — fine, but still evaluates per-fragment
lighting. On Quest for colliders you likely don't need lit shading at
all.

**Fix:** for static colliders in XR, use `MeshBasicMaterial` (no
lighting) — visually similar at the shader output of toon+ambient, and
dramatically cheaper on mobile.

---

## Quest-3-priority order

1. Findings #1 and #3 (the reactivity cascade) — the single biggest
   win. Already covered in the desktop section.
2. Finding #6 — BVH-accelerate XR raycasters.
3. Finding #7 — drop/throttle edge wireframes in XR.
4. Finding #10 — swap the arm material (or drop `<Environment>` in XR).
5. Finding #8 — cheaper axes helpers.
6. Finding #15 — throttle/alloc-free the hover handler.
7. Everything else is cleanup.

---

# Second-pass findings

Things missed in the first sweep. Mostly streaming / Draw-API / overlay
hot paths.

---

## 18. `ArrowGroups` destroys and rebuilds the entire `InstancedArrows` on every change

**File:** `src/lib/components/Entities/Arrows/ArrowGroups.svelte:38-41`

```ts
const onChange = (entity: Entity) => {
    onRemove(entity)
    onAdd(entity)
}
```

On any `traits.Arrows` change event, `onRemove` drops the entry from the
`SvelteMap`, then `onAdd` allocates a **new** `InstancedArrows` (new
`BatchedMesh`, new matrix buffers sized to `count`). That also forces
the `{#each map as ...}` block at line 60 to unmount + remount the
child `<Arrows>` component, which re-runs its `Portal` resolution. For
arrows streamed from `useDrawAPI.svelte.ts:297-315` (`drawPoses`) at
any frequency, this is a full InstancedMesh rebuild per message.

`InstancedArrows` already exposes an in-place
`update({ poses, colors, headAtPose })`
(`src/lib/three/InstancedArrows/InstancedArrows.ts:154`) — the initial
`onAdd` calls it. `onChange` should call it too.

**Fix:** in `onChange`, look up the existing `arrows` in the map and
call `arrows.update({ poses, colors, headAtPose })` in place. Only
rebuild if `count` changed beyond the allocated capacity.

---

## 19. `Selected.svelte` re-traverses the selected subtree every frame

**File:** `src/lib/components/Selected.svelte:21-45`

```ts
useTask(
    () => {
        ...
        } else {
            obbHelper.setFromObject(object)
        }
        invalidate()
    },
    { running: () => selectedEntity.current !== undefined, autoInvalidate: false }
)
```

`OBBHelper.setFromObject` (`src/lib/three/OBBHelper.ts:91-137`) calls
`root.updateWorldMatrix(true, true)` then `root.traverse(...)` over the
full subtree, calling `geometry.computeBoundingBox()` + matrix math per
mesh. On Quest, while an arm is selected that's the arm's full GLTF
subtree traversed every frame at 90 Hz. Also `invalidate()` runs every
frame here — no-op in XR but redundant with `autoInvalidate: false`.

**Fix:** only recompute the OBB when the selected object's world
transform actually changes (subscribe to the entity's `Pose`/`WorldPose`
trait, or dirty-flag on input). Drop the per-frame `invalidate()`.

---

## 20. `useSelection.focusedObject3d` clones the entire focused subtree

**File:** `src/lib/hooks/useSelection.svelte.ts:74-76`

```ts
const focusedObject3d = $derived(
    focused ? scene.getObjectByName(focused as unknown as string)?.clone() : undefined
)
```

Two things per focus change: `scene.getObjectByName` recursively walks
the whole scene looking for the first match, then `.clone()` deep-clones
the matched subtree (new geometries, materials, child groups). For a
GLTF arm this duplicates every mesh in memory. `Focus.svelte` then uses
that clone in `<T is={object3d} />` + `<T.BoxHelper args={[object3d,
'red']} />` — the `BoxHelper` args literal is also fresh each render so
the helper rebuilds on every reactive read (low-frequency, but a
free-lunch cleanup).

**Fix:** don't clone — render the focused object in its existing
location and adjust camera/overlay. If isolating it visually is the
goal, move it under a different group instead of duplicating.

---

## 21. `LineGeometry.svelte` allocates a fresh `LineGeometry` on every `positions` change

**File:** `src/lib/components/Entities/LineGeometry.svelte:10-18`

```ts
$effect(() => {
    if (positions) {
        untrack(() => {
            geometry = new LineGeometry()
            geometry.setPositions(positions)
            if (colors) geometry.setColors(colors)
        })
    }
})
```

Any time the `positions` reference changes (streamed from `useDrawAPI`'s
`drawLine`, `drawNurbs`, or any `traits.LinePositions` update), a new
`LineGeometry` is constructed — that allocates position/UV/draw-range
buffers on the GPU. The old one is dropped; Svelte/GC eventually
disposes it, but until then GL state churn and memory pressure build up.

**Fix:** keep one `LineGeometry` for the component's lifetime. Call
`geometry.setPositions(positions)` / `geometry.setColors(colors)` to
rewrite buffers in place (the fat-line `LineGeometry` reuploads
attributes on those calls).

---

## 22. `LineDots.svelte` tears down and re-adds every instance on positions change

**File:** `src/lib/components/Entities/LineDots.svelte:42-61`

```ts
$effect(() => {
    for (let i = 0, l = positions.length; i < l; i += 3) {
        const instance = mesh.addInstance(geometryID)
        matrix.makeTranslation(...)
        mesh.setMatrixAt(instance, matrix)
        ...
    }
    return () => {
        for (let i = 0, l = positions.length / 3; i < l; i += 1) {
            mesh.deleteInstance(i)
        }
    }
})
```

Two issues:
1. **Instance churn on update.** Svelte runs the cleanup (delete all
   instances) then the new body (add all instances back) on every
   `positions` change. For ~hundreds of dots, that's a full instance
   rebuild per update.
2. **Fragile cleanup indexing.** The cleanup deletes by positional
   index `i`, not by the instance IDs returned from `addInstance`. If
   `BatchedMesh` assigns non-sequential IDs (after reuse/holes), the
   cleanup drops wrong instances or leaks.

**Fix:** keep a `number[] instanceIds` buffer. On update, walk the
minimum of old/new counts and `setMatrixAt`/`setColorAt` in place; only
`addInstance`/`deleteInstance` for the growth/shrink delta. Track and
delete by real instance ID.

---

## 23. `useDrawAPI` `drawPoints` / `drawLine` linearly scan the world for a name match

**Files:** `src/lib/hooks/useDrawAPI.svelte.ts:369-370, 409-411`

```ts
const entities = world.query(traits.DrawAPI)
const entity = entities.find((entity) => entity.get(traits.Name) === label)
```

Called per websocket message. `world.query` returns all entities with
`DrawAPI`; `.find(...)` walks them reading the `Name` trait each time.
For N Draw-API entities, every incoming message is O(N) just to look up
the one being updated — on top of that the module already keeps an
`entities: Map<string, Entity>` (line 151) that would give O(1) lookup.

**Fix:** read from `entities.get(label)`. Also do the same in `remove`
(lines 479-490) — the inner `for (const entity of world.query(...))`
loop is O(N) per name removed.

---

## 24. `useDrawAPI` `drawNurbs` re-evaluates a 600-point curve per message

**File:** `src/lib/hooks/useDrawAPI.svelte.ts:260-293`

For each websocket message it allocates a `NURBSCurve`, a `Float32Array`
of 600 × 3 floats, and calls `curve.getPointAt(...)` 200 times (note:
the loop at line 272-277 steps `i += 3` up to `numPoints * 3 = 1800`,
meaning 600 evaluations, not 200). Each `getPointAt` walks the curve's
basis function evaluation — not cheap.

**Fix:** cache curves keyed by `(Degree, Knots, ControlPts)` — if the
shape didn't change, reuse the positions array. If only control points
move, tessellate at a lower resolution (e.g., 100 pts) and rely on
line-width for visual smoothness. Or move NURBS eval to a worker.

---

## 25. `useDrawAPI` `drawLine` reads floats one-at-a-time via `DataView.getFloat32`

**File:** `src/lib/hooks/useDrawAPI.svelte.ts:426-431`

```ts
const points = new Float32Array(nPoints * 3)
for (let i = 0; i < nPoints * 3; i += 3) {
    points[i + 0] = reader.read()
    points[i + 1] = reader.read()
    points[i + 2] = reader.read()
}
```

`reader.read()` is `view.getFloat32(offset, littleEndian)` — a V8
intrinsic but still one call per float across thousands of floats per
message. The same module already has `reader.readF32Array(count)` that
returns a typed-array view without copy. `drawLine` is the only
big-payload handler still doing per-float reads.

**Fix:** `const points = reader.readF32Array(nPoints * 3)` and drop the
loop. Same cleanup in `drawPoints` label decode at line 319-323 (loops
per-char via `read()` — small but ugly).

---

## 26. `useWorldState` re-parses PLY bytes on every `physicalObject` update

**File:** `src/lib/hooks/useWorldState.svelte.ts:104-106`

```ts
} else if (geometryType.case === 'mesh') {
    entity.set(traits.BufferGeometry, parsePlyInput(geometryType.value.mesh))
}
```

Same pattern as finding #1 but on the streaming path: every
`TransformChangeType.UPDATED` with a `physicalObject` change re-parses
the PLY. Meshes in world-state updates rarely change shape; poses do.

**Fix:** cache `BufferGeometry` by PLY byte-content hash (or by mesh
identity if upstream preserves it), and only re-parse when the bytes
change. Also diff the `path` more specifically — most updates only
touch the pose, not the mesh.

---

## 27. Labels are DOM overlays that keep positioning while in XR *(opt-in)*

**File:** `src/lib/components/Entities/Label.svelte:17-25`

**Opt-in only:** `settings.enableLabels` defaults to `false`
(`useSettings.svelte.ts:120`), so this cost is zero by default. It only
bites users who turn labels on and then enter XR — worth fixing but not
a baseline perf issue.

```svelte
{#if labels && text}
    <HTML center zIndexRange={[3, 0]} class="...">
        {text}
    </HTML>
{/if}
```

`HTML` from `@threlte/extras` projects a DOM element over the canvas
each frame. In XR the canvas is taken over by the headset compositor —
those DOM overlays aren't visible through the Quest, but projection
math + style recalc still runs per frame per label.

**Fix:** gate with `!$isPresenting` in `Label.svelte` (or in the
`{#each}` blocks in `Entities.svelte`). If labels are wanted in XR,
render them as `threlte-uikit` text billboards instead of DOM.

---

## 28. Svelte-wrapping the `configFrames` result for edit-mode fallback is a hot derived

**File:** `src/lib/hooks/useFrames.svelte.ts:59-100` (`const frames = $derived.by(...)`)

The `frames` derived rebuilds the record on every upstream change:
`query.data`, `partConfig.hasPendingSave`, `configFrames.current`,
`configFrames.unsetFrames`, `connectionStatus.current`, and
`didRecentlyEdit`. Inside, it always allocates a new record, merges
`configFrames.current` via spread (`{ ...frames, ...configFrames.current }`),
and iterates `unsetFrames` to `delete` from the merge result. Even for
live connections (monitor mode) the derived runs the full merge + clone
dance whenever any source ticks.

**Fix:** short-circuit early when `!didRecentlyEdit && !partConfig.hasPendingSave && connectionStatus === CONNECTED` — just return the plain `frames` map without any spread/clone.

---

## Updated Quest-3-priority order

1. Findings #1, #3 — the reactivity cascade on `getGeometries` / `frameSystemConfig`.
2. Finding #18 — stop rebuilding `InstancedArrows` on every change.
3. Finding #6 — BVH on XR raycasters.
4. Finding #19 — stop per-frame `setFromObject` on the selected arm.
5. Finding #7 — drop the edge wireframes in XR.
6. Finding #21 — in-place `LineGeometry` updates.
7. Finding #23 — O(1) entity lookup in `useDrawAPI`.
8. Finding #10 — cheaper arm material / no HDR env in XR.
9. Findings #22, #24, #25, #26 — streaming-path allocations.
10. Findings #8, #15, #20, #28 — follow-ups.
11. Finding #27 *(opt-in only — `enableLabels` defaults to off)*.
12. Everything else — cleanup.
