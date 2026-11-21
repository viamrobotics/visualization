import type { Material, Object3D } from 'three'

import { isInstanceOf } from '@threlte/core/webgpu'
import { Color } from 'three'

import { dimColor } from '#lib/ecs/index.js'

interface TintableMaterial extends Material {
	color: Color
}

const isTintableMaterial = (material: Material): material is TintableMaterial =>
	'color' in material && material.color instanceof Color

/** The color each dimmed material had before it was dimmed, so a restore is exact. */
const originalColors = new WeakMap<Material, Color>()

const dimMaterial = (material: TintableMaterial) => {
	if (originalColors.has(material)) return
	originalColors.set(material, material.color.clone())
	dimColor(material.color)
}

const restoreMaterial = (material: TintableMaterial) => {
	const original = originalColors.get(material)
	if (!original) return
	material.color.copy(original)
	originalColors.delete(material)
}

/**
 * Blends the color of every mesh material under `object` toward `gray-5`, or restores it.
 * Dimming twice blends once. Textures and vertex colors are left alone.
 * Only call this on a model whose materials it owns. See `cloneWithOwnMaterials`.
 */
export const setModelDimmed = (object: Object3D, isDimmed: boolean) => {
	object.traverse((child) => {
		if (!isInstanceOf(child, 'Mesh')) return

		const materials = Array.isArray(child.material) ? child.material : [child.material]

		for (const material of materials) {
			if (!isTintableMaterial(material)) continue

			if (isDimmed) {
				dimMaterial(material)
			} else {
				restoreMaterial(material)
			}
		}
	})
}
