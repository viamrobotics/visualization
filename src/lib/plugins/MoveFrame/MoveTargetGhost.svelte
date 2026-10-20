<script lang="ts">
	import type { LineBasicMaterial } from 'three'

	import { T, useThrelte } from '@threlte/core'
	import { MeshLineGeometry, MeshLineMaterial } from '@threlte/extras'
	import { Group, Matrix4, Vector3 } from 'three'

	import { MOVE_GHOST_COLOR } from './moveGhostColor'

	interface Props {
		/** Where the frame is right now — world space, metres. */
		currentWorldMatrix: Matrix4
		/** Where the gizmo has staged it — world space, metres. */
		targetWorldMatrix: Matrix4
	}

	const { currentWorldMatrix, targetWorldMatrix }: Props = $props()

	const { invalidate } = useThrelte()

	const AXES_LENGTH = 0.08
	/** Below this the travel line degenerates, so only the triad is worth drawing. */
	const MIN_TRAVEL = 0.001

	// Both ends of the travel line, reused across drag frames. The array the
	// derived returns is what tells the geometry to rebuild — a mutated `Vector3`
	// on its own is `===` its old self, so nothing downstream would see it.
	const origin = new Vector3()
	const end = new Vector3()

	const points = $derived.by(() => {
		origin.setFromMatrixPosition(currentWorldMatrix)
		end.setFromMatrixPosition(targetWorldMatrix)
		return [origin, end]
	})

	/** Read through `points` so the distance can never go stale against it. */
	const travel = $derived(points[0].distanceTo(points[1]))

	/**
	 * The staged pose is a rigid world transform, so the triad takes the matrix
	 * whole — no decompose, and no position/quaternion arrays per drag frame.
	 */
	const anchor = new Group()
	anchor.matrixAutoUpdate = false

	$effect.pre(() => {
		anchor.matrix.copy(targetWorldMatrix)
		anchor.updateMatrixWorld()
		invalidate()
	})

	/** Draw the ghost through occluding geometry — the goal is usually behind something. */
	const seeThrough = (material: LineBasicMaterial) => {
		material.depthTest = false
		material.transparent = true
		material.opacity = 0.9
	}
</script>

{#if travel > MIN_TRAVEL}
	<!-- The path from where the frame is to where it has been staged. -->
	<T.Mesh
		raycast={() => null}
		bvh={{ enabled: false }}
		renderOrder={1}
	>
		<MeshLineGeometry {points} />
		<MeshLineMaterial
			width={2}
			color={MOVE_GHOST_COLOR}
			depthTest={false}
			attenuate={false}
			dashArray={0.05}
			dashRatio={0.4}
			transparent
		/>
	</T.Mesh>
{/if}

<!-- The staged pose. The triad reads the orientation the gizmo can't in world space. -->
<T is={anchor}>
	<T.AxesHelper
		args={[AXES_LENGTH]}
		raycast={() => null}
		bvh={{ enabled: false }}
		renderOrder={1}
		oncreate={(ref) => seeThrough(ref.material as LineBasicMaterial)}
	/>

	<T.Mesh
		raycast={() => null}
		bvh={{ enabled: false }}
		renderOrder={1}
	>
		<T.SphereGeometry args={[0.008]} />
		<T.MeshBasicMaterial
			color={MOVE_GHOST_COLOR}
			depthTest={false}
			transparent
			opacity={0.5}
		/>
	</T.Mesh>
</T>
