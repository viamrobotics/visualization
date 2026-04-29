<script lang="ts">
	import type { Pose } from '@viamrobotics/sdk'
	import type { Entity } from 'koota'
	import type { Snippet } from 'svelte'

	import { Matrix4 } from 'three'

	import { traits, useTrait } from '$lib/ecs'
	import { useEnvironment } from '$lib/hooks/useEnvironment.svelte'
	import { useFrameEditSession } from '$lib/hooks/useFrameEditSession.svelte'
	import { usePartConfig } from '$lib/hooks/usePartConfig.svelte'
	import { usePose } from '$lib/hooks/usePose.svelte'
	import { matrixToPose, poseToMatrix } from '$lib/transform'

	interface Props {
		entity: Entity
		children: Snippet<[{ pose: Pose | undefined }]>
	}
	let { entity, children }: Props = $props()

	const environment = useEnvironment()
	const partConfig = usePartConfig()
	const editSession = useFrameEditSession()
	const name = useTrait(() => entity, traits.Name)
	const parent = useTrait(() => entity, traits.Parent)
	const editedPose = useTrait(() => entity, traits.EditedPose)
	const entityPose = useTrait(() => entity, traits.Pose)
	const snapshot = useTrait(() => entity, traits.EditEntrySnapshot)

	const pose = usePose(
		() => name.current,
		() => parent.current
	)

	// On entering edit mode, freeze worldAtEntry × baseline⁻¹ as a Matrix4
	// trait. During the edit the renderer multiplies it by the live editedPose
	// to get the world transform — so child frames stay attached to their
	// (frozen) parent's last-known world pose even as the user drags. Cleared
	// once we're back in monitor mode AND the post-save catch-up has settled,
	// so live `getPose` data takes over again.
	$effect.pre(() => {
		const mode = environment.current.viewerMode
		const pendingSave = partConfig.hasPendingSave

		if (mode === 'edit') {
			if (entity.has(traits.EditEntrySnapshot)) return

			const baseline = entityPose.current
			if (!baseline) return

			const live = pose.current
			const matrix = new Matrix4()
			if (live) {
				matrix.copy(poseToMatrix(live)).multiply(poseToMatrix(baseline).invert())
			}
			// else: identity — no live pose was ever fetched, blend collapses
			// to bare editedPose, matching the prior fallback behavior.
			entity.add(traits.EditEntrySnapshot(matrix))
			return
		}

		if (!pendingSave && entity.has(traits.EditEntrySnapshot)) {
			entity.remove(traits.EditEntrySnapshot)
		}
	})

	const resolvedPose = $derived.by(() => {
		// Active session owns this entity → render editedPose directly. Avoids
		// the matrix roundtrip drift that fights the gizmo's per-frame
		// position/quaternion writes during a drag.
		if (editSession.current?.owns(entity)) return editedPose.current

		const snap = snapshot.current
		if (snap) {
			if (!editedPose.current) return undefined
			const result = new Matrix4().copy(snap).multiply(poseToMatrix(editedPose.current))
			return matrixToPose(result)
		}

		if (pose.current === undefined) return editedPose.current
		if (!entityPose.current || !editedPose.current) return undefined

		const poseNetwork = poseToMatrix(entityPose.current)
		const poseLive = poseToMatrix(pose.current)
		const poseEdited = poseToMatrix(editedPose.current)
		return matrixToPose(poseLive.multiply(poseNetwork.invert()).multiply(poseEdited))
	})
</script>

{@render children({ pose: resolvedPose })}
