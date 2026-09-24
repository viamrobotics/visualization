---
paths:
  - 'src/lib/math/**'
  # `src/lib/motion/` is the same discipline one layer up: joint poses, frame descriptors, and
  # trajectory interpolation, all hand ports of RDK Go carrying the same unit boundaries.
  - 'src/lib/motion/**'
---

# Spatial Math

`src/lib/math/` holds spatial math primitives. `src/lib/motion/` builds on them: joint poses, frame descriptors, plan frames, and trajectory interpolation. Neither imports from `$lib/ecs`, `$lib/components` or a hook. Both are pure computation that the rest of the app composes.

## Units

`Pose` is **millimetres with theta in degrees** — the units the Viam APIs and the machine config speak. Three.js scene objects (`Matrix4`, `Vector3`, `Object3D`) are **metres with angles in radians**. Every `Pose` method that crosses that boundary converts, so callers never scale by hand. A number is only unitless inside a single method.

Round-trip tests cancel unit errors out: `setFromVector3(toVector3(p))` passes whether the constant is 1000 or 1. Give every unit boundary at least one _absolute_ assertion alongside its round-trip.

## An orientation vector is not an axis-angle

`{ ox, oy, oz }` is the direction the frame's **local +Z points**, and `theta` rotates about that direction — it is not a rotation axis with an angle. RDK converts by building a ZYZ Euler quaternion from `(lon, lat, theta)`, and `OrientationVector.toQuaternion` mirrors that term for term. Do not "simplify" it to `setFromAxisAngle`.

`axis_angles` (RDK's `R4AA`) _is_ a true axis-angle, in radians, and it tags its fields `th/x/y/z` — the same names as both orientation-vector encodings. A value read under the wrong one of those three decodes cleanly into a plausible wrong rotation, so the encoding tag is the only thing that says which is which. Never guess a default.

A zero-length vector means "unset" and resolves to +Z, because protobuf materialises absent scalars as `0` and RDK's `Normalize` does the same substitution.

## These are hand ports of Go

Each decoder mirrors Go this repo cannot import. Cite the Go file and symbol in a docblock, because a switch here is a place the copy can silently fall behind its original. When behaviour is deliberately _not_ reproduced — validation RDK runs that we skip, a panic we degrade to a warning — write down why rather than leaving a reader to wonder whether it was missed.

The encoding lists live in exactly one place each. Two readers of the same JSON that disagree is the failure mode these modules exist to prevent, so a new consumer imports the decoder rather than switching on `type` itself.

## Verify against RDK, not intuition

Before changing a conversion, check the behaviour in `viamrobotics/rdk` (`spatialmath/`, `referenceframe/`) or the proto in `viamrobotics/api` — see `viam-context.md`. Two conventions in particular are easy to get backwards and are documented where they are used:

- Which frame a geometry offset is measured from. A model link's is **parent**-relative; a part's own `frame` geometry is **frame**-local. `FrameSystem.Transform` and the two static-frame kinds in `referenceframe/frame.go` are what settle it.
- Capsule `length` is tip-to-tip, so the cylindrical section is `l - 2r`. Three.js' `CapsuleGeometry` takes the middle section instead.

## Allocation

Pre-allocate scratch `Quaternion`/`Euler`/`Vector3`/`Matrix4` at module scope and reuse them — these run per frame and per entity. A function that returns one of them must return a fresh instance, not the scratch value, or the next call mutates the caller's result.

## Verify Your Work

```
pnpm check    # svelte-check + go vet
pnpm test     # vitest unit tests
```
