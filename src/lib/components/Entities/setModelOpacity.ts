import type { Object3D } from 'three'

import { isInstanceOf } from '@threlte/core'

/**
 * Fades every mesh under `object`, wireframe included.
 *
 * A loaded model ships its own materials, so `createSurfaceMaterial` never
 * reaches it and the `Opacity` traits have to be written through them here.
 * Only ever call this on a model whose materials it owns, or the fade lands on
 * the cached original too — see `cloneWithOwnMaterials`.
 */
export const setModelOpacity = (object: Object3D, opacity: number) => {
	const transparent = opacity < 1

	object.traverse((child) => {
		if (!isInstanceOf(child, 'Mesh')) return

		const materials = Array.isArray(child.material) ? child.material : [child.material]

		for (const material of materials) {
			if (material.transparent !== transparent) {
				material.transparent = transparent
				material.needsUpdate = true
			}

			material.opacity = opacity
			material.depthWrite = !transparent
		}
	})
}
