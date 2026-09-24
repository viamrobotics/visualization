---
paths:
  - '**/three/**'
  - '**/*.three.ts'
  - '**/*.glsl'
  - '**/*.wgsl'
---

# Three.js Extension Patterns

A repo's Three.js layer is **pure Three.js**: no framework bindings, no Svelte, no React. It
extends Three.js classes or builds reusable geometry and material utilities. Framework
components consume what it exports, never rebuild it declaratively.

## Check the upstream docs before writing an unfamiliar API

Three.js and its framework bindings publish their documentation in `llms.txt` form. The
URLs are in `../reference/three-upstream-docs.md`. Fetch the relevant one rather than recalling a
signature, since much of the Three.js material on the web predates the current API.

## Extend Three.js classes directly

Subclass the closest Three.js type instead of wrapping it, so the result hands straight to a
renderer or framework binding:

```typescript
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';

export class OBBHelper extends LineSegments2 {
  update(obb: OBB) {
    // ...
  }
}
```

## Pre-allocate temporaries at module scope

Never allocate `Vector3`, `Color`, `Matrix4`, or similar inside a hot-path method. Allocate once
at module scope and reuse:

```typescript
const _axis = new Vector3();
const _object3d = new Object3D();

export class BatchedArrow {
  updateArrow(id: number, origin: Vector3, direction: Vector3) {
    _object3d.position.copy(origin);
    _axis.set(direction.z, 0, -direction.x).normalize();
    // ...
  }
}
```

## BatchedMesh or instancing for many objects

Past a few dozen copies of the same object, use `BatchedMesh` (many geometries, many instances)
or `InstancedMesh` (one geometry, many instances) instead of individual meshes. A free list
reuses instance slots without resizing:

```typescript
class BatchedArrow {
  private pool: number[] = [];

  addArrow() {
    const id = this.pool.pop() ?? this.mesh.addInstance(this.geometryId);
    // ...
    return id;
  }

  removeArrow(id: number) {
    this.mesh.setVisibleAt(id, false);
    this.pool.push(id);
  }
}
```

## Custom BufferGeometry

Set typed-array attributes directly. The legacy `geometry.vertices` API is gone.

```typescript
import { BufferAttribute, BufferGeometry } from 'three';

const geometry = new BufferGeometry();
geometry.setAttribute('position', new BufferAttribute(new Float32Array([]), 3));
geometry.setIndex([]);
```

For instanced data that changes per frame, use `InstancedBufferAttribute` with
`DynamicDrawUsage`.

## Custom shaders

Import GLSL as strings through a bundler raw import. Pick the material base by how much control
you need: `RawShaderMaterial` for full control, `ShaderMaterial` to inherit Three.js uniforms.

```typescript
import fragmentShader from './fragment.glsl';
import vertexShader from './vertex.glsl';

const material = new RawShaderMaterial({ vertexShader, fragmentShader });
```

Keep the pair in sibling `vertex.glsl` and `fragment.glsl` files.

## Custom raycasting

Override `raycast` on a `Mesh` or `Object3D` subclass when the default sphere or box test is
wrong for the geometry. Push hits to `intersects`, or return early to opt out.

## Dispose GPU resources

Geometries, materials, and textures are disposable GPU resources. `Object3D` is cheap. Call
`.dispose()` on each once nothing references it, since garbage collection never frees the GPU.

Decide early which layer owns disposal. An unclear owner is how a scene ends in gradual
slowdown and eventual context loss.

## Render on demand

Render only when the scene changes, not every frame, for a viewer or configurator that is not
continuously animating. This is the largest performance win available here.

## Also installed in this repo

- **Diagnosing a broken render:** `../reference/three-debugging.md`
