import type { Object3D } from 'three'

import { isInstanceOf } from '@threlte/core'

/**
 * Clones `source` and gives the copy its own materials.
 *
 * `Object3D.clone()` duplicates the hierarchy but shares every material with
 * the object it came from, so writing opacity or wireframe through one clone
 * reaches the cached original and every other clone of it. A mounted model
 * needs display properties that are its own, and Threlte disposes the
 * materials under a `<T>` on unmount, which would otherwise take the cache's
 * with them.
 */
export const cloneWithOwnMaterials = <TObject extends Object3D>(source: TObject): TObject => {
	const clone = source.clone()

	clone.traverse((child) => {
		if (!isInstanceOf(child, 'Mesh')) return

		child.material = Array.isArray(child.material)
			? child.material.map((material) => material.clone())
			: child.material.clone()
	})

	return clone
}
