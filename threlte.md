# threlte/xr — hand-model deformation notes

Notes on why the default `<Hand left />` / `<Hand right />` model may not appear
to articulate when joints move, gathered from walking through
`@threlte/xr@1.5.2` and `three@0.183.2`.

## How deformation is supposed to work

1. `setupHands` (internal) creates one `XRHandModel` per handSpace via
   `XRHandModelFactory.createHandModel(handSpace, 'mesh')`.
2. `Hand.svelte` renders
   `<T is={xrHand.hand} attach={scene}><T is={model} /></T>`, adding the model
   as a child of the XR handSpace.
3. Each frame, `renderer.render(scene)` triggers `scene.updateMatrixWorld()`,
   which recurses into the `XRHandModel`. Its override (in
   `three/examples/jsm/webxr/XRHandModelFactory.js:68-78`) calls
   `this.motionController.updateMesh()` →
   `XRHandMeshModel.updateMesh()` → copies each `XRJoint.position` and
   `XRJoint.quaternion` onto the skinned-mesh bones.

## Fragility #1 — glTF load is silent

`XRHandMeshModel` loads its rigged mesh from a hard-coded CDN:

```
https://cdn.jsdelivr.net/npm/@webxr-input-profiles/assets@1.0/dist/profiles/generic-hand/{left|right}.glb
```

If that fetch is slow, blocked by CSP, or fails on a headset without internet,
`this.bones` stays empty and `updateMesh()` is a no-op — you'd see the default
rest pose frozen, even though the handSpace itself is tracking. The loader does
not surface errors to the console, so this can look like a deformation bug.

This is the most common cause of "hand mesh doesn't articulate." Check the
Network tab on the headset (for Quest: enable USB debugging and attach Chrome
DevTools via `chrome://inspect`).

## Fragility #2 — one-frame lag in `XRHandModel.updateMatrixWorld`

```js
updateMatrixWorld(force) {
  super.updateMatrixWorld(force);             // traverses skeleton first
  if (this.motionController) this.motionController.updateMesh(); // writes bones AFTER
}
```

Bones are written *after* the traversal that would propagate them into
skinning, so the mesh always renders one frame behind. This is a three.js
quirk, not threlte's. It only lags animation — it does not freeze it — so it's
not the cause if the hand looks completely still.

## Fragility #3 — the commented workaround in `Hand.svelte`

The comment at
`node_modules/@threlte/xr/dist/components/Hand.svelte:67-73` admits "children
of a hand XRSpace or model will not move relative to their parent." The
accompanying `useTask` manually syncs a helper `Group` to the wrist joint.

That workaround only runs when you pass a `wrist` or `children` snippet — it
does **not** apply to the default model path. If you use
`<Hand left onpinchstart={…} onpinchend={…} />` with no snippets, you're on
the unprotected path.

## Diagnostic checklist

1. In DevTools on the headset, confirm both `.glb` files load with 200 OK.
2. From inside a `useTask`:
   `console.log(xrHand?.model?.motionController?.bones?.length)` — expect 26
   once the glTF loads. If it's `0` or `undefined`, it's the loader.
3. If the glTF loads but articulation still looks wrong, pass a `wrist`
   snippet to `<Hand>` to activate the sync `useTask` path. That at least
   confirms joint poses are reaching the scene.

## Workarounds

- **Self-host the glTF:** provide a custom `XRHandModelFactory` via the
  `<XR handFactory={…} />` prop, pointing `setPath()` at a local copy of the
  `@webxr-input-profiles/assets` hand profile. Eliminates the CDN dependency.
- **Render your own rigged hand:** use the `children` snippet on `<Hand>` and
  drive bones yourself from `useHandJoint`. Gives full control and sidesteps
  the XRHandModel path entirely.
- **Patch the one-frame lag:** in an app-level `useTask` that runs *before*
  `renderStage`, call `model.motionController?.updateMesh()` manually, then
  `model.updateMatrixWorld(true)`. Makes bone transforms current for the
  frame's skinning.

## `PointerCursor` reticle floats off-surface during depth changes

`node_modules/@threlte/xr/dist/components/internal/PointerCursor.svelte` places
the hover reticle with a lerp:

```js
useTask(() => {
  if (intersection === undefined) return
  const { point, face, object } = intersection
  ref.position.lerp(point, 0.4)
  // … orient to surface normal
})

$effect.pre(() => {
  if (hovering && intersection) {
    ref.position.copy(intersection.point)
  }
})
```

Two paths write to `ref.position` on different timing:

- `useTask` runs every render frame and lerps 40% toward the current hit point.
- `$effect.pre` snaps when the `intersection` $derived changes reference —
  a Svelte microtask, not tied to the render frame.

When the user sweeps the ray across two objects at different depths, the lerp
visibly drags the reticle through empty space between the old and new hit
points for one or more frames before the snap catches up. It's most noticeable
near object edges or when transitioning between a near and a far surface.

### Suggested fix

Snap when the hit `object` changes; only lerp while staying on the same
object (or drop the lerp entirely). Something like:

```js
let lastObject
useTask(() => {
  if (intersection === undefined) return
  const { point, face, object } = intersection
  if (object !== lastObject) {
    ref.position.copy(point)
  } else {
    ref.position.lerp(point, 0.4)
  }
  lastObject = object
  // … orient to surface normal
})
```

The existing `$effect.pre` snap can then be removed; the useTask handles both
cases coherently in one place.

### Workaround

`pnpm patch @threlte/xr` and replace the `ref.position.lerp(point, 0.4)` with
`ref.position.copy(point)`. The `pointerCursor` snippet slot on `<Controller>`
only swaps the visual — children are rendered inside the already-positioned
`ref`, so it can't fix the reticle location.

## Session setup reminder

`@threlte/xr`'s default optional features
(`node_modules/@threlte/xr/dist/internal/defaultFeatures.js`) already include
`hand-tracking` and `anchors`. If you override `sessionInit`, be sure to keep
those, plus `anchors` if you also want persistent scene-origin anchors.
