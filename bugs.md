# Bug Hunt Findings

## High severity

### `sanitizeFloatValue` returns the unrounded value
**File:** `src/lib/FrameConfigUpdater.svelte.ts:175-187`

```ts
private sanitizeFloatValue = (value?: number): number | undefined => {
  if (value === undefined) return undefined
  const num = Number.parseFloat(value.toFixed(2))
  if (Number.isNaN(num)) return undefined
  return value  // should be `return num`
}
```

The function exists to round pose values to 2 decimals before writing to the config, but it returns the original `value`. Rounding is a no-op, so full-precision floats leak into the persisted config.

**Fix:** `return num`

---

### `setDrawRange` count is off by factor of 3
**File:** `src/lib/attribute.ts:32`

```ts
if (positionAttr && positionAttr.array.length >= positions.length) {
  positionAttr.array.set(positions, 0)
  geometry.setDrawRange(0, positions.length)   // count is *vertex* count, not floats
  positionAttr.needsUpdate = true
}
```

`BufferGeometry.setDrawRange(start, count)` takes a vertex count, but `positions.length` is the float count (3 floats per xyz). For non-indexed geometry this asks WebGL to draw 3× the actual number of vertices, reading past the valid data into stale floats. `updateBufferGeometry` is on the reuse path for point clouds and draw-API updates (called from `usePointclouds`, `usePointcloudObjects`, `useDrawAPI`, `draw.ts`), so stale/incorrect points get rendered whenever the position buffer is reused.

**Fix:** `geometry.setDrawRange(0, positions.length / 3)`

---

### `asFloat32Array` mutates the caller's bytes on the aligned path
**File:** `src/lib/buffer.ts:34-48`

```ts
if (bytes.byteOffset % 4 === 0 && bytes.byteLength % 4 === 0) {
  const view = new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4)
  if (transform) {
    for (let i = 0; i < view.length; i++) view[i] = transform(view[i])
  }
  return view
}
```

The aligned path returns a view that shares memory with the input `Uint8Array`. When a `transform` like `inMeters` is passed, `view[i] = transform(view[i])` writes back through the view and mutates the underlying protobuf bytes. The unaligned branch allocates a fresh array and does not mutate — the two paths have different semantics.

Today `asFloat32Array(geometryType.value.positions, inMeters)` is called once per message in `draw.ts`, so it works in practice, but:

- if the same protobuf message is re-read (e.g., a `$derived` re-runs, upstream caching, retry logic), positions get scaled by 0.001 again, silently shrinking coordinates each time
- any other code path that reads the original `Uint8Array` after this call sees corrupted bytes

**Fix:** on the aligned path, copy into a new `Float32Array` before applying `transform` (or drop the transform shortcut and always copy when a transform is present).

---

## Medium severity

### `index === 0` never registers a hover
**File:** `src/lib/HoverUpdater.svelte.ts:67, 77`

```ts
if (index && index > 0) {
  closestArrow = getArrowAtIndex(...)
}
```

Used in two places in `updateHoverInfo`. `index` comes from the raycast intersection; the `-1` sentinel is already filtered above (line 57), so valid values are `>= 0`. Both the truthiness check and `> 0` exclude index `0`, so the first point in a point cloud and the first arrow in an arrows entity never produce hover info.

**Fix:** `if (index !== undefined && index >= 0)`

---

### `use3DModels` has an async race and missing reactive dep
**File:** `src/lib/hooks/use3DModels.svelte.ts:79-86`

```ts
$effect(() => {
  const shouldFetchModels =
    settings.isLoaded && settings.current.renderArmModels.includes('model')
  if (shouldFetchModels) {
    fetch3DModels()
  }
})
```

Two issues:
- `fetch3DModels` is async and uncancelled. Toggling `renderArmModels` on/off/on spawns parallel fetches; the last to resolve writes `current`, so earlier runs can overwrite later state.
- The effect reads `settings.isLoaded` and `settings.current.renderArmModels` but never reads `clients`. `fetch3DModels` closes over `clients` and reads it at call time, but a subsequent change in `clients` (arms added/removed) doesn't retrigger the effect, so new arms never get their models fetched.

**Fix:** guard with a `cancelled` flag in the effect scope, and reference `clients` inside the effect body so it participates in tracking.

---

### `parsePlyInput` drops `byteOffset` on binary PLY
**File:** `src/lib/ply.ts:28`

```ts
// Case 4: binary PLY → pass ArrayBuffer directly
return plyLoader.parse(mesh.buffer as ArrayBuffer)
```

`mesh` is a `Uint8Array` view that may sit inside a larger `ArrayBuffer` at a non-zero `byteOffset` — the common case for protobuf-decoded bytes. `mesh.buffer` is the *underlying* buffer, so `PLYLoader.parse(mesh.buffer)` reads from offset 0 of the full allocation rather than from the view. Binary PLY meshes coming from protobuf (`traits.ts` via `traits.Geometry`, `useWorldState.svelte.ts:105`, `useDrawAPI.svelte.ts:226`) can therefore be parsed starting at the wrong bytes, producing garbage geometry or a parser error.

**Fix:** `plyLoader.parse(mesh.buffer.slice(mesh.byteOffset, mesh.byteOffset + mesh.byteLength))`

---

### Capsule update ignores the `change` object
**File:** `src/lib/FrameConfigUpdater.svelte.ts:121-130`

```ts
const r = this.sanitizeFloatValue(geometry.r)
const l = this.sanitizeFloatValue(geometry.l)

if (r === undefined && l === undefined) return

const change: { r?: number; l?: number } = {}
if (r !== undefined) change.r = r
if (l !== undefined) change.l = l

entity.set(traits.Capsule, { r, l })   // should be `change`
```

`change` is built to carry only the defined fields (mirroring how `updateLocalPosition` and the box branch work), but the final `entity.set` passes `{ r, l }` directly. If the user edits only one of the two fields, the other is written as `undefined`, wiping out the existing `r` or `l` on `traits.Capsule`. The box and sphere branches don't have this issue.

**Fix:** `entity.set(traits.Capsule, change)`
