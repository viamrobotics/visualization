import type { Material, Object3D } from 'three'

import { isInstanceOf } from '@threlte/core/webgpu'
import { Color } from 'three'

interface TintableMaterial extends Material {
	color: Color
	map?: unknown
	vertexColors: boolean
}

const isTintableMaterial = (material: Material): material is TintableMaterial =>
	'color' in material && material.color instanceof Color

/**
 * Paints every mesh under `object` one flat `color`, the way a ghost's collider is drawn.
 *
 * The texture and vertex colours go too, because both multiply with `color` and would leave a
 * dark, patterned ghost instead of a tinted one. Only call this on a model whose materials it owns.
 * See `cloneWithOwnMaterials`.
 */
export const setModelGhostAppearance = (
	object: Object3D,
	color: { r: number; g: number; b: number }
) => {
	object.traverse((child) => {
		if (!isInstanceOf(child, 'Mesh')) return

		const materials = Array.isArray(child.material) ? child.material : [child.material]

		for (const material of materials) {
			if (!isTintableMaterial(material)) continue

			material.color.setRGB(color.r, color.g, color.b)
			if (material.map || material.vertexColors) {
				material.map = null
				material.vertexColors = false
				material.needsUpdate = true
			}
		}
	})
}
