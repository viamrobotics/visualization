<!--
@component

A selected saver's target. Saved `joints` draw the arm itself at them, the same twin a previewed plan
draws. A saved pose has no joints to draw, since many arm configurations reach it, so it draws only
the triad of where the end of the arm would be.
-->
<script lang="ts">
	import type { Entity } from 'koota'
	import type { LineBasicMaterial } from 'three'

	import { T, useThrelte } from '@threlte/core/webgpu'
	import { Group } from 'three'

	import { traits, useTrait, useWorld } from '$lib/ecs'
	import { useFrames } from '$lib/hooks/useFrames.svelte'
	import { buildFrameDescriptors } from '$lib/motion/frameDescriptors'
	import { frameSystemToPlanFrames } from '$lib/motion/frameSystemToPlanFrames'

	import { MOVE_GHOST_COLOR } from '../moveGhostColor'
	import { clearPreviewGhosts, createPreviewGhosts, spawnSavedPoseGhosts } from '../previewGhosts'

	interface Props {
		entity: Entity
	}

	const { entity }: Props = $props()

	/** Metres. Matches the triad `MoveTargetGhost` draws at a staged goal. */
	const AXES_LENGTH = 0.08
	const AXES_OPACITY = 0.9
	/** Metres. A dot at the origin, so the pose reads even where the axes are edge-on. */
	const ORIGIN_RADIUS = 0.008
	const ORIGIN_OPACITY = 0.5
	/** After the scene, so the marker draws over whatever stands in front of it. */
	const OVERLAY_RENDER_ORDER = 1

	const world = useWorld()
	const frames = useFrames()
	const { invalidate } = useThrelte()

	const saverName = useTrait(() => entity, traits.Name)
	const savedPose = useTrait(() => entity, traits.SavedPose)

	const ghosts = createPreviewGhosts()

	$effect(() => {
		const name = saverName.current
		const saved = savedPose.current
		if (name === undefined || saved?.joints === undefined) return

		const descriptors = buildFrameDescriptors(frameSystemToPlanFrames(frames.parts))
		spawnSavedPoseGhosts(world, descriptors, name, saved.arm, saved.joints, ghosts)

		return () => clearPreviewGhosts(ghosts)
	})

	const anchor = new Group()
	anchor.matrixAutoUpdate = false

	const pose = $derived(savedPose.current?.joints ? undefined : savedPose.current?.pose)

	$effect.pre(() => {
		if (!pose) return
		pose.toMatrix4(anchor.matrix)
		anchor.updateMatrixWorld()
		invalidate()
	})

	const seeThrough = (material: LineBasicMaterial) => {
		material.depthTest = false
		material.transparent = true
		material.opacity = AXES_OPACITY
	}
</script>

{#if pose}
	<T is={anchor}>
		<T.AxesHelper
			args={[AXES_LENGTH]}
			raycast={() => null}
			bvh={{ enabled: false }}
			renderOrder={OVERLAY_RENDER_ORDER}
			oncreate={(ref) => seeThrough(ref.material as LineBasicMaterial)}
		/>
		<T.Mesh
			raycast={() => null}
			bvh={{ enabled: false }}
			renderOrder={OVERLAY_RENDER_ORDER}
		>
			<T.SphereGeometry args={[ORIGIN_RADIUS]} />
			<T.MeshBasicMaterial
				color={MOVE_GHOST_COLOR}
				depthTest={false}
				transparent
				opacity={ORIGIN_OPACITY}
			/>
		</T.Mesh>
	</T>
{/if}
