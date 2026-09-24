import type { BufferGeometry, MaterialParameters, Mesh } from 'three'

import { useThrelte } from '@threlte/core'

import type { SurfaceMaterial } from '$lib/three/surfaceShading'

import { useSettings } from '$lib/hooks/useSettings.svelte'
import { createSurfaceMaterial } from '$lib/three/surfaceShading'

interface Surface {
	mesh: Mesh<BufferGeometry, SurfaceMaterial>
	/** The per-shape material options, reapplied to every material the mode swap builds. */
	parameters: MaterialParameters
}

/**
 * Re-shades each faces mesh when the render mode changes and disposes the material
 * it replaced. `InstancedMesh2` re-patches its material on every render, so the
 * swap itself is a plain assignment.
 *
 * The mount pass is skipped: callers build their first material with
 * `createSurfaceMaterial` themselves, because `InstancedMesh2` needs one at
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
