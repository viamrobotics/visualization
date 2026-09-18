import { useTask, useThrelte } from '@threlte/core'
import { type OrthographicCamera, type PerspectiveCamera, Quaternion, Vector3 } from 'three'

import { traits, useWorld } from '$lib/ecs'

/** Long enough to ride out the gaps in a stuttering drag, short enough to feel immediate. */
const SETTLE_SECONDS = 0.001

/** Floor per cloud, so splitting a tight budget across many clouds can't erase the small ones. */
const MIN_CLOUD_POINTS = 20_000

/**
 * Caps points drawn while the camera moves, restoring full detail once it settles. Motion-only
 * is deliberate: `three-mesh-bvh` ignores draw range, so picking stays honest on a settled
 * scene, which on-demand rendering makes free anyway.
 */
export const providePointBudget = (budget: () => number) => {
	const { camera, invalidate } = useThrelte()
	const world = useWorld()

	const lastPosition = new Vector3()
	const lastQuaternion = new Quaternion()
	let lastZoom = 0
	let stillSeconds = Number.POSITIVE_INFINITY

	const cameraMoved = () => {
		const current = camera.current as PerspectiveCamera | OrthographicCamera

		if (
			lastZoom === current.zoom &&
			lastPosition.equals(current.position) &&
			lastQuaternion.equals(current.quaternion)
		) {
			return false
		}

		lastPosition.copy(current.position)
		lastQuaternion.copy(current.quaternion)
		lastZoom = current.zoom
		return true
	}

	const samplings: ({ total: number; shuffled: number } | undefined)[] = []

	const applyBudget = (limit: number) => {
		const entities = world.query(traits.PointSampling, traits.BufferGeometry)
		if (entities.length === 0) return

		samplings.length = 0
		let total = 0

		for (const entity of entities) {
			const sampling = entity.get(traits.PointSampling)
			samplings.push(sampling)
			total += sampling?.total ?? 0
		}

		const ratio = total > limit ? limit / total : 1
		let changed = false

		for (const [index, entity] of entities.entries()) {
			const sampling = samplings[index]
			const geometry = entity.get(traits.BufferGeometry)
			if (!geometry || !sampling) continue

			const { total: count, shuffled } = sampling

			// A cloud parsed under a smaller budget can't be decimated as far as the current one
			// asks, so it holds at its own depth rather than reaching into scan order.
			// Draw range addresses the index when one exists, and only the position buffer was
			// shuffled, so a prefix of an index an embedder supplied is a contiguous chunk.
			const target =
				ratio === 1 || shuffled <= 0 || geometry.index !== null
					? count
					: Math.min(count, shuffled, Math.max(MIN_CLOUD_POINTS, Math.round(count * ratio)))

			if (geometry.drawRange.count !== target) {
				geometry.setDrawRange(0, target)
				changed = true
			}
		}

		// Nothing else marks the frame dirty when the camera comes to rest, so the restored
		// range would sit unrendered until the next interaction.
		if (changed) invalidate()
	}

	useTask(
		(delta) => {
			stillSeconds = cameraMoved() ? 0 : stillSeconds + delta

			const limit = budget()
			const decimating = limit > 0 && stillSeconds < SETTLE_SECONDS

			applyBudget(decimating ? limit : Number.POSITIVE_INFINITY)
		},
		{ autoInvalidate: false }
	)
}
