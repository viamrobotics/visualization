---
paths:
  - 'src/lib/three/**'
---

# Three.js Extension Patterns

Files in `src/lib/three/` are **pure Three.js** — no Threlte, no Svelte. They extend Three.js classes or create reusable geometry/material utilities that Threlte components consume via `T is={obj}`.

## Extend Three.js classes directly

Subclass the closest Three.js type rather than wrapping it. The result can be passed directly to `T is={obj}` in a Svelte component:

```typescript
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js'

export class OBBHelper extends LineSegments2 {
  update(obb: OBB) { ... }
}
```

## Pre-allocate temporaries at module scope

Avoid allocating `Vector3`, `Color`, `Matrix4`, etc. inside hot-path methods. Allocate once at module scope and reuse:

```typescript
// module scope
const _axis = new Vector3()
const _object3d = new Object3D()
const _col = new Color()

export class BatchedArrow {
	updateArrow(id: number, origin: Vector3, direction: Vector3) {
		_object3d.position.copy(origin)
		_axis.set(direction.z, 0, -direction.x).normalize()
		// ...
	}
}
```

## BatchedMesh / instancing for many objects

Use `BatchedMesh` (multiple geometries, many instances) or `InstancedMesh` (one geometry, many instances) instead of individual meshes when rendering dozens or more of the same object. Use a free-list pool to reuse instance slots without resizing:

```typescript
class BatchedArrow {
	_pool: number[] = []

	addArrow() {
		const id = this._pool.pop() ?? this.mesh.addInstance(this._geometryId)
		// ...
		return id
	}

	removeArrow(id: number) {
		this.mesh.setVisibleAt(id, false)
		this._pool.push(id)
	}
}
```

## Custom BufferGeometry

Set typed array attributes directly — don't use `geometry.vertices` (legacy):

```typescript
import { BufferAttribute, BufferGeometry } from 'three'

const geometry = new BufferGeometry()
geometry.setAttribute('position', new BufferAttribute(new Float32Array([...]), 3))
geometry.setIndex([...])
```

For instanced data use `InstancedBufferAttribute` with `DynamicDrawUsage` when the data changes per frame.

## Custom shaders

Import GLSL as strings via Vite's raw import (already configured). Use `RawShaderMaterial` for full control, `ShaderMaterial` to inherit Three.js uniforms:

```typescript
import fragmentShader from './fragment.glsl'
import vertexShader from './vertex.glsl'

const material = new RawShaderMaterial({ vertexShader, fragmentShader })
```

Keep vertex and fragment shaders in sibling `.glsl` files named `vertex.glsl` / `fragment.glsl`.

## Custom raycasting

Override `raycast` on a `Mesh` or `Object3D` subclass when the default sphere/box test is wrong for your geometry:

```typescript
raycast(raycaster: Raycaster, intersects: Intersection[]) {
  // custom AABB or OBB test
}
```

Return early without pushing to `intersects` to opt out entirely.
