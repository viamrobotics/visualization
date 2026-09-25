import type { Material, MaterialParameters } from 'three'

import { useThrelte } from '@threlte/core'

import { useSettings } from '$lib/hooks/useSettings.svelte'
import { createSurfaceMaterial } from '$lib/three/surfaceShading'

interface Surface {
	/** Only the material slot is read and replaced, so a `BatchedMesh` qualifies too. */
	mesh: { material: Material }
	/** The per-shape material options, reapplied to every material the mode swap builds. */
	parameters: MaterialParameters
}

/**
 * Re-shades each faces mesh when the render mode changes and disposes the material
 * it replaced. Both batching and instancing are renderer-side defines keyed off the
 * object, not the material, so the swap is a plain assignment.
 *
 * The mount pass is skipped: callers build their first material with
 * `createSurfaceMaterial` themselves, because both mesh types need one at
 * construction.
 */
export const useSurfaceMaterials = (surfaces: Surface[]) => {
	const settings = useSettings()
	const { invalidate } = useThrelte()

	let appliedMode = settings.current.renderMode

	$effect(() => {
		const mode = settings.current.renderMode

		if (mode === appliedMode) return
		appliedMode = mode

		for (const { mesh, parameters } of surfaces) {
			const replaced = mesh.material
			mesh.material = createSurfaceMaterial(mode, parameters)
			replaced.dispose()
		}

		invalidate()
	})
}
