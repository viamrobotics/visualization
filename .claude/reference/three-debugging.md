# Three.js Debugging

Pull-only. Read this when a render is already broken or already slow, not while authoring
new Three.js code.

## Convert a symptom into a hypothesis

Match what you see to a likely cause before touching code:

- A black mesh usually means wrong winding order or a missing light, not a broken material.
- A gradual slowdown that ends in a black canvas usually means leaked GPU resources ending in
  a lost WebGL context, not a single expensive frame.
- A shadow that is missing, offset, or clipped usually means the shadow camera's frustum does
  not cover the caster or receiver.

## Bisect by substitution

Swap out one pipeline stage at a time to isolate where a broken render actually breaks:

- Swap the material for `MeshBasicMaterial` to rule lighting in or out.
- Render vertex normals to rule the geometry in or out.
- Swap the camera for a simple `PerspectiveCamera` at the origin to rule out camera or
  transform math.

Each substitution eliminates one stage. Whatever the substitution fixes is where the bug is.

## Reach for a helper before theorizing

Most "why is nothing lit" or "why is the shadow wrong" questions are answered in seconds by
rendering the relevant helper instead of reasoning about the scene graph:

- `AxesHelper` for orientation and transform bugs.
- `CameraHelper` for a camera whose frustum, near, or far plane is wrong.
- `DirectionalLightShadowHelper` (or the equivalent for the light in use) for a shadow camera
  whose frustum does not cover the scene.

## Handle a lost WebGL context

Listen for the `webglcontextlost` event and either recover or show a graceful fallback.
Without a handler, a lost context leaves the canvas as a black rectangle with no indication
of what happened.

## Diagnose the bottleneck before optimizing

Determine whether a slow scene is CPU-bound, GPU fill-rate-bound, or memory and
bandwidth-bound before changing anything. Each bottleneck has a different fix, and the fix
for one can make another worse:

- CPU-bound: too many draw calls or too much per-frame JavaScript. Batch, instance, or move
  work off the main thread.
- Fill-rate-bound: too many overlapping transparent or post-processed pixels. Reduce
  overdraw or resolution.
- Memory or bandwidth-bound: textures or buffers too large for the target hardware. Downsize
  or compress.

## Detect renderer capability at runtime

Check `navigator.gpu` presence, WebGL2 availability, maximum texture size, and extension
support before committing to a renderer path or a feature, rather than assuming the
capability of the machine that shipped the code is the capability of the machine that runs
it.

## Self-host decoder paths for compressed assets

Configure `DRACOLoader` and `KTX2Loader` to load their decoder from a path your own server
or CDN serves. A path that resolves from a local dev server can 404 once the app moves
behind a production CDN, and the failure only shows up there.
